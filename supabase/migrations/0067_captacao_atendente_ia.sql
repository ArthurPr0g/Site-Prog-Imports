-- Captação: atendente de IA no WhatsApp (2026-10-28).
--
-- Pedido do dono: uma IA que atende os leads do primeiro contato ao fechamento,
-- com cada conversa e a situação do lead no painel, e que só chama o Arthur
-- quando precisa. A IA é mais uma "vendedora": um link (lead_seller_kits) com
-- kind = 'ia'. O dono manda cada lead para o Felipe ou para a IA e o placar
-- compara os dois em tempo real.
--
-- Quem escreve nestas tabelas é o servidor (webhook do WhatsApp e o tick a cada
-- minuto), com a chave secreta do atendente, que ignora o RLS. O painel lê e
-- age com a sessão do admin (policies abaixo).
--
-- Regras de canal (política do WhatsApp): a empresa só manda a 1ª mensagem para
-- quem deu o número e aceitou contato. Por isso a IA chega por e-mail, com um
-- botão "Falar no WhatsApp"; a conversa no WhatsApp sempre começa pelo lead.

-- 1) A IA como vendedora --------------------------------------------------------
alter table public.lead_seller_kits
  add column if not exists kind text not null default 'pessoa' check (kind in ('pessoa', 'ia'));

-- 2) Configuração (uma linha só) -----------------------------------------------
create table if not exists public.ia_config (
  id boolean primary key default true check (id),
  -- Nome com que a IA se apresenta (nome de pessoa, pedido do dono). Se o lead
  -- perguntar diretamente se fala com um robô, ela confirma que é IA.
  persona_name text not null default 'Lia',
  active boolean not null default false,
  model text not null default 'claude-opus-5-5'
    check (model in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5')),
  -- Teto de gasto com a IA no mês (dólar). Passou do teto, a IA para e chama o Arthur.
  monthly_budget_usd numeric(8,2) not null default 30 check (monthly_budget_usd >= 0),
  -- Desconto além do combo: até este %, só quando o cliente pede e a IA julga necessário.
  extra_discount_max numeric(4,1) not null default 10 check (extra_discount_max between 0 and 30),
  -- O "vou ver com meu superior": o pedido espera este tempo. O Arthur pode
  -- negar (ou liberar antes) no painel; sem resposta, a IA libera sozinha.
  discount_wait_minutes integer not null default 6 check (discount_wait_minutes between 1 and 120),
  -- E-mails de primeiro contato por dia (aquecimento do remetente).
  daily_email_cap integer not null default 15 check (daily_email_cap between 0 and 200),
  -- Para onde vai o aviso "preciso de você" (e-mail do Arthur).
  owner_email text,
  updated_at timestamptz not null default now()
);
insert into public.ia_config (id) values (true) on conflict (id) do nothing;

-- 3) Conversas e mensagens -----------------------------------------------------
create table if not exists public.ia_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'instagram')),
  -- WhatsApp: número com DDI, só dígitos. Instagram: id do usuário na conta.
  contact_id text not null,
  contact_name text,
  lead_id uuid references public.leads(id) on delete set null,
  kit_id uuid references public.lead_seller_kits(id) on delete set null,
  -- ia = a IA responde; humano = o Arthur assumiu (a IA fica calada).
  mode text not null default 'ia' check (mode in ('ia', 'humano')),
  needs_human boolean not null default false,
  needs_human_reason text,
  summary text,
  last_inbound_at timestamptz,
  last_message_at timestamptz not null default now(),
  unread integer not null default 0,
  created_at timestamptz not null default now(),
  unique (channel, contact_id)
);
create index if not exists ia_conversations_lead_idx on public.ia_conversations (lead_id);
create index if not exists ia_conversations_recentes_idx on public.ia_conversations (last_message_at desc);

create table if not exists public.ia_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ia_conversations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  author text not null check (author in ('lead', 'ia', 'arthur', 'sistema')),
  body text not null,
  -- Id da mensagem no WhatsApp: evita gravar duas vezes o mesmo webhook.
  external_id text unique,
  status text,     -- sent, delivered, read, failed
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ia_messages_conversa_idx on public.ia_messages (conversation_id, created_at);

-- 4) Pedido de desconto extra (o "vou ver com meu superior") --------------------
create table if not exists public.ia_discount_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ia_conversations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  percent numeric(4,1) not null check (percent > 0 and percent <= 30),
  reason text,
  status text not null default 'aguardando' check (status in ('aguardando', 'aprovado', 'negado')),
  release_at timestamptz not null,
  decided_by text,          -- 'arthur' ou 'automatico'
  decided_at timestamptz,
  -- Quando a IA já deu a resposta ao cliente.
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ia_discount_pendentes_idx on public.ia_discount_requests (status, release_at);

-- 5) E-mails de primeiro contato e retorno ----------------------------------------
create table if not exists public.ia_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  kit_id uuid references public.lead_seller_kits(id) on delete set null,
  step integer not null check (step between 0 and 3),
  to_email text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (lead_id, step)
);

-- 6) Gasto com a IA (para o teto do mês) -----------------------------------------
create table if not exists public.ia_usage (
  id bigint generated always as identity primary key,
  conversation_id uuid references public.ia_conversations(id) on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd numeric(10,5) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ia_usage_data_idx on public.ia_usage (created_at);

-- RLS: só o admin pelo painel; o servidor usa a chave secreta.
alter table public.ia_config enable row level security;
alter table public.ia_conversations enable row level security;
alter table public.ia_messages enable row level security;
alter table public.ia_discount_requests enable row level security;
alter table public.ia_emails enable row level security;
alter table public.ia_usage enable row level security;
create policy ia_config_admin_all on public.ia_config for all using (public.is_admin()) with check (public.is_admin());
create policy ia_conversations_admin_all on public.ia_conversations for all using (public.is_admin()) with check (public.is_admin());
create policy ia_messages_admin_all on public.ia_messages for all using (public.is_admin()) with check (public.is_admin());
create policy ia_discount_requests_admin_all on public.ia_discount_requests for all using (public.is_admin()) with check (public.is_admin());
create policy ia_emails_admin_all on public.ia_emails for all using (public.is_admin()) with check (public.is_admin());
create policy ia_usage_admin_all on public.ia_usage for all using (public.is_admin()) with check (public.is_admin());

-- 7) Relógio do atendente: a cada minuto chama /api/atendente/tick (libera o
-- desconto que esperou, manda os e-mails do dia e os retornos). O segredo fica
-- no Vault (nome 'atendente_tick_secret'), criado à mão, nunca no git:
--   select vault.create_secret('<o mesmo valor de ATENDENTE_TICK_SECRET na Vercel>', 'atendente_tick_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('atendente-tick') where exists (select 1 from cron.job where jobname = 'atendente-tick');
  perform cron.schedule(
    'atendente-tick',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://www.prog-imports.com/api/atendente/tick',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'authorization', 'Bearer ' || coalesce(
            (select decrypted_secret from vault.decrypted_secrets where name = 'atendente_tick_secret'), '')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      )
      where exists (select 1 from public.ia_config where active);
    $cron$
  );
end $$;
