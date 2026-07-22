-- Prog Imports e-commerce schema
-- Extensions
create extension if not exists "pgcrypto";

-- ============ PROFILES (extends auth.users) ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','admin')),
  name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- auto-create profile on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ CATALOG ============
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  glyph text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  price numeric(12,2) not null,
  promo_price numeric(12,2),
  stock int not null default 0,
  active boolean not null default true,
  description text not null default '',
  rating numeric(2,1) not null default 4.9,
  review_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_collections (
  product_id uuid references public.products(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  url text,
  position int not null default 0
);

create table public.product_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  k text not null,
  v text not null,
  position int not null default 0
);

create table public.product_related (
  product_id uuid references public.products(id) on delete cascade,
  related_id uuid references public.products(id) on delete cascade,
  primary key (product_id, related_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  text text not null,
  created_at timestamptz not null default now()
);

-- ============ CUSTOMER-FACING ============
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rua text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default '',
  cep text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favorites (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

-- ============ ORDERS ============
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null unique,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  status text not null default 'Aguardando pagamento'
    check (status in ('Aguardando pagamento','Pago','Enviado','Entregue','Cancelado')),
  timeline_stage int not null default 0 check (timeline_stage between 0 and 10),
  payment_method text not null default '',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  coupon_code text,
  tracking_code text,
  tracking_url text,
  address_snapshot jsonb,
  is_import boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.order_number_seq start 1048;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  qty int not null default 1,
  unit_price numeric(12,2) not null
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stage int not null,
  note text not null default '',
  occurred_at timestamptz not null default now()
);

-- ============ MARKETING / CONTENT ============
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  pct int not null check (pct between 1 and 100),
  active boolean not null default true,
  uses int not null default 0,
  created_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  position int not null default 0,
  tag text not null default '',
  title text not null default '',
  subtitle text not null default '',
  image_label text not null default '',
  product_id uuid references public.products(id) on delete set null
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_label text not null default 'sob consulta',
  glyph text not null default '',
  description text not null default '',
  position int not null default 0
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  bought text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ============ INDEXES ============
create index products_category_idx on public.products(category_id);
create index products_brand_idx on public.products(brand_id);
create index product_images_product_idx on public.product_images(product_id);
create index orders_customer_idx on public.orders(customer_id);
create index order_items_order_idx on public.order_items(order_id);
create index favorites_customer_idx on public.favorites(customer_id);

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_collections enable row level security;
alter table public.product_images enable row level security;
alter table public.product_specs enable row level security;
alter table public.product_related enable row level security;
alter table public.reviews enable row level security;
alter table public.addresses enable row level security;
alter table public.favorites enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.coupons enable row level security;
alter table public.banners enable row level security;
alter table public.services enable row level security;
alter table public.testimonials enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles for update
  using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_admin" on public.profiles for insert
  with check (public.is_admin());

-- public read-only catalog content
create policy "brands_public_read" on public.brands for select using (true);
create policy "brands_admin_write" on public.brands for insert with check (public.is_admin());
create policy "brands_admin_update" on public.brands for update using (public.is_admin());
create policy "brands_admin_delete" on public.brands for delete using (public.is_admin());

create policy "categories_public_read" on public.categories for select using (true);
create policy "categories_admin_write" on public.categories for insert with check (public.is_admin());
create policy "categories_admin_update" on public.categories for update using (public.is_admin());
create policy "categories_admin_delete" on public.categories for delete using (public.is_admin());

create policy "collections_public_read" on public.collections for select using (true);
create policy "collections_admin_write" on public.collections for insert with check (public.is_admin());
create policy "collections_admin_update" on public.collections for update using (public.is_admin());
create policy "collections_admin_delete" on public.collections for delete using (public.is_admin());

create policy "products_public_read" on public.products for select using (true);
create policy "products_admin_write" on public.products for insert with check (public.is_admin());
create policy "products_admin_update" on public.products for update using (public.is_admin());
create policy "products_admin_delete" on public.products for delete using (public.is_admin());

create policy "product_collections_public_read" on public.product_collections for select using (true);
create policy "product_collections_admin_all" on public.product_collections for all using (public.is_admin()) with check (public.is_admin());

create policy "product_images_public_read" on public.product_images for select using (true);
create policy "product_images_admin_all" on public.product_images for all using (public.is_admin()) with check (public.is_admin());

create policy "product_specs_public_read" on public.product_specs for select using (true);
create policy "product_specs_admin_all" on public.product_specs for all using (public.is_admin()) with check (public.is_admin());

create policy "product_related_public_read" on public.product_related for select using (true);
create policy "product_related_admin_all" on public.product_related for all using (public.is_admin()) with check (public.is_admin());

create policy "reviews_public_read" on public.reviews for select using (true);
create policy "reviews_admin_all" on public.reviews for all using (public.is_admin()) with check (public.is_admin());

-- customer-owned data
create policy "addresses_owner_all" on public.addresses for all
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy "favorites_owner_all" on public.favorites for all
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

-- orders: customer sees own, admin sees/edits all; customer cannot create orders directly (checkout is via WhatsApp, admin launches orders)
create policy "orders_select_own_or_admin" on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());
create policy "orders_admin_write" on public.orders for insert with check (public.is_admin());
create policy "orders_admin_update" on public.orders for update using (public.is_admin());
create policy "orders_admin_delete" on public.orders for delete using (public.is_admin());

create policy "order_items_select_own_or_admin" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_admin())));
create policy "order_items_admin_write" on public.order_items for insert with check (public.is_admin());
create policy "order_items_admin_update" on public.order_items for update using (public.is_admin());
create policy "order_items_admin_delete" on public.order_items for delete using (public.is_admin());

create policy "order_events_select_own_or_admin" on public.order_events for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_admin())));
create policy "order_events_admin_all" on public.order_events for all using (public.is_admin()) with check (public.is_admin());

-- marketing/content: public read, admin write
create policy "coupons_public_read" on public.coupons for select using (true);
create policy "coupons_admin_write" on public.coupons for insert with check (public.is_admin());
create policy "coupons_admin_update" on public.coupons for update using (public.is_admin());
create policy "coupons_admin_delete" on public.coupons for delete using (public.is_admin());

create policy "banners_public_read" on public.banners for select using (true);
create policy "banners_admin_write" on public.banners for insert with check (public.is_admin());
create policy "banners_admin_update" on public.banners for update using (public.is_admin());
create policy "banners_admin_delete" on public.banners for delete using (public.is_admin());

create policy "services_public_read" on public.services for select using (true);
create policy "services_admin_write" on public.services for insert with check (public.is_admin());
create policy "services_admin_update" on public.services for update using (public.is_admin());
create policy "services_admin_delete" on public.services for delete using (public.is_admin());

create policy "testimonials_public_read" on public.testimonials for select using (true);
create policy "testimonials_admin_write" on public.testimonials for insert with check (public.is_admin());
create policy "testimonials_admin_update" on public.testimonials for update using (public.is_admin());
create policy "testimonials_admin_delete" on public.testimonials for delete using (public.is_admin());

create policy "newsletter_insert_anyone" on public.newsletter_subscribers for insert with check (true);
create policy "newsletter_admin_read" on public.newsletter_subscribers for select using (public.is_admin());
