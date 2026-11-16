-- Stage 11 · online payment with Stripe, one account per store (AD-019).
--
-- Each store points to a Stripe account alias (stores.payment_account); the
-- keys live only in server env vars. Every Checkout Session is a row of
-- order_payments, tied to the account it was opened in. The database decides
-- what a payment means (settle_order_payment); the server only talks to
-- Stripe. orders.payment_status summarises it for the panel, Realtime and the
-- public order page.
--
-- Lock order everywhere: the order first, then its payment rows (cancel_order
-- already updates payments after locking the order).

-- structure ---------------------------------------------------------------------

alter table public.stores
  add column payment_account text
    constraint stores_payment_account_check check (payment_account ~ '^[a-z0-9]{2,20}$');

alter table public.orders
  add column payment_status public.order_payment_status not null default 'nenhum';

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  account text not null,             -- account the session was opened in (spec D7)
  session_id text unique,            -- cs_...; null until Stripe answers
  payment_intent_id text unique,     -- pi_...; arrives with the payment
  amount_cents integer not null check (amount_cents >= 50), -- Stripe minimum: R$ 0,50
  status public.payment_attempt_status not null default 'aberto',
  method text check (method in ('pix', 'card')),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  refund_id text,
  note text,                         -- why it was refunded or needs checking
  expires_at timestamptz not null,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_payments_order_idx on public.order_payments (order_id, created_at);
-- At most one valid payment per order.
create unique index order_payments_one_paid_idx on public.order_payments (order_id) where status = 'pago';

create trigger order_payments_updated_at before update on public.order_payments
  for each row execute function public.set_updated_at();

alter table public.order_payments enable row level security;

-- Visible when the order is visible (orders RLS: admin or own store).
create policy "staff reads payments of visible orders" on public.order_payments
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- No write policy: payments change only through the functions below.
grant select on public.order_payments to authenticated;
grant all on public.order_payments to service_role;

-- internal helpers --------------------------------------------------------------

-- Recomputes orders.payment_status from the attempts. A paid attempt wins
-- (a duplicate being refunded does not hide it); then what needs attention.
create function public.refresh_payment_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_payment_status;
begin
  select case
           when bool_or(p.status = 'pago') then 'pago'
           when bool_or(p.status = 'conferir') then 'conferir'
           when bool_or(p.status = 'falha_devolucao') then 'falha_devolucao'
           when bool_or(p.status = 'devolvendo') then 'devolvendo'
           when bool_or(p.status = 'devolvido') then 'devolvido'
           when bool_or(p.status = 'aberto' and p.expires_at > now()) then 'pagando'
           else 'nenhum'
         end::public.order_payment_status
    into v_status
  from public.order_payments p
  where p.order_id = p_order_id;

  update public.orders
  set payment_status = coalesce(v_status, 'nenhum')
  where id = p_order_id and payment_status is distinct from coalesce(v_status, 'nenhum');
end;
$$;

-- Reserves the vitrine stock of an expired order again, all or nothing
-- (CK010 with the missing products). Extracted from reactivate_order (stage
-- 05) so a late payment can reserve the same way. Weighed pieces follow the
-- status change in the sync_order_pieces trigger.
create function public.reserve_order_again(p_order public.orders, p_reason public.stock_reason, p_actor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_after integer;
  v_out jsonb := '[]'::jsonb;
begin
  for v_item in
    select product_id, sum(qty)::integer as qty
    from public.order_items
    where order_id = p_order.id and type = 'vitrine' and product_id is not null
    group by product_id
    order by product_id
  loop
    update public.stock
    set quantity = quantity - v_item.qty
    where product_id = v_item.product_id and store_id = p_order.store_id and quantity >= v_item.qty
    returning quantity into v_after;

    if found then
      insert into public.stock_movements
        (product_id, store_id, delta, reason, order_id, user_id, quantity_after, actor_name)
      values
        (v_item.product_id, p_order.store_id, -v_item.qty, p_reason, p_order.id, auth.uid(), v_after, p_actor);
    else
      v_out := v_out || to_jsonb(v_item.product_id::text);
    end if;
  end loop;

  if jsonb_array_length(v_out) > 0 then
    raise exception 'out of stock' using errcode = 'CK010', detail = v_out::text;
  end if;
end;
$$;

-- payment functions (server only, service role) ----------------------------------

-- Opens a payment attempt for a new order, from the public site (code +
-- token, like get_order_public). Cancels the attempts still open (their
-- sessions are returned so the server expires them at Stripe) and stretches
-- the reservation so it outlives the Checkout Session (spec D9): Stripe takes
-- 30 min to 24 h; 5 min of slack covers a late webhook.
create function public.begin_order_payment(p_code text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_account text;
  v_until timestamptz;
  v_stale jsonb;
  v_payment_id uuid;
begin
  perform public.expire_orders();

  select * into v_order from public.orders
  where code = p_code and public_token = p_token
  for update;
  if v_order.id is null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'novo' or v_order.subtotal_cents < 50 then
    raise exception 'order does not take payments' using errcode = 'CK040';
  end if;
  if v_order.payment_status not in ('nenhum', 'pagando') then
    raise exception 'order already paid' using errcode = 'CK041';
  end if;

  select payment_account into v_account from public.stores where id = v_order.store_id;
  if v_account is null then
    raise exception 'store has no payment account' using errcode = 'CK042';
  end if;
  if (select count(*) from public.order_payments where order_id = v_order.id) >= 5 then
    raise exception 'too many payment attempts' using errcode = 'CK043';
  end if;

  select coalesce(jsonb_agg(session_id) filter (where session_id is not null), '[]'::jsonb)
    into v_stale
  from public.order_payments
  where order_id = v_order.id and status = 'aberto';

  update public.order_payments set status = 'cancelado'
  where order_id = v_order.id and status = 'aberto';

  v_until := least(greatest(v_order.expires_at, now() + interval '31 minutes'), now() + interval '23 hours');

  update public.orders set expires_at = v_until + interval '5 minutes' where id = v_order.id;

  insert into public.order_payments (order_id, account, amount_cents, expires_at)
  values (v_order.id, v_account, v_order.subtotal_cents, v_until)
  returning id into v_payment_id;

  perform public.refresh_payment_status(v_order.id);

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'account', v_account,
    'amount_cents', v_order.subtotal_cents,
    'code', v_order.code,
    'expires_at', v_until,
    'stale_sessions', v_stale
  );
end;
$$;

-- Stores the Checkout Session id. Returns false when the attempt was
-- cancelled meanwhile (another tab opened a new one): the server then expires
-- this session. The id is kept anyway, so a payment that still gets through
-- is found and refunded.
create function public.attach_payment_session(p_payment_id uuid, p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.payment_attempt_status;
begin
  update public.order_payments
  set session_id = p_session_id
  where id = p_payment_id and session_id is null
  returning status into v_status;

  if not found then
    raise exception 'payment attempt not found' using errcode = 'P0002';
  end if;
  return v_status = 'aberto';
end;
$$;

-- Stripe refused to create the session.
create function public.fail_payment_attempt(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := (select order_id from public.order_payments where id = p_payment_id);
begin
  if v_order_id is null then
    return;
  end if;
  perform 1 from public.orders where id = v_order_id for update;

  update public.order_payments set status = 'erro'
  where id = p_payment_id and status = 'aberto' and session_id is null;

  perform public.refresh_payment_status(v_order_id);
end;
$$;

-- A Checkout Session was paid. Decides what the money means and returns
-- { action, payment_id, payment_intent_id }:
--   ok        the order is paid (and stops expiring, spec D2)
--   refund    the server must refund it (spec D10)
--   review    amount or currency differ: the panel shows "Conferir"
--   duplicate already handled
--   ignore    unknown session or another account (webhook answers 400)
-- Money received is never ignored: attempts already cancelled, expired or
-- failed follow the same rules.
create function public.settle_order_payment(
  p_account text,
  p_session_id text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order public.orders;
  v_pay public.order_payments;
  v_method text := case when p_method in ('pix', 'card') then p_method end;
  v_note text;
  v_reserved boolean;
begin
  select order_id into v_order_id from public.order_payments where session_id = p_session_id;
  if v_order_id is null then
    return jsonb_build_object('action', 'ignore');
  end if;

  select * into v_order from public.orders where id = v_order_id for update;
  select * into v_pay from public.order_payments where session_id = p_session_id for update;

  if v_pay.account is distinct from p_account then
    return jsonb_build_object('action', 'ignore');
  end if;

  -- A refund decided earlier whose Stripe call never happened is retried.
  if v_pay.status = 'devolvendo' and v_pay.refund_id is null then
    return jsonb_build_object('action', 'refund', 'payment_id', v_pay.id, 'payment_intent_id', v_pay.payment_intent_id);
  end if;
  if v_pay.status in ('pago', 'conferir', 'devolvendo', 'devolvido', 'falha_devolucao') then
    return jsonb_build_object('action', 'duplicate', 'payment_id', v_pay.id, 'payment_intent_id', v_pay.payment_intent_id);
  end if;

  update public.order_payments
  set payment_intent_id = p_payment_intent_id, method = v_method, paid_at = now()
  where id = v_pay.id;

  if p_amount_cents is distinct from v_pay.amount_cents or lower(coalesce(p_currency, '')) <> 'brl' then
    update public.order_payments
    set status = 'conferir',
        note = format('Recebido %s centavos em %s; o pedido é de %s', p_amount_cents, upper(coalesce(p_currency, '?')), v_pay.amount_cents)
    where id = v_pay.id;
    -- Money arrived: keep the reservation until someone checks it.
    update public.orders set expires_at = null where id = v_order.id and status = 'novo';
    perform public.refresh_payment_status(v_order.id);
    return jsonb_build_object('action', 'review', 'payment_id', v_pay.id, 'payment_intent_id', p_payment_intent_id);
  end if;

  if exists (select 1 from public.order_payments where order_id = v_order.id and status = 'pago' and id <> v_pay.id) then
    v_note := 'Pagamento em duplicidade';
  elsif v_order.status = 'cancelado' then
    v_note := 'Pedido cancelado';
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
      v_note := 'Reserva expirada sem estoque';
    end if;
  end if;

  if v_note is not null then
    update public.order_payments set status = 'devolvendo', note = v_note where id = v_pay.id;
    perform public.refresh_payment_status(v_order.id);
    return jsonb_build_object('action', 'refund', 'payment_id', v_pay.id, 'payment_intent_id', p_payment_intent_id);
  end if;

  update public.order_payments set status = 'pago', note = null where id = v_pay.id;
  -- A paid order no longer expires (spec D2); confirmed ones already have no expiry.
  update public.orders set expires_at = null where id = v_order.id and expires_at is not null;
  perform public.refresh_payment_status(v_order.id);
  return jsonb_build_object('action', 'ok', 'payment_id', v_pay.id, 'payment_intent_id', p_payment_intent_id);
end;
$$;

-- A session expired unpaid ('expirado') or its asynchronous payment failed
-- ('falhou'). Only open (or cancelled) attempts change.
create function public.close_payment_attempt(p_account text, p_session_id text, p_status public.payment_attempt_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_pay public.order_payments;
begin
  if p_status not in ('expirado', 'falhou') then
    raise exception 'invalid status %', p_status using errcode = 'CK011', detail = 'status';
  end if;

  select order_id into v_order_id from public.order_payments where session_id = p_session_id;
  if v_order_id is null then
    return jsonb_build_object('action', 'ignore');
  end if;
  perform 1 from public.orders where id = v_order_id for update;
  select * into v_pay from public.order_payments where session_id = p_session_id for update;
  if v_pay.account is distinct from p_account then
    return jsonb_build_object('action', 'ignore');
  end if;

  if v_pay.status = 'aberto' or (v_pay.status = 'cancelado' and p_status = 'falhou') then
    update public.order_payments set status = p_status where id = v_pay.id;
    perform public.refresh_payment_status(v_order_id);
    return jsonb_build_object('action', 'ok', 'payment_id', v_pay.id);
  end if;
  return jsonb_build_object('action', 'duplicate', 'payment_id', v_pay.id);
end;
$$;

-- Records a refund, from the panel action (right after asking Stripe) or from
-- the refund.* webhook. Finds the attempt by id or, for refunds made in the
-- Stripe dashboard, by payment intent. p_refund_status is Stripe's refund
-- status; p_total_refunded_cents is the charge's total refunded so far
-- (idempotent across repeated events). Refunds the system did not ask for
-- only update the refunded amount.
create function public.mark_refund(
  p_account text,
  p_payment_id uuid,
  p_payment_intent_id text,
  p_refund_id text,
  p_refund_status text,
  p_total_refunded_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_pay public.order_payments;
  v_ours boolean;
begin
  select order_id into v_order_id from public.order_payments
  where id = p_payment_id or (p_payment_id is null and payment_intent_id = p_payment_intent_id);
  if v_order_id is null then
    return jsonb_build_object('action', 'ignore');
  end if;
  perform 1 from public.orders where id = v_order_id for update;
  select * into v_pay from public.order_payments
  where id = p_payment_id or (p_payment_id is null and payment_intent_id = p_payment_intent_id)
  for update;
  if v_pay.account is distinct from p_account then
    return jsonb_build_object('action', 'ignore');
  end if;

  v_ours := v_pay.status in ('devolvendo', 'falha_devolucao');

  if p_refund_status = 'succeeded' then
    update public.order_payments
    set refunded_cents = greatest(refunded_cents, least(coalesce(p_total_refunded_cents, amount_cents), amount_cents)),
        refund_id = coalesce(refund_id, p_refund_id),
        refunded_at = now()
    where id = v_pay.id
    returning * into v_pay;
    if v_pay.refunded_cents >= v_pay.amount_cents and v_pay.status in ('pago', 'devolvendo', 'falha_devolucao', 'conferir') then
      update public.order_payments
      set status = 'devolvido', note = coalesce(note, 'Devolvido pelo painel da Stripe')
      where id = v_pay.id;
    end if;
  elsif p_refund_status in ('pending', 'requires_action') and v_ours then
    update public.order_payments set status = 'devolvendo', refund_id = coalesce(p_refund_id, refund_id)
    where id = v_pay.id;
  elsif p_refund_status in ('failed', 'canceled') and v_ours then
    update public.order_payments set status = 'falha_devolucao', refund_id = null
    where id = v_pay.id;
  else
    return jsonb_build_object('action', 'duplicate', 'payment_id', v_pay.id);
  end if;

  perform public.refresh_payment_status(v_order_id);
  return jsonb_build_object('action', 'ok', 'payment_id', v_pay.id);
end;
$$;

-- existing functions ------------------------------------------------------------

-- Same as stage 05, plus: a paid order is marked for refund (the panel action
-- asks Stripe) and open sessions are cancelled (spec D11).
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
      handled_by = auth.uid(), expires_at = null
  where id = p_order_id;

  -- stage 11
  update public.order_payments set status = 'devolvendo', note = 'Pedido cancelado'
  where order_id = p_order_id and status = 'pago';
  update public.order_payments set status = 'cancelado'
  where order_id = p_order_id and status = 'aberto';
  perform public.refresh_payment_status(p_order_id);
end;
$$;

-- Same as stage 05, with the stock part in reserve_order_again.
create or replace function public.reactivate_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders := public.order_lock(p_order_id, 'expirado');
begin
  perform public.reserve_order_again(
    v_order, 'venda', coalesce((select name from public.staff where user_id = auth.uid()), 'Sistema')
  );

  update public.orders
  set status = 'confirmado', confirmed_at = now(), handled_by = auth.uid(), expires_at = null
  where id = p_order_id;
end;
$$;

-- Same as stage 10, plus expirado → novo (a late payment reserved the order
-- again): the pieces are reserved with a 'reserva' movement.
create or replace function public.sync_order_pieces()
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
                  when old.status = 'expirado' and new.status = 'novo' then 'Pagamento ' || new.code
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

  elsif old.status = 'expirado' and new.status in ('confirmado', 'novo') then
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
      perform public.piece_log(
        v_piece, case when new.status = 'novo' then 'reserva' else 'venda' end::public.stock_reason, -1, new.id, v_actor
      );
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

-- Same as stage 09, plus the "payment" key: no session ids, notes or
-- refunded amounts reach the public page.
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
    -- stage 11
    'payment', jsonb_build_object(
      'status', v_order.payment_status,
      'method', (
        select p.method from public.order_payments p
        where p.order_id = v_order.id and p.status in ('pago', 'devolvendo', 'devolvido', 'falha_devolucao')
        order by (p.status = 'pago') desc, p.paid_at desc nulls last
        limit 1
      ),
      'attempts_left', greatest(0, 5 - (select count(*) from public.order_payments p where p.order_id = v_order.id)),
      'store_has_account', v_store.payment_account is not null
    )
  );
end;
$$;

-- Same as stage 06, plus online_cents (paid through the site, minus refunds)
-- in the totals and per store.
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
           coalesce((select sum(p.amount_cents - p.refunded_cents) from public.order_payments p
                     where p.order_id = o.id and p.status = 'pago'), 0) as online_cents
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

revoke execute on function public.refresh_payment_status(uuid) from public, anon, authenticated;
revoke execute on function public.reserve_order_again(public.orders, public.stock_reason, text) from public, anon, authenticated;

revoke execute on function public.begin_order_payment(text, text) from public, anon, authenticated;
revoke execute on function public.attach_payment_session(uuid, text) from public, anon, authenticated;
revoke execute on function public.fail_payment_attempt(uuid) from public, anon, authenticated;
revoke execute on function public.settle_order_payment(text, text, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.close_payment_attempt(text, text, public.payment_attempt_status) from public, anon, authenticated;
revoke execute on function public.mark_refund(text, uuid, text, text, text, integer) from public, anon, authenticated;

grant execute on function public.begin_order_payment(text, text) to service_role;
grant execute on function public.attach_payment_session(uuid, text) to service_role;
grant execute on function public.fail_payment_attempt(uuid) to service_role;
grant execute on function public.settle_order_payment(text, text, text, integer, text, text) to service_role;
grant execute on function public.close_payment_attempt(text, text, public.payment_attempt_status) to service_role;
grant execute on function public.mark_refund(text, uuid, text, text, text, integer) to service_role;
