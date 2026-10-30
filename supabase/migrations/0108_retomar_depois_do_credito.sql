/*
 * 0108 — Créditos da Anthropic acabaram: nada se perde e a Lia retoma sozinha (pedido do Arthur em 30/10/2026).
 *   ia_conversations.ia_pendente_desde  — a conversa ficou sem resposta da Lia por falta de crédito
 *   ia_config.ia_sem_credito_desde      — desde quando a IA está sem crédito (null = funcionando)
 * O relógio testa a cada 2 min; quando volta, responde as conversas paradas, em ordem. Aditiva.
 */
alter table public.ia_conversations add column if not exists ia_pendente_desde timestamptz;
alter table public.ia_config add column if not exists ia_sem_credito_desde timestamptz;
comment on column public.ia_conversations.ia_pendente_desde is 'Sem resposta da Lia por falta de crédito da Anthropic; o relógio retoma (0108).';
