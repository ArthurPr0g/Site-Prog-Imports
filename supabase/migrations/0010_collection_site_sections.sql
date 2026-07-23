-- Permite escolher até 4 coleções para virarem seções na home (feed horizontal),
-- com posição própria de exibição no site (independente da ordem de arrastar do admin).
alter table public.collections
  add column if not exists show_on_site boolean not null default false,
  add column if not exists site_position int not null default 0;

-- Ativa as 3 coleções já existentes por padrão, para a home não ficar vazia
-- antes do admin configurar manualmente em Gerenciamento > Catálogo.
update public.collections set show_on_site = true, site_position = 1 where name = 'Lançamentos';
update public.collections set show_on_site = true, site_position = 2 where name = 'Promoções';
update public.collections set show_on_site = true, site_position = 3 where name = 'Mais vendidos';
