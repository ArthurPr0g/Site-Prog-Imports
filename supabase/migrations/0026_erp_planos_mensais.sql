-- Planos mensais: serviços de vínculo recorrente (hospedagem, manutenção,
-- suporte), com contrato de 6, 12 ou 24 meses.

-- O preço do catálogo passa a significar coisas diferentes conforme o tipo: em
-- 'unico' é o valor do trabalho; em 'mensal' é a MENSALIDADE.
alter table public.internal_services
  add column if not exists billing_type text not null default 'unico'
    check (billing_type in ('unico', 'mensal'));

comment on column public.internal_services.billing_type is
  'unico = cobrado uma vez; mensal = price é a mensalidade de um plano.';

-- O tipo é copiado para o item junto com nome, valor e prazo, pelo mesmo
-- motivo dos outros campos: mudar o catálogo não pode reescrever contrato
-- fechado — inclusive transformar um serviço avulso em mensalidade.
alter table public.service_order_items
  add column if not exists billing_type text not null default 'unico'
    check (billing_type in ('unico', 'mensal'));

alter table public.service_quote_items
  add column if not exists billing_type text not null default 'unico'
    check (billing_type in ('unico', 'mensal'));

-- Valor único e mensalidade ficam em colunas SEPARADAS, por decisão do dono:
-- é como o contrato é lido ("R$ 4.500 + R$ 149/mês") e somar os dois apagaria
-- a informação de quanto é recorrente.
alter table public.service_orders
  add column if not exists monthly_amount numeric(12,2) not null default 0
    check (monthly_amount >= 0);

-- Duração do plano. Null quando a prestação não tem nenhum serviço mensal.
alter table public.service_orders
  add column if not exists plan_months integer
    check (plan_months in (6, 12, 24));

-- Data da PRIMEIRA mensalidade, escolhida na criação (decisão do dono). As
-- demais caem no mesmo dia dos meses seguintes, presas ao último dia quando o
-- mês não tem aquele dia.
alter table public.service_orders
  add column if not exists plan_start_date date;

alter table public.service_quotes
  add column if not exists monthly_amount numeric(12,2) not null default 0
    check (monthly_amount >= 0);

alter table public.service_quotes
  add column if not exists plan_months integer
    check (plan_months in (6, 12, 24));

-- Número da parcela dentro do plano (1..N). `installment_id` agrupa, este
-- identifica.
--
-- Existe para a re-sincronização casar parcela com parcela. Sem ele, editar a
-- prestação teria que apagar e recriar tudo, e as parcelas que o dono já
-- baixou como recebidas voltariam para Previsto — o caixa perderia meses de
-- recebimento por causa de uma correção de título.
--
-- Casa por NÚMERO e não por data de propósito: a parcela 3 continua sendo a 3
-- mesmo que o plano mude de data de início.
alter table public.finance_entries
  add column if not exists installment_number integer
    check (installment_number is null or installment_number >= 1);

comment on column public.finance_entries.installment_number is
  'Posição da parcela no plano (1..N). Null em lançamento avulso ou de trabalho único.';

create index if not exists finance_entries_installment_idx
  on public.finance_entries (reference_id, installment_number);

NOTIFY pgrst, 'reload schema';
