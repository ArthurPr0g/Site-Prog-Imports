-- Variações de configuração por produto (ex: 8GB/512GB vs 16GB/1TB),
-- cada uma com suas próprias specs, preço e estoque.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  gpu text not null default '',
  cpu text not null default '',
  ram text not null default '',
  storage text not null default '',
  screen_type text not null default '',
  price numeric(12,2) not null,
  promo_price numeric(12,2),
  stock int not null default 0,
  position int not null default 0
);

alter table public.product_variants enable row level security;

create policy "product_variants_public_read" on public.product_variants for select using (true);
create policy "product_variants_admin_all" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());
