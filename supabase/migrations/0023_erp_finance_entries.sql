-- M5 — Financeiro. Livro-caixa único: tudo que entra e sai vira uma linha aqui,
-- venha de venda, de serviço ou da mão.
--
-- Por que uma tabela só em vez de "receitas" e "despesas" separadas: os dois
-- lados têm exatamente os mesmos campos, e todo relatório precisa dos dois
-- juntos e ordenados por data. Duas tabelas obrigariam a um UNION em cada
-- consulta e a duplicar toda regra de status.
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('receita', 'despesa')),
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  entry_date date not null default current_date,

  -- 'Previsto' é o padrão porque lançamento futuro é o caso que mais aparece
  -- (parcela, conta a pagar). Só o que já movimentou dinheiro é 'Pago', e só
  -- isso entra no resultado real e no fluxo de caixa.
  status text not null default 'Previsto' check (status in ('Pago', 'Previsto')),

  -- De onde veio. Lançamento gerado por venda ou serviço não pode ser apagado
  -- solto pela tela do Financeiro: o registro de origem continuaria afirmando
  -- que houve dinheiro e o caixa discordaria.
  source text not null default 'manual' check (source in ('manual', 'venda', 'servico')),

  -- Id da venda/prestação que gerou a linha. Sem FK porque as tabelas de
  -- origem ainda não existem (M4 e M6) e porque a coluna aponta para tabelas
  -- diferentes conforme o source.
  reference_id uuid,

  -- Agrupa as parcelas de um mesmo lançamento parcelado: todas compartilham o
  -- installment_id, cada uma com sua data e seu status.
  installment_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O filtro de período é sempre por data, e o gráfico varre um ano inteiro.
create index if not exists finance_entries_entry_date_idx on public.finance_entries (entry_date desc);
create index if not exists finance_entries_reference_idx on public.finance_entries (source, reference_id);

alter table public.finance_entries enable row level security;

-- Financeiro é interno: nenhum cliente do site enxerga esta tabela.
drop policy if exists finance_entries_admin_all on public.finance_entries;
create policy finance_entries_admin_all on public.finance_entries
  for all using (public.is_admin()) with check (public.is_admin());

NOTIFY pgrst, 'reload schema';
