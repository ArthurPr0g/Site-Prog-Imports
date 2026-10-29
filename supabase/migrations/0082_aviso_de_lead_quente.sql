-- Aviso de lead quente (pedido do dono em 28/10/2026): o lead abriu o diagnóstico
-- e 15 min depois ainda não chamou no WhatsApp; o Arthur recebe aviso no WhatsApp
-- dele para ligar enquanto o lead está pensando no assunto. Guarda quando avisou,
-- para não repetir a mesma visita. Aditiva.

alter table public.leads add column if not exists diag_aviso_em timestamptz;
create index if not exists leads_diag_last_view_idx on public.leads (diag_last_view_at) where diag_last_view_at is not null;
