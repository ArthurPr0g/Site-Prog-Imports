-- Reordenação manual (arrastar e soltar) de coleções e produtos, e opção de
-- ativar/desativar categoria para controlar a exibição no site.
alter table public.collections add column if not exists position int not null default 0;
alter table public.products add column if not exists position int not null default 0;
alter table public.categories add column if not exists active boolean not null default true;

-- Backfill: preserva a ordem atual como ponto de partida para a nova ordem manual.
with ordered as (
  select id, row_number() over (order by name) - 1 as rn from public.collections
)
update public.collections c set position = ordered.rn from ordered where ordered.id = c.id;

with ordered as (
  select id, row_number() over (order by created_at) - 1 as rn from public.products
)
update public.products p set position = ordered.rn from ordered where ordered.id = p.id;
