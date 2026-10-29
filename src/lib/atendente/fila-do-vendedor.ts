// Fila do dia no WhatsApp do vendedor (pedido do dono em 28/10/2026). O número da
// Lia manda ao Felipe até 5 leads (quem abriu o diagnóstico, retornos vencidos e os
// melhores novos), cada um com um link que abre o WhatsApp do lead com a mensagem
// pronta (os mesmos modelos da página dele). Ele também pode mandar "fila" ou
// "relatório" a qualquer hora. Mesma ordem da aba Hoje da página do vendedor.
//
// WhatsApp: texto livre só até 24 h depois da última mensagem dele para a Lia; fora
// disso o relógio manda o modelo "fila_do_vendedor" (Responda FILA) e a resposta
// abre a janela.

import type { DbDoAtendente } from '@/lib/atendente/db';
import { enviarTexto, enviarModelo, criarModelo, statusDoModelo, whatsappConfigurado, JANELA_MS } from '@/lib/atendente/whatsapp-api';
import { mesmoTelefone } from '@/lib/atendente/avisos';
import { proximaEtapa, whatsappDoLead, LEAD_STATUS_LABEL, type LeadStatus, type Pais } from '@/lib/captacao';
import {
  escolherModelo,
  varianteDoLead,
  variaveisDoLead,
  preencher,
  linkWhatsApp,
  idiomaDoLead,
  type ModeloMensagem,
} from '@/lib/mensagens-lead';
import { SITE_URL } from '@/lib/seo';

export const MODELO_DA_FILA = 'fila_do_vendedor';
export const PEDIDO_DE_FILA = /^\s*(fila|hoje|leads do dia)\b/i;
export const PEDIDO_DE_RELATORIO_DO_VENDEDOR = /^\s*(relat[oó]rio|meus n[uú]meros|placar)\b/i;

const ENCERRADOS: LeadStatus[] = ['fechado', 'perdido', 'nao_contatar'];
const NOME_DA_ETAPA = ['1º contato', '1º retorno', '2º retorno', 'último retorno'];

type Kit = { id: string; token: string; seller_name: string; seller_whatsapp: string | null; ultima_msg_em: string | null; fila_enviada_em: string | null };

/** Link do vendedor (pessoa) dono deste número, se houver. */
export async function kitDoVendedor(db: DbDoAtendente, numero: string): Promise<Kit | null> {
  const { data } = await db
    .from('lead_seller_kits')
    .select('id, token, seller_name, seller_whatsapp, ultima_msg_em, fila_enviada_em')
    .eq('kind', 'pessoa')
    .eq('active', true);
  return (data ?? []).find((k) => mesmoTelefone(k.seller_whatsapp, numero)) ?? null;
}

type LeadDaFila = {
  id: string;
  name: string;
  city: string | null;
  country: string;
  phone: string | null;
  sem_whatsapp: boolean;
  status: string;
  score: number;
  followup_step: number;
  first_contact_at: string | null;
  diag_last_view_at: string | null;
  category: string | null;
  niche: string | null;
  website: string | null;
  site_check: string | null;
  review_count: number | null;
  rating: number | null;
  public_token: string;
  suggested_services: string[];
  ab_variant: 'A' | 'B' | null;
};

async function leadsDoKit(db: DbDoAtendente, kitId: string): Promise<LeadDaFila[]> {
  const { data } = await db
    .from('lead_kit_items')
    .select(
      'leads!inner(id, name, city, country, phone, sem_whatsapp, status, score, followup_step, first_contact_at, diag_last_view_at, category, niche, website, site_check, review_count, rating, public_token, suggested_services, ab_variant)'
    )
    .eq('kit_id', kitId);
  return (data ?? []).map((i) => i.leads as unknown as LeadDaFila);
}

/** Até 5 leads do dia, na ordem da aba Hoje: quentes, retornos vencidos, melhores novos. */
function escolher(leads: LeadDaFila[], agora: number): { l: LeadDaFila; motivo: string; etapa: number }[] {
  const dia = new Date(agora - 3 * 3600_000).toISOString().slice(0, 10);
  const ativos = leads.filter((l) => !ENCERRADOS.includes(l.status as LeadStatus));
  const prox = (l: LeadDaFila) =>
    proximaEtapa({ status: l.status as LeadStatus, followupStep: l.followup_step, firstContactAt: l.first_contact_at });
  const lista: { l: LeadDaFila; motivo: string; etapa: number }[] = [];
  const ja = new Set<string>();
  const add = (l: LeadDaFila, motivo: string) => {
    if (ja.has(l.id) || lista.length >= 5) return;
    ja.add(l.id);
    lista.push({ l, motivo, etapa: prox(l)?.etapa ?? 0 });
  };
  ativos
    .filter((l) => l.diag_last_view_at && agora - Date.parse(l.diag_last_view_at) < 48 * 3600_000)
    .sort((a, b) => Date.parse(b.diag_last_view_at!) - Date.parse(a.diag_last_view_at!))
    .forEach((l) => add(l, '🔥 abriu o diagnóstico'));
  ativos
    .map((l) => ({ l, p: prox(l) }))
    .filter(({ p }) => !!p && p.etapa > 0 && !!p.vence && p.vence <= dia)
    .sort((a, b) => (a.p!.vence ?? '').localeCompare(b.p!.vence ?? ''))
    .forEach(({ l, p }) => add(l, `⏰ ${NOME_DA_ETAPA[p!.etapa]} vence hoje`));
  ativos
    .filter((l) => l.status === 'novo')
    .sort((a, b) => b.score - a.score)
    .forEach((l) => add(l, `✨ novo, nota ${l.score}`));
  return lista;
}

export async function textoDaFila(db: DbDoAtendente, kit: Kit): Promise<{ texto: string; quantos: number }> {
  const agora = Date.now();
  const [leads, { data: modelos }] = await Promise.all([
    leadsDoKit(db, kit.id),
    db.from('lead_templates').select('channel, lang, step, variant, subject, body'),
  ]);
  const fila = escolher(leads, agora);
  const nome = kit.seller_name.split(' ')[0];
  const pagina = `${SITE_URL}/vendedor/${kit.token}`;
  if (!fila.length) {
    return { texto: `Bom dia, ${nome}! Nada pendente hoje na sua lista. Se acabaram os leads, peça mais na sua página:\n${pagina}`, quantos: 0 };
  }
  const tpl = (modelos ?? []) as ModeloMensagem[];
  const linhas = fila.map(({ l, motivo, etapa }, i) => {
    const adaptado = {
      id: l.id,
      name: l.name,
      category: l.category,
      niche: l.niche,
      city: l.city,
      country: l.country as Pais,
      website: l.website,
      siteCheck: l.site_check,
      reviewCount: l.review_count,
      rating: l.rating,
      publicToken: l.public_token,
      suggestedServices: l.suggested_services,
      abVariant: l.ab_variant,
    };
    const lang = idiomaDoLead(adaptado);
    const vars = variaveisDoLead(adaptado, lang, SITE_URL, { nome, assinatura: kit.seller_name, kit: kit.token });
    const modelo = escolherModelo(tpl, 'whatsapp', lang, etapa, varianteDoLead(adaptado, tpl));
    const wa = l.sem_whatsapp ? null : whatsappDoLead(l.phone, l.country as Pais);
    const contato =
      wa?.celular && modelo
        ? `Mensagem pronta: ${linkWhatsApp(wa.numero, preencher(modelo.body, vars))}`
        : l.phone
          ? `Ligar: ${l.phone}`
          : 'Sem telefone: veja na sua página';
    return `*${i + 1}. ${l.name}*${l.city ? ` (${l.city})` : ''}\n${motivo} · ${LEAD_STATUS_LABEL[l.status as LeadStatus] ?? l.status}\n${contato}`;
  });
  return {
    texto: [`Bom dia, ${nome}! Sua fila de hoje (${fila.length}):`, '', linhas.join('\n\n'), '', `Depois de mandar, registre na sua página: ${pagina}`].join('\n'),
    quantos: fila.length,
  };
}

export async function relatorioDoVendedor(db: DbDoAtendente, kit: Kit): Promise<string> {
  const leads = await leadsDoKit(db, kit.id);
  const conta = (s: string[]) => leads.filter((l) => s.includes(l.status)).length;
  const nome = kit.seller_name.split(' ')[0];
  return [
    `📊 *Seus números, ${nome}*`,
    '',
    `• Leads na lista: ${leads.length}`,
    `• A contatar: ${conta(['novo'])}`,
    `• Contatados: ${conta(['contatado'])} · Responderam: ${conta(['respondeu'])}`,
    `• Reunião: ${conta(['reuniao'])} · Proposta: ${conta(['proposta'])}`,
    `• Fechados: ${conta(['fechado'])} · Perdidos: ${conta(['perdido', 'nao_contatar'])}`,
    `• Abriram o diagnóstico (48 h): ${leads.filter((l) => l.diag_last_view_at && Date.now() - Date.parse(l.diag_last_view_at) < 48 * 3600_000).length}`,
    '',
    `Sua página: ${SITE_URL}/vendedor/${kit.token}`,
  ].join('\n');
}

/* ------------------------------------------------------------ relógio */

const agoraEmBrasilia = () => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
  return { dia: p.find((x) => x.type === 'weekday')?.value, hora: Number(p.find((x) => x.type === 'hour')?.value) };
};
const inicioDoDiaEmBrasilia = () => {
  const d = new Date(Date.now() - 3 * 3600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3)).toISOString();
};

/** Cria o modelo "fila_do_vendedor" na Meta (uma vez) e acompanha a aprovação. */
export async function garantirModeloDaFila(db: DbDoAtendente): Promise<string | null> {
  if (!whatsappConfigurado()) return null;
  const { data: c } = await db.from('ia_config').select('waba_id, fila_template_status').eq('id', true).maybeSingle();
  if (!c?.waba_id || c.fila_template_status === 'APPROVED') return c?.fila_template_status ?? null;
  let status = await statusDoModelo(c.waba_id, MODELO_DA_FILA);
  if (!status) {
    const r = await criarModelo(c.waba_id, {
      name: MODELO_DA_FILA,
      language: 'pt_BR',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Bom dia, {{1}}! Sua fila de hoje na Captação tem {{2}} leads para trabalhar.\n\nResponda FILA para receber a lista aqui.',
          example: { body_text: [['Felipe', '5']] },
        },
      ],
    });
    status = r.ok ? (r.status ?? 'PENDING') : `ERRO: ${r.erro}`.slice(0, 200);
  }
  if (status !== c.fila_template_status) await db.from('ia_config').update({ fila_template_status: status }).eq('id', true);
  return status;
}

/** 8h dos dias úteis: a fila do dia para cada vendedor (uma vez por dia). */
export async function mandarFilasDoDia(db: DbDoAtendente): Promise<number> {
  const { dia, hora } = agoraEmBrasilia();
  if (dia === 'Sat' || dia === 'Sun' || hora < 8 || hora >= 11 || !whatsappConfigurado()) return 0;
  const { data: kits } = await db
    .from('lead_seller_kits')
    .select('id, token, seller_name, seller_whatsapp, ultima_msg_em, fila_enviada_em')
    .eq('kind', 'pessoa')
    .eq('active', true);
  const { data: cfg } = await db.from('ia_config').select('fila_template_status').eq('id', true).maybeSingle();
  let enviadas = 0;
  for (const k of (kits ?? []) as Kit[]) {
    if (!k.seller_whatsapp || (k.fila_enviada_em && k.fila_enviada_em >= inicioDoDiaEmBrasilia())) continue;
    const { texto, quantos } = await textoDaFila(db, k);
    if (!quantos) continue;
    const janela = !!k.ultima_msg_em && Date.now() - new Date(k.ultima_msg_em).getTime() < JANELA_MS;
    const r = janela
      ? await enviarTexto(k.seller_whatsapp, texto)
      : cfg?.fila_template_status === 'APPROVED'
        ? await enviarModelo(k.seller_whatsapp, MODELO_DA_FILA, [k.seller_name.split(' ')[0], String(quantos)])
        : null;
    if (!r) continue; // sem janela e sem modelo aprovado: a fila fica na página dele
    if (r.ok) {
      await db.from('lead_seller_kits').update({ fila_enviada_em: new Date().toISOString() }).eq('id', k.id);
      enviadas++;
    }
  }
  return enviadas;
}
