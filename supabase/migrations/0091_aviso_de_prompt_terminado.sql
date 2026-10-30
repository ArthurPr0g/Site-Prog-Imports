/*
 * 0091 — A Lia avisa o Arthur no WhatsApp quando um prompt dele termina (pedido de 29/10/2026).
 * O relógio (/api/atendente/tick) pega os prompts 'feito' ou 'parcial' cujo aviso ainda não saiu nesse
 * status (avisado_status diferente do status) e manda pelo avisarArthur. Um 'parcial' que depois vira
 * 'feito' gera os dois avisos.
 */
alter table public.ideias add column if not exists avisado_status text;
comment on column public.ideias.avisado_status is 'Último status (feito/parcial) já avisado ao Arthur no WhatsApp. 0091.';
