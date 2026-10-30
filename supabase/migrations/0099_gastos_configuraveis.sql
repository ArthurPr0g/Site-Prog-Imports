/*
 * 0099 — Página de Gastos (pedido do Arthur em 30/10/2026): controle detalhado de tudo o que se gasta
 * (IA, mensagens da Meta, transcrição, custos fixos) com os parâmetros editáveis pelo painel.
 *   ia_config.custos = {
 *     dolar: null (usa a cotação do dia) | número,
 *     meta_utilidade_usd, meta_marketing_usd, meta_servico_gratis_mes, meta_servico_usd,
 *     transcricao_usd_hora, minutos_por_audio,
 *     respostas_por_projeto, pesquisas_por_projeto, modelos_por_projeto,
 *     fixos: [{ id, nome, valor_brl, periodo: 'mensal'|'anual', categoria }]
 *   }
 * Preços iniciais da Meta (Brasil): utilidade US$ 0,0068 por mensagem entregue (página oficial de preços,
 * consultada em 30/10/2026); marketing US$ 0,0625 (guias de terceiros, confirmar); 1.000 mensagens de
 * serviço grátis por mês por número. Transcrição: preço do provedor a preencher pelo Arthur.
 * O teto da IA continua em ia_config.monthly_budget_usd (a Lia para de responder ao atingir).
 */
alter table public.ia_config add column if not exists custos jsonb not null default jsonb_build_object(
  'dolar', null,
  'meta_utilidade_usd', 0.0068,
  'meta_marketing_usd', 0.0625,
  'meta_servico_gratis_mes', 1000,
  'meta_servico_usd', 0,
  'transcricao_usd_hora', 0,
  'minutos_por_audio', 1,
  'respostas_por_projeto', 40,
  'pesquisas_por_projeto', 2,
  'modelos_por_projeto', 5,
  'fixos', '[]'::jsonb
);
comment on column public.ia_config.custos is 'Parâmetros da página de Gastos (preços da Meta, transcrição, premissas da estimativa, custos fixos). 0099.';
