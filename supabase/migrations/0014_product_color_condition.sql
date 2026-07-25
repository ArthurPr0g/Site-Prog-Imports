-- Cor e estado físico (Novo/Seminovo/Open Box), aplicáveis a qualquer produto,
-- independente das specs técnicas (que variam por categoria).
alter table public.products
  add column if not exists color text not null default '',
  add column if not exists condition text not null default 'Novo';
