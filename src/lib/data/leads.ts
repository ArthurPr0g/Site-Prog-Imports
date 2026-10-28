import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/database.types';
import type { Lead, LeadStatus, Pais } from '@/lib/captacao';
import type { ModeloMensagem } from '@/lib/mensagens-lead';

type Row = Tables<'leads'>;

function toLead(r: Row): Lead {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    niche: r.niche,
    city: r.city,
    state: r.state,
    country: r.country as Pais,
    address: r.address,
    phone: r.phone,
    semWhatsapp: r.sem_whatsapp,
    email: r.email,
    website: r.website,
    siteCheck: r.site_check,
    publicToken: r.public_token,
    instagram: r.instagram,
    facebook: r.facebook,
    linkedin: r.linkedin,
    mapsUrl: r.maps_url,
    rating: r.rating === null ? null : Number(r.rating),
    reviewCount: r.review_count,
    score: r.score,
    suggestedServices: r.suggested_services ?? [],
    reasons: r.reasons ?? [],
    status: r.status as LeadStatus,
    nextContact: r.next_contact,
    firstContactAt: r.first_contact_at,
    repliedAt: r.replied_at,
    closedAt: r.closed_at,
    notes: r.notes,
    customerId: r.customer_id,
    createdAt: r.created_at,
    lastContactAt: r.last_contact_at,
    followupStep: r.followup_step,
    abVariant: (r.ab_variant as Lead['abVariant']) ?? null,
    diagViews: r.diag_views,
    diagFirstViewAt: r.diag_first_view_at,
    diagLastViewAt: r.diag_last_view_at,
    latitude: r.latitude === null ? null : Number(r.latitude),
    longitude: r.longitude === null ? null : Number(r.longitude),
    screenshotUrl: r.screenshot_url,
    quoteId: r.quote_id,
    discovery: (r.discovery as Lead['discovery']) ?? {},
    discoveryBy: r.discovery_by,
    discoveryAt: r.discovery_at,
  };
}

// O PostgREST da Supabase devolve no máximo 1000 linhas por chamada.
const PAGINA = 1000;

/** Todos os leads, os de nota maior primeiro. */
export async function listLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  const leads: Lead[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(de, de + PAGINA - 1);
    leads.push(...(data ?? []).map(toLead));
    if (!data || data.length < PAGINA) break;
  }
  return leads;
}

/** Modelos de mensagem: canal × idioma × etapa da sequência × variante A/B. */
export async function listLeadTemplates(): Promise<ModeloMensagem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('lead_templates').select('channel, lang, step, variant, subject, body');
  return (data ?? []).map((r) => ({
    channel: r.channel as ModeloMensagem['channel'],
    lang: r.lang as ModeloMensagem['lang'],
    step: r.step,
    variant: r.variant as ModeloMensagem['variant'],
    subject: r.subject,
    body: r.body,
  }));
}

export type PedidoDeBusca = {
  id: string;
  niche: string;
  city: string;
  country: Pais;
  status: 'pendente' | 'rodando' | 'feito' | 'erro';
  message: string | null;
  newLeads: number | null;
  createdAt: string;
  finishedAt: string | null;
};

/** Pedidos de busca: pendentes e rodando, mais os 30 últimos terminados. */
export async function listSearchRequests(): Promise<PedidoDeBusca[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('lead_search_requests').select('*').order('created_at', { ascending: false }).limit(200);
  const todos = (data ?? []).map((r) => ({
    id: r.id,
    niche: r.niche,
    city: r.city,
    country: r.country as Pais,
    status: r.status as PedidoDeBusca['status'],
    message: r.message,
    newLeads: r.new_leads,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  }));
  const abertos = todos.filter((p) => p.status === 'pendente' || p.status === 'rodando');
  const fechados = todos.filter((p) => p.status === 'feito' || p.status === 'erro').slice(0, 30);
  return [...abertos.reverse(), ...fechados];
}

const digitos = (v: string | null) => (v ?? '').replace(/\D/g, '');

/**
 * Ids dos leads que já são clientes do ERP: ligados por customer_id ou com o
 * mesmo telefone (últimos 10 dígitos, ignora DDI) ou e-mail de um cliente.
 */
export async function leadsQueJaSaoClientes(leads: Lead[]): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('customers').select('phone, email');
  const fones = new Set((data ?? []).map((c) => digitos(c.phone).slice(-10)).filter((f) => f.length >= 10));
  const emails = new Set((data ?? []).map((c) => (c.email ?? '').trim().toLowerCase()).filter(Boolean));
  return leads
    .filter(
      (l) =>
        l.customerId !== null ||
        (digitos(l.phone).length >= 10 && fones.has(digitos(l.phone).slice(-10))) ||
        (!!l.email && emails.has(l.email.trim().toLowerCase()))
    )
    .map((l) => l.id);
}

export type KitDoVendedor = {
  id: string;
  token: string;
  sellerName: string;
  sellerWhatsapp: string | null;
  active: boolean;
  createdAt: string;
  leadIds: string[];
};

/** Links de vendedor, os mais novos primeiro, com os leads de cada um. */
export async function listKits(): Promise<KitDoVendedor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('lead_seller_kits')
    .select('id, token, seller_name, seller_whatsapp, active, created_at, lead_kit_items(lead_id, position)')
    .order('created_at', { ascending: false });
  return (data ?? []).map((k) => ({
    id: k.id,
    token: k.token,
    sellerName: k.seller_name,
    sellerWhatsapp: k.seller_whatsapp,
    active: k.active,
    createdAt: k.created_at,
    leadIds: [...(k.lead_kit_items ?? [])].sort((a, b) => a.position - b.position).map((i) => i.lead_id),
  }));
}
