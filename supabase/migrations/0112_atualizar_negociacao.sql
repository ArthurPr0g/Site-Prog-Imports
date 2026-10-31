-- "Atualizar a negociação" pelo WhatsApp da Lia (pedido do Arthur, 30/10/2026).
-- O Arthur manda (texto ou áudio) "atualiza a negociação do Matheus" / "como foi a reunião com X": a Lia
-- localiza o cliente (confirma com botões), recebe o relato da reunião (áudio, texto colado ou link de
-- transcrição), a IA atualiza o lead (notas, briefing, etapa) e deixa um aviso interno na conversa.
--
-- negociacao_sessoes: uma sessão por pedido (dono → cliente escolhido → conteúdo → processado), com validade.
-- Só o servidor (chave do atendente, que ignora o RLS) lê e grava: RLS ligado e sem políticas.
-- leads.atualizacoes_do_dono: histórico dos resumos (o painel mostra na ficha do lead; leads já tem a política de admin).

create table if not exists public.negociacao_sessoes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '3 hours'),
  dono text not null check (char_length(dono) <= 20),
  status text not null default 'escolhendo' check (
    status in ('perguntando', 'escolhendo', 'confirmando', 'aguardando_conteudo', 'processando', 'concluida', 'cancelada', 'erro')
  ),
  -- Frase que abriu a sessão (já transcrita, se era áudio).
  pedido text check (pedido is null or char_length(pedido) <= 8000),
  nome_falado text check (nome_falado is null or char_length(nome_falado) <= 120),
  -- [{lead_id, conversation_id, nome, descricao}] mostrados nos botões.
  candidatos jsonb,
  lead_id uuid references public.leads (id) on delete set null,
  conversation_id uuid references public.ia_conversations (id) on delete set null,
  -- Relato da reunião, juntando as partes que chegam (o WhatsApp corta textos longos).
  conteudo text check (conteudo is null or char_length(conteudo) <= 60000),
  ultima_parte_em timestamptz,
  -- Ids das mensagens do WhatsApp já tratadas (o webhook pode repetir).
  mensagens text[] not null default '{}',
  resultado jsonb,
  erro text check (erro is null or char_length(erro) <= 1000)
);

create index if not exists negociacao_sessoes_dono_idx on public.negociacao_sessoes (dono, atualizado_em desc);
create index if not exists negociacao_sessoes_abertas_idx on public.negociacao_sessoes (status)
  where status in ('perguntando', 'escolhendo', 'confirmando', 'aguardando_conteudo', 'processando');
create index if not exists negociacao_sessoes_lead_idx on public.negociacao_sessoes (lead_id);
create index if not exists negociacao_sessoes_conversa_idx on public.negociacao_sessoes (conversation_id);

alter table public.negociacao_sessoes enable row level security;

alter table public.leads add column if not exists atualizacoes_do_dono jsonb;
