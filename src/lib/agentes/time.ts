// Time de agentes da Prog Soluções (pedido do Arthur, 30/10/2026): cada etapa depois da venda tem um
// agente com nome próprio e instruções próprias, para ele saber quem fez o quê. Mapa completo em
// docs/AGENTES.md; as instruções de cada um em agentes/claude-code e agentes/claude-design.
//
// A Lia continua sendo a única que fala com o cliente. Os agentes do Claude Code recebem o trabalho pela
// mesma fila do executor do PC (public.ideias, tipo 'prompt'), com origem 'agente' (0103).

import type { DbDoAtendente } from '@/lib/atendente/db';

export type ChaveDoAgente = 'lia' | 'teo' | 'bia' | 'duda' | 'nina' | 'rafa' | 'vera' | 'nico' | 'iris' | 'tito' | 'leo' | 'gabi' | 'vistoria' | 'conserto';

export type Agente = {
  nome: string;
  papel: string;
  onde: 'Lia (servidor)' | 'Claude Code' | 'Claude Design';
  /** Nome do subagente no Claude Code (arquivo agentes/claude-code/<subagente>.md). */
  subagente?: string;
};

export const TIME: Record<ChaveDoAgente, Agente> = {
  lia: { nome: 'Lia', papel: 'atendimento e venda', onde: 'Lia (servidor)' },
  teo: { nome: 'Téo', papel: 'cobranças', onde: 'Claude Code', subagente: 'teo-cobrancas' },
  bia: { nome: 'Bia', papel: 'abertura do projeto', onde: 'Claude Code', subagente: 'bia-abertura' },
  duda: { nome: 'Duda', papel: 'identidade visual', onde: 'Claude Design' },
  nina: { nome: 'Nina', papel: 'protótipo das telas', onde: 'Claude Design' },
  rafa: { nome: 'Rafa', papel: 'construção', onde: 'Claude Code', subagente: 'rafa-construcao' },
  vera: { nome: 'Vera', papel: 'vistoria', onde: 'Claude Code', subagente: 'vera-vistoria' },
  nico: { nome: 'Nico', papel: 'revisão de código', onde: 'Claude Code', subagente: 'nico-revisao' },
  iris: { nome: 'Íris', papel: 'cibersegurança', onde: 'Claude Code', subagente: 'iris-seguranca' },
  tito: { nome: 'Tito', papel: 'testes e desempenho', onde: 'Claude Code', subagente: 'tito-testes' },
  vistoria: { nome: 'Vistoria completa', papel: 'Vera, Nico, Íris e Tito juntos', onde: 'Claude Code' },
  leo: { nome: 'Leo', papel: 'ajustes do cliente', onde: 'Claude Code', subagente: 'leo-ajustes' },
  gabi: { nome: 'Gabi', papel: 'entrega', onde: 'Claude Code', subagente: 'gabi-entrega' },
  conserto: { nome: 'Conserto automático', papel: 'resolve os erros e pendências dos alarmes', onde: 'Claude Code' },
};

/** "Bia (abertura do projeto)": como o agente aparece nos avisos. */
export function rotuloDoAgente(chave: string | null | undefined): string | null {
  const a = chave ? TIME[chave as ChaveDoAgente] : undefined;
  return a ? `${a.nome} (${a.papel})` : null;
}

/** Texto do pedido com a ordem de delegar ao subagente certo (o executor roda o Claude Code com ele). */
export function pedidoParaOAgente(chave: ChaveDoAgente, pedido: string): string {
  const a = TIME[chave];
  return a.subagente ? `Use o subagente ${a.subagente} (${a.nome}, ${a.papel}) para este pedido.\n\n${pedido}` : pedido;
}

/**
 * Vistoria completa automática (pedido do Arthur em 30/10/2026): quando o Rafa constrói ou o Leo faz um ajuste,
 * os 4 de qualidade entram na fila sozinhos, na mesma pasta. Antes dependia de o Arthur lembrar de pedir.
 */
export function pedidoDeVistoria(projeto: string, oQueMudou: string, depoisDe: 'rafa' | 'leo' | 'arthur'): string {
  return [
    depoisDe === 'arthur'
      ? `Vistoria completa do projeto ${projeto} (pedido do Arthur).`
      : `Vistoria completa do projeto ${projeto} (automática, depois do ${depoisDe === 'rafa' ? 'Rafa construir' : 'Leo fazer um ajuste'}).`,
    `${depoisDe === 'arthur' ? 'Pedido' : 'O que foi feito'}: ${oQueMudou.slice(0, 1500)}`,
    '',
    'Chame EM PARALELO os subagentes vera-vistoria, nico-revisao, iris-seguranca e tito-testes, cada um com o projeto acima' +
      (depoisDe === 'leo' ? ' (olhando só o que o ajuste mudou)' : '') +
      ', e junte os 4 vereditos.',
    'Devolva no começo do resumo UMA linha: "Veredito: pode ir para a Gabi" ou "Veredito: volta para o ' + (depoisDe === 'rafa' ? 'Rafa' : 'Leo') + '" (ou "parar: crítico" se a Íris achar algo crítico).',
    'Depois, os achados de cada um em no máximo 3 linhas. Se algo precisar do Arthur, escreva "Aguardando você: ...".',
    'Nenhum dos 4 altera o código do site (o Tito só pode criar testes em tests/). Não mande nada ao cliente.',
  ].join('\n');
}

/** Põe um pedido do sistema na fila do executor do PC, já endereçado ao agente. */
export async function pedirAoAgente(
  db: DbDoAtendente,
  chave: ChaveDoAgente,
  p: { titulo: string; pedido: string; projeto?: string | null; pastaExclusiva?: string | null }
) {
  const a = TIME[chave];
  return db.from('ideias').insert({
    tipo: 'prompt',
    origem: 'agente',
    agente: chave,
    status: 'pendente',
    titulo: `${a.nome}: ${p.titulo}`.slice(0, 120),
    texto: pedidoParaOAgente(chave, p.pedido).slice(0, 8000),
    projeto: p.projeto?.slice(0, 200) ?? null,
    pasta_exclusiva: p.pastaExclusiva ?? null,
  });
}
