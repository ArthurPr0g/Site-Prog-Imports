-- Pauta: os assuntos de tecnologia que podem virar post.
--
-- O Estúdio já sabia desenhar e escrever; o que faltava era o começo da
-- conversa — de onde vem o assunto. A pauta busca lançamentos e notícias nas
-- fontes do setor, pontua por relevância para o que a loja vende e deixa o dono
-- ler e decidir. Quem escolhe o que vira peça é ele; o sistema só traz a mesa
-- posta.
--
-- `url` é a chave natural: a mesma notícia aparece em atualizações seguidas, e
-- sem a restrição a lista encheria de repetição a cada clique em "atualizar".
-- Guardar o que foi descartado é o que impede uma notícia recusada de voltar
-- amanhã como novidade.

create table if not exists public.studio_topics (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  resumo text not null default '',
  fonte text not null,
  url text not null unique,
  publicado_em timestamptz,
  -- Quantos sinais do catálogo o texto tocou. Ordena a lista: notícia de
  -- Alienware vale mais para esta loja que notícia de carro elétrico.
  relevancia integer not null default 0,
  -- As marcas reconhecidas no texto, para o dono ver por que aquilo subiu.
  marcas text[] not null default '{}',
  status text not null default 'novo' check (status in ('novo', 'descartado', 'produzido')),
  created_at timestamptz not null default now()
);

create index if not exists studio_topics_fila_idx
  on public.studio_topics (status, relevancia desc, publicado_em desc nulls last);

alter table public.studio_topics enable row level security;

-- Pauta é material de trabalho do dono, não conteúdo da loja.
create policy studio_topics_admin_all on public.studio_topics
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.studio_topics is
  'Pauta do Estudio: assuntos de tecnologia buscados nas fontes do setor, pontuados pelo que a loja vende.';

NOTIFY pgrst, 'reload schema';
