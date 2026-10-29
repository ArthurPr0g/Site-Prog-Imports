-- Pós-venda da Prog Soluções (pedido do dono em 28/10/2026; decisões no
-- docs/CAPTACAO-BACKLOG.md, P1–P9). Venda feita (pelo painel, pelo vendedor ou pela
-- Lia) cria o projeto com os serviços vendidos, prazo, entrega prevista e o contador
-- de rodadas de ajuste por serviço. Cada rodada fica registrada (pedido, quem atendeu,
-- entrega, aceite); passou do que o contrato inclui, a rodada nasce "extra" (vira
-- orçamento). Reuniões ligam ao projeto/rodada. Mora no mesmo banco do ERP e só
-- aponta para o orçamento/contrato de lá (service_quotes), sem copiar nada. Aditiva.

-- Pacote que o lead escolheu (mesma forma do simulador): a Lia grava ao passar o preço.
alter table public.leads add column if not exists pacote jsonb;

create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  service_quote_id uuid references public.service_quotes (id) on delete set null,
  cliente text not null,
  responsavel text,
  vendido_por text not null,
  vendido_em timestamptz not null default now(),
  pacote jsonb,
  moeda text not null default 'BRL' check (moeda in ('BRL', 'USD')),
  valor numeric(12, 2),
  mensal numeric(12, 2),
  prazo_dias integer not null default 0,
  entrega_prevista date,
  entregue_em date,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'entregue', 'em_suporte', 'encerrado')),
  observacoes text,
  created_at timestamptz not null default now()
);
create unique index if not exists projetos_lead_unico on public.projetos (lead_id) where lead_id is not null;

create table if not exists public.projeto_servicos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  tipo text not null check (tipo in ('site', 'loja', 'erp', 'marca')),
  nome text not null,
  rodadas_incluidas integer not null default 2,
  suporte_dias integer not null default 0,
  prazo_dias integer not null default 0,
  posicao integer not null default 0
);

create table if not exists public.rodadas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  servico_id uuid not null references public.projeto_servicos (id) on delete cascade,
  numero integer not null,
  extra boolean not null default false,
  pedido text not null,
  pedido_em timestamptz not null default now(),
  atendido_por text,
  entregue_em timestamptz,
  aceite_em timestamptz,
  status text not null default 'aberta' check (status in ('aberta', 'entregue', 'aceita')),
  created_at timestamptz not null default now()
);
create index if not exists rodadas_projeto_idx on public.rodadas (projeto_id, servico_id);

alter table public.reunioes add column if not exists projeto_id uuid references public.projetos (id) on delete set null;
alter table public.reunioes add column if not exists rodada_id uuid references public.rodadas (id) on delete set null;
alter table public.reunioes add column if not exists ata text;

-- Resumo diário de pendências do pós-venda no WhatsApp do Arthur (uma vez por dia).
alter table public.ia_config add column if not exists posvenda_resumo_em date;

alter table public.projetos enable row level security;
alter table public.projeto_servicos enable row level security;
alter table public.rodadas enable row level security;
create policy projetos_admin_all on public.projetos for all using (public.is_admin()) with check (public.is_admin());
create policy projeto_servicos_admin_all on public.projeto_servicos for all using (public.is_admin()) with check (public.is_admin());
create policy rodadas_admin_all on public.rodadas for all using (public.is_admin()) with check (public.is_admin());
