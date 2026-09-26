-- Stage 03 · stock. Every quantity change goes through these functions, which
-- lock the row, change the quantity and write the movement in one transaction.
-- stock and stock_movements keep having no write policies.

alter table public.stock_movements
  add column quantity_after integer check (quantity_after >= 0),
  add column actor_name text;

-- Admins manage every store; attendants only their own.
create function public.can_manage_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.is_admin() or public.staff_store() = p_store_id, false);
$$;

-- Internal: authorizes, validates, ensures the row exists and locks it.
-- Returns the current quantity.
create function public.stock_lock(p_product_id uuid, p_store_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantity integer;
begin
  if not public.can_manage_store(p_store_id) then
    raise exception 'not allowed to manage stock of this store' using errcode = '42501';
  end if;
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'store not found' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and type = 'vitrine') then
    raise exception 'product is not a vitrine product' using errcode = 'CK004';
  end if;

  insert into public.stock (product_id, store_id, quantity)
  values (p_product_id, p_store_id, 0)
  on conflict do nothing;

  select quantity into v_quantity
  from public.stock
  where product_id = p_product_id and store_id = p_store_id
  for update;

  return v_quantity;
end;
$$;

-- Internal: writes the new quantity and its movement. Caller holds the lock.
create function public.stock_apply(p_product_id uuid, p_store_id uuid, p_old integer, p_new integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_new is null then
    raise exception 'quantity is required' using errcode = '22023';
  end if;
  if p_new < 0 then
    raise exception 'stock cannot be negative' using errcode = 'CK002';
  end if;
  if p_new > 9999 then
    raise exception 'stock above 9999' using errcode = 'CK003';
  end if;
  if p_new = p_old then
    return p_new;
  end if;

  update public.stock
  set quantity = p_new
  where product_id = p_product_id and store_id = p_store_id;

  insert into public.stock_movements
    (product_id, store_id, delta, reason, user_id, quantity_after, actor_name)
  values (
    p_product_id,
    p_store_id,
    p_new - p_old,
    'ajuste',
    auth.uid(),
    p_new,
    (select name from public.staff where user_id = auth.uid())
  );

  return p_new;
end;
$$;

-- +/− buttons. Concurrent calls queue on the row lock, so none is lost.
create function public.adjust_stock(p_product_id uuid, p_store_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old integer := public.stock_lock(p_product_id, p_store_id);
begin
  return public.stock_apply(p_product_id, p_store_id, v_old, v_old + p_delta);
end;
$$;

-- "Definir" and "Esgotar" (quantity 0).
create function public.set_stock(p_product_id uuid, p_store_id uuid, p_quantity integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old integer := public.stock_lock(p_product_id, p_store_id);
begin
  return public.stock_apply(p_product_id, p_store_id, v_old, p_quantity);
end;
$$;

-- Morning count: [{ "product_id": uuid, "quantity": int }, ...]. All or nothing.
-- Rows are locked in product_id order so two counts never deadlock.
-- Returns how many items changed.
create function public.count_stock(p_store_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_old integer;
  v_changed integer := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;

  for v_item in
    select (element ->> 'product_id')::uuid as product_id,
           (element ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as element
    order by 1
  loop
    v_old := public.stock_lock(v_item.product_id, p_store_id);
    if v_old is distinct from v_item.quantity then
      perform public.stock_apply(v_item.product_id, p_store_id, v_old, v_item.quantity);
      v_changed := v_changed + 1;
    end if;
  end loop;

  return v_changed;
end;
$$;

revoke execute on function public.can_manage_store(uuid) from public, anon, authenticated;
revoke execute on function public.stock_lock(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.stock_apply(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid, uuid, integer) from public, anon;
revoke execute on function public.set_stock(uuid, uuid, integer) from public, anon;
revoke execute on function public.count_stock(uuid, jsonb) from public, anon;
grant execute on function public.adjust_stock(uuid, uuid, integer) to authenticated;
grant execute on function public.set_stock(uuid, uuid, integer) to authenticated;
grant execute on function public.count_stock(uuid, jsonb) to authenticated;

-- Opening balance: seed stock had no movements. One "Saldo inicial" movement per
-- row makes the sum of movements equal the quantity from day one.
insert into public.stock_movements
  (product_id, store_id, delta, reason, quantity_after, actor_name, created_at)
select s.product_id, s.store_id, s.quantity, 'ajuste', s.quantity, 'Saldo inicial', s.updated_at
from public.stock s
where s.quantity > 0
  and not exists (
    select 1 from public.stock_movements m
    where m.product_id = s.product_id and m.store_id = s.store_id
  );
