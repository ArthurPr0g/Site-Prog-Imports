-- Uma resposta da Lia por vez em cada conversa (28/10/2026). Duas orientações
-- seguidas fizeram duas respostas rodarem juntas e uma delas mandou ao cliente um
-- relatório para o Arthur. Quem responde marca até quando está ocupado; outra
-- execução no mesmo período não roda. Aditiva.

alter table public.ia_conversations add column if not exists respondendo_ate timestamptz;
