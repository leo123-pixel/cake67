-- Product photos: public read through public URLs, writes only by admins.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Listing and upsert need select; public URLs work without it.
create policy "admin lists product photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'produtos' and (select public.is_admin()));

create policy "admin uploads product photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and (select public.is_admin()));

create policy "admin updates product photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (select public.is_admin()))
  with check (bucket_id = 'produtos' and (select public.is_admin()));

create policy "admin deletes product photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (select public.is_admin()));
