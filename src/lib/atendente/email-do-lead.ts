// O e-mail que a Lia manda para um lead (1º contato e retornos). Separado do
// relógio para o "Enviar e-mail de teste" do painel usar exatamente o mesmo texto
// que o lead real recebe (pedido do dono em 28/10/2026).

import type { ConfigDoAtendente } from '@/lib/atendente/regras';
import { emailDaEtapa, textoDoBotao, ENDERECO_COMERCIAL } from '@/lib/atendente/regras';
import { htmlDoEmail, type PartesDoEmail } from '@/lib/atendente/email-html';
import { variaveisDoLead, linkWhatsApp } from '@/lib/mensagens-lead';
import { SITE_URL } from '@/lib/seo';
import { situacaoDoSite } from '@/lib/captacao';
import type { DbDoAtendente } from '@/lib/atendente/db';

/** Concorrentes do lead na base: mesmo ramo, cidade e país (a mesma conta do diagnóstico, lead_diagnostico). */
export type Regiao = { total: number; comSite: number; notaMedia: number | null };

// Site próprio e no ar: rede social e página de agendamento não contam (igual ao lead_diagnostico).
const NAO_E_SITE = /(instagram|facebook|fb\.(com|me)|wa\.me|whatsapp|linktr\.ee|linkin\.bio|beacons\.ai|business\.site|negocio\.site|sites\.google|apointoo|calendly|booksy|doctoralia|ifood)/i;

export async function regiaoDoLead(db: DbDoAtendente, l: ItemComLead['leads']): Promise<Regiao | null> {
  if (!l.city || !l.niche) return null;
  const { data } = await db
    .from('leads')
    .select('website, site_check, rating')
    .eq('country', l.country)
    .eq('city', l.city)
    .eq('niche', l.niche)
    .neq('id', l.id)
    .limit(1000);
  const c = data ?? [];
  const notas = c.map((x) => Number(x.rating)).filter((n) => n > 0);
  return {
    total: c.length,
    comSite: c.filter(
      (x) => x.website && !NAO_E_SITE.test(x.website) && !(x.site_check ?? '').includes('fora') && !(x.site_check ?? '').includes('parado')
    ).length,
    notaMedia: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null,
  };
}

/** O dado da região que vale citar (sempre verdadeiro). null = sem amostra ou sem contraste. */
function fraseDaRegiao(l: ItemComLead['leads'], r: Regiao | null, ingles: boolean): { assunto: string; cartao: string } | null {
  if (!r || r.total < 5 || !l.city) return null;
  const sit = situacaoDoSite(l.website, l.site_check);
  const semSiteProprio = ['sem_site', 'rede_social', 'fora', 'parado'].includes(sit);
  // Só cita quando a maioria relevante já tem site (40%+): "7 de 59" diria o contrário.
  if (semSiteProprio && r.comSite / r.total >= 0.4) {
    return ingles
      ? {
          assunto: `${l.name}: ${r.comSite} of the ${r.total} competitors we checked in ${l.city} have their own website`,
          cartao: `Of the ${r.total} businesses like yours we checked in ${l.city}, ${r.comSite} already have their own website`,
        }
      : {
          assunto: `${l.name}: ${r.comSite} dos ${r.total} concorrentes que analisamos em ${l.city} têm site próprio`,
          cartao: `Dos ${r.total} negócios do seu ramo que analisamos em ${l.city}, ${r.comSite} já têm site próprio`,
        };
  }
  const nota = Number(l.rating ?? 0);
  if (r.notaMedia && nota >= 4.3 && nota - r.notaMedia >= 0.2) {
    const n = (v: number) => (ingles ? v.toFixed(1) : v.toFixed(1).replace('.', ','));
    return ingles
      ? {
          assunto: `${l.name}: ${n(nota)} on Google, above the ${l.city} average (${n(r.notaMedia)})`,
          cartao: `Your ${n(nota)} rating is above the ${l.city} average for your field (${n(r.notaMedia)}): online, that should show`,
        }
      : {
          assunto: `${l.name}: nota ${n(nota)} no Google, acima da média de ${l.city} (${n(r.notaMedia)})`,
          cartao: `Sua nota ${n(nota)} está acima da média do seu ramo em ${l.city} (${n(r.notaMedia)}): isso precisa aparecer na internet`,
        };
  }
  return null;
}

/** Colunas que o relógio e o teste leem de cada item da lista da IA. */
export const SELECT_DO_ITEM =
  'kit_id, position, lead_seller_kits!inner(kind, active, token, seller_whatsapp), leads!inner(id, name, email, status, country, city, website, site_check, category, niche, review_count, rating, public_token, suggested_services, first_contact_at)';

export type ItemComLead = {
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

/** Assunto, texto puro e versão bonita (HTML) do e-mail da etapa (0 = 1º contato). null se o link da IA não tem WhatsApp. */
export function emailDoLead(
  cfg: ConfigDoAtendente,
  i: ItemComLead,
  etapa: number,
  o: { regiao?: Regiao | null; assuntoDoPrimeiro?: string | null } = {}
): { assunto: string; corpo: string; html: string } | null {
  const l = i.leads;
  const numero = i.lead_seller_kits.seller_whatsapp;
  if (!numero) return null;
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
  const whatsapp = linkWhatsApp(numero, textoDoBotao(l.name, cfg.personaName, ingles));
  const texto = emailDaEtapa(etapa, {
    persona: cfg.personaName,
    empresa: l.name,
    problema: v.problema,
    elogio: v.elogio,
    diagnostico: v.diagnostico,
    whatsapp,
    ingles,
  });
  const regiao = etapa === 0 ? fraseDaRegiao(l, o.regiao ?? null, ingles) : null;
  const html = htmlDoEmail(
    partes(etapa, { persona: cfg.personaName, empresa: l.name, problema: v.problema, elogio: v.elogio, diagnostico: v.diagnostico, whatsapp, ingles }, regiao?.cartao)
  );
  // Assunto com o número real da região (pedido do dono, 28/10/2026); os retornos
  // repetem o assunto do 1º e-mail com "Re:" para ficarem na mesma conversa.
  const assunto = regiao ? regiao.assunto : etapa === 1 && o.assuntoDoPrimeiro ? `Re: ${o.assuntoDoPrimeiro}` : texto.assunto;
  const corpo = regiao ? texto.corpo.replace(/\n\n(Preparei|I put together)/, `\n\n${regiao.cartao}.\n\n$1`) : texto.corpo;
  return { assunto, corpo, html };
}

type Dados = { persona: string; empresa: string; problema: string; elogio: string; diagnostico: string; whatsapp: string; ingles: boolean };

/** O mesmo conteúdo do texto puro (emailDaEtapa), organizado em blocos para o HTML. */
function partes(etapa: number, d: Dados, regiao?: string): PartesDoEmail {
  const comum = d.ingles
    ? {
        persona: d.persona,
        tagline: 'Websites, online stores and management systems',
        endereco: ENDERECO_COMERCIAL,
        descadastro: 'If you\'d rather not hear from us, just reply "no".',
        botao: { texto: `Message ${d.persona} on WhatsApp`, url: d.whatsapp },
        linkSecundario: { texto: 'See the free review', url: d.diagnostico },
      }
    : {
        persona: d.persona,
        tagline: 'Sites, lojas virtuais e sistemas de gestão',
        endereco: ENDERECO_COMERCIAL,
        descadastro: 'Se não quiser mais receber mensagens, é só responder "não".',
        botao: { texto: `Falar com a ${d.persona} no WhatsApp`, url: d.whatsapp },
        linkSecundario: { texto: 'Ver o diagnóstico gratuito', url: d.diagnostico },
      };
  if (d.ingles) {
    const en: Omit<PartesDoEmail, keyof typeof comum>[] = [
      {
        previa: `A free review of ${d.empresa}'s online presence`,
        saudacao: 'Hi there,',
        paragrafos: [
          `I'm ${d.persona} from Prog Soluções. I found **${d.empresa}** on Google Maps${d.elogio}.`,
          'I put together a free review, no strings attached, with what I found and how other businesses nearby show up online.',
        ],
        destaque: { titulo: 'What I found', texto: d.problema.replace(/^noticed /, 'I noticed '), extra: regiao },
        notaDoBotao: "I'll walk you through it in 5 minutes.",
        despedida: 'Best,',
      },
      {
        previa: `Did you get a chance to see the review for ${d.empresa}?`,
        saudacao: 'Hi!',
        paragrafos: [`Just checking whether you had a chance to see the review I prepared for **${d.empresa}**.`],
        despedida: 'Any questions, just message me.',
      },
      {
        previa: `One idea for ${d.empresa}`,
        saudacao: 'Hi!',
        paragrafos: [
          `One last idea for **${d.empresa}**: most new customers check Google before calling.`,
          'A simple, fast website with a WhatsApp button usually turns those searches into conversations.',
        ],
        despedida: 'Best,',
      },
      {
        previa: `Closing the loop on ${d.empresa}`,
        saudacao: 'Hi!',
        paragrafos: [`I won't take more of your time. If this becomes a priority later for **${d.empresa}**, just message me.`],
        despedida: 'All the best,',
      },
    ];
    return { ...comum, ...(en[etapa] ?? en[0]) };
  }
  const pt: Omit<PartesDoEmail, keyof typeof comum>[] = [
    {
      previa: `Um diagnóstico gratuito da presença online da ${d.empresa}`,
      saudacao: 'Olá, tudo bem?',
      paragrafos: [
        `Aqui é a ${d.persona}, da Prog Soluções. Encontrei a **${d.empresa}** no Google Maps${d.elogio}.`,
        'Preparei um diagnóstico gratuito, sem compromisso, com o que encontrei e como os concorrentes da região aparecem.',
      ],
      destaque: { titulo: 'O que encontrei', texto: d.problema, extra: regiao },
      notaDoBotao: 'Te explico tudo em 5 minutos.',
      despedida: 'Abraço,',
    },
    {
      previa: `Conseguiu ver o diagnóstico da ${d.empresa}?`,
      saudacao: 'Oi!',
      paragrafos: [`Passando para saber se você conseguiu ver o diagnóstico que preparei para a **${d.empresa}**.`],
      despedida: 'Qualquer dúvida, é só me chamar.',
    },
    {
      previa: `Uma ideia para a ${d.empresa}`,
      saudacao: 'Oi!',
      paragrafos: [
        `Uma última ideia para a **${d.empresa}**: a maioria dos clientes novos procura no Google antes de ligar.`,
        'Um site simples, rápido e com botão de WhatsApp costuma transformar essas buscas em conversas.',
      ],
      despedida: 'Abraço,',
    },
    {
      previa: `Encerrando o contato sobre a ${d.empresa}`,
      saudacao: 'Oi!',
      paragrafos: [`Não vou tomar mais o seu tempo. Se isso virar prioridade mais para frente para a **${d.empresa}**, é só me chamar.`],
      despedida: 'Sucesso!',
    },
  ];
  return { ...comum, ...(pt[etapa] ?? pt[0]) };
}
