-- Data da venda, separada da data em que ela foi cadastrada.
--
-- Até aqui o Financeiro usava `created_at` — o instante do cadastro. Numa venda
-- lançada no dia em que aconteceu dá no mesmo; numa venda retroativa, não:
-- a receita das parcelas ia para os meses certos (elas têm data própria) e o
-- CUSTO caía no mês do cadastro. O resultado ficava errado dos dois lados, com
-- despesa num mês que não teve a venda.
--
-- `created_at` continua existindo e não é tocado: é o registro de quando a
-- linha entrou no sistema, e serve para auditar. Quem manda no caixa passa a ser
-- `sale_date`, que o dono edita.
alter table public.orders
  add column if not exists sale_date date;

-- Backfill: para tudo que já existe, a data da venda é a do cadastro — que é
-- exatamente o que o sistema vinha usando. Nenhum número se move sozinho.
update public.orders
set sale_date = created_at::date
where sale_date is null;

alter table public.orders
  alter column sale_date set default current_date;

comment on column public.orders.sale_date is
  'Dia em que a venda aconteceu. É a data que vale no Financeiro; created_at é só o registro do cadastro.';

NOTIFY pgrst, 'reload schema';
