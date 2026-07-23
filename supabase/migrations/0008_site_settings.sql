-- Configurações globais do site (linha única). show_small_banners controla a
-- visibilidade da grade de 3 banners pequenos da home.
create table if not exists public.site_settings (
  id boolean primary key default true,
  show_small_banners boolean not null default true,
  constraint site_settings_singleton check (id)
);

insert into public.site_settings (id, show_small_banners)
values (true, false)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings for select using (true);

drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_admin_update" on public.site_settings for update
  using (public.is_admin()) with check (public.is_admin());
