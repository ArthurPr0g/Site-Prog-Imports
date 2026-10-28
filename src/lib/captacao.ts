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
  /** Sinais de atividade e dados do negócio no Google (migration 0064). */
  mapsStatus: string | null;
  lastReviewAt: string | null;
  ownerClaimed: boolean | null;
  openingHours: Record<string, string[]> | null;
  attributes: string[];
  onlineBooking: string | null;
  ratingDist: Record<string, number> | null;
  recentReviews: AvaliacaoRecente[];
  /** Porte estimado (migration 0065) e quantas unidades da mesma marca há na cidade. */
  porte: Porte | null;
  unidades: number;
};

export type Porte = 'pequena' | 'media' | 'grande';
export const NOME_DO_PORTE: Record<Porte, string> = { pequena: 'Pequena', media: 'Média', grande: 'Grande' };

/** Avaliação do Google guardada no lead: nota, data (AAAA-MM-DD) e trecho. */
export type AvaliacaoRecente = { n: number | null; d: string | null; t: string };

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
  // Calculadas pelo kit (scrape.py, derive): sinais de atividade e dados do negócio.
  mapsStatus: ['status', 'maps_status'],
  ultimaAvaliacao: ['ultima_avaliacao'],
  perfilReivindicado: ['perfil_reivindicado'],
  horario: ['horario'],
  atributos: ['atributos'],
  agendamento: ['agendamento_online'],
  notas: ['notas'],
  avaliacoes: ['avaliacoes'],
};

/**
 * E-mail que não é da empresa: modelo de site (info@example.com), endereço
 * técnico (sentry, wixpress), de plataforma (linktr.ee, doctoralia) ou nome de
 * arquivo de imagem (nuvempago@2x.png). Mesma regra da migration 0064 e do kit.
 */
const EMAIL_LIXO = [
  /@([a-z0-9-]+\.)*(example|exemplo|sentry|wixpress|yourdomain|seudominio|seusite|suaempresa|linktr\.ee|doctoralia|domain\.com|dominio\.com|email\.com$|mail\.com$)/i,
  /\.(png|jpe?g|gif|webp|svg)$/i,
  /^(name|email|user|you|someone|seuemail|seu-email|seunome|nome|seu|voce|você|exemplo|johndoe|john\.doe)@/i,
];
export const emailDeVerdade = (e: string) => !EMAIL_LIXO.some((r) => r.test(e));

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
  // undefined = o CSV não tem a coluna (reimportar um CSV antigo não apaga o que já existe).
  mapsStatus?: string | null;
  ultimaAvaliacao?: string | null;
  perfilReivindicado?: boolean | null;
  horario?: Record<string, string[]> | null;
  atributos?: string[] | null;
  agendamento?: string | null;
  notas?: Record<string, number> | null;
  avaliacoes?: AvaliacaoRecente[] | null;
};

function json<T>(v: string | null): T | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

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
  /** Campo opcional: undefined quando o CSV não tem a coluna. */
  function opcional<T>(linha: string[], campo: string, conv: (v: string | null) => T): T | undefined {
    return pos[campo] >= 0 ? conv(ler(linha, campo)) : undefined;
  }

  return dados
    .map((l) => ({
      name: ler(l, 'name') ?? '',
      phone: ler(l, 'phone'),
      // O kit junta vários e-mails numa célula; o primeiro basta para contato.
      email:
        ler(l, 'email')
          ?.split(/[,;\s]+/)
          .map((e) => e.replace(/^(%20)+/, '').toLowerCase())
          .find((e) => e.includes('@') && emailDeVerdade(e)) ?? null,
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
      mapsStatus: opcional(l, 'mapsStatus', (v) => v),
      ultimaAvaliacao: opcional(l, 'ultimaAvaliacao', (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)),
      perfilReivindicado: opcional(l, 'perfilReivindicado', (v) => v === 'sim'),
      horario: opcional(l, 'horario', (v) => json<Record<string, string[]>>(v)),
      atributos: opcional(l, 'atributos', (v) => (v ? v.split(';').map((a) => a.trim()).filter(Boolean) : null)),
      agendamento: opcional(l, 'agendamento', (v) => v),
      notas: opcional(l, 'notas', (v) => json<Record<string, number>>(v)),
      avaliacoes: opcional(l, 'avaliacoes', (v) => json<AvaliacaoRecente[]>(v)),
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

export type Avaliacao = { score: number; suggestedServices: string[]; reasons: string[]; porte: Porte; rede: boolean };

/* ------------------------------------------------------------ porte */

// Palavras do nome que não identificam a marca (o ramo, ligações, "unidade").
const GENERICAS = new Set(
  ('a o as os e de da do das dos em no na com para por the and of ' +
    'loja lojas pet shop petshop clinica clinicas consultorio odontologia odonto odontologica dental dentista ' +
    'salao studio estudio espaco centro instituto academia escola colegio curso cursos idiomas ' +
    'otica oticas farmacia drogaria mercado supermercado restaurante bar cafe padaria ' +
    'imobiliaria escritorio advocacia advogados contabilidade contabil arquitetura lavanderia ' +
    'buffet festas floricultura flores joalheria moda boutique calcados moveis decoracao materiais construcao ' +
    'distribuidora bebidas conveniencia auto escola cfc barbearia beleza estetica fisioterapia ' +
    'unidade filial matriz loja1 loja2 goiania brasilia gyn go df sp rj')
    .split(' ')
);

/**
 * Chave da marca para contar unidades: duas primeiras palavras do nome que não
 * sejam o ramo (ex.: "Óticas Diniz Rua 83" e "Óticas Diniz Setor Bueno" → "diniz").
 * null quando o nome é só o ramo.
 */
export function chaveDaMarca(nome: string): string | null {
  const palavras = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[\s\-|–,()/.&]+/)
    .filter((p) => p.length >= 2 && !GENERICAS.has(p) && !/^\d+$/.test(p));
  const chave = palavras.slice(0, 2).join(' ');
  return chave.length >= 4 ? chave : null;
}

// Redes e franquias nacionais: site, loja e sistema vêm da marca (decisão da matriz).
const REDES = [
  'cobasi', 'petz', 'petland', 'oticas diniz', 'oticas carol', 'chilli beans', 'boticario', 'natura', 'drogasil',
  'pague menos', 'smart fit', 'smartfit', 'bluefit', 'selfit', 'bodytech', 'wizard', 'ccaa', 'fisk', 'cna',
  'wise up', 'wiseup', 'kumon', 'cacau show', 'kopenhagen', 'havaianas', 'renner', 'riachuelo', 'c&a', 'centauro',
  'leroy merlin', 'telhanorte', 'magazine luiza', 'casas bahia', '5asec', '5 a sec', 'omo lavanderia', 'lavateria',
  'odontocompany', 'sorridents', 'oral sin', 'amor saude', 'dr consulta', 'dr. consulta', 'hering', 'vivara',
  'pandora', 'sodie', 'mcdonald', 'subway', 'burger king', 'cvc', 'localiza', 'unimed', 'hapvida', 'sabin',
  'fleury', 'hermes pardini', 'uniodonto', 'grupo boticario', 'quem disse berenice',
];

const ALTO_TICKET = ['imobili', 'buffet', 'escola', 'colégio', 'colegio', 'advoca', 'arquitet', 'construç', 'construc', 'distribuidora', 'clínica médica', 'clinica medica', 'real estate', 'construction', 'lawyer'];

/**
 * Porte estimado pelo que é público no Google. Não é faturamento: é um
 * indicador de tamanho para escolher o nível do pacote.
 * - Avaliações no Google acompanham o volume de clientes (≥1.000 +3, ≥300 +2, ≥100 +1, <30 −1).
 * - Mais de uma unidade da marca na cidade: +2.
 * - Site próprio funcionando (já investe em presença): +1.
 * - Ramo de ticket alto (imobiliária, buffet, escola, advocacia...): +1.
 * Soma ≤ 1 pequena, 2 a 3 média, ≥ 4 grande. Média pede dois sinais: muitas
 * avaliações sozinhas não fazem uma empresa média (salão com 150 avaliações e
 * sem site continua pequeno).
 */
export function estimarPorte(
  l: Pick<LinhaImportada, 'name' | 'reviewCount' | 'website' | 'siteCheck' | 'category'>,
  niche: string | null,
  unidades = 1
): { porte: Porte; sinais: string[]; rede: boolean } {
  const sinais: string[] = [];
  let p = 0;
  const av = l.reviewCount ?? 0;
  if (av >= 1000) p += 3;
  else if (av >= 300) p += 2;
  else if (av >= 100) p += 1;
  else if (av < 30) p -= 1;
  sinais.push(`${av} avaliações`);
  if (unidades > 1) {
    p += 2;
    sinais.push(`${unidades} unidades na cidade`);
  }
  const sit = situacaoDoSite(l.website, l.siteCheck);
  if (sit === 'ok' || sit === 'vende_online' || sit === 'sem_https') {
    p += 1;
    sinais.push('site próprio no ar');
  }
  const tipo = `${l.category ?? ''} ${niche ?? ''}`.toLowerCase();
  if (contem(tipo, ALTO_TICKET)) {
    p += 1;
    sinais.push('ramo de ticket alto');
  }
  // Palavra inteira: "Petzito" n\u00e3o \u00e9 a rede Petz. V\u00e1rias unidades de uma marca
  // local \u00e9 empresa grande, n\u00e3o franquia.
  const nome = palavras(l.name);
  const rede = REDES.some((r) => nome.includes(palavras(r)));
  return { porte: p >= 4 ? 'grande' : p >= 2 ? 'media' : 'pequena', sinais, rede };
}

/** Texto em palavras, sem acento e pontua\u00e7\u00e3o, com espa\u00e7o nas pontas (compara palavra inteira). */
function palavras(t: string): string {
  const limpo = t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${limpo} `;
}

const NIVEIS_SITE = ['Essencial', 'Profissional', 'Premium'];
const NIVEIS_GESTAO = ['Básico', 'Intermediário', 'Avançado'];

/**
 * Nível do pacote pelo porte: pequena fica no básico (ou no intermediário, se o
 * problema pede), média sobe para o intermediário, grande vai para o completo.
 */
function nivelPeloPorte(servico: string, porte: Porte): string {
  const site = servico.match(/^(Site|Loja) (Essencial|Profissional|Premium)$/);
  if (site) {
    const atual = NIVEIS_SITE.indexOf(site[2]);
    const nivel = porte === 'grande' ? 2 : porte === 'media' ? Math.max(atual, 1) : Math.min(atual, 1);
    return `${site[1]} ${NIVEIS_SITE[nivel]}`;
  }
  if (/^Sistema de Gestão /.test(servico)) {
    return `Sistema de Gestão ${NIVEIS_GESTAO[porte === 'grande' ? 2 : porte === 'media' ? 1 : 0]}`;
  }
  return servico;
}

/** Status do Google que indicam negócio fechado (permanente ou temporário). */
const FECHADO = /clos|fechad|encerrad/i;

/**
 * Possível "empresa fantasma": fechada no Google, sem avaliação nova há mais de
 * 2 anos, ou sem contato e quase sem avaliações. Fica fora do link do vendedor
 * e do modo foco; o motivo aparece no painel.
 */
export function motivoFantasma(
  l: Pick<Lead, 'mapsStatus' | 'lastReviewAt' | 'reviewCount' | 'phone' | 'email'>,
  agora = Date.now()
): string | null {
  if (l.mapsStatus && FECHADO.test(l.mapsStatus)) return 'Fechado no Google';
  if (l.lastReviewAt && agora - Date.parse(l.lastReviewAt) > 730 * 24 * 3600 * 1000) return 'Sem avaliação nova há mais de 2 anos';
  if ((l.reviewCount ?? 0) < 3 && !l.phone && !l.email) return 'Sem contato e quase sem avaliações';
  return null;
}

export function avaliarLead(l: LinhaImportada, niche: string | null, unidades = 1): Avaliacao {
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
  // Fixo brasileiro quase nunca tem WhatsApp: o contato vai ser por ligação ou e-mail.
  if (l.phone && l.buscaPais !== 'US' && whatsappDoLead(l.phone, 'BR')?.celular === false) {
    nota -= 5;
    motivos.push('Só telefone fixo: contato por ligação ou e-mail');
  }
  if (!l.phone && !l.email) {
    nota -= 20;
    motivos.push('Sem telefone nem e-mail');
  }

  // Sinais de atividade (só quando a busca trouxe esses dados).
  const dias = l.ultimaAvaliacao ? (Date.now() - Date.parse(l.ultimaAvaliacao)) / (24 * 3600 * 1000) : null;
  if (dias !== null) {
    if (dias > 730) {
      nota -= 30;
      motivos.push('Última avaliação há mais de 2 anos: pode estar parado');
    } else if (dias > 365) {
      nota -= 15;
      motivos.push('Sem avaliação nova há mais de 1 ano');
    } else if (dias <= 90) {
      nota += 5;
      motivos.push('Avaliação nos últimos 3 meses: em atividade');
    }
  }
  if (l.perfilReivindicado === true) nota += 5;
  else if (l.perfilReivindicado === false) motivos.push('Perfil do Google sem dono');
  if (l.agendamento) motivos.push(`Já agenda/vende online por ${l.agendamento}`);
  // Porte: nível do pacote e prioridade (rede/franquia decide na matriz).
  const { porte, sinais, rede } = estimarPorte(l, niche, unidades);
  const pacotes = [...new Set(servicos.map((s) => nivelPeloPorte(s, porte)))];
  motivos.push(`Porte ${NOME_DO_PORTE[porte].toLowerCase()} (${sinais.join(', ')})`);
  if (rede) {
    nota -= 30;
    motivos.push('Rede ou franquia: site e sistema costumam vir da marca');
  }

  if (l.mapsStatus && FECHADO.test(l.mapsStatus)) {
    // Fechado no Google: fica na base (para não voltar como novo), mas com nota zero.
    return { score: 0, suggestedServices: pacotes, reasons: ['Fechado no Google', ...motivos], porte, rede };
  }

  return { score: Math.max(0, Math.min(100, nota)), suggestedServices: pacotes, reasons: motivos, porte, rede };
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
  // Unidades da mesma marca na mesma cidade, dentro do arquivo (a limpeza da base,
  // scripts/captacao/reavaliar-base.ts, conta na base inteira).
  const cidadeDe = (l: LinhaImportada) => (l.buscaCidade ?? padroes.city ?? '').toLowerCase();
  const contagem = new Map<string, number>();
  for (const l of linhas) {
    const m = chaveDaMarca(l.name);
    if (m) contagem.set(`${cidadeDe(l)}|${m}`, (contagem.get(`${cidadeDe(l)}|${m}`) ?? 0) + 1);
  }
  return linhas.map((l) => {
    const pais: Pais = l.buscaPais === 'US' || l.buscaPais === 'BR' ? l.buscaPais : padroes.pais;
    const niche = l.buscaRamo ?? padroes.niche;
    const marca = chaveDaMarca(l.name);
    const unidades = marca ? (contagem.get(`${cidadeDe(l)}|${marca}`) ?? 1) : 1;
    const { score, suggestedServices, reasons, porte } = avaliarLead(l, niche, unidades);
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
      // Só leva os campos que o CSV trouxe: reimportar um CSV antigo não apaga nada.
      ...(l.mapsStatus !== undefined && { maps_status: l.mapsStatus }),
      ...(l.ultimaAvaliacao !== undefined && { last_review_at: l.ultimaAvaliacao }),
      ...(l.perfilReivindicado !== undefined && { owner_claimed: l.perfilReivindicado }),
      ...(l.horario !== undefined && { opening_hours: l.horario }),
      ...(l.atributos !== undefined && { attributes: l.atributos }),
      ...(l.agendamento !== undefined && { online_booking: l.agendamento }),
      ...(l.notas !== undefined && { rating_dist: l.notas }),
      ...(l.avaliacoes !== undefined && { recent_reviews: l.avaliacoes }),
      score,
      porte,
      unidades,
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
