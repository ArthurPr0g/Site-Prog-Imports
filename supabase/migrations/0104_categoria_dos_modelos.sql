/*
 * 0104 — Categoria de cada modelo da Meta (30/10/2026). A Meta reclassificou 6 modelos criados como utilidade
 * para marketing (allow_category_change), e marketing custa ~9x mais por mensagem no Brasil (US$ 0,0625 x
 * US$ 0,0068). A página Gastos passa a cobrar cada mensagem modelo pela categoria real. Aditiva.
 */
alter table public.ia_config add column if not exists modelos_categoria jsonb not null default '{}'::jsonb;
comment on column public.ia_config.modelos_categoria is 'Categoria de cada modelo na Meta (UTILITY/MARKETING), gravada pelo relógio. 0104.';
