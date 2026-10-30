/*
 * 0103 — Time de agentes (pedido do Arthur, 30/10/2026): cada etapa depois da venda tem um agente com nome
 * próprio (mapa em docs/AGENTES.md). Os pedidos que o sistema faz a um agente entram na mesma fila do
 * executor (public.ideias, tipo 'prompt'):
 *   origem 'agente' — pedido aberto pelo sistema (ex.: sinal pago → Bia abre o projeto), não pelo Arthur;
 *   agente          — chave do agente que faz o pedido (bia, leo...), para os avisos dizerem quem fez.
 * Aditiva: o executor e a página Ideias continuam funcionando sem conhecer as colunas novas.
 */
alter table public.ideias add column if not exists agente text check (agente is null or char_length(agente) <= 40);
comment on column public.ideias.agente is 'Agente do time que faz o pedido (chave de src/lib/agentes/time.ts). 0103.';

alter table public.ideias drop constraint if exists ideias_origem_check;
alter table public.ideias add constraint ideias_origem_check check (origem in ('whatsapp', 'whatsapp_audio', 'hub', 'cliente', 'agente'));
