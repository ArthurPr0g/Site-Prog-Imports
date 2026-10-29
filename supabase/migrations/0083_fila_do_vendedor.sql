-- Fila do dia no WhatsApp do vendedor (pedido do dono em 28/10/2026): o número da
-- Lia manda ao Felipe os 5 leads do dia com a mensagem pronta e responde "fila" e
-- "relatório". Guarda a última mensagem dele para a Lia (janela de 24 h do WhatsApp),
-- quando a fila saiu (uma por dia) e o status do modelo da Meta para quando a janela
-- está fechada. Aditiva.

alter table public.lead_seller_kits add column if not exists ultima_msg_em timestamptz;
alter table public.lead_seller_kits add column if not exists fila_enviada_em timestamptz;
alter table public.ia_config add column if not exists fila_template_status text;
