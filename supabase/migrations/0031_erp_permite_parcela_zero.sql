-- A entrada de um parcelamento é a parcela 0, mas o check original (migration
-- 0026) exigia número >= 1 e recusava a linha. Como o insert não verificava
-- erro, a entrada simplesmente não aparecia no Financeiro — o carnê somava
-- R$ 3.240 e o caixa só R$ 2.640, sem nada indicando o motivo.
alter table public.finance_entries
  drop constraint if exists finance_entries_installment_number_check;

alter table public.finance_entries
  add constraint finance_entries_installment_number_check
  check (installment_number is null or installment_number >= 0);

comment on column public.finance_entries.installment_number is
  'Posição da parcela: 0 = entrada, 1..N = parcelas. Null em lançamento avulso ou de trabalho único.';

NOTIFY pgrst, 'reload schema';
