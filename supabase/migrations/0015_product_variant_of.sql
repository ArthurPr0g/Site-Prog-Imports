-- Substitui a tabela product_variants por um link direto entre produtos:
-- cada variação de configuração passa a ser um produto completo (com suas
-- próprias fotos, descrição, SKU), ligado ao produto de origem via
-- variant_of. Isso resolve edição/exclusão individual e fotos ausentes,
-- que a tabela auxiliar não resolvia bem.
alter table public.products
  add column if not exists variant_of uuid references public.products(id) on delete set null;

create index if not exists products_variant_of_idx on public.products(variant_of);

drop table if exists public.product_variants cascade;
