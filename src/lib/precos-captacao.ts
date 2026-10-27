// Valor estimado de cada lead da Captação, na moeda do país do lead.
//
// - Brasil: preços do catálogo deste ERP (internal_services), lidos na hora.
// - EUA: tabela em dólar do portfólio (ArthurPr0g/Portfolio-Arthur-Prog,
//   app/src/pages/planos/planos.en.js, preços de 17/10/2026). Mudou lá, mude
//   TABELA_USD aqui: o portfólio é estático e não dá para ler de outro repo.
//
// Mesmas regras da página de planos: site ou loja + sistema de gestão vira
// combo (15% / 15% / 20% no mesmo nível, 15% em níveis diferentes),
// arredondado para baixo até terminar em 97 (reais) ou 90 (dólar); o cliente
// paga uma mensalidade só, a maior.

import type { Pais } from '@/lib/captacao';

export type Moeda = 'BRL' | 'USD';
type Produto = 'site' | 'loja' | 'erp';
type Nivel = 0 | 1 | 2;
/** [valor do trabalho, mensalidade] por nível. */
type Faixa = [number, number];

export type TabelaPrecos = {
  moeda: Moeda;
  fim: 97 | 90;
  site: Faixa[];
  loja: Faixa[];
  erp: Faixa[];
  marca: number[];
};

// Nome no catálogo (o que a nota sugere) → produto e nível.
const SERVICO: Record<string, [Produto | 'marca', Nivel]> = {
  'Site Essencial': ['site', 0],
  'Site Profissional': ['site', 1],
  'Site Premium': ['site', 2],
  'Loja Essencial': ['loja', 0],
  'Loja Profissional': ['loja', 1],
  'Loja Premium': ['loja', 2],
  'Sistema de Gestão Básico': ['erp', 0],
  'Sistema de Gestão Intermediário': ['erp', 1],
  'Sistema de Gestão Avançado': ['erp', 2],
  'Logo Essencial': ['marca', 0],
  'Identidade a partir do Logo': ['marca', 1],
  'Identidade Visual Completa': ['marca', 2],
};

export const TABELA_USD: TabelaPrecos = {
  moeda: 'USD',
  fim: 90,
  site: [[890, 59], [1790, 59], [3490, 59]],
  loja: [[1490, 89], [2990, 89], [5490, 89]],
  erp: [[2990, 99], [5990, 149], [9990, 199]],
  marca: [390, 490, 790],
};

/** Tabela em reais montada do catálogo (nomes de 0045–0049). Item ausente vale 0. */
export function tabelaBRL(catalogo: Map<string, number>): TabelaPrecos {
  const p = (nome: string) => catalogo.get(nome) ?? 0;
  const gestao = ['Básico', 'Intermediário', 'Avançado'];
  return {
    moeda: 'BRL',
    fim: 97,
    site: (['Essencial', 'Profissional', 'Premium'] as const).map((n) => [p(`Site ${n}`), p('Mensalidade Site')]),
    loja: (['Essencial', 'Profissional', 'Premium'] as const).map((n) => [p(`Loja ${n}`), p('Mensalidade Loja')]),
    erp: gestao.map((n) => [p(`Sistema de Gestão ${n}`), p(`Mensalidade Gestão ${n}`)]),
    marca: [p('Logo Essencial'), p('Identidade a partir do Logo'), p('Identidade Visual Completa')],
  };
}

export const moedaDoPais = (pais: Pais): Moeda => (pais === 'US' ? 'USD' : 'BRL');

const terminadoEm = (v: number, fim: number) => Math.floor((v - fim) / 100) * 100 + fim;

export type Estimativa = { moeda: Moeda; unico: number; mensal: number; combo: boolean };

export function estimar(servicos: string[], t: TabelaPrecos): Estimativa {
  const itens = servicos.map((s) => SERVICO[s]).filter(Boolean);
  // Um de cada produto: se vierem dois níveis, vale o maior.
  const nivel = (prod: Produto | 'marca') =>
    itens.filter(([p]) => p === prod).reduce<Nivel | null>((m, [, n]) => (m === null || n > m ? n : m), null);
  const principal = (['loja', 'site'] as const).find((p) => nivel(p) !== null);
  const erp = nivel('erp');
  const marca = nivel('marca');

  let unico = 0;
  let mensal = 0;
  let combo = false;
  if (principal && erp !== null) {
    const l = nivel(principal)!;
    const [a, amo] = t[principal][l];
    const [b, bmo] = t.erp[erp];
    const desconto = l === erp ? [0.15, 0.15, 0.2][l] : 0.15;
    unico = terminadoEm((a + b) * (1 - desconto), t.fim);
    mensal = Math.max(amo, bmo);
    combo = true;
  } else if (principal) {
    [unico, mensal] = t[principal][nivel(principal)!];
  } else if (erp !== null) {
    [unico, mensal] = t.erp[erp];
  }
  if (marca !== null) unico += t.marca[marca];
  return { moeda: t.moeda, unico, mensal, combo };
}

/** Formato brasileiro nas duas moedas: quem lê o painel é o dono, não o lead. */
export function formatMoeda(v: number, moeda: Moeda): string {
  return `${moeda === 'USD' ? 'US$' : 'R$'} ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** Quantos reais vale 1 unidade de cada moeda (null = cotação indisponível). */
export type Cotacoes = { USD: number | null; atualizadaEm: string | null };

export function emReais(v: number, moeda: Moeda, c: Cotacoes): number | null {
  if (moeda === 'BRL') return v;
  return c[moeda] ? Math.round(v * c[moeda]!) : null;
}
