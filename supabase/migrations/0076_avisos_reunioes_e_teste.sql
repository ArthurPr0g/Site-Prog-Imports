-- Atendente de IA (pedido do dono em 28/10/2026): avisos no WhatsApp do Arthur,
-- reuniões marcadas pela Lia no Google Agenda e conversas de teste (simulador do
-- painel e lead de teste fora do placar e do aprendizado). Aditiva: não muda nada
-- que já está no ar.

-- Avisos ao Arthur pelo WhatsApp (o número da Lia manda para o dele).
alter table public.ia_config add column if not exists owner_whatsapp text default '5562982133188';
-- Conta do WhatsApp Business (vem em cada webhook): necessária para criar o modelo de aviso.
alter table public.ia_config add column if not exists waba_id text;
-- Modelo "aviso_ao_arthur" na Meta: null = não criado; PENDING / APPROVED / REJECTED.
alter table public.ia_config add column if not exists aviso_template_status text;
-- Última mensagem do Arthur para o número da Lia: abre a janela de 24 h para texto livre.
alter table public.ia_config add column if not exists owner_last_inbound_at timestamptz;

create table if not exists public.ia_avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  texto text not null,
  conversation_id uuid references public.ia_conversations (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  -- texto (janela aberta), modelo (template aprovado) ou email.
  via text not null check (via in ('texto', 'modelo', 'email', 'nenhum')),
  external_id text unique,
  status text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ia_avisos_created_idx on public.ia_avisos (created_at desc);
alter table public.ia_avisos enable row level security;
create policy ia_avisos_admin_all on public.ia_avisos for all using (public.is_admin()) with check (public.is_admin());

-- Conversa de teste (lead de teste no WhatsApp ou simulador do painel): fica fora
-- do placar, do custo por resultado e do aprendizado. O simulador ainda tem
-- contact_id 'simulador:…' e nunca manda WhatsApp nem mexe em lead.
alter table public.ia_conversations add column if not exists is_test boolean not null default false;

-- Reuniões que a Lia marca (no Google Agenda do Arthur quando ele está conectado).
create table if not exists public.reunioes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  conversation_id uuid references public.ia_conversations (id) on delete set null,
  titulo text not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  email_cliente text,
  google_event_id text,
  meet_link text,
  status text not null default 'marcada' check (status in ('marcada', 'cancelada')),
  created_at timestamptz not null default now()
);
create index if not exists reunioes_inicio_idx on public.reunioes (inicio) where status = 'marcada';
alter table public.reunioes enable row level security;
create policy reunioes_admin_all on public.reunioes for all using (public.is_admin()) with check (public.is_admin());

-- Credenciais de integrações (refresh token do Google Agenda). Sem política:
-- só a chave do atendente (servidor) lê e grava; o navegador nunca vê.
create table if not exists public.integracoes (
  chave text primary key,
  dados jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.integracoes enable row level security;

-- A conversa do Felipe (lead de teste de 28/10/2026) vira teste.
update public.ia_conversations c set is_test = true
from public.leads l
where l.id = c.lead_id and l.source like 'teste%';
