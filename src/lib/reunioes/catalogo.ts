// Preços e prazos do lead na sala de reunião (Fase 2/3, 31/10/2026). Só no servidor.
// Mesma regra da Lia (agente.ts › responder): o retrato do catálogo guardado no link do vendedor; sem link, o
// catálogo de agora (internal_services). Lead dos EUA: a tabela em dólar do portfólio.

import type { DbDoAtendente } from '@/lib/atendente/db';
import { tabelaBRL, TABELA_USD, type TabelaPrecos } from '@/lib/precos-captacao';

export type CatalogoDoLead = { tabela: TabelaPrecos; prazos: Map<string, number>; eua: boolean };

export async function catalogoDoLead(db: DbDoAtendente, leadId: string | null): Promise<CatalogoDoLead> {
  const [{ data: lead }, { data: conv }] = leadId
    ? await Promise.all([
        db.from('leads').select('country').eq('id', leadId).maybeSingle(),
        db.from('ia_conversations').select('kit_id').eq('lead_id', leadId).order('last_message_at', { ascending: false }).limit(1).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const [{ data: item }, { data: kit }] = conv?.kit_id && leadId
    ? await Promise.all([
        db.from('lead_kit_items').select('currency').match({ kit_id: conv.kit_id, lead_id: leadId }).maybeSingle(),
        db.from('lead_seller_kits').select('catalog').eq('id', conv.kit_id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const moeda = (item?.currency as 'BRL' | 'USD' | undefined) ?? (lead?.country === 'US' ? 'USD' : 'BRL');
  const itensDoLink = (kit?.catalog ?? []) as { nome: string; preco: number; prazoDias?: number }[];
  let catalogo = new Map<string, number>(itensDoLink.map((s) => [s.nome, Number(s.preco)]));
  let prazos = new Map<string, number>(itensDoLink.map((s) => [s.nome, Number(s.prazoDias ?? 0)]));
  if (catalogo.size === 0 || itensDoLink.every((s) => !s.prazoDias)) {
    const { data: servicos } = await db.from('internal_services').select('name, price, lead_time_days').eq('active', true);
    if (catalogo.size === 0) catalogo = new Map((servicos ?? []).map((s) => [s.name, Number(s.price)]));
    prazos = new Map((servicos ?? []).map((s) => [s.name, Number(s.lead_time_days ?? 0)]));
  }
  return { tabela: moeda === 'USD' ? TABELA_USD : tabelaBRL(catalogo), prazos, eua: moeda === 'USD' };
}
