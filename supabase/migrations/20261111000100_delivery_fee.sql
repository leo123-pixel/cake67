-- Stage 11 · delivery fee calculated on the site by Juma (Machine API,
-- Entregas v2). The server asks Juma, stores the answer in delivery_quotes
-- (service role only) and create_order reads the fee from there by id,
-- checking store, address and age. The browser never sends a fee.
--
-- get_order_public and report_summary are left untouched on purpose: the
-- online payment migrations (20261021*) already replaced them in the project.

-- stores: origin of the delivery and the Juma category ------------------------

alter table public.stores
  add column address_street text check (char_length(address_street) <= 120),
  add column address_number text check (char_length(address_number) <= 20),
  add column address_district text check (char_length(address_district) <= 80),
  add column delivery_category_id text check (delivery_category_id ~ '^[0-9]{1,12}$'),
  add column delivery_category_name text check (char_length(delivery_category_name) <= 80);

-- quotes ------------------------------------------------------------------------

create type public.delivery_quote_status as enum ('ok', 'falhou');

create table public.delivery_quotes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  -- street|number|district normalized by the server, to reuse a recent quote.
  address_key text not null check (char_length(address_key) <= 250),
  street text not null check (char_length(street) <= 120),
  number text not null check (char_length(number) <= 20),
  district text not null check (char_length(district) <= 80),
  status public.delivery_quote_status not null,
  fee_cents integer check (fee_cents between 1 and 30000),
  km numeric(8, 2),
  minutes integer,
  category_id text,
  -- Technical reason from Juma, for the log. Never shown to customers.
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  constraint delivery_quote_fee check ((status = 'ok') = (fee_cents is not null))
);

create index delivery_quotes_lookup_idx on public.delivery_quotes (store_id, address_key, created_at desc);
create index delivery_quotes_recent_idx on public.delivery_quotes (store_id, created_at desc);

-- No policy: only the service role (server) reads and writes quotes.
alter table public.delivery_quotes enable row level security;
grant all on public.delivery_quotes to service_role;

-- orders --------------------------------------------------------------------------

alter table public.orders
  add column delivery_street text check (char_length(delivery_street) <= 120),
  add column delivery_number text check (char_length(delivery_number) <= 20),
  add column delivery_complement text check (char_length(delivery_complement) <= 60),
  add column delivery_district text check (char_length(delivery_district) <= 80),
  add column delivery_reference text check (char_length(delivery_reference) <= 120),
  -- null = to be agreed on WhatsApp (or pickup).
  add column delivery_fee_cents integer check (delivery_fee_cents between 0 and 30000),
  add column delivery_quote_id uuid references public.delivery_quotes (id) on delete set null,
  add column total_cents integer generated always as (subtotal_cents + coalesce(delivery_fee_cents, 0)) stored,
  add constraint delivery_fee_only_for_delivery check (delivery_fee_cents is null or fulfillment = 'entrega');

-- helpers ---------------------------------------------------------------------------

-- Same rule on both sides of the quote check: case and spacing do not matter.
create function public.delivery_address_key(p_street text, p_number text, p_district text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_street, '')), '\s+', ' ', 'g'))
    || '|' || lower(regexp_replace(btrim(coalesce(p_number, '')), '\s+', ' ', 'g'))
    || '|' || lower(regexp_replace(btrim(coalesce(p_district, '')), '\s+', ' ', 'g'));
$$;

-- "Rua X, 123, apto 4 · Bairro Y · ref.: perto da praça"
create function public.format_delivery_address(
  p_street text, p_number text, p_complement text, p_district text, p_reference text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(' · ',
    concat_ws(', ', p_street, p_number, nullif(p_complement, '')),
    p_district,
    'ref.: ' || nullif(p_reference, ''));
$$;

-- create_order (from stage 10; adds the address fields and the fee) -----------------

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
  -- stage 11: delivery address in fields and the fee from a server quote
  v_street text;
  v_number text;
  v_complement text;
  v_district text;
  v_reference text;
  v_quote_id uuid;
  v_fee integer;
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

  -- stage 11 · address in fields. Without any field (the site before this
  -- stage, during the deploy) the free-text address is kept, as before.
  if v_fulfillment = 'entrega' then
    v_street := nullif(left(btrim(coalesce(p_customer ->> 'delivery_street', '')), 120), '');
    v_number := nullif(left(btrim(coalesce(p_customer ->> 'delivery_number', '')), 20), '');
    v_complement := nullif(left(btrim(coalesce(p_customer ->> 'delivery_complement', '')), 60), '');
    v_district := nullif(left(btrim(coalesce(p_customer ->> 'delivery_district', '')), 80), '');
    v_reference := nullif(left(btrim(coalesce(p_customer ->> 'delivery_reference', '')), 120), '');

    if coalesce(v_street, v_number, v_complement, v_district, v_reference) is not null then
      if v_street is null then
        raise exception 'street is required' using errcode = 'CK011', detail = 'delivery_street';
      end if;
      if v_number is null then
        raise exception 'number is required' using errcode = 'CK011', detail = 'delivery_number';
      end if;
      if v_district is null then
        raise exception 'district is required' using errcode = 'CK011', detail = 'delivery_district';
      end if;
      v_address := public.format_delivery_address(v_street, v_number, v_complement, v_district, v_reference);

      -- The fee only comes from a quote the server stored (service role); a
      -- value sent by the browser is never read.
      if nullif(p_customer ->> 'delivery_quote_id', '') is not null then
        begin
          v_quote_id := (p_customer ->> 'delivery_quote_id')::uuid;
        exception when others then
          raise exception 'invalid delivery quote' using errcode = 'CK016';
        end;
        select q.fee_cents into v_fee
        from public.delivery_quotes q
        where q.id = v_quote_id
          and q.store_id = p_store_id
          and q.status = 'ok'
          and q.created_at > now() - interval '35 minutes'
          and public.delivery_address_key(q.street, q.number, q.district)
              = public.delivery_address_key(v_street, v_number, v_district);
        if v_fee is null then
          raise exception 'invalid delivery quote' using errcode = 'CK016';
        end if;
      end if;
    end if;
  end if;
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
    fulfillment, delivery_address, scheduled_for, subtotal_cents, has_made_to_order,
    delivery_street, delivery_number, delivery_complement, delivery_district, delivery_reference,
    delivery_fee_cents, delivery_quote_id
  )
  values (
    p_store_id, 'novo',
    now() + make_interval(mins => (select reservation_minutes from public.settings where id = 1)),
    v_name, v_whatsapp, v_tax_id, v_notes, v_fulfillment, v_address, v_scheduled,
    (select sum((l ->> 'total_cents')::integer) from jsonb_array_elements(v_lines) l),
    v_max_lead is not null,
    v_street, v_number, v_complement, v_district, v_reference,
    v_fee, case when v_fee is not null then v_quote_id end
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


-- fee and total for the public order page ---------------------------------------------

create function public.get_order_delivery(p_code text, p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('delivery_fee_cents', o.delivery_fee_cents, 'total_cents', o.total_cents)
  from public.orders o
  where o.code = p_code and o.public_token = p_token;
$$;

-- grants ------------------------------------------------------------------------------------

revoke execute on function public.delivery_address_key(text, text, text) from public, anon, authenticated;
revoke execute on function public.format_delivery_address(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_order_delivery(text, text) from public;
grant execute on function public.get_order_delivery(text, text) to anon, authenticated;
-- create_order keeps its grants (create or replace).
