-- Stage 12 · online payment with InfinitePay, one account per store (AD-021).
--
-- Replaces the Stripe stage (20261021000100/200), which was applied to the
-- project but never shipped: order_payments was empty and every order had
-- payment_status = 'nenhum' when this ran.
--
-- What can be paid online: a vitrine-only order (no made-to-order item), for
-- pickup or for delivery with a calculated fee, in a store with an InfinitePay
-- account (stores.payment_handle) whose API key is on the server. Everything
-- else stays on WhatsApp.
--
-- The summary lives on orders (one link at a time per order); every webhook,
-- return and API answer goes to payment_events for audit. The database decides
-- what a confirmed payment means (settle_online_payment); the server only talks
-- to InfinitePay and always confirms through /payment_check first.
--
-- Stock: the order already reserved its vitrine stock in create_order. Paying
-- does not move stock again; it keeps the reservation (the order stops
-- expiring) until the team confirms (reserva → venda) or cancels.

-- remove the Stripe stage -------------------------------------------------------

drop function public.begin_order_payment(text, text);
drop function public.attach_payment_session(uuid, text);
drop function public.fail_payment_attempt(uuid);
drop function public.settle_order_payment(text, text, text, integer, text, text);
drop function public.close_payment_attempt(text, text, public.payment_attempt_status);
drop function public.mark_refund(text, uuid, text, text, text, integer);
drop function public.refresh_payment_status(uuid);
drop table public.order_payments;
alter table public.orders drop column payment_status;
alter table public.stores drop column payment_account;
drop type public.payment_attempt_status;
drop type public.order_payment_status;
-- Kept from the Stripe stage, because they are not about Stripe:
-- reserve_order_again (used by reactivate_order and below) and the expirado → novo
-- branch of sync_order_pieces.

-- structure ---------------------------------------------------------------------

create type public.online_payment_status as enum (
  'aguardando_pagamento', -- a link was opened and not paid yet
  'pago',
  'expirado',             -- the link expired unpaid (the order may still be "novo")
  'cancelado',            -- the order was cancelled before paying
  'conferir'              -- money arrived but does not fit the order: the team checks and refunds in the InfinitePay app
);

-- InfiniteTag of the store's InfinitePay account (each store is a CNPJ). The
-- API key is only in the server env (rule 4). Not secret: it is public in the
-- InfinitePay app.
alter table public.stores
  add column payment_handle text
    constraint stores_payment_handle_check check (payment_handle ~ '^[a-z0-9][a-z0-9_.-]{1,39}$');

alter table public.orders
  add column payment_status public.online_payment_status,   -- null = no online payment (WhatsApp)
  add column payment_handle text,                           -- account the link was opened in
  add column checkout_url text check (checkout_url ~ '^https://'),
  add column invoice_slug text check (char_length(invoice_slug) <= 120),
  add column transaction_nsu text unique check (char_length(transaction_nsu) <= 120),
  add column capture_method text check (capture_method in ('credit_card', 'pix')),
  add column installments integer check (installments between 1 and 12),
  add column amount_cents integer check (amount_cents >= 100), -- what the link charges (InfinitePay minimum: R$ 1,00)
  add column paid_amount_cents integer check (paid_amount_cents >= 0), -- may be higher (installment interest)
  add column receipt_url text check (receipt_url ~ '^https://'),
  add column paid_at timestamptz,
  add column payment_valid_until timestamptz,
  add column payment_note text check (char_length(payment_note) <= 300);

create index orders_payment_pending_idx on public.orders (payment_valid_until)
  where payment_status = 'aguardando_pagamento';

-- Raw log for audit: webhooks, returns, link answers, payment_check answers.
create table public.payment_events (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders (id) on delete set null,
  source text not null check (source in ('webhook', 'return', 'checkout')),
  kind text not null check (char_length(kind) <= 40),
  transaction_nsu text check (char_length(transaction_nsu) <= 120),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index payment_events_order_idx on public.payment_events (order_id, created_at);
create index payment_events_nsu_idx on public.payment_events (transaction_nsu) where transaction_nsu is not null;

alter table public.payment_events enable row level security;

-- Visible when the order is visible (orders RLS: admin or own store).
create policy "staff reads payment events of visible orders" on public.payment_events
  for select to authenticated
  using (order_id is not null and exists (select 1 from public.orders o where o.id = order_id));

-- No write policy: only the server (service role) writes events.
grant select on public.payment_events to authenticated;
grant all on public.payment_events to service_role;

-- Jeribá is the first store with an InfinitePay account (Leonardo, 2026-11-16).
update public.stores set payment_handle = 'cake-zsf' where slug = 'cake67-jeriba';

-- helpers -----------------------------------------------------------------------

-- Whether the order can be paid on the site right now (spec 12, D1–D3).
create function public.online_payment_eligible(p_order public.orders, p_store public.stores)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_store.payment_handle is not null
     and p_order.status = 'novo'
     and not p_order.has_made_to_order
     and (p_order.fulfillment = 'retirada' or p_order.delivery_fee_cents is not null)
     and p_order.total_cents >= 100
     and p_order.payment_status is distinct from 'pago'
     and p_order.payment_status is distinct from 'conferir';
$$;

-- payment functions (server only, service role) ----------------------------------

-- Opens (or reuses) the payment link of an order, from the public site (code +
-- token, like get_order_public). Returns what the server needs to create the
-- link. While the current link is valid for 2 more minutes, the same
-- valid_until comes back, so the server sends an identical request and
-- InfinitePay can return the same link (no second payable link). The
-- reservation is stretched to outlive the link by 5 minutes.
create function public.begin_online_payment(p_code text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_store public.stores;
  v_until timestamptz;
begin
  perform public.expire_orders();

  select * into v_order from public.orders
  where code = p_code and public_token = p_token
  for update;
  if v_order.id is null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  select * into v_store from public.stores where id = v_order.store_id;

  if v_order.payment_status in ('pago', 'conferir') then
    raise exception 'order already paid' using errcode = 'CK041';
  end if;
  if v_store.payment_handle is null then
    raise exception 'store has no payment account' using errcode = 'CK042';
  end if;
  if v_order.has_made_to_order then
    raise exception 'made-to-order goes to WhatsApp' using errcode = 'CK044';
  end if;
  if v_order.fulfillment = 'entrega' and v_order.delivery_fee_cents is null then
    raise exception 'delivery fee to be agreed on WhatsApp' using errcode = 'CK045';
  end if;
  if v_order.status <> 'novo' or v_order.total_cents < 100 then
    raise exception 'order does not take payments' using errcode = 'CK040';
  end if;

  if v_order.payment_status = 'aguardando_pagamento'
     and v_order.payment_valid_until > now() + interval '2 minutes'
     and v_order.amount_cents = v_order.total_cents
     and v_order.payment_handle = v_store.payment_handle then
    v_until := v_order.payment_valid_until;
  else
    if (select count(*) from public.payment_events
        where order_id = v_order.id and source = 'checkout' and kind = 'link_created') >= 5 then
      raise exception 'too many payment links' using errcode = 'CK043';
    end if;
    v_until := date_trunc('second', now()) + interval '60 minutes';
    update public.orders
    set payment_status = 'aguardando_pagamento',
        payment_handle = v_store.payment_handle,
        amount_cents = v_order.total_cents,
        payment_valid_until = v_until,
        checkout_url = null,
        invoice_slug = null,
        payment_note = null,
        expires_at = greatest(expires_at, v_until + interval '5 minutes')
    where id = v_order.id
    returning * into v_order;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'code', v_order.code,
    'handle', v_order.payment_handle,
    'amount_cents', v_order.amount_cents,
    'valid_until', v_until,
    'checkout_url', v_order.checkout_url,
    'customer_name', v_order.customer_name,
    'customer_whatsapp', v_order.customer_whatsapp,
    'delivery_fee_cents', case when v_order.fulfillment = 'entrega' then v_order.delivery_fee_cents end,
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

-- Stores the link InfinitePay returned. False when the order moved on meanwhile
-- (a newer link, paid, cancelled): the server then does not redirect.
create function public.attach_payment_link(
  p_order_id uuid,
  p_valid_until timestamptz,
  p_checkout_url text,
  p_invoice_slug text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set checkout_url = p_checkout_url,
      invoice_slug = coalesce(p_invoice_slug, invoice_slug)
  where id = p_order_id
    and payment_status = 'aguardando_pagamento'
    and payment_valid_until = p_valid_until;
  return found;
end;
$$;

-- A payment confirmed by /payment_check (never by the webhook alone). Amounts,
-- installments and method come from payment_check; the receipt from the webhook
-- or the return URL. Returns { action }:
--   ok         the order is paid and stops expiring
--   duplicate  this transaction was already handled (webhook repeated)
--   review     money arrived but does not fit: payment_status 'conferir'
--   ignore     unknown order, or the transaction belongs to another order
-- Money received is never dropped: every case keeps the transaction data.
create function public.settle_online_payment(
  p_order_id uuid,
  p_transaction_nsu text,
  p_invoice_slug text,
  p_amount_cents integer,
  p_paid_amount_cents integer,
  p_installments integer,
  p_capture_method text,
  p_receipt_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_owner uuid;
  v_method text := case when p_capture_method in ('credit_card', 'pix') then p_capture_method end;
  v_receipt text := case when p_receipt_url ~ '^https://' and char_length(p_receipt_url) <= 500 then p_receipt_url end;
  v_installments integer := case when p_installments between 1 and 12 then p_installments end;
  v_note text;
  v_reserved boolean;
begin
  if p_transaction_nsu is null or btrim(p_transaction_nsu) = '' then
    raise exception 'transaction_nsu is required' using errcode = 'CK011', detail = 'transaction_nsu';
  end if;

  select id into v_owner from public.orders where transaction_nsu = p_transaction_nsu;
  if v_owner is not null and v_owner <> p_order_id then
    return jsonb_build_object('action', 'ignore');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    return jsonb_build_object('action', 'ignore');
  end if;

  if v_order.transaction_nsu = p_transaction_nsu then
    -- Same transaction again: only fill a receipt that was missing.
    if v_order.receipt_url is null and v_receipt is not null then
      update public.orders set receipt_url = v_receipt where id = v_order.id;
    end if;
    return jsonb_build_object('action', 'duplicate', 'status', v_order.payment_status);
  end if;

  if v_order.transaction_nsu is not null then
    -- A second payment for the same order (another link): keep the first one.
    update public.orders
    set payment_status = 'conferir',
        payment_note = left(format('Segundo pagamento recebido (transação %s, %s centavos): devolver pelo app InfinitePay',
                                   p_transaction_nsu, p_amount_cents), 300)
    where id = v_order.id;
    return jsonb_build_object('action', 'review', 'reason', 'second_payment');
  end if;

  update public.orders
  set transaction_nsu = p_transaction_nsu,
      invoice_slug = coalesce(p_invoice_slug, invoice_slug),
      capture_method = v_method,
      installments = v_installments,
      paid_amount_cents = p_paid_amount_cents,
      receipt_url = v_receipt,
      paid_at = now()
  where id = v_order.id
  returning * into v_order;

  if v_order.amount_cents is null or p_amount_cents is distinct from v_order.amount_cents then
    v_note := format('Valor confirmado %s centavos; o pedido cobra %s', p_amount_cents, coalesce(v_order.amount_cents::text, '?'));
  elsif v_order.status = 'cancelado' then
    v_note := 'Pedido cancelado antes do pagamento: devolver pelo app InfinitePay';
  elsif v_order.status = 'expirado' then
    -- Reserve again (savepoint): out of stock rolls back only this block.
    begin
      perform public.reserve_order_again(v_order, 'reserva', 'Pagamento ' || v_order.code);
      update public.orders set status = 'novo', expires_at = null where id = v_order.id;
      v_reserved := true;
    exception when sqlstate 'CK010' then
      v_reserved := false;
    end;
    if not v_reserved then
      v_note := 'Reserva expirada sem estoque: devolver pelo app InfinitePay';
    end if;
  end if;

  if v_note is not null then
    update public.orders
    set payment_status = 'conferir', payment_note = left(v_note, 300),
        -- money arrived: keep the reservation until someone checks it
        expires_at = case when status = 'novo' then null else expires_at end
    where id = v_order.id;
    return jsonb_build_object('action', 'review', 'reason', v_note);
  end if;

  -- A paid order no longer expires; the team still confirms it (spec 12, D4).
  update public.orders
  set payment_status = 'pago', payment_note = null, expires_at = null
  where id = v_order.id;
  return jsonb_build_object('action', 'ok');
end;
$$;

-- existing functions ------------------------------------------------------------

-- Same as stage 04, plus: links whose time is over become 'expirado', and an
-- order that expires while waiting for payment takes its link along.
create or replace function public.expire_orders()
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
  update public.orders
  set payment_status = 'expirado'
  where payment_status = 'aguardando_pagamento' and payment_valid_until <= now();

  for v_order in
    select id, code, store_id
    from public.orders
    where status = 'novo' and expires_at <= now()
    order by created_at
    for update skip locked
  loop
    update public.orders
    set status = 'expirado',
        payment_status = case when payment_status = 'aguardando_pagamento' then 'expirado' else payment_status end
    where id = v_order.id;

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

-- Same as stage 05, plus: an unpaid link is closed. A paid order keeps
-- 'pago': the panel tells the team to refund in the InfinitePay app (the API
-- has no refund).
create or replace function public.cancel_order(p_order_id uuid, p_from public.order_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders := public.order_lock(p_order_id, p_from);
  v_reason text := left(btrim(coalesce(p_reason, '')), 200);
  v_item record;
  v_after integer;
begin
  if p_from not in ('novo', 'confirmado', 'em_producao', 'pronto') then
    raise exception 'cannot cancel a % order', p_from using errcode = 'CK021';
  end if;
  if v_reason = '' then
    raise exception 'reason is required' using errcode = 'CK011', detail = 'reason';
  end if;

  for v_item in
    select product_id, sum(qty)::integer as qty
    from public.order_items
    where order_id = p_order_id and type = 'vitrine' and product_id is not null
    group by product_id
    order by product_id
  loop
    update public.stock
    set quantity = quantity + v_item.qty
    where product_id = v_item.product_id and store_id = v_order.store_id
    returning quantity into v_after;

    if found then
      insert into public.stock_movements
        (product_id, store_id, delta, reason, order_id, user_id, quantity_after, actor_name)
      values
        (v_item.product_id, v_order.store_id, v_item.qty, 'devolucao', p_order_id, auth.uid(), v_after,
         coalesce((select name from public.staff where user_id = auth.uid()), 'Sistema'));
    end if;
  end loop;

  update public.orders
  set status = 'cancelado', cancelled_at = now(), cancel_reason = v_reason,
      handled_by = auth.uid(), expires_at = null,
      payment_status = case when payment_status in ('aguardando_pagamento', 'expirado') then 'cancelado'
                            else payment_status end
  where id = p_order_id;
end;
$$;

-- Same as stage 09, with the InfinitePay "payment" key: no transaction ids,
-- notes or link of another state reach the public page. "handle" is the
-- account to pay in, only while the order can be paid (the server also checks
-- that the account has a key).
create or replace function public.get_order_public(p_code text, p_token text)
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
    'store', jsonb_build_object(
      'name', v_store.name,
      'address', v_store.address,
      'whatsapp', case when v_order.has_made_to_order then v_store.whatsapp_made_to_order else v_store.whatsapp_ready end,
      'support_whatsapp', v_store.whatsapp_support
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', i.name_snapshot, 'type', i.type, 'qty', i.qty,
               'unit_price_cents', i.unit_price_cents, 'total_cents', i.total_cents, 'options', i.options)
             order by i.position), '[]'::jsonb)
      from public.order_items i where i.order_id = v_order.id
    ),
    -- Status history for the timeline: no actor, from_status or note (the
    -- cancel reason is internal).
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.created_at) order by e.id), '[]'::jsonb)
      from public.order_events e where e.order_id = v_order.id
    ),
    -- stage 12
    'payment', jsonb_build_object(
      'status', v_order.payment_status,
      'method', v_order.capture_method,
      'installments', v_order.installments,
      'amount_cents', v_order.amount_cents,
      'paid_amount_cents', v_order.paid_amount_cents,
      'paid_at', v_order.paid_at,
      'receipt_url', case when v_order.payment_status in ('pago', 'conferir') then v_order.receipt_url end,
      'handle', case when public.online_payment_eligible(v_order, v_store) then v_store.payment_handle end
    )
  );
end;
$$;

-- Same as stage 06, plus online_cents (charged through the site, paid) in the
-- totals and per store. Same keys as the Stripe version, so the panel and the
-- integration tests keep working.
create or replace function public.report_summary(p_from date, p_to date, p_store_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'report is admin only' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 400 then
    raise exception 'invalid period' using errcode = 'CK011', detail = 'period';
  end if;

  with scoped as (
    select o.id, o.store_id, o.status, o.subtotal_cents,
           (o.created_at at time zone 'America/Campo_Grande')::date as day,
           o.status in ('confirmado', 'em_producao', 'pronto', 'entregue') as counted,
           case when o.payment_status = 'pago' then coalesce(o.amount_cents, 0) else 0 end as online_cents
    from public.orders o
    where (o.created_at at time zone 'America/Campo_Grande')::date between p_from and p_to
      and (p_store_id is null or o.store_id = p_store_id)
  ),
  totals as (
    select
      count(*) filter (where counted) as orders,
      coalesce(sum(subtotal_cents) filter (where counted), 0) as revenue,
      coalesce(sum(online_cents) filter (where counted), 0) as online,
      count(*) filter (where status = 'cancelado') as cancelled,
      coalesce(sum(subtotal_cents) filter (where status = 'cancelado'), 0) as cancelled_cents,
      count(*) filter (where status = 'expirado') as expired,
      coalesce(sum(subtotal_cents) filter (where status = 'expirado'), 0) as expired_cents,
      count(*) filter (where status = 'novo') as pending,
      coalesce(sum(subtotal_cents) filter (where status = 'novo'), 0) as pending_cents
    from scoped
  ),
  by_day as (
    select day, count(*) as orders, sum(subtotal_cents) as revenue
    from scoped where counted group by day
  ),
  by_store as (
    select s.id, s.name, s.sort, count(*) as orders, sum(sc.subtotal_cents) as revenue, sum(sc.online_cents) as online
    from scoped sc join public.stores s on s.id = sc.store_id
    where sc.counted
    group by s.id, s.name, s.sort
  ),
  lines as (
    select coalesce(i.product_id::text, 'snapshot:' || i.name_snapshot) as key,
           i.product_id, i.name_snapshot, i.type, i.qty, i.total_cents,
           -- bolo_kg lines are one cake each; the weight goes to kg
           case when i.type = 'bolo_kg' then (i.options ->> 'weight_kg')::numeric end as kg
    from public.order_items i join scoped sc on sc.id = i.order_id
    where sc.counted
  ),
  top as (
    select l.key,
           coalesce(max(p.name), max(l.name_snapshot)) as name,
           max(l.type::text) as type,
           max(l.product_id::text) as product_id,
           sum(case when l.type = 'bolo_kg' then 1 else l.qty end) as units,
           sum(l.kg) as kg,
           sum(l.total_cents) as revenue
    from lines l left join public.products p on p.id = l.product_id
    group by l.key
    order by units desc, revenue desc, name
    limit 10
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'orders', t.orders,
        'revenue_cents', t.revenue,
        'online_cents', t.online,
        'avg_ticket_cents', case when t.orders > 0 then round(t.revenue::numeric / t.orders)::integer end,
        'cancelled', jsonb_build_object('count', t.cancelled, 'cents', t.cancelled_cents),
        'expired', jsonb_build_object('count', t.expired, 'cents', t.expired_cents),
        'pending', jsonb_build_object('count', t.pending, 'cents', t.pending_cents)
      ) from totals t
    ),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'orders', d.orders, 'revenue_cents', d.revenue) order by d.day)
      from by_day d
    ), '[]'::jsonb),
    'by_store', coalesce((
      select jsonb_agg(jsonb_build_object(
        'store_id', b.id, 'name', b.name, 'orders', b.orders, 'revenue_cents', b.revenue,
        'online_cents', b.online,
        'avg_ticket_cents', round(b.revenue::numeric / b.orders)::integer
      ) order by b.sort, b.name)
      from by_store b
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', tp.product_id, 'name', tp.name, 'type', tp.type,
        'units', tp.units, 'kg', tp.kg, 'revenue_cents', tp.revenue
      ) order by tp.units desc, tp.revenue desc, tp.name)
      from top tp
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- grants ------------------------------------------------------------------------
-- create or replace keeps the grants of the functions that already existed.

revoke execute on function public.online_payment_eligible(public.orders, public.stores) from public, anon, authenticated;
revoke execute on function public.begin_online_payment(text, text) from public, anon, authenticated;
revoke execute on function public.attach_payment_link(uuid, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.settle_online_payment(uuid, text, text, integer, integer, integer, text, text)
  from public, anon, authenticated;

grant execute on function public.online_payment_eligible(public.orders, public.stores) to service_role;
grant execute on function public.begin_online_payment(text, text) to service_role;
grant execute on function public.attach_payment_link(uuid, timestamptz, text, text) to service_role;
grant execute on function public.settle_online_payment(uuid, text, text, integer, integer, integer, text, text)
  to service_role;
