-- Fila automática das 8h para o vendedor: desligada por pedido do dono em 28/10/2026
-- ("pode tirar os avisos para o Felipe por enquanto"). "fila" e "relatório" pedidos
-- por ele continuam respondidos. Para religar: update ia_config set fila_automatica = true. Aditiva.

alter table public.ia_config add column if not exists fila_automatica boolean not null default false;
