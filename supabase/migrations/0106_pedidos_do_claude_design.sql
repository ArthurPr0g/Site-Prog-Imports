/*
 * 0106 — Pedidos do Claude Design só depois das etapas anteriores (pedido do Arthur em 30/10/2026).
 * Os pedidos da Duda e da Nina ficam disponíveis para copiar no Pós-venda quando: o projeto está aberto
 * (pasta da Bia), o financeiro está resolvido e o cliente confirmou a descoberta. Aí a Bia gera a versão
 * final e grava o texto aqui. Aditiva.
 *   leads.briefing_confirmado_em     — o cliente confirmou o resumo da descoberta (Lia, ferramenta confirmar_briefing)
 *   projetos.briefing_confirmado_em  — o mesmo, no projeto (ou o Arthur marca no painel)
 *   projetos.pedidos_design          — { pedido_em, prontos_em, avisado_em, duda, nina }
 */
alter table public.leads add column if not exists briefing_confirmado_em timestamptz;
alter table public.projetos add column if not exists briefing_confirmado_em timestamptz;
alter table public.projetos add column if not exists pedidos_design jsonb not null default '{}'::jsonb;
comment on column public.projetos.pedidos_design is 'Pedidos finais do Claude Design (0106): {pedido_em, prontos_em, avisado_em, duda, nina}. Escritos pela Bia.';
