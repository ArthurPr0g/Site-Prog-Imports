import { createClient } from '@/lib/supabase/server';
import type { Lead, LeadStatus, Pais } from '@/lib/captacao';
import type { ModeloMensagem } from '@/lib/mensagens-lead';

type Row = {
  id: string;
  name: string;
  category: string | null;
  niche: string | null;
  city: string | null;
  state: string | null;
  country: string;
  address: string | null;
  phone: string | null;
  sem_whatsapp: boolean;
  email: string | null;
  website: string | null;
  site_check: string | null;
  public_token: string;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  maps_url: string | null;
  rating: number | null;
  review_count: number | null;
  score: number;
  suggested_services: string[];
  reasons: string[];
  status: string;
  next_contact: string | null;
  first_contact_at: string | null;
  replied_at: string | null;
  closed_at: string | null;
  notes: string | null;
  customer_id: string | null;
  created_at: string;
};

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
    leads.push(...(data ?? []).map((r) => toLead(r as Row)));
    if (!data || data.length < PAGINA) break;
  }
  return leads;
}

/** Os 4 modelos de mensagem (WhatsApp e e-mail, em português e inglês). */
export async function listLeadTemplates(): Promise<ModeloMensagem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('lead_templates').select('channel, lang, subject, body');
  return (data ?? []).map((r) => ({
    channel: r.channel as ModeloMensagem['channel'],
    lang: r.lang as ModeloMensagem['lang'],
    subject: r.subject,
    body: r.body,
  }));
}
