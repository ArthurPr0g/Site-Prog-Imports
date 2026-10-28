// Página do vendedor (/vendedor/<token>): o formato que a função lead_kit
// devolve e os adaptadores para reaproveitar as regras do painel (mensagens,
// sequência de retorno, situação do site).

import type { LeadStatus, Pais } from '@/lib/captacao';
import type { ModeloMensagem } from '@/lib/mensagens-lead';
import type { RespostasDoChecklist } from '@/lib/checklist-descoberta';

export type ServicoDoKit = { nome: string; descricao: string; preco: number; mensal: boolean; prazoDias: number };
export type ItemDoCatalogo = ServicoDoKit & { categoria: string };

export type LeadDoKit = {
  id: string;
  public_token: string;
  name: string;
  category: string | null;
  niche: string | null;
  city: string | null;
  state: string | null;
  country: Pais;
  address: string | null;
  phone: string | null;
  sem_whatsapp: boolean;
  email: string | null;
  website: string | null;
  site_check: string | null;
  instagram: string | null;
  facebook: string | null;
  maps_url: string | null;
  rating: number | null;
  review_count: number | null;
  score: number;
  reasons: string[];
  suggested_services: string[];
  status: LeadStatus;
  notes: string | null;
  first_contact_at: string | null;
  followup_step: number;
  ab_variant: 'A' | 'B' | null;
  diag_views: number;
  diag_last_view_at: string | null;
  screenshot_url: string | null;
  discovery: RespostasDoChecklist;
  discovery_at: string | null;
  currency: 'BRL' | 'USD';
  one_time: number;
  monthly: number;
  combo: boolean;
  services: ServicoDoKit[];
};

export type Kit = {
  seller_name: string;
  seller_whatsapp: string | null;
  seller_email: string | null;
  instructions: string | null;
  created_at: string;
  catalog: ItemDoCatalogo[];
  templates: ModeloMensagem[];
  leads: LeadDoKit[];
};

/** Etapas que o vendedor usa no quadro dele (as do painel, com nomes de vendedor). */
export const ETAPAS_DO_VENDEDOR: { chave: LeadStatus; titulo: string; cor: string }[] = [
  { chave: 'novo', titulo: 'A contatar', cor: '#8a8a93' },
  { chave: 'contatado', titulo: 'Contatado', cor: '#6aa6ff' },
  { chave: 'respondeu', titulo: 'Respondeu', cor: '#c9a15a' },
  { chave: 'reuniao', titulo: 'Reunião marcada', cor: '#b58cff' },
  { chave: 'proposta', titulo: 'Quer proposta', cor: '#ff9f43' },
  { chave: 'fechado', titulo: 'Fechado', cor: '#4ade80' },
  { chave: 'perdido', titulo: 'Sem interesse', cor: '#e05555' },
];
/** No quadro, "não contatar" aparece junto de "sem interesse" (marca-se na aba Registro). */
export const colunaDoVendedor = (s: LeadStatus): LeadStatus => (s === 'nao_contatar' ? 'perdido' : s);
/** O que o vendedor pode marcar (fechado é com o Arthur, e "a contatar" não volta). */
export const ETAPAS_QUE_O_VENDEDOR_MARCA: LeadStatus[] = [
  'contatado',
  'respondeu',
  'reuniao',
  'proposta',
  'perdido',
  'nao_contatar',
];

export const tituloDaEtapa = (s: LeadStatus) =>
  s === 'nao_contatar' ? 'Não contatar' : (ETAPAS_DO_VENDEDOR.find((e) => e.chave === s)?.titulo ?? s);

/** Campos no formato do painel, para usar as mesmas funções de mensagem. */
export function comoLeadDoPainel(l: LeadDoKit) {
  return {
    id: l.id,
    name: l.name,
    category: l.category,
    niche: l.niche,
    city: l.city,
    country: l.country,
    website: l.website,
    siteCheck: l.site_check,
    reviewCount: l.review_count,
    rating: l.rating,
    publicToken: l.public_token,
    suggestedServices: l.suggested_services,
    abVariant: l.ab_variant,
    status: l.status,
    followupStep: l.followup_step,
    firstContactAt: l.first_contact_at,
  };
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;
