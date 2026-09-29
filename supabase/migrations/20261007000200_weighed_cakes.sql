-- Stage 10 · whole cakes sold by weight in the showcase (AD-018).
-- Each physical cake is a piece with its own weight. Pieces change only through
-- the functions below and the order trigger; every change writes a
-- stock_movements row. The public site reads available pieces through a view.

create table public.showcase_pieces (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  weight_g integer not null check (weight_g between 300 and 10000),
  status public.piece_status not null default 'disponivel',
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Reserved pieces belong to an order; available and discarded ones never do.
  -- Sold pieces keep the order (online) or have none (counter sale).
  check (status = 'vendido' or (status = 'reservado') = (order_id is not null))
);

create index showcase_pieces_available_idx
  on public.showcase_pieces (store_id, product_id) where status = 'disponivel';
create index showcase_pieces_order_idx
  on public.showcase_pieces (order_id) where order_id is not null;

create trigger set_updated_at before update on public.showcase_pieces
  for each row execute function public.set_updated_at();

alter table public.order_items
  add column piece_id uuid references public.showcase_pieces (id) on delete set null;

alter table public.stock_movements
  add column piece_id uuid references public.showcase_pieces (id) on delete set null,
  add column weight_g integer;
alter table public.stock_movements drop constraint stock_movements_delta_check;
alter table public.stock_movements
  add constraint stock_movements_delta_check check (delta <> 0 or reason = 'correcao_peso');

-- RLS: staff reads (admin all, attendant own store); no write policies.
alter table public.showcase_pieces enable row level security;
create policy "staff reads pieces" on public.showcase_pieces
  for select to authenticated
  using ((select public.is_admin()) or store_id = (select public.staff_store()));

grant select on public.showcase_pieces to authenticated;
grant all on public.showcase_pieces to service_role;

-- Public availability (owner's rights, like product_availability): only
-- available pieces of visible products sold in that store. No price here;
-- the site computes it for display and the database recomputes it.
create view public.piece_availability
with (security_invoker = false) as
select c.id, c.product_id, c.store_id, c.weight_g, c.created_at
from public.showcase_pieces c
join public.products p on p.id = c.product_id
where c.status = 'disponivel'
  and p.active
  and not p.price_pending
  and p.type = 'vitrine_kg'
  and (cardinality(p.store_ids) = 0 or c.store_id = any(p.store_ids));

revoke all on public.piece_availability from anon, authenticated;
grant select on public.piece_availability to anon, authenticated, service_role;

-- panel functions ---------------------------------------------------------------

create function public.staff_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select name from public.staff where user_id = auth.uid();
$$;

-- Internal: writes the movement of a piece. quantity_after = available pieces
-- of that product in that store after the change.
create function public.piece_log(
  p_piece public.showcase_pieces,
  p_reason public.stock_reason,
  p_delta integer,
  p_order_id uuid,
  p_actor text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stock_movements
    (product_id, store_id, delta, reason, order_id, user_id, quantity_after, actor_name, piece_id, weight_g)
  values (
    p_piece.product_id, p_piece.store_id, p_delta, p_reason, p_order_id, auth.uid(),
    (select count(*) from public.showcase_pieces
     where product_id = p_piece.product_id and store_id = p_piece.store_id and status = 'disponivel'),
    p_actor, p_piece.id, p_piece.weight_g
  );
end;
$$;

-- Internal: locks an available piece the caller may manage.
create function public.piece_lock(p_piece_id uuid)
returns public.showcase_pieces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_piece public.showcase_pieces;
begin
  select * into v_piece from public.showcase_pieces where id = p_piece_id for update;
  if v_piece.id is null then
    raise exception 'piece not found' using errcode = 'CK030';
  end if;
  if not public.can_manage_store(v_piece.store_id) then
    raise exception 'not allowed to manage stock of this store' using errcode = '42501';
  end if;
  if v_piece.status <> 'disponivel' then
    raise exception 'piece is not available' using errcode = 'CK030';
  end if;
  return v_piece;
end;
$$;

create function public.check_piece_weight(p_weight_g integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_weight_g is null or p_weight_g not between 300 and 10000 then
    raise exception 'weight must be between 300 g and 10000 g' using errcode = 'CK031';
  end if;
end;
$$;

-- "Adicionar bolo": a new available piece weighed at the store.
create function public.add_piece(p_product_id uuid, p_store_id uuid, p_weight_g integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_piece public.showcase_pieces;
begin
  if not public.can_manage_store(p_store_id) then
    raise exception 'not allowed to manage stock of this store' using errcode = '42501';
  end if;
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'store not found' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and type = 'vitrine_kg') then
    raise exception 'product is not a weighed cake' using errcode = 'CK004';
  end if;
  perform public.check_piece_weight(p_weight_g);

  insert into public.showcase_pieces (product_id, store_id, weight_g)
  values (p_product_id, p_store_id, p_weight_g)
  returning * into v_piece;

  perform public.piece_log(v_piece, 'ajuste', 1, null, public.staff_name());
  return v_piece.id;
end;
$$;

-- "Vendida no balcão".
create function public.sell_piece(p_piece_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_piece public.showcase_pieces := public.piece_lock(p_piece_id);
begin
  update public.showcase_pieces set status = 'vendido' where id = v_piece.id;
  perform public.piece_log(v_piece, 'venda', -1, null, public.staff_name());
end;
$$;

-- "Descartar".
create function public.discard_piece(p_piece_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_piece public.showcase_pieces := public.piece_lock(p_piece_id);
begin
  update public.showcase_pieces set status = 'descartado' where id = v_piece.id;
  perform public.piece_log(v_piece, 'descarte', -1, null, public.staff_name());
end;
$$;

-- "Corrigir peso" (typing mistake). Only available pieces.
create function public.set_piece_weight(p_piece_id uuid, p_weight_g integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_piece public.showcase_pieces := public.piece_lock(p_piece_id);
begin
  perform public.check_piece_weight(p_weight_g);
  if p_weight_g = v_piece.weight_g then
    return;
  end if;
  update public.showcase_pieces set weight_g = p_weight_g where id = v_piece.id
  returning * into v_piece;
  perform public.piece_log(v_piece, 'correcao_peso', 0, null, public.staff_name());
end;
$$;

-- orders ------------------------------------------------------------------------
-- Same functions as stage 04 (20260929000100_orders.sql), changed only where
-- marked "stage 10".

-- Internal: evaluates each requested line against the catalog and the store.
-- p_items: [{ product_id, qty, weight_kg?, format?, addon_ids?, message?, piece_id? }]
-- Returns one object per line with price, options and `problem`
-- (null | 'esgotado' | 'indisponivel' | 'invalido') plus a PT-BR `problem_text`.
create or replace function public.evaluate_order_lines(p_store_id uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_index integer := 0;
  v_product public.products;
  v_qty integer;
  v_weight numeric;
  v_format text;
  v_message text;
  v_addons jsonb;
  v_addon_total integer;
  v_unit integer;
  v_total integer;
  v_options jsonb;
  v_problem text;
  v_problem_text text;
  v_lines jsonb := '[]'::jsonb;
  v_demand jsonb := '{}'::jsonb;
  v_line jsonb;
  v_available integer;
  v_result jsonb := '[]'::jsonb;
  -- stage 10
  v_piece public.showcase_pieces;
  v_seen_pieces jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'items must be an array' using errcode = 'CK011', detail = 'items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_index := v_index + 1;
    v_problem := null;
    v_problem_text := null;
    v_options := '{}'::jsonb;
    v_unit := 0;
    v_total := 0;
    v_product := null;
    v_piece := null;

    if coalesce(v_item ->> 'product_id', '') ~ '^[0-9a-f-]{36}$' then
      select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;
    end if;
    v_qty := case when coalesce(v_item ->> 'qty', '') ~ '^\d{1,5}$' then (v_item ->> 'qty')::integer end;

    if v_product.id is null
       or not v_product.active
       or v_product.price_pending
       or (cardinality(v_product.store_ids) > 0 and not p_store_id = any(v_product.store_ids)) then
      v_problem := 'indisponivel';
      v_problem_text := 'Indisponível nesta loja';
    elsif v_product.type = 'vitrine' then
      if v_qty is null or v_qty not between 1 and 10 then
        v_problem := 'invalido'; v_problem_text := 'Quantidade entre 1 e 10';
      else
        v_unit := v_product.price_cents;
        v_total := v_unit * v_qty;
        v_demand := jsonb_set(v_demand, array[v_product.id::text],
          to_jsonb(coalesce((v_demand ->> v_product.id::text)::integer, 0) + v_qty));
      end if;
    elsif v_product.type = 'vitrine_kg' then
      -- stage 10: one weighed piece per line, priced by its weight.
      if coalesce(v_item ->> 'piece_id', '') ~ '^[0-9a-f-]{36}$' then
        select * into v_piece from public.showcase_pieces
        where id = (v_item ->> 'piece_id')::uuid and product_id = v_product.id and store_id = p_store_id;
      end if;

      if v_piece.id is null then
        v_problem := 'indisponivel'; v_problem_text := 'Indisponível nesta loja';
      elsif v_qty is distinct from 1 or v_seen_pieces ? v_piece.id::text then
        v_problem := 'invalido'; v_problem_text := 'Este bolo já está no pedido';
      elsif v_piece.status <> 'disponivel' then
        v_problem := 'esgotado'; v_problem_text := 'Esse bolo acabou de ser reservado, escolha outro peso';
      else
        v_unit := round(v_product.price_cents * v_piece.weight_g / 1000.0)::integer;
        v_total := v_unit;
        v_options := jsonb_build_object('piece_id', v_piece.id, 'weight_g', v_piece.weight_g);
      end if;
      if v_piece.id is not null then
        v_seen_pieces := v_seen_pieces || to_jsonb(v_piece.id::text);
      end if;
    elsif v_product.type = 'bolo_kg' then
      v_weight := case when coalesce(v_item ->> 'weight_kg', '') ~ '^\d{1,2}(\.\d)?$' then (v_item ->> 'weight_kg')::numeric end;
      v_format := v_item ->> 'format';
      v_message := left(btrim(coalesce(v_item ->> 'message', '')), 61);

      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price_cents', a.price_cents) order by a.sort), '[]'::jsonb),
             coalesce(sum(a.price_cents), 0)
        into v_addons, v_addon_total
      from public.addons a
      join public.product_addons pa on pa.addon_id = a.id and pa.product_id = v_product.id
      where a.active
        and a.id::text in (select jsonb_array_elements_text(coalesce(v_item -> 'addon_ids', '[]'::jsonb)));

      if v_qty is null or v_qty not between 1 and 5 then
        v_problem := 'invalido'; v_problem_text := 'Quantidade entre 1 e 5';
      elsif v_weight is null or not v_weight = any(v_product.weights_kg) then
        v_problem := 'invalido'; v_problem_text := 'Peso não oferecido';
      elsif v_format is null or not v_format = any(v_product.formats) then
        v_problem := 'invalido'; v_problem_text := 'Formato não oferecido';
      elsif jsonb_array_length(v_addons) <> jsonb_array_length(coalesce(v_item -> 'addon_ids', '[]'::jsonb)) then
        v_problem := 'invalido'; v_problem_text := 'Adicional não disponível para este bolo';
      elsif length(v_message) > 60 then
        v_problem := 'invalido'; v_problem_text := 'Frase com mais de 60 caracteres';
      else
        v_unit := round(v_product.price_cents * v_weight)::integer + v_addon_total;
        v_total := v_unit * v_qty;
        v_options := jsonb_build_object('weight_kg', v_weight, 'format', v_format, 'addons', v_addons,
                                        'message', nullif(v_message, ''));
      end if;
    elsif v_product.type = 'cento' then
      if v_qty is null or v_qty < v_product.min_qty or v_qty > 2000
         or (v_qty - v_product.min_qty) % v_product.step_qty <> 0 then
        v_problem := 'invalido';
        v_problem_text := format('A partir de %s, de %s em %s', v_product.min_qty, v_product.step_qty, v_product.step_qty);
      else
        v_unit := v_product.price_cents;
        v_total := round(v_product.price_cents * v_qty / 100.0)::integer;
      end if;
    else -- kit
      if v_qty is null or v_qty not between 1 and 20 then
        v_problem := 'invalido'; v_problem_text := 'Quantidade entre 1 e 20';
      else
        v_unit := v_product.price_cents;
        v_total := v_unit * v_qty;
        v_options := jsonb_build_object('kit_contents', v_product.kit_contents);
      end if;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'index', v_index,
      'product_id', v_product.id,
      'name', coalesce(v_product.name, 'Produto indisponível'),
      'type', v_product.type,
      'qty', coalesce(v_qty, 0),
      'unit_price_cents', v_unit,
      'total_cents', v_total,
      'options', v_options,
      'lead_time_hours', case when v_product.type in ('vitrine', 'vitrine_kg') then 0 -- stage 10
                              else coalesce(v_product.lead_time_hours, 0) end,
      'piece_id', v_piece.id,
      'problem', v_problem,
      'problem_text', v_problem_text
    );
  end loop;

  -- Second pass: vitrine demand per product against the store's stock.
  for v_line in select value from jsonb_array_elements(v_lines) loop
    if v_line ->> 'problem' is null and v_line ->> 'type' = 'vitrine' then
      select quantity into v_available
      from public.stock
      where product_id = (v_line ->> 'product_id')::uuid and store_id = p_store_id;

      if (v_demand ->> (v_line ->> 'product_id'))::integer > 10 then
        v_line := v_line || '{"problem": "invalido", "problem_text": "Máximo de 10 por item"}'::jsonb;
      elsif coalesce(v_available, 0) < (v_demand ->> (v_line ->> 'product_id'))::integer then
        v_line := v_line || jsonb_build_object(
          'problem', 'esgotado',
          'problem_text', case when coalesce(v_available, 0) = 0 then 'Acabou nesta loja'
                               else format('Só temos %s nesta loja', least(v_available, 10)) end);
      end if;
    end if;
    v_result := v_result || v_line;
  end loop;

  return v_result;
end;
$$;

-- Public, read-only quote used by the cart and checkout.
create or replace function public.quote_order(p_store_id uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lines jsonb;
  v_store_active boolean;
  v_max_lead integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 30 then
    raise exception 'too many lines' using errcode = 'CK011', detail = 'items';
  end if;

  select active into v_store_active from public.stores where id = p_store_id;
  v_lines := public.evaluate_order_lines(p_store_id, p_items);

  select max((l ->> 'lead_time_hours')::integer) filter (where l ->> 'type' not in ('vitrine', 'vitrine_kg')) -- stage 10
    into v_max_lead
  from jsonb_array_elements(v_lines) l;

  return jsonb_build_object(
    'store_available', coalesce(v_store_active, false),
    'lines', v_lines,
    'subtotal_cents', (select coalesce(sum((l ->> 'total_cents')::integer), 0)
                       from jsonb_array_elements(v_lines) l where l ->> 'problem' is null),
    'has_made_to_order', v_max_lead is not null,
    'earliest_schedule', case when v_max_lead is not null then now() + make_interval(hours => v_max_lead) end,
    'reservation_minutes', (select reservation_minutes from public.settings where id = 1)
  );
end;
$$;

-- Creates an order, reserving vitrine stock atomically.
-- p_customer: { name, whatsapp, fulfillment, delivery_address?, notes?, tax_id?, scheduled_for? }
create or replace function public.create_order(p_store_id uuid, p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_whatsapp text;
  v_fulfillment public.fulfillment;
  v_address text;
  v_notes text;
  v_tax_id text;
  v_scheduled timestamptz;
  v_lines jsonb;
  v_bad jsonb;
  v_max_lead integer;
  v_reserved jsonb := '[]'::jsonb;
  v_out jsonb := '[]'::jsonb;
  v_row record;
  v_after integer;
  v_order public.orders;
  v_piece public.showcase_pieces; -- stage 10
begin
  perform public.expire_orders();

  if not exists (select 1 from public.stores where id = p_store_id and active) then
    raise exception 'store unavailable' using errcode = 'CK014';
  end if;

  -- customer --------------------------------------------------------------
  v_name := left(btrim(coalesce(p_customer ->> 'name', '')), 80);
  if v_name = '' then
    raise exception 'name is required' using errcode = 'CK011', detail = 'name';
  end if;

  v_whatsapp := regexp_replace(coalesce(p_customer ->> 'whatsapp', ''), '\D', '', 'g');
  if length(v_whatsapp) in (10, 11) then v_whatsapp := '55' || v_whatsapp; end if;
  if v_whatsapp !~ '^55\d{10,11}$' then
    raise exception 'invalid whatsapp' using errcode = 'CK011', detail = 'whatsapp';
  end if;

  if coalesce(p_customer ->> 'fulfillment', '') not in ('retirada', 'entrega') then
    raise exception 'invalid fulfillment' using errcode = 'CK011', detail = 'fulfillment';
  end if;
  v_fulfillment := (p_customer ->> 'fulfillment')::public.fulfillment;
  v_address := case when v_fulfillment = 'entrega'
                    then nullif(left(btrim(coalesce(p_customer ->> 'delivery_address', '')), 200), '') end;
  v_notes := nullif(left(btrim(coalesce(p_customer ->> 'notes', '')), 500), '');

  v_tax_id := nullif(regexp_replace(coalesce(p_customer ->> 'tax_id', ''), '\D', '', 'g'), '');
  if v_tax_id is not null and not public.is_valid_tax_id(v_tax_id) then
    raise exception 'invalid tax id' using errcode = 'CK011', detail = 'tax_id';
  end if;

  -- anti-abuse (AD-009) ----------------------------------------------------
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'between 1 and 30 lines' using errcode = 'CK011', detail = 'items';
  end if;
  if (select count(*) from public.orders where customer_whatsapp = v_whatsapp and status = 'novo') >= 2 then
    raise exception 'too many open orders' using errcode = 'CK012';
  end if;

  -- lines -------------------------------------------------------------------
  v_lines := public.evaluate_order_lines(p_store_id, p_items);

  select coalesce(jsonb_agg(l ->> 'product_id') filter (where l ->> 'problem' = 'esgotado'), '[]'::jsonb)
    into v_bad from jsonb_array_elements(v_lines) l;
  if jsonb_array_length(v_bad) > 0 then
    raise exception 'out of stock' using errcode = 'CK010', detail = v_bad::text;
  end if;
  select coalesce(jsonb_agg(l ->> 'product_id') filter (where l ->> 'problem' is not null), '[]'::jsonb)
    into v_bad from jsonb_array_elements(v_lines) l;
  if jsonb_array_length(v_bad) > 0 then
    raise exception 'unavailable or invalid lines' using errcode = 'CK015', detail = v_bad::text;
  end if;

  -- schedule ----------------------------------------------------------------
  select max((l ->> 'lead_time_hours')::integer) filter (where l ->> 'type' not in ('vitrine', 'vitrine_kg')) -- stage 10
    into v_max_lead from jsonb_array_elements(v_lines) l;

  if v_max_lead is not null then
    begin
      v_scheduled := (p_customer ->> 'scheduled_for')::timestamptz;
    exception when others then
      v_scheduled := null;
    end;
    if v_scheduled is null
       or v_scheduled < now() + make_interval(hours => v_max_lead)
       or not public.store_open_at(p_store_id, v_scheduled) then
      raise exception 'invalid schedule' using errcode = 'CK013';
    end if;
  end if;

  -- reserve vitrine stock (row locks; product order avoids deadlocks) ---------
  for v_row in
    select (l ->> 'product_id')::uuid as product_id, sum((l ->> 'qty')::integer)::integer as qty
    from jsonb_array_elements(v_lines) l
    where l ->> 'type' = 'vitrine'
    group by 1
    order by 1
  loop
    update public.stock
    set quantity = quantity - v_row.qty
    where product_id = v_row.product_id and store_id = p_store_id and quantity >= v_row.qty
    returning quantity into v_after;

    if found then
      v_reserved := v_reserved || jsonb_build_object('product_id', v_row.product_id, 'qty', v_row.qty, 'after', v_after);
    else
      v_out := v_out || to_jsonb(v_row.product_id::text);
    end if;
  end loop;

  if jsonb_array_length(v_out) > 0 then
    -- Raising rolls back the reservations already made in this call.
    raise exception 'out of stock' using errcode = 'CK010', detail = v_out::text;
  end if;

  -- persist -------------------------------------------------------------------
  insert into public.orders (
    store_id, status, expires_at, customer_name, customer_whatsapp, customer_tax_id, notes,
    fulfillment, delivery_address, scheduled_for, subtotal_cents, has_made_to_order
  )
  values (
    p_store_id, 'novo',
    now() + make_interval(mins => (select reservation_minutes from public.settings where id = 1)),
    v_name, v_whatsapp, v_tax_id, v_notes, v_fulfillment, v_address, v_scheduled,
    (select sum((l ->> 'total_cents')::integer) from jsonb_array_elements(v_lines) l),
    v_max_lead is not null
  )
  returning * into v_order;

  insert into public.order_items
    (order_id, product_id, name_snapshot, type, qty, unit_price_cents, total_cents, options, position, piece_id)
  select v_order.id,
         (l ->> 'product_id')::uuid,
         l ->> 'name',
         (l ->> 'type')::public.product_type,
         (l ->> 'qty')::integer,
         (l ->> 'unit_price_cents')::integer,
         (l ->> 'total_cents')::integer,
         l -> 'options',
         (l ->> 'index')::integer,
         (l ->> 'piece_id')::uuid
  from jsonb_array_elements(v_lines) l;

  -- stage 10: reserve the weighed pieces (id order avoids deadlocks). The
  -- status check in the UPDATE settles races: only one order gets a piece.
  for v_row in
    select (l ->> 'piece_id')::uuid as piece_id, l ->> 'product_id' as product_id
    from jsonb_array_elements(v_lines) l
    where l ->> 'type' = 'vitrine_kg'
    order by 1
  loop
    update public.showcase_pieces
    set status = 'reservado', order_id = v_order.id
    where id = v_row.piece_id and store_id = p_store_id and status = 'disponivel'
    returning * into v_piece;

    if found then
      perform public.piece_log(v_piece, 'reserva', -1, v_order.id, 'Pedido ' || v_order.code);
    else
      v_out := v_out || to_jsonb(v_row.product_id);
    end if;
  end loop;

  if jsonb_array_length(v_out) > 0 then
    raise exception 'out of stock' using errcode = 'CK010', detail = v_out::text;
  end if;

  insert into public.stock_movements
    (product_id, store_id, delta, reason, order_id, quantity_after, actor_name)
  select (r ->> 'product_id')::uuid, p_store_id, -(r ->> 'qty')::integer, 'reserva', v_order.id,
         (r ->> 'after')::integer, 'Pedido ' || v_order.code
  from jsonb_array_elements(v_reserved) r;

  return jsonb_build_object('code', v_order.code, 'token', v_order.public_token);
end;
$$;

-- Follows the order status: expiring or cancelling returns the pieces,
-- reactivating reserves them again (or fails the reactivation with CK010),
-- delivering marks them sold. Runs in the same transaction as the change.
create function public.sync_order_pieces()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_piece public.showcase_pieces;
  v_actor text;
  v_out jsonb := '[]'::jsonb;
begin
  -- Same actor names as the stock counter: expiration is always the system.
  v_actor := case when new.status = 'expirado' then 'Expiração ' || new.code
                  else coalesce(public.staff_name(), 'Sistema') end;

  if new.status in ('expirado', 'cancelado') then
    for v_piece in
      update public.showcase_pieces
      set status = 'disponivel', order_id = null
      where order_id = new.id and status = 'reservado'
      returning *
    loop
      perform public.piece_log(v_piece, 'devolucao', 1, new.id, v_actor);
    end loop;

  elsif old.status = 'expirado' and new.status = 'confirmado' then
    for v_piece in
      select c.* from public.showcase_pieces c
      join public.order_items i on i.piece_id = c.id
      where i.order_id = new.id
      order by c.id
      for update of c
    loop
      if v_piece.status <> 'disponivel' then
        v_out := v_out || to_jsonb(v_piece.product_id::text);
        continue;
      end if;
      update public.showcase_pieces set status = 'reservado', order_id = new.id
      where id = v_piece.id
      returning * into v_piece;
      perform public.piece_log(v_piece, 'venda', -1, new.id, v_actor);
    end loop;
    if jsonb_array_length(v_out) > 0 then
      raise exception 'out of stock' using errcode = 'CK010', detail = v_out::text;
    end if;

  elsif new.status = 'entregue' then
    update public.showcase_pieces set status = 'vendido'
    where order_id = new.id and status = 'reservado';
  end if;

  return null;
end;
$$;

create trigger sync_order_pieces
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.sync_order_pieces();

-- grants ------------------------------------------------------------------------

revoke execute on function public.staff_name() from public, anon, authenticated;
revoke execute on function public.piece_log(public.showcase_pieces, public.stock_reason, integer, uuid, text) from public, anon, authenticated;
revoke execute on function public.piece_lock(uuid) from public, anon, authenticated;
revoke execute on function public.check_piece_weight(integer) from public, anon, authenticated;
revoke execute on function public.sync_order_pieces() from public, anon, authenticated;
revoke execute on function public.add_piece(uuid, uuid, integer) from public, anon;
revoke execute on function public.sell_piece(uuid) from public, anon;
revoke execute on function public.discard_piece(uuid) from public, anon;
revoke execute on function public.set_piece_weight(uuid, integer) from public, anon;
grant execute on function public.add_piece(uuid, uuid, integer) to authenticated;
grant execute on function public.sell_piece(uuid) to authenticated;
grant execute on function public.discard_piece(uuid) to authenticated;
grant execute on function public.set_piece_weight(uuid, integer) to authenticated;
