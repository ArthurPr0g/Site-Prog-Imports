-- Central de decisões e avisos do dia a dia (pedido do Arthur, 31/10/2026). Só acréscimos: nada muda no que já
-- está no ar.
--
-- 1. decisoes: cada decisão que o Arthur precisa tomar (desconto, assumir conversa, financeiro, dúvida da Lia,
--    pedido "Aguardando você", modelo recusado pela Meta, prazo da pré-venda...). Nasce quando o aviso sai (ou
--    quando o relógio acha uma pendência sem card) e sai da lista quando é resolvida, pelo WhatsApp ou pela tela
--    /admin/decisoes. A "chave" diz de onde veio (ex.: "desc:<pedido>", "prompt:<ideia>"): uma pendente por chave.
-- 2. ia_config.modelos_avisados: último status de cada modelo da Meta já avisado ao Arthur (uma vez por mudança).
-- 3. reunioes.resumo_arthur_em / lembrete_10min_em: resumo do cliente 15 min antes e lembrete ao cliente 10 min
--    antes (uma vez cada; o lembrete de 2 h continua em lembrete_em).
-- 4. leads.diag_olhando_aviso_em: aviso "está olhando o diagnóstico agora" (no máximo 1 a cada 6 h por lead).

create table if not exists public.decisoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null check (char_length(chave) <= 200),
  tipo text not null check (char_length(tipo) <= 40),
  origem text not null check (char_length(origem) <= 60),
  titulo text not null check (char_length(titulo) <= 300),
  resumo text check (resumo is null or char_length(resumo) <= 4000),
  pergunta text check (pergunta is null or char_length(pergunta) <= 500),
  -- {"cliente": "...", "valores": ["5% de desconto"], "links": [{"rotulo": "Conversa", "url": "..."}]}
  contexto jsonb not null default '{}'::jsonb,
  -- [{"id": "desc:ok:<uuid>", "titulo": "Aprovar desconto"}]: o mesmo id dos botões do WhatsApp (decisoes.ts).
  opcoes jsonb not null default '[]'::jsonb,
  conversation_id uuid references public.ia_conversations (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  ideia_id uuid references public.ideias (id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'resolvida', 'descartada')),
  resposta text check (resposta is null or char_length(resposta) <= 4000),
  resolvida_por text check (resolvida_por is null or char_length(resolvida_por) <= 40),
  resolvida_em timestamptz,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create unique index if not exists decisoes_chave_pendente_idx on public.decisoes (chave) where status = 'pendente';
create index if not exists decisoes_status_idx on public.decisoes (status, criada_em desc);
create index if not exists decisoes_conversa_idx on public.decisoes (conversation_id);
create index if not exists decisoes_lead_idx on public.decisoes (lead_id);
create index if not exists decisoes_ideia_idx on public.decisoes (ideia_id);

alter table public.decisoes enable row level security;
-- O painel lê e grava pela sessão do admin; o relógio e o webhook usam a chave do atendente (ignora o RLS).
create policy decisoes_admin_all on public.decisoes for all using (public.is_admin()) with check (public.is_admin());

comment on table public.decisoes is 'Central de decisões do Arthur (/admin/decisoes): o que espera uma resposta dele, com opções e histórico. 0117.';

alter table public.ia_config add column if not exists modelos_avisados jsonb not null default '{}'::jsonb;
comment on column public.ia_config.modelos_avisados is 'Último status de cada modelo da Meta já avisado ao Arthur no WhatsApp (aprovado/recusado/desativado). 0117.';

alter table public.reunioes
  add column if not exists resumo_arthur_em timestamptz,
  add column if not exists lembrete_10min_em timestamptz;
comment on column public.reunioes.resumo_arthur_em is 'Resumo do cliente mandado ao Arthur ~15 min antes da reunião. 0117.';
comment on column public.reunioes.lembrete_10min_em is 'Lembrete com o link da sala mandado ao cliente ~10 min antes. 0117.';

alter table public.leads add column if not exists diag_olhando_aviso_em timestamptz;
comment on column public.leads.diag_olhando_aviso_em is 'Último aviso "está olhando o diagnóstico agora" ao Arthur (no máximo 1 a cada 6 h). 0117.';

-- Resposta em texto pela central (regra do Arthur, 31/10/2026): roda no plano do Claude dele, pela fila do PC
-- (ideias tipo prompt), nunca pela API. O card fica "enviada" até o pedido terminar e então vira resolvida.
alter table public.decisoes drop constraint if exists decisoes_status_check;
alter table public.decisoes add constraint decisoes_status_check check (status in ('pendente', 'enviada', 'resolvida', 'descartada'));
alter table public.decisoes add column if not exists resposta_ideia_id uuid references public.ideias (id) on delete set null;
create index if not exists decisoes_resposta_ideia_idx on public.decisoes (resposta_ideia_id);
comment on column public.decisoes.resposta_ideia_id is 'Pedido na fila do PC criado pela resposta em texto (roda no plano do Claude do Arthur). Status enviada até a ideia terminar. 0117.';
