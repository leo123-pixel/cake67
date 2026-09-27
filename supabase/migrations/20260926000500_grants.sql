-- This project does not auto-grant Data API privileges on new public tables,
-- so every table needs explicit grants. RLS still decides which rows each
-- role sees; grants only open the door.
-- New tables in later migrations must add their own grants here-style.

-- anon: read the public catalog only. No grant at all on private tables.
grant select on
  public.stores,
  public.categories,
  public.products,
  public.product_images,
  public.addons,
  public.product_addons,
  public.highlights
to anon;

-- authenticated (staff): DML allowed, filtered by RLS policies.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- service_role: server-side scripts and admin tasks (bypasses RLS).
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
