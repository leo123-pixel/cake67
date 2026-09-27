-- Stage 05 · order operations. Orders change only through these functions
-- (like stock): they lock the order, check the caller's store and the
-- expected status, and touch stock in the same transaction.

-- The stage 01 policy let attendants update orders directly, which would
-- allow skipping steps with a forged request. Updates now go through functions.
drop policy "staff updates orders" on public.orders;

-- status history ---------------------------------------------------------------

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null,
  note text,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, id);

alter table public.order_events enable row level security;

-- Visible when the order is visible (orders RLS: admin or own store).
create policy "staff reads events of visible orders" on public.order_events
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;

create function public.log_order_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (order_id, from_status, to_status, actor_name)
  values (new.id, null, new.status, 'Cliente');
  return null;
end;
$$;

-- Actor: the signed-in staff member. Expiration is always "Sistema", even when
-- a staff session triggers it (the order list expires overdue orders first).
create function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by_system boolean := new.status = 'expirado' or auth.uid() is null;
begin
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, from_status, to_status, actor_id, actor_name, note)
    values (
      new.id,
      old.status,
      new.status,
      case when v_by_system then null else auth.uid() end,
      case when v_by_system then 'Sistema'
           else coalesce((select name from public.staff where user_id = auth.uid()), 'Sistema') end,
      case when new.status = 'cancelado' then new.cancel_reason end
    );
  end if;
  return null;
end;
$$;

create trigger orders_log_insert
  after insert on public.orders
  for each row execute function public.log_order_insert();

create trigger orders_log_status
  after update of status on public.orders
  for each row execute function public.log_order_status();

-- transitions -------------------------------------------------------------------

-- Internal: locks the order and checks store access and the expected status.
create function public.order_lock(p_order_id uuid, p_from public.order_status)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if not public.can_manage_store(v_order.store_id) then
    raise exception 'order belongs to another store' using errcode = '42501';
  end if;
  if v_order.status is distinct from p_from then
    raise exception 'order changed (now %)', v_order.status using errcode = 'CK020';
  end if;
  return v_order;
end;
$$;

-- confirm, production, ready, delivered. Confirming turns the reservation
-- into a sale in the movement log (SPEC §5.5); deltas and dates stay.
create function public.advance_order(p_order_id uuid, p_from public.order_status, p_to public.order_status)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders := public.order_lock(p_order_id, p_from);
begin
  if not (
       (p_from = 'novo' and p_to = 'confirmado')
    or (p_from = 'confirmado' and p_to = 'em_producao')
    or (p_from = 'confirmado' and p_to in ('pronto', 'entregue') and not v_order.has_made_to_order)
    or (p_from = 'em_producao' and p_to = 'pronto')
    or (p_from = 'pronto' and p_to = 'entregue')
  ) then
    raise exception 'transition % -> % not allowed', p_from, p_to using errcode = 'CK021';
  end if;

  if p_to = 'confirmado' then
    update public.orders
    set status = 'confirmado', confirmed_at = now(), handled_by = auth.uid(), expires_at = null
    where id = p_order_id;

    update public.stock_movements
    set reason = 'venda'
    where order_id = p_order_id and reason = 'reserva';
  else
    update public.orders set status = p_to, handled_by = auth.uid() where id = p_order_id;
  end if;

  return p_to;
end;
$$;

-- Cancels an open order with a reason and returns its vitrine stock.
create function public.cancel_order(p_order_id uuid, p_from public.order_status, p_reason text)
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
end;
$$;

-- Expired order the customer still wants: reserve again (all or nothing) and
-- confirm (AD-010). Made-to-order dates are not re-checked.
create function public.reactivate_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders := public.order_lock(p_order_id, 'expirado');
  v_item record;
  v_after integer;
  v_out jsonb := '[]'::jsonb;
  v_actor text := coalesce((select name from public.staff where user_id = auth.uid()), 'Sistema');
begin
  for v_item in
    select product_id, sum(qty)::integer as qty
    from public.order_items
    where order_id = p_order_id and type = 'vitrine' and product_id is not null
    group by product_id
    order by product_id
  loop
    update public.stock
    set quantity = quantity - v_item.qty
    where product_id = v_item.product_id and store_id = v_order.store_id and quantity >= v_item.qty
    returning quantity into v_after;

    if found then
      insert into public.stock_movements
        (product_id, store_id, delta, reason, order_id, user_id, quantity_after, actor_name)
      values
        (v_item.product_id, v_order.store_id, -v_item.qty, 'venda', p_order_id, auth.uid(), v_after, v_actor);
    else
      v_out := v_out || to_jsonb(v_item.product_id::text);
    end if;
  end loop;

  if jsonb_array_length(v_out) > 0 then
    raise exception 'out of stock' using errcode = 'CK010', detail = v_out::text;
  end if;

  update public.orders
  set status = 'confirmado', confirmed_at = now(), handled_by = auth.uid(), expires_at = null
  where id = p_order_id;
end;
$$;

-- grants ------------------------------------------------------------------------

revoke execute on function public.log_order_insert() from public, anon, authenticated;
revoke execute on function public.log_order_status() from public, anon, authenticated;
revoke execute on function public.order_lock(uuid, public.order_status) from public, anon, authenticated;
revoke execute on function public.advance_order(uuid, public.order_status, public.order_status) from public, anon;
revoke execute on function public.cancel_order(uuid, public.order_status, text) from public, anon;
revoke execute on function public.reactivate_order(uuid) from public, anon;

grant execute on function public.advance_order(uuid, public.order_status, public.order_status) to authenticated;
grant execute on function public.cancel_order(uuid, public.order_status, text) to authenticated;
grant execute on function public.reactivate_order(uuid) to authenticated;
-- Lists expire overdue orders before showing them.
grant execute on function public.expire_orders() to authenticated;

-- Realtime: new/changed orders reach the panel (Realtime applies orders RLS).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
