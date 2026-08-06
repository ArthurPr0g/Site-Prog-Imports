-- A compra de mercadoria vira despesa na entrada do estoque.
--
-- Até aqui o dinheiro gasto com mercadoria só aparecia no caixa quando o item
-- era VENDIDO, como "Custo da venda". Quem importa paga o fornecedor meses
-- antes de vender, então o mês da compra não mostrava saída nenhuma e o mês da
-- venda mostrava uma saída que já tinha acontecido — e o estoque parado não
-- aparecia em lugar nenhum como dinheiro investido.
--
-- Decisão do dono: a despesa passa a ser lançada na ENTRADA do item. Em troca,
-- a venda desse item deixa de lançar custo — senão o mesmo dinheiro sairia
-- duas vezes do caixa. Quem veio por encomenda, sem item de estoque, continua
-- lançando o custo na venda: aí não houve compra para estoque nenhuma.
alter table public.finance_entries
  drop constraint if exists finance_entries_source_check;

alter table public.finance_entries
  add constraint finance_entries_source_check
  check (source = any (array['manual'::text, 'venda'::text, 'servico'::text, 'estoque'::text]));

comment on column public.finance_entries.source is
  'De onde a linha veio. manual = digitada; venda/servico/estoque = gerada e mantida pelo módulo, editável só no status.';

NOTIFY pgrst, 'reload schema';
