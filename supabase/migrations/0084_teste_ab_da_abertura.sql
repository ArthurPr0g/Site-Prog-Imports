-- Teste A/B da abertura da Lia (pedido do dono em 28/10/2026). A = abertura atual
-- (achado + "Ver preço agora | Tirar uma dúvida"); B = proposta em PDF já na 1ª
-- resposta. Sorteado na primeira resposta e fixo até o fim da conversa. Aditiva.

alter table public.ia_conversations add column if not exists abertura text check (abertura in ('A', 'B'));
