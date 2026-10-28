// Simulador de preços, igual ao da página de planos do portfólio
// (ArthurPr0g/Portfolio-Arthur-Prog, app/src/pages/planos/planos.js, renderSim):
// produto + nível, sistema de gestão opcional (vira combo), marca, uma
// mensalidade só (a maior) e as formas de pagamento. Usado na página do
// vendedor, para ele responder preço na hora da conversa.
//
// Brasil: preços do catálogo do ERP (retrato guardado no link do vendedor).
// EUA: TABELA_USD (cópia da tabela em dólar do portfólio).

import { TABELA_USD, type Moeda, type TabelaPrecos } from '@/lib/precos-captacao';

export type Produto = 'site' | 'loja' | 'erp';

export const NOMES: Record<Moeda, { site: string[]; loja: string[]; erp: string[]; marca: string[] }> = {
  BRL: {
    site: ['Site Essencial', 'Site Profissional', 'Site Premium'],
    loja: ['Loja Essencial', 'Loja Profissional', 'Loja Premium'],
    erp: ['Sistema de Gestão Básico', 'Sistema de Gestão Intermediário', 'Sistema de Gestão Avançado'],
    marca: ['Logo Essencial', 'Identidade a partir do Logo', 'Identidade Visual Completa'],
  },
  USD: {
    site: ['Starter Website', 'Business Website', 'Premium Website'],
    loja: ['Starter Store', 'Growth Store', 'Enterprise Store'],
    erp: ['Essential Management', 'Professional Management', 'Custom Management'],
    marca: ['Logo Design', 'Brand Kit from Your Logo', 'Full Brand Identity'],
  },
};

export type Escolha = {
  produto: Produto;
  nivel: 0 | 1 | 2;
  /** Sistema de gestão junto (só para site/loja). */
  comGestao: boolean;
  nivelGestao: 0 | 1 | 2;
  /** 0 = já tem marca; 1–3 = Logo, Identidade a partir do logo, Identidade completa. */
  marca: 0 | 1 | 2 | 3;
};

export type Simulacao = {
  linhas: { nome: string; valor: number }[];
  desconto: number;
  total: number;
  mensal: number;
  /** Soma das mensalidades separadas (riscada no combo). */
  mensalSeparadas: number | null;
  /** Sistema Avançado/Custom é "a partir de". */
  aPartirDe: boolean;
};

const terminadoEm = (v: number, fim: number) => Math.floor((v - fim) / 100) * 100 + fim;

export function simular(e: Escolha, t: TabelaPrecos): Simulacao {
  const nomes = NOMES[t.moeda];
  const [preco, mensal] = t[e.produto][e.nivel];
  const linhas = [{ nome: nomes[e.produto][e.nivel], valor: preco }];
  let total = preco;
  let mo = mensal;
  let desconto = 0;
  let mensalSeparadas: number | null = null;

  const combo = e.comGestao && e.produto !== 'erp';
  if (combo) {
    const [pg, mg] = t.erp[e.nivelGestao];
    linhas.push({ nome: nomes.erp[e.nivelGestao], valor: pg });
    const pct = e.nivel === e.nivelGestao ? [0.15, 0.15, 0.2][e.nivel] : 0.15;
    const soma = preco + pg;
    total = terminadoEm(soma * (1 - pct), t.fim);
    desconto = soma - total;
    mo = Math.max(mensal, mg);
    mensalSeparadas = mensal + mg;
  }
  if (e.marca > 0) {
    const v = t.marca[e.marca - 1];
    linhas.push({ nome: nomes.marca[e.marca - 1], valor: v });
    total += v;
  }
  return {
    linhas,
    desconto,
    total,
    mensal: mo,
    mensalSeparadas,
    aPartirDe: (e.produto === 'erp' && e.nivel === 2) || (combo && e.nivelGestao === 2),
  };
}

/** Taxa da maquininha por número de parcelas (mesma do portfólio). */
const mdr = (n: number) => (n === 1 ? 0.0299 : n <= 6 ? 0.0349 : 0.0399);

/** Valor de cada parcela no cartão (2x sem juros; 3x–12x com a taxa da operadora). */
export function parcela(total: number, n: number): number {
  return n <= 2 ? total / n : Math.ceil((total + 0.49) / (1 - mdr(n) - (0.0125 * (n + 1)) / 2) / n);
}

export const tabelaDaMoeda = (moeda: Moeda, tabelaBRL: TabelaPrecos) => (moeda === 'USD' ? TABELA_USD : tabelaBRL);
