-- Cobranças pelo Asaas (2026-10-28).
--
-- Pedido do dono: pagamento automatizado. Quando a venda fecha, a Lia gera a
-- cobrança do sinal (50%) no Asaas com a forma de pagamento em aberto (o
-- cliente escolhe Pix, boleto ou cartão na fatura) e manda o link no WhatsApp.
-- O webhook do Asaas (/api/asaas/webhook) avisa quando foi pago.
-- O CPF/CNPJ não fica aqui: vai direto para o cadastro do cliente no Asaas.

alter table public.leads add column if not exists asaas_customer_id text;

create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  conversation_id uuid references public.ia_conversations(id) on delete set null,
  parcela text not null check (parcela in ('sinal', 'entrega')),
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  asaas_payment_id text unique,
  link text,
  -- PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED... (status do Asaas)
  status text not null default 'PENDING',
  pago_em timestamptz,
  ambiente text not null default 'sandbox' check (ambiente in ('sandbox', 'producao')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, parcela, ambiente)
);
create index if not exists cobrancas_lead_idx on public.cobrancas (lead_id);

alter table public.cobrancas enable row level security;
create policy cobrancas_admin_all on public.cobrancas for all using (public.is_admin()) with check (public.is_admin());
