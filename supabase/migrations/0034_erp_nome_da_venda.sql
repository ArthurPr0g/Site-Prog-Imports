-- Nome da venda, para identificá-la sem decorar número.
--
-- "Venda #1051" não diz nada em lista nenhuma: nem na tela de Vendas, nem no
-- histórico do cliente, nem no Financeiro. O dono precisa reconhecer a venda de
-- relance.
--
-- A coluna é opcional de propósito. Quando está vazia a tela mostra o nome
-- derivado dos produtos ("iPhone 15 Pro +2"), que já resolve a maioria dos
-- casos sem exigir digitação. O apelido serve para quando o produto não
-- identifica a venda — duas vendas do mesmo modelo para clientes diferentes,
-- ou uma negociação que ficou conhecida por outro nome.
alter table public.orders
  add column if not exists name text not null default '';

comment on column public.orders.name is
  'Apelido da venda. Vazio significa "use o nome derivado dos itens".';

NOTIFY pgrst, 'reload schema';
