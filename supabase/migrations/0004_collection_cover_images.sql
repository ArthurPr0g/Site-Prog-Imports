-- Capa de imagem para coleções (usado na tela Catálogo do admin).
alter table public.collections add column image_url text;

insert into storage.buckets (id, name, public)
values ('collection-images', 'collection-images', true)
on conflict (id) do nothing;

create policy "collection_images_public_read" on storage.objects for select
  using (bucket_id = 'collection-images');

create policy "collection_images_admin_write" on storage.objects for insert
  with check (bucket_id = 'collection-images' and public.is_admin());

create policy "collection_images_admin_update" on storage.objects for update
  using (bucket_id = 'collection-images' and public.is_admin());

create policy "collection_images_admin_delete" on storage.objects for delete
  using (bucket_id = 'collection-images' and public.is_admin());
