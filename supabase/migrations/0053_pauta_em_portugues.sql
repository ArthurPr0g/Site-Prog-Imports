-- A pauta em português.
--
-- As cinco fontes publicam em inglês, e ler manchete em inglês para decidir o
-- que virar post em português é um pedágio em cada linha da lista. Pior: o
-- pedágio desestimula ler, e pauta que não é lida não serve para nada.
--
-- A tradução fica em coluna própria em vez de substituir o original por dois
-- motivos. O título em inglês é o que casa com a página da fonte quando o
-- dono abre o link — trocar faria a pauta e a matéria parecerem coisas
-- diferentes. E tradução automática pode sair torta: guardar o original
-- deixa conferir, em vez de só confiar.

alter table public.studio_topics
  add column if not exists titulo_pt text,
  add column if not exists resumo_pt text;

-- Para achar o que ainda falta traduzir numa atualização seguinte.
create index if not exists studio_topics_sem_traducao_idx
  on public.studio_topics (created_at desc)
  where titulo_pt is null;

comment on column public.studio_topics.titulo_pt is
  'Titulo traduzido para portugues do Brasil. Nulo enquanto nao traduzido; a tela cai no original.';

NOTIFY pgrst, 'reload schema';
