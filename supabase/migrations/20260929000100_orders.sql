-- Stage 04 · public orders. Prices, rules and availability are decided here,
-- never in the browser. Anonymous visitors only execute quote_order,
-- create_order, get_order_public and get_public_settings.

alter table public.orders
  add column customer_tax_id text check (customer_tax_id ~ '^(\d{11}|\d{14})$');

alter table public.order_items
  add column position integer not null default 0;

-- CPF (11) or CNPJ (14) digits with valid check digits.
create function public.is_valid_tax_id(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d integer[];
  w integer[];
  s integer;
  r integer;
begin
  if p_value is null or p_value !~ '^\d+$' then
    return false;
  end if;
  d := array(select substring(p_value from g for 1)::integer from generate_series(1, length(p_value)) g);

  if length(p_value) = 11 then
    if p_value ~ '^(\d)\1{10}$' then return false; end if;
    s := 0;
    for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if;
    if r <> d[10] then return false; end if;
    s := 0;
    for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if;
    return r = d[11];
  end if;

  if length(p_value) = 14 then
    if p_value ~ '^(\d)\1{13}$' then return false; end if;
    w := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    s := 0;
    for i in 1..12 loop s := s + d[i] * w[i]; end loop;
    r := s % 11; r := case when r < 2 then 0 else 11 - r end;
    if r <> d[13] then return false; end if;
    w := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    s := 0;
    for i in 1..13 loop s := s + d[i] * w[i]; end loop;
    r := s % 11; r := case when r < 2 then 0 else 11 - r end;
    return r = d[14];
  end if;

  return false;
end;
$$;

-- Open if open <= local time < close on that weekday (America/Campo_Grande).
create function public.store_open_at(p_store_id uuid, p_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  with local_time as (
    select p_at at time zone 'America/Campo_Grande' as ts
  ),
  day as (
    select (array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])[extract(isodow from ts)::integer] as key,
           ts::time as t
    from local_time
  )
  select coalesce((
    select (s.hours -> d.key ->> 'open')::time <= d.t
       and d.t < (s.hours -> d.key ->> 'close')::time
    from public.stores s, day d
    where s.id = p_store_id
      and jsonb_typeof(s.hours -> d.key) = 'object'
  ), false);
$$;

-- Internal: evaluates each requested line against the catalog and the store.
-- p_items: [{ product_id, qty, weight_kg?, format?, addon_ids?, message? }]
-- Returns one object per line with price, options and `problem`
-- (null | 'esgotado' | 'indisponivel' | 'invalido') plus a PT-BR `problem_text`.
create function public.evaluate_order_lines(p_store_id uuid, p_items jsonb)
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
      'lead_time_hours', case when v_product.type = 'vitrine' then 0 else coalesce(v_product.lead_time_hours, 0) end,
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
create function public.quote_order(p_store_id uuid, p_items jsonb)
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

  select max((l ->> 'lead_time_hours')::integer) filter (where l ->> 'type' <> 'vitrine')
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

-- Returns stock reserved by expired orders. Safe to run repeatedly and
-- concurrently: rows are claimed with FOR UPDATE SKIP LOCKED.
create function public.expire_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_item record;
  v_after integer;
  v_count integer := 0;
begin
  for v_order in
    select id, code, store_id
    from public.orders
    where status = 'novo' and expires_at <= now()
    order by created_at
    for update skip locked
  loop
    update public.orders set status = 'expirado' where id = v_order.id;

    for v_item in
      select product_id, sum(qty)::integer as qty
      from public.order_items
      where order_id = v_order.id and type = 'vitrine' and product_id is not null
      group by product_id
      order by product_id
    loop
      update public.stock
      set quantity = quantity + v_item.qty
      where product_id = v_item.product_id and store_id = v_order.store_id
      returning quantity into v_after;

      if found then
        insert into public.stock_movements
          (product_id, store_id, delta, reason, order_id, quantity_after, actor_name)
        values
          (v_item.product_id, v_order.store_id, v_item.qty, 'devolucao', v_order.id, v_after,
           'Expiração ' || v_order.code);
      end if;
    end loop;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Creates an order, reserving vitrine stock atomically.
-- p_customer: { name, whatsapp, fulfillment, delivery_address?, notes?, tax_id?, scheduled_for? }
create function public.create_order(p_store_id uuid, p_customer jsonb, p_items jsonb)
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
  select max((l ->> 'lead_time_hours')::integer) filter (where l ->> 'type' <> 'vitrine')
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
    (order_id, product_id, name_snapshot, type, qty, unit_price_cents, total_cents, options, position)
  select v_order.id,
         (l ->> 'product_id')::uuid,
         l ->> 'name',
         (l ->> 'type')::public.product_type,
         (l ->> 'qty')::integer,
         (l ->> 'unit_price_cents')::integer,
         (l ->> 'total_cents')::integer,
         l -> 'options',
         (l ->> 'index')::integer
  from jsonb_array_elements(v_lines) l;

  insert into public.stock_movements
    (product_id, store_id, delta, reason, order_id, quantity_after, actor_name)
  select (r ->> 'product_id')::uuid, p_store_id, -(r ->> 'qty')::integer, 'reserva', v_order.id,
         (r ->> 'after')::integer, 'Pedido ' || v_order.code
  from jsonb_array_elements(v_reserved) r;

  return jsonb_build_object('code', v_order.code, 'token', v_order.public_token);
end;
$$;

-- Order summary for the customer holding the link. Never exposes the tax id.
create function public.get_order_public(p_code text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_store public.stores;
begin
  perform public.expire_orders();

  select * into v_order from public.orders where code = p_code and public_token = p_token;
  if v_order.id is null then
    return null;
  end if;
  select * into v_store from public.stores where id = v_order.store_id;

  return jsonb_build_object(
    'code', v_order.code,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'expires_at', v_order.expires_at,
    'fulfillment', v_order.fulfillment,
    'delivery_address', v_order.delivery_address,
    'scheduled_for', v_order.scheduled_for,
    'customer_name', v_order.customer_name,
    'customer_whatsapp', v_order.customer_whatsapp,
    'notes', v_order.notes,
    'subtotal_cents', v_order.subtotal_cents,
    'has_made_to_order', v_order.has_made_to_order,
    'store', jsonb_build_object('name', v_store.name, 'address', v_store.address, 'whatsapp', v_store.whatsapp),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', i.name_snapshot, 'type', i.type, 'qty', i.qty,
               'unit_price_cents', i.unit_price_cents, 'total_cents', i.total_cents, 'options', i.options)
             order by i.position), '[]'::jsonb)
      from public.order_items i where i.order_id = v_order.id
    )
  );
end;
$$;

-- Non-sensitive settings the public site needs.
create function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reservation_minutes', reservation_minutes,
    'order_whatsapp_template', order_whatsapp_template,
    'privacy_text', privacy_text
  )
  from public.settings where id = 1;
$$;

-- grants ------------------------------------------------------------------------

revoke execute on function public.is_valid_tax_id(text) from public, anon, authenticated;
revoke execute on function public.store_open_at(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.evaluate_order_lines(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.expire_orders() from public, anon, authenticated;
revoke execute on function public.quote_order(uuid, jsonb) from public;
revoke execute on function public.create_order(uuid, jsonb, jsonb) from public;
revoke execute on function public.get_order_public(text, text) from public;
revoke execute on function public.get_public_settings() from public;

grant execute on function public.quote_order(uuid, jsonb) to anon, authenticated;
grant execute on function public.create_order(uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.get_order_public(text, text) to anon, authenticated;
grant execute on function public.get_public_settings() to anon, authenticated;
grant execute on function public.expire_orders() to service_role;
