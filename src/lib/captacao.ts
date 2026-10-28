// Captação de clientes para os serviços da Prog Soluções.
// Puro, sem servidor: lê o CSV do google-maps-scraper-kit, dá a nota de cada
// lead e diz quais serviços do catálogo ele tem chance de comprar.
//
// A nota (0–100) só usa o que o CSV mostra, sem visitar o site:
// - falta de site (ou site que é só rede social/link) é o sinal mais forte;
// - movimento no Google (avaliações) indica empresa ativa que pode pagar;
// - sem telefone nem e-mail não há como falar com ela.
// É um ponto de partida para ordenar a fila, não uma previsão de fechamento.

export const LEAD_STATUSES = [
  'novo',
  'contatado',
  'respondeu',
  'reuniao',
  'proposta',
  'fechado',
  'perdido',
  'nao_contatar',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  respondeu: 'Respondeu',
  reuniao: 'Reunião',
  proposta: 'Proposta',
  fechado: 'Fechado',
  perdido: 'Perdido',
  nao_contatar: 'Não contatar',
};

/** Etapas em que a conversa está viva (contam como "em negociação"). */
export const EM_NEGOCIACAO: LeadStatus[] = ['respondeu', 'reuniao', 'proposta'];
/** Etapas encerradas: saem da fila e dos follow-ups. */
export const ENCERRADOS: LeadStatus[] = ['fechado', 'perdido', 'nao_contatar'];

export type Pais = 'BR' | 'US';

export type Lead = {
  id: string;
  name: string;
  category: string | null;
  niche: string | null;
  city: string | null;
  state: string | null;
  country: Pais;
  address: string | null;
  phone: string | null;
  semWhatsapp: boolean;
  email: string | null;
  website: string | null;
  siteCheck: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  mapsUrl: string | null;
  publicToken: string;
  rating: number | null;
  reviewCount: number | null;
  score: number;
  suggestedServices: string[];
  reasons: string[];
  status: LeadStatus;
  nextContact: string | null;
  firstContactAt: string | null;
  repliedAt: string | null;
  closedAt: string | null;
  notes: string | null;
  customerId: string | null;
  createdAt: string;
  lastContactAt: string | null;
  /** Etapa da sequência já enviada: 0 nada, 1 primeiro contato, 2 dia 3, 3 dia 7, 4 dia 14. */
  followupStep: number;
  abVariant: 'A' | 'B' | null;
  diagViews: number;
  diagFirstViewAt: string | null;
  diagLastViewAt: string | null;
  latitude: number | null;
  longitude: number | null;
  screenshotUrl: string | null;
  quoteId: string | null;
  /** Checklist de descoberta (src/lib/checklist-descoberta.ts). */
  discovery: Record<string, string | string[]>;
  discoveryBy: string | null;
  discoveryAt: string | null;
};

/* ------------------------------------------------------------ CSV */

/** Parser de CSV com aspas (RFC 4180). Aceita vírgula ou ponto e vírgula. */
export function parseCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, '');
  const primeiraLinha = limpo.slice(0, limpo.indexOf('\n') >= 0 ? limpo.indexOf('\n') : undefined);
  const sep = (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ';' : ',';

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo[i + 1] === '\n') i++;
      linha.push(campo);
      if (linha.some((v) => v.trim() !== '')) linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v.trim() !== '')) linhas.push(linha);
  return linhas;
}

// Nomes de coluna aceitos para cada campo (o kit usa os primeiros; os outros
// cobrem o modo --full do engine e planilhas editadas à mão).
const COLUNAS: Record<string, string[]> = {
  name: ['title', 'name', 'nome'],
  phone: ['phone', 'telefone'],
  email: ['emails', 'email', 'e-mail'],
  website: ['website', 'web_site', 'site'],
  category: ['category', 'categoria'],
  address: ['address', 'complete_address', 'endereco', 'endereço'],
  rating: ['review_rating', 'rating', 'nota'],
  reviews: ['review_count', 'reviews', 'avaliacoes', 'avaliações'],
  instagram: ['instagram'],
  facebook: ['facebook'],
  linkedin: ['linkedin'],
  placeId: ['place_id', 'cid', 'data_id'],
  mapsUrl: ['link', 'maps_url', 'google_maps_url', 'url'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon'],
  // Gravada pelo scripts/captacao/checar-sites.py: fora, sem_https, sem_celular,
  // vende_online ou ok (vários juntos com "+").
  siteCheck: ['site_check'],
  // Gravadas pelo captar.ps1: a importação não precisa perguntar ramo, cidade e país.
  buscaRamo: ['busca_ramo'],
  buscaCidade: ['busca_cidade'],
  buscaEstado: ['busca_estado'],
  buscaPais: ['busca_pais'],
};

export type LinhaImportada = {
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  category: string | null;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  placeId: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  siteCheck: string | null;
  buscaRamo: string | null;
  buscaCidade: string | null;
  buscaEstado: string | null;
  buscaPais: string | null;
};

function numero(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Converte as linhas do CSV em leads. Linhas sem nome são ignoradas. */
export function linhasDoCsv(texto: string): LinhaImportada[] {
  const [cabecalho, ...dados] = parseCsv(texto);
  if (!cabecalho) return [];
  const nomes = cabecalho.map((c) => c.trim().toLowerCase());
  const indice = (campo: string) => {
    for (const alias of COLUNAS[campo]) {
      const i = nomes.indexOf(alias);
      if (i >= 0) return i;
    }
    return -1;
  };
  const pos = Object.fromEntries(Object.keys(COLUNAS).map((c) => [c, indice(c)]));
  const ler = (linha: string[], campo: string) => {
    const i = pos[campo];
    const v = i >= 0 ? linha[i]?.trim() : '';
    return v ? v : null;
  };

  return dados
    .map((l) => ({
      name: ler(l, 'name') ?? '',
      phone: ler(l, 'phone'),
      // O kit junta vários e-mails numa célula; o primeiro basta para contato.
      email:
        ler(l, 'email')
          ?.split(/[,;\s]+/)
          .find((e) => e.includes('@')) ?? null,
      website: ler(l, 'website'),
      category: ler(l, 'category'),
      address: ler(l, 'address'),
      rating: numero(ler(l, 'rating') ?? undefined),
      reviewCount: numero(ler(l, 'reviews') ?? undefined),
      instagram: ler(l, 'instagram'),
      facebook: ler(l, 'facebook'),
      linkedin: ler(l, 'linkedin'),
      placeId: ler(l, 'placeId'),
      mapsUrl: ler(l, 'mapsUrl'),
      ...coordenadas(ler(l, 'latitude'), ler(l, 'longitude'), ler(l, 'mapsUrl')),
      siteCheck: ler(l, 'siteCheck'),
      buscaRamo: ler(l, 'buscaRamo'),
      buscaCidade: ler(l, 'buscaCidade'),
      buscaEstado: ler(l, 'buscaEstado'),
      buscaPais: ler(l, 'buscaPais'),
    }))
    .filter((l) => l.name);
}

/**
 * Coordenadas da linha: colunas latitude/longitude, ou do próprio link do Maps
 * (`.../data=...!3d-16.68!4d-49.25...`), que vem em todo CSV do captar.ps1.
 */
function coordenadas(
  lat: string | null,
  lng: string | null,
  link: string | null
): { latitude: number | null; longitude: number | null } {
  const ok = (v: number) => Number.isFinite(v) && v !== 0;
  const a = Number(lat);
  const b = Number(lng);
  if (lat && lng && ok(a) && ok(b)) return { latitude: a, longitude: b };
  const m = link?.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return { latitude: Number(m[1]), longitude: Number(m[2]) };
  return { latitude: null, longitude: null };
}

/** Chave de deduplicação: place_id do Google, senão nome + dígitos do telefone. */
export function chaveDoLead(l: Pick<LinhaImportada, 'placeId' | 'name' | 'phone'>): string {
  if (l.placeId) return `place:${l.placeId}`;
  const nome = l.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `nome:${nome}|${(l.phone ?? '').replace(/\D/g, '')}`;
}

/* ------------------------------------------------------------ nota */

// Endereços que aparecem no campo "site" mas não são um site da empresa.
const SITE_FRACO = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'fb.me',
  'linktr.ee',
  'linkin.bio',
  'beacons.ai',
  'wa.me',
  'whatsapp.com',
  'api.whatsapp',
  'business.site',
  'negocio.site',
  'sites.google.com',
  'wixsite.com',
  'ifood.com.br',
  'doctoralia',
  'booksy.com',
  'yelp.com',
  'google.com',
  'goo.gl',
  'bit.ly',
  'tiktok.com',
  'ubereats.com',
  'doordash.com',
  'linkedin.com',
  'my.canva.site',
  // Páginas de agendamento: a empresa usa no lugar de um site próprio.
  'apointoo.com',
  'calendly.com',
  'simplybook',
  'agendapro',
  'trinks.com',
  'setmore.com',
  'square.site',
];

// Negócios que vendem produto: candidatos a loja virtual.
const VAREJO = [
  'loja',
  'boutique',
  'moda',
  'roupa',
  'vestuário',
  'calçado',
  'joalheria',
  'ótica',
  'otica',
  'perfumaria',
  'cosmético',
  'cosmetico',
  'suplemento',
  'papelaria',
  'móveis',
  'moveis',
  'decoração',
  'decoracao',
  'floricultura',
  'pet shop',
  'artigos',
  'presentes',
  'brinquedo',
  // "shop" sozinho não entra: pegaria barbershop, que é serviço.
  'store',
  'clothing',
  'apparel',
  'jewelry',
  'jeweler',
  'florist',
  'furniture',
  'gift',
  'cosmetics',
  'supplement',
  'retail',
  'optical',
  'eyewear',
  // Categorias do Google em português (buscas do Brasil saem em pt-BR).
  'materiais de construção',
  'materiais de construcao',
  'mercado',
  'empório',
  'emporio',
  'market',
  'bakery',
  'padaria',
  'confeitaria',
];

// Negócios com agenda, cadastro, estoque ou financeiro: candidatos a sistema de gestão.
const GESTAO = [
  'clínica',
  'clinica',
  'consultório',
  'consultorio',
  'odontol',
  'dentista',
  'academia',
  'pilates',
  'crossfit',
  'oficina',
  'mecânica',
  'mecanica',
  'salão',
  'salao',
  'barbearia',
  'estética',
  'estetica',
  'escola',
  'curso',
  'veterinár',
  'veterinar',
  'pet shop',
  'distribuidora',
  'contabilidade',
  'imobiliária',
  'imobiliaria',
  'laboratório',
  'laboratorio',
  'fisioterapia',
  'autoescola',
  'buffet',
  'clinic',
  'dentist',
  'dental',
  'gym',
  'fitness',
  'auto repair',
  'mechanic',
  'salon',
  'barber',
  'spa',
  'school',
  'academy',
  'veterinar',
  'physical therap',
  'chiropract',
  'accounting',
  'real estate',
  'distributor',
  'wholesale',
  // Categorias do Google em português (buscas do Brasil saem em pt-BR).
  'contador',
  'advoga',
  'advocacia',
  'psicólog',
  'psicolog',
  'nutricionista',
  'idiomas',
  'arquitet',
  'dedetiza',
  'assistência técnica',
  'assistencia tecnica',
  'centro automotivo',
  'despachante',
  'corretor',
  'materiais de construção',
  'materiais de construcao',
  'lavanderia',
  'cleaning',
  'contractor',
  'construction',
  'lawyer',
  'attorney',
  'insurance',
  'church',
  'igreja',
];

const contem = (texto: string, lista: string[]) => lista.some((p) => texto.includes(p));

export function ehVarejo(category: string | null, niche: string | null): boolean {
  return contem(`${category ?? ''} ${niche ?? ''}`.toLowerCase(), VAREJO);
}

/** O principal achado sobre o site, na ordem em que vira argumento de venda. */
export type SituacaoDoSite = 'sem_site' | 'rede_social' | 'parado' | 'fora' | 'sem_celular' | 'sem_https' | 'vende_online' | 'ok';

export function situacaoDoSite(website: string | null, siteCheck: string | null): SituacaoDoSite {
  const site = (website ?? '').toLowerCase();
  if (!site) return 'sem_site';
  if (contem(site, SITE_FRACO)) return 'rede_social';
  const c = siteCheck ?? '';
  if (c.includes('parado')) return 'parado';
  if (c.includes('fora')) return 'fora';
  if (c.includes('sem_celular')) return 'sem_celular';
  if (c.includes('sem_https')) return 'sem_https';
  if (c.includes('vende_online')) return 'vende_online';
  return 'ok';
}

export type Avaliacao = { score: number; suggestedServices: string[]; reasons: string[] };

export function avaliarLead(l: LinhaImportada, niche: string | null): Avaliacao {
  const tipo = `${l.category ?? ''} ${niche ?? ''}`.toLowerCase();
  const varejo = contem(tipo, VAREJO);
  const gestao = contem(tipo, GESTAO);
  const site = (l.website ?? '').toLowerCase();
  const servicos: string[] = [];
  const motivos: string[] = [];
  let nota = 0;

  if (!site) {
    nota += 40;
    motivos.push('Sem site');
    servicos.push(varejo ? 'Loja Essencial' : 'Site Essencial');
  } else if (contem(site, SITE_FRACO)) {
    nota += 30;
    motivos.push('O "site" é só rede social ou link');
    servicos.push(varejo ? 'Loja Essencial' : 'Site Profissional');
  } else if (l.siteCheck?.includes('parado')) {
    // Domínio à venda: o site morreu e o endereço pode ir para outro dono.
    nota += 40;
    motivos.push('Domínio do site à venda (site perdido)');
    servicos.push(varejo ? 'Loja Essencial' : 'Site Essencial');
  } else if (l.siteCheck?.includes('fora')) {
    nota += 35;
    motivos.push('Site fora do ar');
    servicos.push(varejo ? 'Loja Essencial' : 'Site Essencial');
  } else if (l.siteCheck?.includes('sem_celular')) {
    nota += 20;
    motivos.push('Site não se adapta ao celular');
    servicos.push(varejo ? 'Loja Essencial' : 'Site Profissional');
  } else if (varejo && !l.siteCheck?.includes('vende_online')) {
    nota += 10;
    motivos.push('Tem site; conferir se já vende online');
    servicos.push('Loja Essencial');
  }
  if (l.siteCheck?.includes('vende_online')) motivos.push('Já vende online');
  // Sem HTTPS o navegador mostra "não seguro": soma a qualquer outro motivo.
  if (l.siteCheck?.includes('sem_https') && !l.siteCheck.includes('fora')) {
    nota += 10;
    motivos.push('Site sem HTTPS ("não seguro")');
    if (servicos.length === 0) servicos.push('Site Profissional');
  }

  if (gestao) {
    nota += 10;
    motivos.push('Ramo que usa agenda, cadastro ou estoque');
    servicos.push('Sistema de Gestão Básico');
  }

  const avaliacoes = l.reviewCount ?? 0;
  if (avaliacoes >= 100) {
    nota += 20;
    motivos.push(`${avaliacoes} avaliações: empresa com movimento`);
  } else if (avaliacoes >= 30) nota += 15;
  else if (avaliacoes >= 10) nota += 5;
  else if (avaliacoes < 3) {
    nota -= 10;
    motivos.push('Quase sem avaliações no Google');
  }
  if ((l.rating ?? 0) >= 4.5) nota += 5;

  if (l.phone) nota += 10;
  if (l.email) nota += 5;
  if (!l.phone && !l.email) {
    nota -= 20;
    motivos.push('Sem telefone nem e-mail');
  }

  return { score: Math.max(0, Math.min(100, nota)), suggestedServices: servicos, reasons: motivos };
}

/* ------------------------------------------------------------ contato */

/**
 * Número no formato do wa.me, ou null se não der para montar.
 * `celular` é false para fixo brasileiro (8 dígitos depois do DDD), que
 * normalmente não tem WhatsApp.
 */
export function whatsappDoLead(phone: string | null, pais: Pais): { numero: string; celular: boolean } | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (pais === 'BR') {
    if (d.startsWith('0')) d = d.replace(/^0+/, '');
    if (!d.startsWith('55') || d.length <= 11) d = `55${d}`;
    if (d.length !== 12 && d.length !== 13) return null;
    return { numero: d, celular: d.length === 13 && d[4] === '9' };
  }
  if (d.length === 10) d = `1${d}`;
  if (d.length !== 11 || !d.startsWith('1')) return null;
  // Nos EUA não dá para saber pelo número, e telefone comercial costuma ser fixo
  // sem WhatsApp: o botão fica sem destaque (e-mail e ligação primeiro).
  return { numero: d, celular: false };
}

/** Link do Maps: o do CSV (modo --full) ou uma busca por nome + endereço. */
export function mapsDoLead(l: Pick<Lead, 'mapsUrl' | 'name' | 'address' | 'city'>): string {
  if (l.mapsUrl) return l.mapsUrl;
  const q = [l.name, l.address ?? l.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/* ------------------------------------------------------------ sequência de retorno */

/** Dias depois do primeiro contato em que cada retorno vence (etapas 1, 2 e 3). */
export const DIAS_DA_ETAPA = [0, 3, 7, 14] as const;
export const NOME_DA_ETAPA = ['Primeiro contato', 'Retorno (dia 3)', 'Retorno (dia 7)', 'Último contato (dia 14)'] as const;
/** Canal sugerido em cada etapa: alterna para não insistir sempre no mesmo. */
export const CANAL_DA_ETAPA = ['whatsapp', 'whatsapp', 'email', 'whatsapp'] as const;

function somarDias(iso: string, dias: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Próxima mensagem da sequência: etapa (0–3) e a data em que vence. Só para
 * quem ainda não respondeu (novo ou contatado); null quando a sequência acabou.
 */
export function proximaEtapa(
  l: Pick<Lead, 'status' | 'followupStep' | 'firstContactAt'>
): { etapa: number; vence: string | null } | null {
  if (l.status !== 'novo' && l.status !== 'contatado') return null;
  if (l.followupStep >= 4) return null;
  if (l.followupStep === 0 || !l.firstContactAt) return { etapa: 0, vence: null };
  const etapa = l.followupStep;
  return { etapa, vence: somarDias(l.firstContactAt, DIAS_DA_ETAPA[etapa]) };
}

/** Data do retorno seguinte depois de enviar a etapa `etapa` (null depois da última). */
export function retornoDepoisDe(etapa: number, primeiroContato: string): string | null {
  return etapa >= 3 ? null : somarDias(primeiroContato, DIAS_DA_ETAPA[etapa + 1]);
}

/* ------------------------------------------------------------ lead quente */

/** Abriu o diagnóstico nas últimas 48 h. */
export function ehQuente(l: Pick<Lead, 'diagLastViewAt' | 'status'>, agora: number): boolean {
  return !!l.diagLastViewAt && !ENCERRADOS.includes(l.status) && agora - Date.parse(l.diagLastViewAt) <= 48 * 3600 * 1000;
}

/* ------------------------------------------------------------ importação */

export type PadroesDaImportacao = {
  pais: Pais;
  niche: string | null;
  city: string | null;
  state: string | null;
  source: string;
};

/**
 * Linhas do CSV → registros da tabela leads (nota, serviços, dedupe). Usada
 * pela importação do painel e pelo programa do PC (worker), para as duas
 * darem exatamente o mesmo resultado. Nunca leva status, notas e datas de
 * contato: o upsert não pode mexer no que o dono já fez.
 */
export function registrosDaImportacao(linhas: LinhaImportada[], padroes: PadroesDaImportacao) {
  const agora = new Date().toISOString();
  return linhas.map((l) => {
    const pais: Pais = l.buscaPais === 'US' || l.buscaPais === 'BR' ? l.buscaPais : padroes.pais;
    const niche = l.buscaRamo ?? padroes.niche;
    const { score, suggestedServices, reasons } = avaliarLead(l, niche);
    return {
      dedupe_key: chaveDoLead(l),
      place_id: l.placeId,
      name: l.name,
      category: l.category,
      niche,
      city: l.buscaCidade ?? padroes.city,
      state: l.buscaEstado || padroes.state,
      country: pais,
      address: l.address,
      phone: l.phone,
      email: l.email,
      website: l.website,
      site_check: l.siteCheck,
      instagram: l.instagram,
      facebook: l.facebook,
      linkedin: l.linkedin,
      maps_url: l.mapsUrl,
      latitude: l.latitude,
      longitude: l.longitude,
      rating: l.rating,
      review_count: l.reviewCount,
      score,
      suggested_services: suggestedServices,
      reasons,
      source: padroes.source,
      updated_at: agora,
    };
  });
}

export function urlComProtocolo(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
