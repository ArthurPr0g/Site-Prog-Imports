-- M8 — Avaliação de Troca. O cliente entrega produtos usados como parte do
-- pagamento de um item do estoque: troca e venda na mesma negociação.
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,

  -- Item do estoque que está sendo vendido. Fica gravado o nome também: se o
  -- item for excluído um dia, a negociação continua legível.
  stock_item_id uuid references public.stock_items(id) on delete set null,
  main_product_name text not null,
  main_sale_price numeric(12,2) not null default 0 check (main_sale_price >= 0),
  main_cost numeric(12,2) not null default 0 check (main_cost >= 0),

  -- Somatórios gravados: o histórico não pode mudar se um item for editado
  -- depois de a negociação estar fechada.
  total_received numeric(12,2) not null default 0 check (total_received >= 0),
  difference_to_pay numeric(12,2) not null default 0 check (difference_to_pay >= 0),
  total_profit numeric(12,2) not null default 0,
  margin_pct numeric(6,2) not null default 0,

  -- Só a diferença é paga em dinheiro, e é ela que pode ser parcelada.
  payment_method text not null default '',
  installment_count integer not null default 0 check (installment_count >= 0),
  down_payment numeric(12,2) not null default 0 check (down_payment >= 0),
  interest_pct numeric(5,2) not null default 0 check (interest_pct >= 0 and interest_pct <= 20),
  first_due_date date,
  installment_notes text not null default '',

  notes text not null default '',
  trade_date date not null default current_date,

  -- Venda criada ao concluir. Sem ela a troca não teve efeito no estoque nem
  -- no caixa.
  order_id uuid references public.orders(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Produtos recebidos do cliente. O documento original limita a 10 por
-- negociação; a regra fica na tela, não no banco, para não travar um caso
-- excepcional.
create table if not exists public.trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,

  name text not null,
  category text not null default '',
  specs text not null default '',
  condition text not null default 'Seminovo - Bom',

  -- O que o produto vale no mercado (referência de negociação), o que a loja
  -- aceitou abater e por quanto espera revender.
  market_value numeric(12,2) not null default 0 check (market_value >= 0),
  paid_value numeric(12,2) not null default 0 check (paid_value >= 0),
  resale_value numeric(12,2) not null default 0 check (resale_value >= 0),

  notes text not null default '',
  position integer not null default 0,

  -- Item de estoque gerado a partir deste produto recebido.
  stock_item_id uuid references public.stock_items(id) on delete set null
);

create index if not exists trades_customer_idx on public.trades (customer_id);
create index if not exists trades_date_idx on public.trades (trade_date desc);
create index if not exists trade_items_trade_idx on public.trade_items (trade_id, position);

alter table public.trades enable row level security;
alter table public.trade_items enable row level security;

drop policy if exists trades_admin_all on public.trades;
create policy trades_admin_all on public.trades
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists trade_items_admin_all on public.trade_items;
create policy trade_items_admin_all on public.trade_items
  for all using (public.is_admin()) with check (public.is_admin());

-- Liga a venda de volta à troca que a gerou, para a exclusão saber o que
-- reverter. A coluna trade_item_id de stock_items já existia desde o M2.
alter table public.orders
  add column if not exists trade_id uuid references public.trades(id) on delete set null;

create index if not exists orders_trade_idx on public.orders (trade_id);

comment on column public.trades.difference_to_pay is
  'O que o cliente paga em DINHEIRO. Só isto vira lançamento no Financeiro — produto recebido não é caixa.';

NOTIFY pgrst, 'reload schema';
