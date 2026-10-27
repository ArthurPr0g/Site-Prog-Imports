// Mensagens prontas de WhatsApp e e-mail para os leads da Captação.
// Puro: a tela monta o texto com o modelo salvo (lead_templates) e os dados do
// lead, e abre o WhatsApp ou o Gmail já preenchidos.
//
// Variáveis aceitas nos modelos: {empresa} {cidade} {elogio} {problema}
// {servico} {diagnostico} {portfolio}. Variável desconhecida fica como está,
// para o dono ver o erro de digitação em vez de sumir com o texto.

import { ehVarejo, situacaoDoSite, type Lead, type SituacaoDoSite } from '@/lib/captacao';

export type Canal = 'whatsapp' | 'email';
export type Idioma = 'pt' | 'en';

export type Variante = 'A' | 'B';

/**
 * Um modelo por canal × idioma × etapa da sequência (0 primeiro contato, 1 dia
 * 3, 2 dia 7, 3 dia 14) × variante do teste A/B (B é opcional).
 */
export type ModeloMensagem = {
  channel: Canal;
  lang: Idioma;
  step: number;
  variant: Variante;
  subject: string | null;
  body: string;
};

/** Modelo da etapa; a variante B só vale se existir, senão cai na A. */
export function escolherModelo(
  modelos: ModeloMensagem[],
  canal: Canal,
  lang: Idioma,
  step: number,
  variant: Variante
): ModeloMensagem | undefined {
  const da = (v: Variante) => modelos.find((m) => m.channel === canal && m.lang === lang && m.step === step && m.variant === v);
  return da(variant) ?? da('A');
}

/**
 * Variante do teste A/B para o lead: a que ele já recebeu, ou alterna pelo id
 * (metade A, metade B) quando existe modelo B para o primeiro contato.
 */
export function varianteDoLead(l: Pick<Lead, 'id' | 'abVariant' | 'country'>, modelos: ModeloMensagem[]): Variante {
  if (l.abVariant) return l.abVariant;
  const lang = idiomaDoLead(l);
  const temB = modelos.some((m) => m.lang === lang && m.step === 0 && m.variant === 'B' && m.body.trim());
  if (!temB) return 'A';
  return parseInt(l.id.replace(/-/g, '').slice(-2), 16) % 2 === 0 ? 'A' : 'B';
}

export const VARIAVEIS = ['empresa', 'cidade', 'elogio', 'problema', 'servico', 'diagnostico', 'portfolio'] as const;

const PORTFOLIO: Record<Idioma, string> = {
  pt: 'https://portfolio-arthur-prog.vercel.app/pt',
  en: 'https://portfolio-arthur-prog.vercel.app/en',
};

export const idiomaDoLead = (l: Pick<Lead, 'country'>): Idioma => (l.country === 'US' ? 'en' : 'pt');

// Frase que completa "Encontrei a {empresa} no Google Maps e {problema}".
const PROBLEMA: Record<SituacaoDoSite, Record<Idioma, string>> = {
  sem_site: {
    pt: 'vi que vocês ainda não têm um site próprio',
    en: "noticed you don't have your own website yet",
  },
  rede_social: {
    pt: 'vi que o link de vocês no Google leva para uma rede social, não para um site próprio',
    en: 'noticed your Google link goes to a social profile instead of your own website',
  },
  parado: {
    pt: 'vi que o endereço do site de vocês está à venda, ou seja, o site saiu do ar',
    en: 'noticed your website address is up for sale, so the site is no longer online',
  },
  fora: {
    pt: 'tentei abrir o site de vocês, mas ele está fora do ar',
    en: 'tried to open your website, but it seems to be down',
  },
  sem_celular: {
    pt: 'abri o site de vocês no celular e ele não se adapta à tela',
    en: "opened your website on my phone and it doesn't fit the screen",
  },
  sem_https: {
    pt: 'vi que o site de vocês aparece como "não seguro" no navegador',
    en: 'noticed your website shows as "not secure" in the browser',
  },
  vende_online: {
    pt: 'dei uma olhada na loja online de vocês',
    en: 'took a look at your online store',
  },
  ok: {
    pt: 'dei uma olhada na presença online de vocês',
    en: 'took a look at your online presence',
  },
};

// Loja física sem venda online: o argumento é vender pelo site.
const PROBLEMA_VAREJO: Record<Idioma, string> = {
  pt: 'vi que vocês ainda não vendem pelo site',
  en: "noticed you don't sell online yet",
};

function servicoPrincipal(l: Lead, lang: Idioma): string {
  const s = l.suggestedServices.join(' ');
  if (s.includes('Loja')) return lang === 'pt' ? 'lojas virtuais' : 'online stores';
  if (s.includes('Site')) return lang === 'pt' ? 'sites profissionais' : 'professional websites';
  if (s.includes('Sistema')) {
    return lang === 'pt'
      ? 'sistemas de gestão (agenda, clientes e financeiro)'
      : 'management systems (scheduling, clients and finances)';
  }
  return lang === 'pt' ? 'sites e sistemas' : 'websites and systems';
}

export function variaveisDoLead(l: Lead, lang: Idioma, origem: string): Record<string, string> {
  const situacao = situacaoDoSite(l.website, l.siteCheck);
  const problema = situacao === 'ok' && ehVarejo(l.category, l.niche) ? PROBLEMA_VAREJO[lang] : PROBLEMA[situacao][lang];
  // Elogio só quando é verdade e vale citar: muita avaliação e nota boa.
  const n = l.reviewCount ?? 0;
  const elogio =
    n >= 30 && (l.rating ?? 0) >= 4.3
      ? lang === 'pt'
        ? ` (${n} avaliações e nota ${l.rating!.toFixed(1).replace('.', ',')}, parabéns!)`
        : ` (${n} reviews and a ${l.rating!.toFixed(1)} rating, congrats!)`
      : '';
  return {
    empresa: l.name,
    cidade: l.city ?? '',
    elogio,
    problema,
    servico: servicoPrincipal(l, lang),
    diagnostico: `${origem}/diagnostico/${l.publicToken}`,
    portfolio: PORTFOLIO[lang],
  };
}

export function preencher(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in vars ? vars[nome] : inteiro));
}

export function linkWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Abre o Gmail (conta padrão do navegador) com destinatário, assunto e texto. */
export function linkGmail(para: string, assunto: string, texto: string): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to: para, su: assunto, body: texto });
  return `https://mail.google.com/mail/?${q.toString()}`;
}
