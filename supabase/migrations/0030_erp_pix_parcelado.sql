-- Parcelamento via PIX em vendas e prestações de serviço.

-- As parcelas ganham tabela própria em vez de viverem só em finance_entries.
-- Motivo: o dono precisa editar o vencimento de cada uma e cancelá-las
-- individualmente, e a sincronização com o caixa recalcula os lançamentos a
-- cada salvamento — as edições se perderiam. Aqui fica o PLANO DE PAGAMENTO
-- (domínio); o Financeiro é o espelho contábil dele.
create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),

  -- Aponta para a venda (orders) ou para a prestação (service_orders). Sem FK
  -- porque são tabelas diferentes conforme o tipo.
  source_type text not null check (source_type in ('venda', 'servico')),
  source_id uuid not null,

  -- 0 é a entrada, quando existe. As demais são 1..N.
  number integer not null check (number >= 0),
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,

  -- 'Atrasada' NÃO é gravado: é derivado de due_date < hoje com status
  -- 'Pendente'. Gravar exigiria uma rotina diária para envelhecer as parcelas,
  -- e qualquer falha dela deixaria o painel mentindo.
  status text not null default 'Pendente'
    check (status in ('Pendente', 'Recebida', 'Cancelada')),

  notes text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_type, source_id, number)
);

create index if not exists payment_installments_source_idx
  on public.payment_installments (source_type, source_id, number);
create index if not exists payment_installments_due_idx
  on public.payment_installments (due_date);

alter table public.payment_installments enable row level security;

drop policy if exists payment_installments_admin_all on public.payment_installments;
create policy payment_installments_admin_all on public.payment_installments
  for all using (public.is_admin()) with check (public.is_admin());

-- Condições do parcelamento, no cabeçalho da venda e da prestação.
alter table public.orders
  add column if not exists installment_count integer not null default 0
    check (installment_count >= 0);
alter table public.orders
  add column if not exists down_payment numeric(12,2) not null default 0
    check (down_payment >= 0);
alter table public.orders
  add column if not exists interest_pct numeric(5,2) not null default 0
    check (interest_pct >= 0 and interest_pct <= 20);
alter table public.orders
  add column if not exists first_due_date date;
alter table public.orders
  add column if not exists installment_notes text not null default '';

alter table public.service_orders
  add column if not exists installment_count integer not null default 0
    check (installment_count >= 0);
alter table public.service_orders
  add column if not exists down_payment numeric(12,2) not null default 0
    check (down_payment >= 0);
alter table public.service_orders
  add column if not exists interest_pct numeric(5,2) not null default 0
    check (interest_pct >= 0 and interest_pct <= 20);
alter table public.service_orders
  add column if not exists first_due_date date;
alter table public.service_orders
  add column if not exists installment_notes text not null default '';

comment on column public.orders.interest_pct is
  'Juros simples sobre o valor financiado, de 0 a 20%. Total = financiado + juros.';
comment on column public.payment_installments.number is
  '0 = entrada. 1..N = parcelas. A última absorve a diferença de arredondamento.';

NOTIFY pgrst, 'reload schema';
