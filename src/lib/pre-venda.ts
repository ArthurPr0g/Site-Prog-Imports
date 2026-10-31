// Pré-venda da Prog Soluções (pedido do Arthur, 31/10/2026): o "projeto antes de ser projeto".
// Puro, sem servidor: os passos da pré-venda, o que dá para marcar sozinho pelos dados e os alertas.
// Só fatos: contagem, datas e preço cheio do catálogo. Nada de chance de fechar (regra do Arthur).

import type { LeadStatus } from '@/lib/captacao';

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

export type ProximoPasso = { oQue: string; quem: string | null; prazo: string | null; origem: 'manual' | 'reuniao' };

/** Próximo passo: o escrito na pré-venda; senão, o primeiro da última reunião registrada. */
export function proximoPasso(
  manual: { passo: string | null; quem: string | null; prazo: string | null },
  atualizacoes: AtualizacaoDoDono[]
): ProximoPasso | null {
  if (manual.passo?.trim()) return { oQue: manual.passo.trim(), quem: manual.quem, prazo: manual.prazo, origem: 'manual' };
  const ultima = atualizacoes.at(-1);
  const p = ultima?.proximosPassos[0];
  if (!ultima || !p) return null;
  return { oQue: p.oQue, quem: p.quem, prazo: dataDoTexto(p.quando, ultima.em), origem: 'reuniao' };
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
