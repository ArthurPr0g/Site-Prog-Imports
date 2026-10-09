-- Publicar a peça do Estúdio no Instagram da loja.
--
-- A API de publicação do Instagram não aceita o arquivo: ela aceita uma URL
-- pública e vai buscar a imagem sozinha. Por isso a arte, que até agora só
-- existia desenhada no navegador, passa a ter uma cópia no storage. É cópia de
-- entrega, não a fonte — a fonte continua sendo o modelo mais os campos, e
-- redesenhar continua sendo o que mantém peça antiga coerente com playbook
-- novo.

create table if not exists public.studio_publications (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.studio_pieces(id) on delete cascade,
  -- 'feed', 'story', 'carrossel' ou 'reels': o que foi efetivamente enviado,
  -- que nem sempre é o formato do modelo (um carrossel pode sair como post
  -- único quando só um slide interessa).
  tipo text not null check (tipo in ('feed', 'story', 'carrossel', 'reels')),
  -- O id da mídia dentro do Instagram. É o que permite abrir a publicação
  -- depois e o que prova que ela existe de verdade.
  media_id text,
  permalink text,
  legenda text not null default '',
  -- As URLs enviadas, na ordem. Guardadas porque são a única prova de o que
  -- saiu: a peça pode ser editada depois, e aí o desenho atual não é mais o
  -- que está no ar.
  imagens text[] not null default '{}',
  -- 'enviando', 'publicada' ou 'falhou'. Container criado e publicação são
  -- duas chamadas; quando a segunda falha, a linha fica aqui com o motivo em
  -- vez de sumir.
  status text not null default 'enviando' check (status in ('enviando', 'publicada', 'falhou')),
  erro text,
  created_at timestamptz not null default now()
);

create index if not exists studio_publications_piece_idx
  on public.studio_publications (piece_id, created_at desc);

alter table public.studio_publications enable row level security;

create policy studio_publications_admin_all on public.studio_publications
  for all using (public.is_admin()) with check (public.is_admin());

-- O bucket da arte entregue.
--
-- Público porque o Instagram busca a imagem como um visitante qualquer: ele
-- não manda cabeçalho de autenticação nem aceita URL assinada de curta
-- duração com confiabilidade. O que fica aqui é peça de divulgação — a mesma
-- coisa que vai para o feed minutos depois.
insert into storage.buckets (id, name, public)
values ('studio-art', 'studio-art', true)
on conflict (id) do nothing;

create policy "studio_art_public_read" on storage.objects for select
  using (bucket_id = 'studio-art');

create policy "studio_art_admin_write" on storage.objects for insert
  with check (bucket_id = 'studio-art' and public.is_admin());

create policy "studio_art_admin_update" on storage.objects for update
  using (bucket_id = 'studio-art' and public.is_admin());

create policy "studio_art_admin_delete" on storage.objects for delete
  using (bucket_id = 'studio-art' and public.is_admin());

comment on table public.studio_publications is
  'O que o Estudio ja mandou para o Instagram da loja, com o id da midia e as URLs enviadas.';

NOTIFY pgrst, 'reload schema';
