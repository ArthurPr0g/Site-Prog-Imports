-- Quantos comentários o painel já leu de cada post.
--
-- Ler os comentários é uma chamada à API por post. Com doze posts tanto faz;
-- com cem, abrir o painel viraria cem chamadas — e o limite da Meta é por hora.
-- Guardando o número lido, o painel só relê o post cujo contador mudou desde a
-- última vez: um comentário novo, uma chamada; nenhum, nenhuma.
alter table public.studio_posts
  add column if not exists comentarios_lidos integer not null default -1;

NOTIFY pgrst, 'reload schema';
