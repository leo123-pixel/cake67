-- Stage 07: cakes for the home (AD-012). Cakes with a pending price are shown
-- without it; products RLS keeps hiding them and create_order still refuses
-- them (CK015), so the provisional price never reaches the public site.

create function public.list_cake_showcase()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(cake order by (cake ->> 'featured')::boolean desc, (cake ->> 'sort')::integer, cake ->> 'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id,
      'slug', p.slug,
      'name', p.name,
      'description', p.description,
      'price_cents', case when p.price_pending then null else p.price_cents end,
      'weights_kg', p.weights_kg,
      'formats', p.formats,
      'lead_time_hours', p.lead_time_hours,
      'store_ids', p.store_ids,
      'featured', p.featured,
      'sort', p.sort,
      'cake_of_month', exists (
        select 1 from public.highlights h
        where h.product_id = p.id and h.slot = 'bolo_do_mes' and h.active
          and (h.starts_at is null or h.starts_at <= now())
          and (h.ends_at is null or h.ends_at > now())
      ),
      'image_path', (select i.path from public.product_images i where i.product_id = p.id order by i.sort limit 1),
      'addons', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price_cents', a.price_cents) order by a.sort)
        from public.product_addons pa join public.addons a on a.id = pa.addon_id
        where pa.product_id = p.id and a.active
      ), '[]'::jsonb)
    ) as cake
    from public.products p
    where p.type = 'bolo_kg' and p.active
  ) cakes;
$$;

revoke execute on function public.list_cake_showcase() from public;
grant execute on function public.list_cake_showcase() to anon, authenticated;
