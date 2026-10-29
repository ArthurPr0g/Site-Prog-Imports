/*
 * 0089 — A Lia organiza a ideia antes de anotar (pedido do Arthur em 29/10/2026: "leia, interprete e
 * melhore um pouco, organize a ideia, mas sem aumentar muito").
 *
 *   titulo    resumo curto gerado pela IA
 *   original  o que o Arthur mandou (ou a transcrição do áudio), do jeito que chegou
 * ideias.texto passa a ser a versão organizada; sem IA (falha ou indisponível), texto = original.
 * As funções da 0088 continuam iguais: ideias_listar já devolve as colunas novas.
 */
alter table public.ideias add column if not exists titulo text check (titulo is null or char_length(titulo) <= 120);
alter table public.ideias add column if not exists original text check (original is null or char_length(original) <= 8000);
comment on column public.ideias.titulo is 'Título curto gerado pela Lia ao organizar a ideia. 0089.';
comment on column public.ideias.original is 'Mensagem do Arthur (ou transcrição do áudio) como chegou; texto é a versão organizada. 0089.';
