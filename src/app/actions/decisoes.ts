'use server';

// Central de decisões (/admin/decisoes, pedido do Arthur em 31/10/2026, 0117). Lê e responde pela chave do
// atendente depois de conferir o admin: as ações reaproveitam os fluxos do WhatsApp (decisoes.ts), que rodam
// com essa chave. Respostas em texto vão para a fila do PC (plano do Claude do Arthur), nunca para a API.

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult } from '@/lib/action-result';
import { dbDoAtendente } from '@/lib/atendente/db';
import { contarPendentes, semTipos, sincronizarDecisoes, type ContextoDaDecisao, type OpcaoDaDecisao } from '@/lib/atendente/central-decisoes';
import { responderDecisao } from '@/lib/atendente/responder-decisao';

export type Decisao = {
  id: string;
  tipo: string;
  origem: string;
  titulo: string;
  resumo: string | null;
  pergunta: string | null;
  contexto: ContextoDaDecisao;
  opcoes: OpcaoDaDecisao[];
  status: 'pendente' | 'enviada' | 'resolvida' | 'descartada';
  resposta: string | null;
  resolvidaPor: string | null;
  resolvidaEm: string | null;
  criadaEm: string;
};

const CAMPOS = 'id, tipo, origem, titulo, resumo, pergunta, contexto, opcoes, status, resposta, resolvida_por, resolvida_em, criada_em';

function paraDecisao(r: Record<string, unknown>): Decisao {
  return {
    id: r.id as string,
    tipo: r.tipo as string,
    origem: r.origem as string,
    titulo: r.titulo as string,
    resumo: (r.resumo as string) ?? null,
    pergunta: (r.pergunta as string) ?? null,
    contexto: (r.contexto ?? {}) as ContextoDaDecisao,
    opcoes: Array.isArray(r.opcoes) ? (r.opcoes as OpcaoDaDecisao[]) : [],
    status: r.status as Decisao['status'],
    resposta: (r.resposta as string) ?? null,
    resolvidaPor: (r.resolvida_por as string) ?? null,
    resolvidaEm: (r.resolvida_em as string) ?? null,
    criadaEm: r.criada_em as string,
  };
}

export async function listarDecisoes(): Promise<{ abertas: Decisao[]; historico: Decisao[] } | null> {
  if (!(await requireAdmin())) return null;
  const db = dbDoAtendente();
  // Antes de mostrar: cria os cards que faltam e tira o que já foi resolvido por outro caminho.
  await sincronizarDecisoes(db).catch((e) => console.error('[decisoes] sincronizar', e));
  const t = semTipos(db).from('decisoes');
  const [abertas, historico] = await Promise.all([
    t.select(CAMPOS).in('status', ['pendente', 'enviada']).order('criada_em', { ascending: false }).limit(100),
    semTipos(db).from('decisoes').select(CAMPOS).in('status', ['resolvida', 'descartada']).order('resolvida_em', { ascending: false, nullsFirst: false }).limit(40),
  ]);
  return {
    abertas: (abertas.data ?? []).map(paraDecisao),
    historico: (historico.data ?? []).map(paraDecisao),
  };
}

export async function responderNaCentral(id: string, resposta: { opcaoId?: string; texto?: string }): Promise<ActionResult> {
  if (!(await requireAdmin())) return errResult('Sem permissão.');
  if (!/^[0-9a-f-]{36}$/.test(id)) return errResult('Decisão inválida.');
  const texto = resposta.texto?.trim().slice(0, 4000);
  if (!texto && !resposta.opcaoId) return errResult('Escolha uma opção ou escreva a resposta.');
  const r = await responderDecisao(dbDoAtendente(), id, { opcaoId: texto ? undefined : resposta.opcaoId, texto });
  revalidatePath('/admin', 'layout');
  return r.ok ? okResult(r.mensagem) : errResult(r.erro);
}

/** Contador do menu (só pendentes; as "enviadas" já estão com o Claude). */
export async function contarDecisoesPendentes(): Promise<number> {
  if (!(await requireAdmin())) return 0;
  try {
    return await contarPendentes(dbDoAtendente());
  } catch {
    return 0;
  }
}
