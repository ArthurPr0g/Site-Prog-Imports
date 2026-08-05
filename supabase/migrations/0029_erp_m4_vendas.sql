-- M4 — Vendas. O ERP absorve os pedidos do site em vez de criar uma tabela
-- paralela: `orders` + `order_items` já é o "cabeçalho e itens" decidido, e o
-- checkout, a área do cliente e a timeline de 10 etapas continuam funcionando
-- sem reescrita.

-- De onde a venda veio. 'Site' é o checkout; as demais nascem no admin.
alter table public.orders
  add column if not exists origin text not null default 'Site'
    check (origin in ('Site', 'Manual', 'Orçamento', 'Troca'));

-- Custo total da venda. É o que permite o Financeiro registrar o LUCRO em vez
-- do faturamento: a venda lança uma receita do total E uma despesa do custo, e
-- receita menos despesa vira o lucro por construção — sem mudar a fórmula do
-- resultado do caixa. Sem esta coluna, o preço cheio contaria como ganho e o
-- custo de aquisição sumiria da conta.
alter table public.orders
  add column if not exists cost_total numeric(12,2) not null default 0
    check (cost_total >= 0);

-- Orçamento de origem, quando a venda nasceu do botão "Gerar Venda".
alter table public.orders
  add column if not exists budget_id uuid references public.store_quotes(id) on delete set null;

-- Custo unitário do item e o item de estoque que o atendeu. O custo fica no
-- item, não só no cabeçalho, para uma venda de vários produtos saber a origem
-- de cada custo. `stock_item_id` é o que permite dar baixa no estoque ao vender
-- — sem ele o mesmo notebook continuaria como pronta entrega depois de vendido.
alter table public.order_items
  add column if not exists unit_cost numeric(12,2) not null default 0
    check (unit_cost >= 0);
alter table public.order_items
  add column if not exists stock_item_id uuid references public.stock_items(id) on delete set null;

create index if not exists orders_origin_idx on public.orders (origin);
create index if not exists orders_budget_idx on public.orders (budget_id);
create index if not exists order_items_stock_idx on public.order_items (stock_item_id);

comment on column public.orders.cost_total is
  'Soma dos custos dos itens. O Financeiro recebe receita (total) e despesa (custo) — o resultado vira lucro por construção.';

NOTIFY pgrst, 'reload schema';
