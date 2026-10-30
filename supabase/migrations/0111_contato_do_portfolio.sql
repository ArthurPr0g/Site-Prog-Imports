-- Formulário de contato do portfólio → Lia (pedido do Arthur, 30/10/2026).
-- Cada envio do formulário vira uma linha aqui. A Lia só chama o cliente depois de terminar a preparação
-- (pesquisa do lead + pré-briefing com empresa, ramo, presença online, pedido e pacote). Se o cliente
-- escrever antes, a resposta espera a preparação (até ~10 min). Fora da janela de 24 h, só com o modelo
-- contato_portfolio aprovado pela Meta (status aguardando_modelo até lá).
-- Só o servidor (chave do atendente, que ignora o RLS) lê e grava: RLS ligado e sem políticas.

create table if not exists public.contatos_portfolio (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(nome) between 1 and 120),
  telefone text check (telefone is null or telefone ~ '^[0-9]{10,15}$'),
  email text check (email is null or char_length(email) <= 200),
  mensagem text check (mensagem is null or char_length(mensagem) <= 3000),
  idioma text check (idioma is null or char_length(idioma) <= 10),
  pagina text check (pagina is null or char_length(pagina) <= 500),
  -- Hash do IP (não o IP): só para o limite de envios.
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 64),
  lead_id uuid references public.leads (id) on delete set null,
  conversation_id uuid references public.ia_conversations (id) on delete set null,
  status text not null default 'preparando' check (
    status in ('preparando', 'aguardando_modelo', 'contatado', 'respondido', 'sem_whatsapp', 'dono', 'cancelado')
  ),
  -- Pré-briefing montado com a pesquisa e o formulário (empresa, ramo, presença, pedido, pacote, assunto...).
  preparo jsonb,
  preparado_em timestamptz,
  cliente_escreveu_em timestamptz,
  respondido_em timestamptz,
  contatado_em timestamptz,
  erro text check (erro is null or char_length(erro) <= 1000),
  is_test boolean not null default false
);

create index if not exists contatos_portfolio_criado_em_idx on public.contatos_portfolio (criado_em desc);
create index if not exists contatos_portfolio_telefone_idx on public.contatos_portfolio (telefone);
create index if not exists contatos_portfolio_ip_idx on public.contatos_portfolio (ip_hash);
create index if not exists contatos_portfolio_conversa_idx on public.contatos_portfolio (conversation_id);
create index if not exists contatos_portfolio_lead_idx on public.contatos_portfolio (lead_id);
create index if not exists contatos_portfolio_abertos_idx on public.contatos_portfolio (status) where status in ('preparando', 'aguardando_modelo');

alter table public.contatos_portfolio enable row level security;
revoke all on table public.contatos_portfolio from anon, authenticated;

comment on table public.contatos_portfolio is
  'Envios do formulário de contato do portfólio (0111). A Lia prepara (pesquisa + pré-briefing) e só então chama o cliente.';
