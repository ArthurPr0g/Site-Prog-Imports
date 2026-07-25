-- O nome exibido do produto (name) passa a ser sempre composto: nome base +
-- especificações da categoria. Para isso precisamos guardar o nome base
-- (o que o admin digita) separado do nome final composto. Variações herdam
-- o nome base do produto de origem.
alter table public.products
  add column if not exists base_name text;

update public.products
  set base_name = name
  where base_name is null and variant_of is null;

update public.products p
  set base_name = r.name
  from public.products r
  where p.variant_of = r.id and p.base_name is null;

update public.products
  set base_name = name
  where base_name is null;

NOTIFY pgrst, 'reload schema';
