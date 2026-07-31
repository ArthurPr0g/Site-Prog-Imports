-- M2 do ERP: inventário físico de itens disponíveis para venda.
--
-- Cada linha é UMA unidade, por decisão do dono do catálogo ("apenas
-- unidades"): item importado é unitário, então não há coluna de quantidade e
-- os indicadores contam linhas. Se um dia houver lote, a coluna entra sem
-- quebrar nada — hoje ela só seria um campo sempre igual a 1.
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),

  -- De onde a unidade veio. 'Orçamento' e 'Troca' são preenchidas pelos
  -- módulos M3 e M8; pelo formulário só nasce 'Manual'.
  origin text not null default 'Manual'
    check (origin in ('Manual', 'Orçamento', 'Troca')),
  status text not null default 'Disponível'
    check (status in ('Disponível', 'Reservado', 'Em Transporte', 'Vendido')),

  -- Vínculo com o catálogo do site é OPCIONAL: existe item comprado para
  -- revenda que nunca vai aparecer na loja, vendido só pelo sistema.
  product_id uuid references public.products(id) on delete set null,
  reserved_customer_id uuid references public.customers(id) on delete set null,

  name text not null,
  category text,
  specs text,
  product_link text,
  photo_url text,

  purchase_date date,
  entry_date date default current_date,
  usd_rate numeric(10,4),

  paid_amount numeric(12,2) not null default 0,
  sale_amount numeric(12,2) not null default 0,

  notes text,

  -- Origem quando veio de orçamento (M3) ou de troca (M8). Sem chave
  -- estrangeira ainda porque as tabelas não existem; a constraint entra junto
  -- com cada módulo, para não travar este aqui.
  budget_id uuid,
  trade_item_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_items_status_idx on public.stock_items (status);
create index if not exists stock_items_product_idx on public.stock_items (product_id);

alter table public.stock_items enable row level security;

-- Admin faz tudo. Custo de aquisição e margem não podem vazar para o visitante.
drop policy if exists stock_items_admin_all on public.stock_items;
create policy stock_items_admin_all on public.stock_items
  for all using (public.is_admin()) with check (public.is_admin());

-- O selo de pronta entrega na loja precisa contar unidades disponíveis por
-- produto sem expor a tabela. A função roda como definer e devolve só a
-- contagem — nada de valores, cliente reservado ou observações.
create or replace function public.ready_stock_counts()
returns table (product_id uuid, qty bigint)
language sql
security definer
set search_path = public
stable
as $$
  select s.product_id, count(*)::bigint
  from public.stock_items s
  where s.status = 'Disponível' and s.product_id is not null
  group by s.product_id;
$$;

grant execute on function public.ready_stock_counts() to anon, authenticated;

NOTIFY pgrst, 'reload schema';
