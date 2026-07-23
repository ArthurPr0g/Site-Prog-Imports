-- Agora "mostrar no topo" (carrossel com capas) e "mostrar no feed" (seção
-- horizontal na home) são independentes, sem limite de quantidade. O front-end
-- decide o link do card do topo: se a coleção também está no feed, ele pula
-- para a seção correspondente; senão, abre a página dedicada /colecao/[id].
alter table public.collections
  add column if not exists show_in_feed boolean not null default false;

-- Preserva o comportamento atual: as coleções que já apareciam na home (via
-- show_on_site) continuam aparecendo também no feed até o admin ajustar.
update public.collections set show_in_feed = true where show_on_site = true;
