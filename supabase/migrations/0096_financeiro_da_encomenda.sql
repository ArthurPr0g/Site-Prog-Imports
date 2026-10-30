/*
 * 0096 — Financeiro dos leads que o Arthur manda à Lia (pedido de 30/10/2026): depois da confirmação, a Lia
 * pergunta ao Arthur (com botões) em que pé está o pagamento e, se foi no Asaas, o sistema procura lá.
 *   pagamento: nada · sinal · total · depois (ele informa depois)
 *   pago_onde: asaas · pix · cartao
 *   valor_total: valor do projeto que o Arthur passou ("Lia, valor 3500"); vai também para leads.closed_value,
 *   que a cobrança do sinal (gerar_cobranca_do_sinal, 50%) e o webhook do Asaas já usam.
 */
alter table public.encomendas add column if not exists pagamento text
  check (pagamento is null or pagamento in ('nada', 'sinal', 'total', 'depois'));
alter table public.encomendas add column if not exists pago_onde text
  check (pago_onde is null or pago_onde in ('asaas', 'pix', 'cartao'));
alter table public.encomendas add column if not exists valor_total numeric(12, 2) check (valor_total is null or valor_total > 0);
alter table public.encomendas add column if not exists asaas_resumo text check (asaas_resumo is null or char_length(asaas_resumo) <= 2000);
