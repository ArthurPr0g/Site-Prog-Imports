-- M6 — Serviços internos e Prestação de Serviço.

-- Catálogo dos serviços que a Prog presta fora da loja (sites, sistemas,
-- design). Separado de public.services, que é a vitrine do site: os dois têm
-- públicos e ciclos de vida diferentes, e misturar faria um serviço interno
-- aparecer para o visitante.
create table if not exists public.internal_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prestação de serviço: a execução. Nasce de um Orçamento de Serviços aprovado
-- (M7) ou direto, à mão.
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,

  -- Orçamento de origem. Sem FK porque a tabela do M7 ainda não existe.
  quote_id uuid,

  title text not null,
  notes text not null default '',

  -- Execução e dinheiro são coisas separadas: serviço entregue não é serviço
  -- pago. Dois campos, senão um deles teria que mentir.
  status text not null default 'Em andamento'
    check (status in ('Em andamento', 'Concluída', 'Cancelada')),
  payment_status text not null default 'Previsto'
    check (payment_status in ('Previsto', 'Recebido')),
  payment_method text not null default '',

  -- Somatórios dos itens, gravados: o histórico não pode mudar se o preço do
  -- catálogo mudar depois.
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),

  start_date date not null default current_date,
  due_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma prestação pode ter vários serviços, com valores separados somados no
-- total (decisão do dono). Nome e valor são copiados do catálogo no momento da
-- criação, não referenciados: proposta fechada não muda de preço sozinha.
create table if not exists public.service_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete cascade,
  internal_service_id uuid references public.internal_services(id) on delete set null,
  name text not null,
  description text not null default '',
  amount numeric(12,2) not null default 0 check (amount >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  position integer not null default 0
);

create index if not exists service_orders_customer_idx on public.service_orders (customer_id);
create index if not exists service_orders_start_date_idx on public.service_orders (start_date desc);
create index if not exists service_order_items_order_idx on public.service_order_items (order_id, position);

alter table public.internal_services enable row level security;
alter table public.service_orders enable row level security;
alter table public.service_order_items enable row level security;

-- Tudo interno: nenhum cliente do site enxerga estas tabelas.
drop policy if exists internal_services_admin_all on public.internal_services;
create policy internal_services_admin_all on public.internal_services
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists service_orders_admin_all on public.service_orders;
create policy service_orders_admin_all on public.service_orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists service_order_items_admin_all on public.service_order_items;
create policy service_order_items_admin_all on public.service_order_items
  for all using (public.is_admin()) with check (public.is_admin());

NOTIFY pgrst, 'reload schema';
