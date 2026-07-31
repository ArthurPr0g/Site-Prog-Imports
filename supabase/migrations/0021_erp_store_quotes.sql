-- M3 do ERP: orçamentos de importação (EUA → Brasil).
--
-- Cinco componentes são digitados em USD e convertidos para BRL multiplicando
-- pela cotação. O frete é o único invertido: cobrado localmente em reais, é
-- digitado em BRL e convertido para USD dividindo. Guardamos os dois lados de
-- cada par porque a cotação muda com o tempo — recalcular a partir do USD daria
-- um BRL diferente do que foi apresentado ao cliente.
create table if not exists public.store_quotes (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid references public.customers(id) on delete set null,
  -- Opcional: o orçamento pode ser de um produto que ainda não está no catálogo.
  product_id uuid references public.products(id) on delete set null,

  name text not null,
  category text,
  specs text,
  product_link text,

  -- Cotação usada neste orçamento. Copiada de site_settings no momento do
  -- cálculo, nunca digitada no formulário — fonte única de verdade.
  usd_rate numeric(10,4) not null,

  product_value_usd numeric(12,2) not null default 0,
  product_value_brl numeric(12,2) not null default 0,
  tax_usd numeric(12,2) not null default 0,
  tax_brl numeric(12,2) not null default 0,
  traveler_fee_usd numeric(12,2) not null default 0,
  traveler_fee_brl numeric(12,2) not null default 0,
  grabr_fee_usd numeric(12,2) not null default 0,
  grabr_fee_brl numeric(12,2) not null default 0,
  processing_usd numeric(12,2) not null default 0,
  processing_brl numeric(12,2) not null default 0,

  -- Frete: origem em BRL, USD derivado.
  shipping_brl numeric(12,2) not null default 0,
  shipping_usd numeric(12,2) not null default 0,

  total_usd numeric(12,2) not null default 0,
  total_brl numeric(12,2) not null default 0,

  sale_price_brl numeric(12,2) not null default 0,
  profit_brl numeric(12,2) not null default 0,
  margin_pct numeric(6,2) not null default 0,

  -- Colunas previstas pelo documento original mas fora do formulário atual, por
  -- decisão do dono. Ficam aqui para virarem campo de tela sem nova migration.
  delivery_time text,
  payment_method text,

  notes text,
  status text not null default 'Em elaboração'
    check (status in ('Em elaboração', 'Enviado', 'Aguardando Cliente', 'Aprovado', 'Reprovado', 'Convertido em Estoque')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_quotes_status_idx on public.store_quotes (status);
create index if not exists store_quotes_customer_idx on public.store_quotes (customer_id);

alter table public.store_quotes enable row level security;

drop policy if exists store_quotes_admin_all on public.store_quotes;
create policy store_quotes_admin_all on public.store_quotes
  for all using (public.is_admin()) with check (public.is_admin());

-- Fecha o vínculo que o M2 deixou pendente: item de estoque criado a partir de
-- um orçamento aponta para ele. ON DELETE SET NULL para que apagar o orçamento
-- não apague o item físico, que a essa altura já é patrimônio independente.
alter table public.stock_items
  drop constraint if exists stock_items_budget_id_fkey;
alter table public.stock_items
  add constraint stock_items_budget_id_fkey
  foreign key (budget_id) references public.store_quotes(id) on delete set null;

NOTIFY pgrst, 'reload schema';
