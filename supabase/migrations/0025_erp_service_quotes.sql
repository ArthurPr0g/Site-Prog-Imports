-- M7 — Orçamentos de Serviços. Espelha o fluxo da loja (orçamento → estoque →
-- venda): aqui é orçamento → prestação, e é a PRESTAÇÃO que lança no
-- Financeiro. O orçamento nunca toca no caixa — é proposta, não dinheiro.
create table if not exists public.service_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,

  title text not null,
  notes text not null default '',

  status text not null default 'Em elaboração'
    check (status in (
      'Em elaboração', 'Enviado', 'Aguardando Cliente',
      'Aprovado', 'Convertido em Prestação', 'Reprovado'
    )),

  -- Somatórios dos itens, gravados pelo mesmo motivo do M6: o histórico não
  -- pode mudar se o preço do catálogo mudar depois.
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),

  -- Sem validade de proposta, por decisão do dono. Sem forma de pagamento
  -- também: ela é pedida no momento da aprovação, junto das demais
  -- informações, e vive na prestação.

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.service_quotes(id) on delete cascade,
  internal_service_id uuid references public.internal_services(id) on delete set null,
  name text not null,
  description text not null default '',
  amount numeric(12,2) not null default 0 check (amount >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  position integer not null default 0
);

create index if not exists service_quotes_customer_idx on public.service_quotes (customer_id);
create index if not exists service_quotes_created_idx on public.service_quotes (created_at desc);
create index if not exists service_quote_items_quote_idx on public.service_quote_items (quote_id, position);

alter table public.service_quotes enable row level security;
alter table public.service_quote_items enable row level security;

drop policy if exists service_quotes_admin_all on public.service_quotes;
create policy service_quotes_admin_all on public.service_quotes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists service_quote_items_admin_all on public.service_quote_items;
create policy service_quote_items_admin_all on public.service_quote_items
  for all using (public.is_admin()) with check (public.is_admin());

-- Agora que service_quotes existe, a prestação pode apontar de volta para o
-- orçamento que a originou. A coluna já existia sem FK (0024, quando esta
-- tabela ainda não existia); a restrição fecha o vínculo.
alter table public.service_orders
  drop constraint if exists service_orders_quote_id_fkey;
alter table public.service_orders
  add constraint service_orders_quote_id_fkey
  foreign key (quote_id) references public.service_quotes(id) on delete set null;

NOTIFY pgrst, 'reload schema';
