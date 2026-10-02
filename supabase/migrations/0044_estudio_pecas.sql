-- Estúdio: as peças de Instagram que a loja produz a partir do playbook.
--
-- Uma peça guarda só o que é dela: qual modelo do playbook usar, que produto
-- entra e o texto de cada campo. A arte não é gravada — é redesenhada em canvas
-- toda vez, no tamanho final. Guardar PNG aqui envelheceria junto com o
-- playbook: mudou a regra de cor, as peças antigas sairiam erradas e ninguém
-- saberia. Redesenhar mantém tudo coerente e deixa o arquivo pesado fora do
-- banco.
--
-- `conteudo` é jsonb porque cada modelo pede campos diferentes — o 3C tem
-- preço-de e preço-por, o 5B tem duas opções de enquete, o 4A tem cinco
-- slides. Uma coluna por campo viraria uma tabela com quarenta colunas nulas.

create table if not exists public.studio_pieces (
  id uuid primary key default gen_random_uuid(),
  -- Código do modelo no playbook: 3a, 3b, 3c, 3d, 3e, 4a, 4b, 5a, 5b, 5c, 5d,
  -- 5e1, 5e2, 5e3. Fica como texto de propósito: o playbook ganha modelo novo
  -- com mais frequência do que o banco deveria ganhar migration.
  modelo text not null,
  formato text not null check (formato in ('feed', 'story', 'carrossel', 'destaque')),
  titulo text not null,
  conteudo jsonb not null default '{}'::jsonb,
  -- O produto é opcional: peça educativa e capa de destaque não têm um.
  product_id uuid references public.products(id) on delete set null,
  legenda text not null default '',
  status text not null default 'Rascunho' check (status in ('Rascunho', 'Pronta', 'Publicada')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_pieces_status_idx on public.studio_pieces (status, position desc, created_at desc);
create index if not exists studio_pieces_product_idx on public.studio_pieces (product_id);

alter table public.studio_pieces enable row level security;

-- Peça de divulgação não é conteúdo público enquanto não foi publicada, e o
-- rascunho carrega preço que ainda não está no ar.
create policy studio_pieces_admin_all on public.studio_pieces
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.studio_pieces is
  'Pecas de Instagram do Estudio. A arte e redesenhada em canvas a partir do modelo do playbook; aqui ficam so os campos.';

NOTIFY pgrst, 'reload schema';
