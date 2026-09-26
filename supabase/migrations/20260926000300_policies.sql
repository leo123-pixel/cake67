-- RLS policies (SPEC §6).
-- anon: reads the active catalog only, never writes.
-- atendente: reads/updates orders and reads stock of their own store.
-- admin: full catalog management; stock and movements change only through
-- SECURITY DEFINER functions (stage 03/04), so no direct write policies here.

-- catalog: public read of active rows ----------------------------------

create policy "public reads active stores" on public.stores
  for select to anon, authenticated using (active);
create policy "admin manages stores" on public.stores
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public reads active categories" on public.categories
  for select to anon, authenticated using (active);
create policy "admin manages categories" on public.categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public reads active products" on public.products
  for select to anon, authenticated using (active);
create policy "admin manages products" on public.products
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public reads images of active products" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.active));
create policy "admin manages product images" on public.product_images
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public reads active addons" on public.addons
  for select to anon, authenticated using (active);
create policy "admin manages addons" on public.addons
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public reads product addons" on public.product_addons
  for select to anon, authenticated using (true);
create policy "admin manages product addons" on public.product_addons
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public reads current highlights" on public.highlights
  for select to anon, authenticated
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );
create policy "admin manages highlights" on public.highlights
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- stock: read-only for staff ------------------------------------------

create policy "staff reads stock" on public.stock
  for select to authenticated
  using ((select public.is_admin()) or store_id = (select public.staff_store()));

create policy "staff reads stock movements" on public.stock_movements
  for select to authenticated
  using ((select public.is_admin()) or store_id = (select public.staff_store()));

-- orders: no anon access; created only by create_order (stage 04) -----

create policy "staff reads orders" on public.orders
  for select to authenticated
  using ((select public.is_admin()) or store_id = (select public.staff_store()));
create policy "staff updates orders" on public.orders
  for update to authenticated
  using ((select public.is_admin()) or store_id = (select public.staff_store()))
  with check ((select public.is_admin()) or store_id = (select public.staff_store()));

create policy "staff reads order items" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_id
        and ((select public.is_admin()) or o.store_id = (select public.staff_store()))
    )
  );

-- staff ----------------------------------------------------------------

create policy "staff reads own row" on public.staff
  for select to authenticated using (user_id = (select auth.uid()));
create policy "admin manages staff" on public.staff
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- settings -------------------------------------------------------------

create policy "staff reads settings" on public.settings
  for select to authenticated
  using ((select public.is_admin()) or (select public.staff_store()) is not null);
create policy "admin updates settings" on public.settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- public availability without exposing stock --------------------------
-- Runs with the owner's rights (security_invoker = false) so anon can read
-- availability while public.stock stays closed.

create view public.product_availability
with (security_invoker = false) as
select
  s.product_id,
  s.store_id,
  s.quantity > 0 as available,
  least(s.quantity, 10) as quantity
from public.stock s
join public.products p on p.id = s.product_id
where p.active
  and p.type = 'vitrine';

revoke all on public.product_availability from anon, authenticated;
grant select on public.product_availability to anon, authenticated;
