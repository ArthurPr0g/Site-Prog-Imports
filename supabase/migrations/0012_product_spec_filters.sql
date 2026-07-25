-- Campos técnicos de especificação por produto, usados para filtro avançado
-- nas páginas de coleção (GPU, CPU, RAM, Armazenamento, Tipo de tela).
alter table public.products
  add column if not exists gpu text not null default '',
  add column if not exists cpu text not null default '',
  add column if not exists ram text not null default '',
  add column if not exists storage text not null default '',
  add column if not exists screen_type text not null default '';
