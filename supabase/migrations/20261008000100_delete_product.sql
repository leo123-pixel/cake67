-- Delete a product from the panel. Only products that never appeared in an
-- order: those keep the report and the order history intact and must be
-- deactivated instead. Stock, pieces, movements, photos rows and addon links
-- go with the product (ON DELETE CASCADE). Returns the photo paths so the
-- caller can remove the files from Storage.
create function public.delete_product(p_product_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paths text[];
begin
  if not public.is_admin() then
    raise exception 'only admins delete products' using errcode = '42501';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.order_items where product_id = p_product_id) then
    raise exception 'product has orders' using errcode = 'CK040';
  end if;

  select coalesce(array_agg(path), '{}') into v_paths
  from public.product_images where product_id = p_product_id;

  delete from public.products where id = p_product_id;
  return v_paths;
end;
$$;

revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;
