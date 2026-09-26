-- Stage 02 · catalog panel.

-- Products with a pending price never reach the public site (AD-006).
drop policy "public reads active products" on public.products;
create policy "public reads visible products" on public.products
  for select to anon, authenticated
  using (active and not price_pending);

create or replace view public.product_availability
with (security_invoker = false) as
select
  s.product_id,
  s.store_id,
  s.quantity > 0 as available,
  least(s.quantity, 10) as quantity
from public.stock s
join public.products p on p.id = s.product_id
where p.active
  and not p.price_pending
  and p.type = 'vitrine';

-- Atomic reordering of sortable lists. SECURITY INVOKER: the caller's RLS
-- decides, so only admins actually change rows.
create function public.reorder(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_table not in ('categories', 'addons', 'product_images', 'stores', 'highlights') then
    raise exception 'reorder: table % is not sortable', p_table using errcode = '22023';
  end if;

  execute format(
    'update public.%I as t
        set sort = o.position::integer
       from unnest($1) with ordinality as o(id, position)
      where t.id = o.id',
    p_table
  ) using p_ids;
end;
$$;

revoke execute on function public.reorder(text, uuid[]) from public, anon;
grant execute on function public.reorder(text, uuid[]) to authenticated;

-- Replaces the addons a cake accepts in one statement pair (atomic).
-- SECURITY INVOKER: RLS on product_addons limits it to admins.
create function public.set_product_addons(p_product_id uuid, p_addon_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.product_addons
  where product_id = p_product_id
    and addon_id <> all (p_addon_ids);

  insert into public.product_addons (product_id, addon_id)
  select p_product_id, addon_id
  from unnest(p_addon_ids) as addon_id
  on conflict do nothing;
end;
$$;

revoke execute on function public.set_product_addons(uuid, uuid[]) from public, anon;
grant execute on function public.set_product_addons(uuid, uuid[]) to authenticated;

-- The team must always keep one active admin, whatever path writes staff.
-- SECURITY DEFINER so the check sees every staff row, not only the caller's.
create function public.ensure_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.staff where role = 'admin' and active) then
    raise exception 'at least one active admin is required' using errcode = 'CK001';
  end if;
  return null;
end;
$$;

revoke execute on function public.ensure_active_admin() from public, anon, authenticated;

create trigger ensure_active_admin
  after update or delete on public.staff
  for each statement execute function public.ensure_active_admin();
