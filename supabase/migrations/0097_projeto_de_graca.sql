/*
 * 0097 — Opção "Projeto de graça" no financeiro da encomenda (pedido do Arthur em 30/10/2026; primeiro
 * uso: o piloto do sistema do Felipe). A Lia não fala de preço nem gera cobrança nesses projetos.
 */
alter table public.encomendas drop constraint if exists encomendas_pagamento_check;
alter table public.encomendas add constraint encomendas_pagamento_check
  check (pagamento is null or pagamento in ('nada', 'sinal', 'total', 'depois', 'gratis'));
