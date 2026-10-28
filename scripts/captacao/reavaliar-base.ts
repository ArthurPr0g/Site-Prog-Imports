/**
 * Limpeza da base da Captação: reavalia todos os leads com as regras atuais de
 * src/lib/captacao.ts (nota, porte, pacote sugerido, rede/franquia, fixo,
 * sinais de atividade) e atualiza os itens dos links de vendedor ativos que
 * ainda não foram contatados (pacote e preço pelo porte).
 *
 * Nunca mexe em etapa, anotações, datas de contato nem checklist: só nos campos
 * calculados (score, suggested_services, reasons, porte, unidades).
 *
 *   npx -y tsx scripts/captacao/reavaliar-base.ts --simular   # só mostra o que mudaria
 *   npx -y tsx scripts/captacao/reavaliar-base.ts             # grava
 *
 * Usa NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY do .env.local (como o worker).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/database.types';
import { avaliarLead, chaveDaMarca, motivoFantasma, type LinhaImportada } from '../../src/lib/captacao';
import { tabelaBRL } from '../../src/lib/precos-captacao';
import { valoresDoItem, type ServicoDoCatalogo } from '../../src/lib/itens-do-kit';

const RAIZ = resolve(__dirname, '..', '..');
const simular = process.argv.includes('--simular');

function env(): Record<string, string> {
  const p = join(RAIZ, '.env.local');
  const e: Record<string, string> = {};
  if (!existsSync(p)) return e;
  for (const linha of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return e;
}

async function main() {
  const e = env();
  const url = process.env.CAPTACAO_SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.CAPTACAO_SUPABASE_KEY || e.SUPABASE_SECRET_KEY;
  if (!url || !chave) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.');
  const supabase = createClient<Database>(url, chave, { auth: { persistSession: false } });

  // Todos os leads (em páginas de 1.000).
  const leads: Database['public']['Tables']['leads']['Row'][] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from('leads').select('*').range(de, de + 999);
    if (error) throw error;
    leads.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  // Unidades da mesma marca na mesma cidade, na base inteira.
  const contagem = new Map<string, number>();
  const chaveDe = (l: (typeof leads)[number]) => {
    const m = chaveDaMarca(l.name);
    return m ? `${(l.city ?? '').toLowerCase()}|${m}` : null;
  };
  for (const l of leads) {
    const k = chaveDe(l);
    if (k) contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }

  const portes = { pequena: 0, media: 0, grande: 0 };
  let redes = 0;
  let fantasmas = 0;
  let fixos = 0;
  const mudancas: {
    id: string;
    dados: Database['public']['Tables']['leads']['Update'];
    nome: string;
    antes: number;
    depois: number;
  }[] = [];
  for (const l of leads) {
    const linha: LinhaImportada = {
      name: l.name,
      phone: l.phone,
      email: l.email,
      website: l.website,
      category: l.category,
      address: l.address,
      rating: l.rating === null ? null : Number(l.rating),
      reviewCount: l.review_count,
      instagram: l.instagram,
      facebook: l.facebook,
      linkedin: l.linkedin,
      placeId: l.place_id,
      mapsUrl: l.maps_url,
      latitude: null,
      longitude: null,
      siteCheck: l.site_check,
      buscaRamo: l.niche,
      buscaCidade: l.city,
      buscaEstado: l.state,
      buscaPais: l.country,
      mapsStatus: l.maps_status,
      ultimaAvaliacao: l.last_review_at,
      perfilReivindicado: l.owner_claimed,
      agendamento: l.online_booking,
    };
    const k = chaveDe(l);
    const unidades = k ? (contagem.get(k) ?? 1) : 1;
    const a = avaliarLead(linha, l.niche, unidades);
    portes[a.porte]++;
    if (a.rede) redes++;
    if (a.reasons.some((r) => r.startsWith('Só telefone fixo'))) fixos++;
    if (motivoFantasma({ mapsStatus: l.maps_status, lastReviewAt: l.last_review_at, reviewCount: l.review_count, phone: l.phone, email: l.email }))
      fantasmas++;
    const igual =
      a.score === l.score &&
      a.porte === l.porte &&
      unidades === l.unidades &&
      JSON.stringify(a.suggestedServices) === JSON.stringify(l.suggested_services) &&
      JSON.stringify(a.reasons) === JSON.stringify(l.reasons);
    if (!igual)
      mudancas.push({
        id: l.id,
        nome: l.name,
        antes: l.score,
        depois: a.score,
        dados: {
          score: a.score,
          porte: a.porte,
          unidades,
          suggested_services: a.suggestedServices,
          reasons: a.reasons,
          updated_at: new Date().toISOString(),
        },
      });
  }

  console.log(`${leads.length} leads · porte: ${portes.pequena} pequenas, ${portes.media} médias, ${portes.grande} grandes`);
  console.log(`redes/franquias: ${redes} · só telefone fixo: ${fixos} · possíveis fantasmas: ${fantasmas}`);
  console.log(`${mudancas.length} lead(s) com nota/pacote/porte novos.`);
  const maiores = [...mudancas].sort((x, y) => Math.abs(y.depois - y.antes) - Math.abs(x.depois - x.antes)).slice(0, 8);
  for (const m of maiores) console.log(`  ${m.antes} → ${m.depois}  ${m.nome.slice(0, 50)}`);

  if (!simular) {
    // 10 em paralelo: rápido sem sobrecarregar o banco.
    for (let i = 0; i < mudancas.length; i += 10) {
      const lote = mudancas.slice(i, i + 10);
      const r = await Promise.all(lote.map((m) => supabase.from('leads').update(m.dados).eq('id', m.id)));
      const erro = r.find((x) => x.error)?.error;
      if (erro) throw erro;
    }
    console.log('Leads gravados.');
  }

  // Links de vendedor ativos: pacote e preço novos para quem ainda está "novo".
  const { data: servicos } = await supabase
    .from('internal_services')
    .select('name, description, price, billing_type, lead_time_days')
    .eq('active', true);
  const catalogo: ServicoDoCatalogo[] = (servicos ?? []).map((s) => ({
    name: s.name,
    description: s.description,
    price: Number(s.price),
    billingType: s.billing_type,
    leadTimeDays: s.lead_time_days,
  }));
  const porNome = new Map(catalogo.map((s) => [s.name, s]));
  const tabBRL = tabelaBRL(new Map(catalogo.map((s) => [s.name, s.price])));
  const { data: itens } = await supabase
    .from('lead_kit_items')
    .select('kit_id, lead_id, one_time, monthly, lead_seller_kits!inner(active, seller_name)')
    .eq('lead_seller_kits.active', true);
  const porId = new Map(leads.map((l) => [l.id, l]));
  const novosServicos = new Map(mudancas.map((m) => [m.id, m.dados.suggested_services as string[]]));
  let itensMudados = 0;
  for (const it of itens ?? []) {
    const l = porId.get(it.lead_id);
    if (!l || l.status !== 'novo') continue;
    const v = valoresDoItem(
      { country: l.country, suggested_services: novosServicos.get(l.id) ?? l.suggested_services },
      porNome,
      tabBRL
    );
    if (Number(it.one_time) === v.one_time && Number(it.monthly) === v.monthly) continue;
    itensMudados++;
    console.log(`  link: ${l.name.slice(0, 40)}  ${it.one_time} + ${it.monthly}/mês → ${v.one_time} + ${v.monthly}/mês`);
    if (!simular) {
      const { error } = await supabase
        .from('lead_kit_items')
        .update({ currency: v.currency, one_time: v.one_time, monthly: v.monthly, combo: v.combo, services: v.services })
        .eq('kit_id', it.kit_id)
        .eq('lead_id', it.lead_id);
      if (error) throw error;
    }
  }
  console.log(`${itensMudados} item(ns) de link de vendedor ${simular ? 'mudariam' : 'atualizados'}.`);
  if (simular) console.log('(simulação: nada foi gravado)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
