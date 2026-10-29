-- Sinal pago vira Prestação de serviço (2026-10-29).
--
-- Pedido do dono: quando o cliente paga o sinal no Asaas, a venda cai sozinha
-- na página de Prestação de serviço (ERP) para ele começar o desenvolvimento,
-- já enriquecida com o que a Captação sabe (diagnóstico, conversa, descoberta),
-- e ligada ao projeto do pós-venda (0086), que nasce no fechamento.

-- Não usada: o pacote da proposta já fica em leads.pacote (0086). Ficou por ter
-- sido aplicada antes de o pós-venda entrar; não apagar sem o dono pedir.
alter table public.leads add column if not exists closed_package jsonb;

-- De qual lead da Captação a prestação veio (null = criada à mão no ERP).
alter table public.service_orders
  add column if not exists lead_id uuid references public.leads(id) on delete set null;
create unique index if not exists service_orders_lead_unico_idx
  on public.service_orders (lead_id) where lead_id is not null and status <> 'Cancelada';

-- Projeto do pós-venda → prestação do ERP (aberta quando o sinal é pago).
alter table public.projetos
  add column if not exists service_order_id uuid references public.service_orders(id) on delete set null;
