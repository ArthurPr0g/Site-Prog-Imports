export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5562982133188';
export const INSTAGRAM_HANDLE = process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || 'Prog.imports';
export const FRETE_GRATIS_MIN = Number(process.env.NEXT_PUBLIC_FRETE_GRATIS_MIN || 5000);
export const FRETE_PADRAO = Number(process.env.NEXT_PUBLIC_FRETE_PADRAO || 49.9);

export const ORDER_STATUSES = [
  'Aguardando pagamento',
  'Pago',
  'Enviado',
  'Entregue',
  'Cancelado',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_STYLES: Record<OrderStatus, { bg: string; border: string; color: string }> = {
  'Aguardando pagamento': { bg: 'rgba(217,164,65,.1)', border: 'rgba(217,164,65,.4)', color: '#d9a441' },
  Pago: { bg: 'rgba(74,222,128,.1)', border: 'rgba(74,222,128,.35)', color: '#4ade80' },
  Enviado: { bg: 'rgba(96,165,250,.1)', border: 'rgba(96,165,250,.35)', color: '#60a5fa' },
  Entregue: { bg: 'rgba(168,168,176,.08)', border: 'rgba(168,168,176,.3)', color: '#a8a8b0' },
  Cancelado: { bg: 'rgba(224,85,85,.1)', border: 'rgba(224,85,85,.35)', color: '#e05555' },
};

// Status escolhido no admin mapeia para a etapa inicial da timeline do cliente (0-10).
// Pago ~ etapas 2-4, Enviado ~ etapas 5-9, Entregue = 10 (ver README de handoff).
export const STATUS_TO_STAGE: Record<OrderStatus, number> = {
  'Aguardando pagamento': 0,
  Pago: 2,
  Enviado: 5,
  Entregue: 10,
  Cancelado: 0,
};

export const TIMELINE_STEPS = [
  'Pedido realizado',
  'Pagamento aprovado',
  'Produto reservado',
  'Produto em preparação',
  'Transporte internacional',
  'Desembaraço aduaneiro',
  'Recebido no Brasil',
  'Enviado à transportadora',
  'Em rota de entrega',
  'Entregue',
] as const;

export const CATEGORY_OPTIONS = [
  'MacBook',
  'iPhone',
  'iPad / Tablet',
  'Notebook Gamer',
  'Notebook Trabalho',
  'Notebook Estudos',
  'Notebooks para IA',
  'Monitores',
  'Periféricos',
  'Peças e upgrades',
] as const;
