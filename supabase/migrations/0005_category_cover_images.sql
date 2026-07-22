-- Capa de imagem para categorias (exibida na Home).
alter table public.categories add column image_url text;

insert into storage.buckets (id, name, public)
values ('category-images', 'category-images', true)
on conflict (id) do nothing;

create policy "category_images_public_read" on storage.objects for select
  using (bucket_id = 'category-images');

create policy "category_images_admin_write" on storage.objects for insert
  with check (bucket_id = 'category-images' and public.is_admin());

create policy "category_images_admin_update" on storage.objects for update
  using (bucket_id = 'category-images' and public.is_admin());

create policy "category_images_admin_delete" on storage.objects for delete
  using (bucket_id = 'category-images' and public.is_admin());
