import { NextRequest, NextResponse } from 'next/server';
import { dbDoAtendente, type DbDoAtendente } from '@/lib/atendente/db';
import { lerConfig, responderConversa } from '@/lib/atendente/agente';
import { enviarEmail, emailConfigurado } from '@/lib/atendente/email';
import { emailDaEtapa, textoDoBotao, DIAS_DOS_RETORNOS } from '@/lib/atendente/regras';
import type { ConfigDoAtendente } from '@/lib/atendente/regras';
import { variaveisDoLead, linkWhatsApp } from '@/lib/mensagens-lead';
import { emailDeVerdade } from '@/lib/captacao';
import { SITE_URL } from '@/lib/seo';
import { guardarArquivosDeClientes } from '@/lib/atendente/arquivos-clientes';
import { aprenderComConversas } from '@/lib/atendente/aprender';
import { garantirModeloDoAviso } from '@/lib/atendente/avisos';

// Relógio do atendente: o pg_cron do Supabase chama a cada minuto (migration
// 0067) com o segredo ATENDENTE_TICK_SECRET. Cada chamada:
// 1. libera o desconto que esperou o tempo do "superior" e manda a IA responder;
// 2. manda no máximo 1 e-mail de primeiro contato (horário comercial, até o
//    limite do dia) e 1 retorno para quem não respondeu;
// 3. relê 1 conversa encerrada para a Lia aprender (lições vão para aprovação);
// 4. cria o modelo de aviso ao Arthur na Meta e acompanha a aprovação.

export const maxDuration = 60;

const DIA = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const segredo = process.env.ATENDENTE_TICK_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const db = dbDoAtendente();
  // Arquivos de quem fechou: guarda mesmo com a atendente desligada.
  const arquivos = await guardarArquivosDeClientes(db);
  // Modelo do aviso ao Arthur na Meta: cria uma vez e acompanha a aprovação.
  const modeloDoAviso = await garantirModeloDoAviso(db);
  const cfg = await lerConfig(db);
  if (!cfg.active) return NextResponse.json({ ok: true, ativo: false, arquivos, modeloDoAviso });

  const descontos = await resolverDescontos(db);
  const emails = emailConfigurado() && horarioComercial() ? await mandarEmails(db, cfg) : 0;
  const licoes = await aprenderComConversas(db, cfg);
  return NextResponse.json({ ok: true, descontos, emails, arquivos, licoes, modeloDoAviso });
}

async function resolverDescontos(db: DbDoAtendente): Promise<number> {
  const agora = new Date().toISOString();
  // Sem resposta do Arthur no tempo combinado: a IA libera sozinha.
  await db
    .from('ia_discount_requests')
    .update({ status: 'aprovado', decided_by: 'automatico', decided_at: agora })
    .eq('status', 'aguardando')
    .lte('release_at', agora);

  const { data: prontos } = await db
    .from('ia_discount_requests')
    .select('id, conversation_id, percent, status')
    .in('status', ['aprovado', 'negado'])
    .is('answered_at', null)
    .limit(5);
  for (const p of prontos ?? []) {
    // Marca antes: o próximo tick não pega o mesmo pedido enquanto a IA escreve.
    await db.from('ia_discount_requests').update({ answered_at: agora }).eq('id', p.id);
    const aviso =
      p.status === 'aprovado'
        ? `O superior aprovou ${Number(p.percent)}% de desconto extra no valor do trabalho. Volte ao cliente com a boa notícia e o novo valor (use calcular_preco).`
        : 'O superior não aprovou o desconto extra desta vez. Volte ao cliente com educação e ofereça outra saída (parcelamento ou um nível abaixo).';
    await responderConversa(p.conversation_id, aviso);
  }
  return prontos?.length ?? 0;
}

/** Meia-noite de hoje em Brasília (UTC−3, sem horário de verão desde 2019), em ISO. */
function inicioDoDiaEmBrasilia(): string {
  const d = new Date(Date.now() - 3 * 3600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3)).toISOString();
}

/** Dias úteis, das 8h às 18h de Brasília. */
function horarioComercial(): boolean {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const dia = partes.find((p) => p.type === 'weekday')?.value;
  const hora = Number(partes.find((p) => p.type === 'hour')?.value);
  return dia !== 'Sat' && dia !== 'Sun' && hora >= 8 && hora < 18;
}

async function mandarEmails(db: DbDoAtendente, cfg: ConfigDoAtendente): Promise<number> {
  const { data: itens } = await db
    .from('lead_kit_items')
    .select(
      'kit_id, position, lead_seller_kits!inner(kind, active, token, seller_whatsapp), leads!inner(id, name, email, status, country, city, website, site_check, category, niche, review_count, rating, public_token, suggested_services, first_contact_at)'
    )
    .eq('lead_seller_kits.kind', 'ia')
    .eq('lead_seller_kits.active', true)
    .order('position');
  if (!itens?.length) return 0;

  const ids = itens.map((i) => i.leads.id);
  const { data: enviados } = await db.from('ia_emails').select('lead_id, step, sent_at').in('lead_id', ids);
  const porLead = new Map<string, Map<number, string | null>>();
  for (const e of enviados ?? []) {
    if (!porLead.has(e.lead_id)) porLead.set(e.lead_id, new Map());
    porLead.get(e.lead_id)!.set(e.step, e.sent_at);
  }

  const { count: hoje } = await db
    .from('ia_emails')
    .select('id', { count: 'exact', head: true })
    .eq('step', 0)
    .gte('sent_at', inicioDoDiaEmBrasilia());

  let enviadosAgora = 0;
  // Retorno: quem recebeu e não respondeu (continua "contatado").
  for (const i of itens) {
    const l = i.leads;
    const passos = porLead.get(l.id);
    const primeiro = passos?.get(0);
    if (l.status !== 'contatado' || !primeiro) continue;
    const proximo = [1, 2, 3].find((k) => !passos!.has(k));
    if (!proximo || Date.now() - new Date(primeiro).getTime() < DIAS_DOS_RETORNOS[proximo - 1] * DIA) continue;
    if (await mandar(db, cfg, i, proximo)) enviadosAgora++;
    break;
  }
  // Primeiro contato: o próximo lead Novo com e-mail, até o limite do dia.
  if ((hoje ?? 0) < cfg.dailyEmailCap) {
    const i = itens.find((x) => x.leads.status === 'novo' && x.leads.email && emailDeVerdade(x.leads.email) && !porLead.get(x.leads.id)?.has(0));
    if (i && (await mandar(db, cfg, i, 0))) enviadosAgora++;
  }
  return enviadosAgora;
}

type ItemComLead = {
  kit_id: string;
  lead_seller_kits: { token: string; seller_whatsapp: string | null };
  leads: {
    id: string;
    name: string;
    email: string | null;
    status: string;
    country: string;
    city: string | null;
    website: string | null;
    site_check: string | null;
    category: string | null;
    niche: string | null;
    review_count: number | null;
    rating: number | null;
    public_token: string;
    suggested_services: string[];
    first_contact_at: string | null;
  };
};

async function mandar(db: DbDoAtendente, cfg: ConfigDoAtendente, i: ItemComLead, etapa: number): Promise<boolean> {
  const l = i.leads;
  const numero = i.lead_seller_kits.seller_whatsapp;
  if (!l.email || !numero) return false;
  const ingles = l.country === 'US';
  const v = variaveisDoLead(
    {
      website: l.website,
      siteCheck: l.site_check,
      category: l.category,
      niche: l.niche,
      reviewCount: l.review_count,
      rating: l.rating,
      name: l.name,
      city: l.city,
      publicToken: l.public_token,
      suggestedServices: l.suggested_services,
    },
    ingles ? 'en' : 'pt',
    SITE_URL,
    { nome: cfg.personaName, assinatura: cfg.personaName, kit: i.lead_seller_kits.token }
  );
  const { assunto, corpo } = emailDaEtapa(etapa, {
    persona: cfg.personaName,
    empresa: l.name,
    problema: v.problema,
    elogio: v.elogio,
    diagnostico: v.diagnostico,
    whatsapp: linkWhatsApp(numero, textoDoBotao(l.name, cfg.personaName, ingles)),
    ingles,
  });

  // Reserva a etapa antes de enviar (unique lead+etapa): dois ticks não mandam duas vezes.
  const { data: reg, error } = await db
    .from('ia_emails')
    .insert({ lead_id: l.id, kit_id: i.kit_id, step: etapa, to_email: l.email, subject: assunto, body: corpo })
    .select('id')
    .single();
  if (error || !reg) return false;

  const r = await enviarEmail({
    para: l.email,
    assunto,
    texto: corpo,
    nomeDoRemetente: `${cfg.personaName} | Prog Soluções`,
    responderPara: cfg.ownerEmail,
  });
  const agora = new Date().toISOString();
  await db.from('ia_emails').update(r.ok ? { sent_at: agora } : { error: r.erro }).eq('id', reg.id);
  if (!r.ok) return false;

  await db
    .from('leads')
    .update({
      ...(etapa === 0 ? { status: 'contatado', first_contact_at: l.first_contact_at ?? agora } : {}),
      last_contact_at: agora,
      followup_step: etapa + 1,
      next_contact: null,
      updated_at: agora,
    })
    .eq('id', l.id);
  return true;
}
