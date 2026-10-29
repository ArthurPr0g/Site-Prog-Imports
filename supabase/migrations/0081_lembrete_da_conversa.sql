-- Lembrete dentro das 24 h (pedido do dono em 28/10/2026): cliente parou de
-- responder 3 h depois da última mensagem da Lia; ela manda UMA retomada curta,
-- ainda na janela do WhatsApp. Guarda quando foi, para não repetir no mesmo silêncio. Aditiva.

alter table public.ia_conversations add column if not exists lembrete_em timestamptz;
