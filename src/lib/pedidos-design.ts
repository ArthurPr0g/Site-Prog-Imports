// Pedidos do Claude Design (Duda e Nina) só depois das etapas anteriores (pedido do Arthur em 30/10/2026).
// Regra única, usada pelo painel do Pós-venda e pelo relógio (que pede à Bia a versão final dos pedidos).

export type PedidosDesign = {
  pedido_em?: string;
  prontos_em?: string;
  avisado_em?: string;
  duda?: string;
  nina?: string;
  /** Caminho integrado (31/10/2026): links dos artifacts no Claude (Design System da Duda e Design da Nina). */
  duda_link?: string;
  nina_link?: string;
  /** O Arthur aprovou o protótipo da Nina: o Rafa pode construir. */
  aprovado_em?: string;
};

export type EtapasDoDesign = {
  /** A Bia abriu o projeto (pasta do cliente criada). */
  aberto: boolean;
  /** Pago (sinal ou total), sinal pago no Asaas ou projeto de graça. */
  financeiro: boolean;
  /** O cliente confirmou o resumo da descoberta (ou o Arthur marcou no painel). */
  descoberta: boolean;
  /** As três etapas acima: a Bia pode gerar a versão final dos pedidos. */
  liberado: boolean;
  /** A Bia já gravou os pedidos finais (prontos para copiar). */
  prontos: boolean;
};

export function etapasDoDesign(p: {
  pasta: string | null;
  sinalPago: boolean;
  pagamentoDaIndicacao: string | null;
  temPrestacao: boolean;
  briefingConfirmadoEm: string | null;
  pedidos: PedidosDesign;
}): EtapasDoDesign {
  const aberto = !!p.pasta;
  const financeiro = p.sinalPago || p.temPrestacao || ['gratis', 'sinal', 'total'].includes(p.pagamentoDaIndicacao ?? '');
  const descoberta = !!p.briefingConfirmadoEm;
  const liberado = aberto && financeiro && descoberta;
  return { aberto, financeiro, descoberta, liberado, prontos: liberado && !!p.pedidos.prontos_em && !!(p.pedidos.duda || p.pedidos.nina) };
}
