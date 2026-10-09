-- Painel de acompanhamento dos posts do Instagram.
--
-- Três coisas que a API não guarda por nós e que o dono precisa ter à mão.

-- 1) O que cada post pede e o que se responde a quem pediu.
--
-- Vale para todo post da conta, não só os publicados pelo Estúdio: os doze posts
-- que já existiam foram feitos pelo aplicativo, e o "QUERO" de um deles precisa
-- de resposta tanto quanto o de uma peça nova. Quando o post veio de uma peça,
-- `piece_id` aponta para ela e a resposta pode sair da peça; quando não, a
-- resposta mora aqui.
create table if not exists public.studio_posts (
  media_id text primary key,
  piece_id uuid references public.studio_pieces(id) on delete set null,
  -- A palavra que o post pede. Vazia = detectar pela legenda ("Comente QUERO").
  palavra text not null default '',
  -- A mensagem de direct para quem pedir. Vazia = usar a da peça vinculada.
  resposta text not null default '',
  atualizado_em timestamptz not null default now()
);

alter table public.studio_posts enable row level security;
create policy studio_posts_admin_all on public.studio_posts
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) A fila de quem pediu.
--
-- Cada comentário com a palavra-chave vira uma linha, e `respondido_em` é o
-- controle: enquanto está nulo, alguém está esperando o direct. A resposta é
-- manual (a automática depende de revisão da Meta), e manual sem lista é como
-- se esquece cliente.
create table if not exists public.studio_respostas (
  id uuid primary key default gen_random_uuid(),
  media_id text not null,
  comment_id text not null unique,
  usuario text not null,
  texto text not null default '',
  palavra text not null default '',
  comentado_em timestamptz not null,
  respondido_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists studio_respostas_media_idx on public.studio_respostas (media_id, comentado_em desc);
create index if not exists studio_respostas_pendentes_idx on public.studio_respostas (comentado_em)
  where respondido_em is null;

alter table public.studio_respostas enable row level security;
create policy studio_respostas_admin_all on public.studio_respostas
  for all using (public.is_admin()) with check (public.is_admin());

-- 3) Seguidores ao longo do tempo.
--
-- A API só devolve o número de agora. A curva existe se alguém anotar um ponto
-- por dia — e quem anota é o próprio painel, a cada vez que é aberto.
create table if not exists public.studio_perfil_diario (
  dia date primary key,
  seguidores integer not null,
  seguindo integer not null default 0,
  posts integer not null default 0,
  atualizado_em timestamptz not null default now()
);

alter table public.studio_perfil_diario enable row level security;
create policy studio_perfil_diario_admin_all on public.studio_perfil_diario
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.studio_posts is 'Configuracao de cada post do Instagram: palavra-chave, resposta de direct e peca de origem.';
comment on table public.studio_respostas is 'Comentarios com a palavra-chave, e se ja receberam o direct.';
comment on table public.studio_perfil_diario is 'Um ponto por dia do perfil do Instagram, para a curva de seguidores.';

NOTIFY pgrst, 'reload schema';
