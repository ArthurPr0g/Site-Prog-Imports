-- Despesa paga com dinheiro do dono (aporte), fora do caixa da loja.
--
-- Decisão do dono (2026-10-14): o Alienware Area-51 do estoque foi comprado com
-- dinheiro que ele colocou na loja, não com o que a loja faturou. Contar a
-- compra como saída derrubava o caixa de agosto em R$ 18.993 que a loja nunca
-- gastou. A linha continua no Financeiro (a compra aconteceu e o item tem
-- custo), mas não entra nos totais nem no gráfico de fluxo de caixa.
alter table public.finance_entries
  add column if not exists paid_by_owner boolean not null default false;

comment on column public.finance_entries.paid_by_owner is
  'Despesa paga com dinheiro do dono (aporte). Aparece no livro, mas não desconta do caixa da loja nos totais e gráficos.';
