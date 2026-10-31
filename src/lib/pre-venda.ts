// Pré-venda da Prog Soluções (pedido do Arthur, 31/10/2026): o "projeto antes de ser projeto".
// Puro, sem servidor: os passos da pré-venda, o que dá para marcar sozinho pelos dados e os alertas.
// Só fatos: contagem, datas e preço cheio do catálogo. Nada de chance de fechar (regra do Arthur).

import type { LeadStatus } from '@/lib/captacao';
import { NOMES, type Escolha, type Produto } from '@/lib/simulador';

/** Etapas do lead que contam como pré-venda (mais "novo" com conversa ativa da Lia). */
export const ETAPAS_DA_PRE_VENDA = ['novo', 'contatado', 'respondeu', 'reuniao', 'proposta'] as const satisfies readonly LeadStatus[];
export type EtapaDaPreVenda = (typeof ETAPAS_DA_PRE_VENDA)[number];

export const PASSOS = [
  { chave: 'contato', nome: 'Contato' },
  { chave: 'respondeu', nome: 'Respondeu' },
  { chave: 'briefing', nome: 'Descoberta e briefing' },
  { chave: 'reuniao', nome: 'Reunião' },
  { chave: 'identidade', nome: 'Identidade (Duda)' },
  { chave: 'prototipo', nome: 'Protótipo (Nina)' },
  { chave: 'proposta', nome: 'Proposta enviada' },
  { chave: 'resposta', nome: 'Resposta do cliente' },
  { chave: 'sinal', nome: 'Sinal pago (vira Pós-venda)' },
] as const;
export type ChavePasso = (typeof PASSOS)[number]['chave'];
export type EstadoPasso = 'feito' | 'andamento' | 'pendente';

/** Passo marcado à mão (tabela prevenda.passos). Ausente = vale o automático. */
export type PassoManual = { estado: EstadoPasso; em?: string | null };
export type PassoCalculado = { chave: ChavePasso; nome: string; estado: EstadoPasso; em: string | null; manual: boolean };

/** O que os dados já dizem de cada passo (sem o que o Arthur marcou). */
export type FatosDoLead = {
  status: LeadStatus;
  primeiroContato: string | null;
  respondeuEm: string | null;
  briefingConfirmadoEm: string | null;
  descobertaRespondida: number;
  temBriefing: boolean;
  reuniaoFeitaEm: string | null;
  reuniaoMarcadaPara: string | null;
  designSystemUrl: string | null;
  prototipoUrl: string | null;
  propostaEnviadaEm: string | null;
  sinal: { pagoEm: string | null } | null;
};

function automatico(chave: ChavePasso, f: FatosDoLead): { estado: EstadoPasso; em: string | null } {
  const feito = (em: string | null) => ({ estado: 'feito' as const, em });
  const andamento = (em: string | null = null) => ({ estado: 'andamento' as const, em });
  const pendente = { estado: 'pendente' as const, em: null };
  switch (chave) {
    case 'contato':
      return f.primeiroContato || f.status !== 'novo' ? feito(f.primeiroContato) : pendente;
    case 'respondeu':
      return f.respondeuEm || ['respondeu', 'reuniao', 'proposta'].includes(f.status) ? feito(f.respondeuEm) : pendente;
    case 'briefing':
      if (f.briefingConfirmadoEm) return feito(f.briefingConfirmadoEm);
      return f.descobertaRespondida > 0 || f.temBriefing ? andamento() : pendente;
    case 'reuniao':
      if (f.reuniaoFeitaEm) return feito(f.reuniaoFeitaEm);
      if (f.reuniaoMarcadaPara) return andamento(f.reuniaoMarcadaPara);
      return f.status === 'reuniao' ? andamento() : pendente;
    case 'identidade':
      return f.designSystemUrl ? feito(null) : pendente;
    case 'prototipo':
      return f.prototipoUrl ? feito(null) : pendente;
    case 'proposta':
      if (f.propostaEnviadaEm) return feito(f.propostaEnviadaEm);
      return f.status === 'proposta' ? feito(null) : pendente;
    case 'resposta':
      return pendente;
    case 'sinal':
      if (f.sinal?.pagoEm) return feito(f.sinal.pagoEm);
      return f.sinal ? andamento() : pendente;
  }
}

/** Trilha completa: o que o Arthur marcou à mão vence o automático. */
export function calcularPassos(f: FatosDoLead, manuais: Partial<Record<ChavePasso, PassoManual>>): PassoCalculado[] {
  return PASSOS.map(({ chave, nome }) => {
    const m = manuais[chave];
    if (m && ['feito', 'andamento', 'pendente'].includes(m.estado)) {
      return { chave, nome, estado: m.estado, em: m.em ?? null, manual: true };
    }
    return { chave, nome, ...automatico(chave, f), manual: false };
  });
}

/** Lê o jsonb de passos manuais descartando o que não for válido. */
export function passosDoJson(j: unknown): Partial<Record<ChavePasso, PassoManual>> {
  const o = (j && typeof j === 'object' ? j : {}) as Record<string, { estado?: unknown; em?: unknown }>;
  const r: Partial<Record<ChavePasso, PassoManual>> = {};
  for (const { chave } of PASSOS) {
    const p = o[chave];
    if (p && (p.estado === 'feito' || p.estado === 'andamento' || p.estado === 'pendente')) {
      r[chave] = { estado: p.estado, em: typeof p.em === 'string' ? p.em : null };
    }
  }
  return r;
}

export type Pendencia = { texto: string; feito: boolean };
export function pendenciasDoJson(j: unknown): Pendencia[] {
  if (!Array.isArray(j)) return [];
  return j
    .filter((p) => p && typeof p.texto === 'string' && p.texto.trim())
    .map((p) => ({ texto: String(p.texto).slice(0, 200), feito: !!p.feito }));
}

/** Registro de reunião que a "atualização do dono" grava no lead (0112). */
export type AtualizacaoDoDono = {
  em: string;
  resumo: string | null;
  escopo: string | null;
  orcamento: string | null;
  prazo: string | null;
  decisoes: string[];
  proximosPassos: { quem: string | null; oQue: string; quando: string | null }[];
  etapaDepois: string | null;
};

export function atualizacoesDoJson(j: unknown): AtualizacaoDoDono[] {
  if (!Array.isArray(j)) return [];
  const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return j
    .filter((a) => a && typeof a.em === 'string')
    .map((a) => ({
      em: a.em,
      resumo: txt(a.resumo),
      escopo: txt(a.escopo),
      orcamento: txt(a.orcamento),
      prazo: txt(a.prazo),
      decisoes: Array.isArray(a.decisoes) ? a.decisoes.filter((d: unknown) => typeof d === 'string') : [],
      proximosPassos: Array.isArray(a.proximos_passos)
        ? a.proximos_passos
            .filter((p: { o_que?: unknown }) => p && typeof p.o_que === 'string')
            .map((p: { quem?: unknown; o_que: string; quando?: unknown }) => ({ quem: txt(p.quem), oQue: p.o_que, quando: txt(p.quando) }))
        : [],
      etapaDepois: txt(a.etapa_depois),
    }))
    .sort((a, b) => a.em.localeCompare(b.em));
}

/** "até 03/11" ou "03/11/2026" → 2026-11-03 (ano da reunião quando não vem escrito). Sem data, null. */
export function dataDoTexto(texto: string | null, referencia: string): string | null {
  const m = texto?.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (!m) return null;
  const [d, mes] = [Number(m[1]), Number(m[2])];
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return null;
  let ano = m[3] ? Number(m[3]) : new Date(referencia).getFullYear();
  // Reunião em dezembro citando "até 05/01": é o ano seguinte.
  if (!m[3] && mes < new Date(referencia).getMonth() + 1 - 6) ano += 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * origem: 'manual' = escrito na pré-venda; 'reuniao' = vindo da reunião (sugerido, ainda não aceito, ou aceito
 * e talvez editado: aceito=true). reuniaoEm = data da reunião de onde veio.
 */
export type ProximoPasso = { oQue: string; quem: string | null; prazo: string | null; origem: 'manual' | 'reuniao'; aceito: boolean; reuniaoEm: string | null };

/** Próximo passo: o escrito na pré-venda; senão, o primeiro da última reunião registrada (sugestão). */
export function proximoPasso(
  manual: { passo: string | null; quem: string | null; prazo: string | null; origem?: string | null },
  atualizacoes: AtualizacaoDoDono[]
): ProximoPasso | null {
  if (manual.passo?.trim()) {
    const reuniaoEm = reuniaoDaOrigem(manual.origem);
    return { oQue: manual.passo.trim(), quem: manual.quem, prazo: manual.prazo, origem: reuniaoEm ? 'reuniao' : 'manual', aceito: true, reuniaoEm };
  }
  const s = sugestoesDaReuniao(atualizacoes)[0];
  if (!s) return null;
  return { oQue: s.oQue, quem: s.quem, prazo: s.prazo, origem: 'reuniao', aceito: false, reuniaoEm: s.reuniaoEm };
}

export type Alerta = { tipo: 'vencido' | 'vence' | 'parado'; texto: string };

const DIA = 24 * 3600_000;

/** Alertas do card: prazo vencido, prazo a menos de 1 dia e lead parado há mais de X dias. */
export function alertasDoLead(prox: ProximoPasso | null, ultimoMovimento: string | null, diasParado: number, agora: number): Alerta[] {
  const r: Alerta[] = [];
  if (prox?.prazo) {
    // Prazo é um dia inteiro: vence no fim dele (horário de Brasília).
    const fim = Date.parse(`${prox.prazo}T23:59:59-03:00`);
    if (fim < agora) r.push({ tipo: 'vencido', texto: 'Prazo do próximo passo venceu' });
    else if (fim - agora < DIA) r.push({ tipo: 'vence', texto: 'Próximo passo vence em menos de 1 dia' });
  }
  if (ultimoMovimento) {
    const dias = Math.floor((agora - Date.parse(ultimoMovimento)) / DIA);
    if (dias > diasParado) r.push({ tipo: 'parado', texto: `Parado há ${dias} dias` });
  }
  return r;
}

/* ------------------------------------------------------------ próximo passo: quem e de onde veio */

/** Escolha rápida do "quem" (feedback do Arthur, 31/10/2026). "Outro" abre o campo de texto. */
export const RESPONSAVEIS = ['Eu (Arthur)', 'Cliente', 'Lia', 'Bia', 'Duda/Nina', 'Rafa'] as const;

/** Data da reunião guardada em prevenda.proximo_origem ("reuniao:AAAA-MM-DD"); null = escrito à mão. */
export function reuniaoDaOrigem(origem: string | null | undefined): string | null {
  const m = origem?.match(/^reuniao:(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : null;
}

/** Sugestões da última reunião registrada, com o prazo já convertido em data. */
export function sugestoesDaReuniao(atualizacoes: AtualizacaoDoDono[]): { oQue: string; quem: string | null; prazo: string | null; reuniaoEm: string }[] {
  const ultima = atualizacoes.at(-1);
  if (!ultima) return [];
  return ultima.proximosPassos.map((p) => ({ oQue: p.oQue, quem: p.quem, prazo: dataDoTexto(p.quando, ultima.em), reuniaoEm: ultima.em.slice(0, 10) }));
}

/* ------------------------------------------------------------ pacote montado na pré-venda */

/** Item do pacote (prevenda.itens, 0115): do catálogo, avulso (digitado) ou referência do portfólio. */
export type ItemDoPacote =
  | { tipo: 'catalogo'; nome: string; preco: number; mensal: number }
  | { tipo: 'avulso'; nome: string; preco: number; mensal: number }
  | { tipo: 'portfolio'; slug: string; nome: string };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0);

export function itensDoJson(j: unknown): ItemDoPacote[] {
  if (!Array.isArray(j)) return [];
  const r: ItemDoPacote[] = [];
  for (const i of j) {
    if (!i || typeof i !== 'object' || typeof i.nome !== 'string' || !i.nome.trim()) continue;
    const nome = String(i.nome).trim().slice(0, 120);
    if (i.tipo === 'portfolio' && typeof i.slug === 'string') r.push({ tipo: 'portfolio', slug: i.slug.slice(0, 60), nome });
    else if (i.tipo === 'catalogo' || i.tipo === 'avulso') r.push({ tipo: i.tipo, nome, preco: num(i.preco), mensal: num(i.mensal) });
  }
  return r.slice(0, 30);
}

/**
 * Preço cheio do pacote montado: soma simples dos itens do catálogo e avulsos (sem o desconto de combo)
 * e uma mensalidade só, a maior (regra do portfólio e do simulador).
 */
export function precoCheioDosItens(itens: ItemDoPacote[]): { unico: number; mensal: number } {
  const pagos = itens.filter((i): i is Extract<ItemDoPacote, { preco: number }> => i.tipo !== 'portfolio');
  return { unico: pagos.reduce((s, i) => s + i.preco, 0), mensal: pagos.reduce((m, i) => Math.max(m, i.mensal), 0) };
}

/** Desconto do valor combinado sobre o preço cheio (R$ e %). Valor acima do cheio dá desconto negativo. */
export function descontoSobre(cheio: number, combinado: number | null): { valor: number; pct: number } | null {
  if (combinado === null || cheio <= 0) return null;
  const valor = cheio - combinado;
  return { valor, pct: (valor / cheio) * 100 };
}

/**
 * Pacote do simulador (o que o Pós-venda usa para criar os serviços do projeto) a partir dos itens montados.
 * null quando não há site, loja nem sistema. "fora" = itens que o Pós-venda não transforma em serviço
 * (avulsos, Power BI, mentoria, um segundo produto).
 */
export function escolhaDosItens(itens: ItemDoPacote[]): { escolha: Escolha; fora: string[] } | null {
  const achar = (nome: string): [Produto | 'marca', 0 | 1 | 2] | null => {
    for (const moeda of ['BRL', 'USD'] as const) {
      const n = NOMES[moeda];
      for (const tipo of ['site', 'loja', 'erp', 'marca'] as const) {
        const i = n[tipo].indexOf(nome);
        if (i >= 0) return [tipo, i as 0 | 1 | 2];
      }
    }
    return null;
  };
  const pagos = itens.filter((i) => i.tipo !== 'portfolio');
  const mapeados = pagos.map((i) => ({ nome: i.nome, m: i.tipo === 'catalogo' ? achar(i.nome) : null }));
  const pega = (tipo: Produto | 'marca') => mapeados.find((x) => x.m?.[0] === tipo);
  const principal = pega('loja') ?? pega('site') ?? pega('erp');
  if (!principal?.m) return null;
  const produto = principal.m[0] as Produto;
  const gestao = produto !== 'erp' ? pega('erp') : undefined;
  const marca = pega('marca');
  const usados = new Set([principal, gestao, marca].filter(Boolean));
  return {
    escolha: {
      produto,
      nivel: principal.m[1],
      comGestao: !!gestao,
      nivelGestao: gestao?.m ? gestao.m[1] : 0,
      marca: marca?.m ? ((marca.m[1] + 1) as 1 | 2 | 3) : 0,
    },
    fora: mapeados.filter((x) => !usados.has(x)).map((x) => x.nome),
  };
}
