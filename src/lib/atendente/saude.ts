// Alarme de saúde do sistema (pedido do Arthur em 30/10/2026): o Arthur só descobria um problema quando o
// Claude conferia. Agora os dois relógios se vigiam (o do minuto e o da pesquisa, rotas separadas na Vercel)
// e, a cada 10 min, um deles confere:
//  - o outro relógio parou;
//  - modelo da Meta recusado, ou em análise há mais de 24 h;
//  - pedidos do Claude esperando na fila há mais de 1h30 (PC e nuvem não pegaram);
//  - gasto da IA disparou (mais de US$ 3 na última hora) ou passou de 80% do teto do mês;
//  - avisos ao Arthur ou mensagens aos clientes falhando (3+ na última hora).
// Cada alarme sai uma vez e só repete depois de 12 h se continuar. Só no servidor.

import type { DbDoAtendente } from './db';
import type { ConfigDoAtendente } from './regras';
import type { Json } from '@/lib/supabase/database.types';
import { avisarArthur } from './avisos';
import { pedirConserto, SO_O_ARTHUR_RESOLVE } from './conserto';
import { gastoDoMes } from './agente';
import { SITE_URL } from '@/lib/seo';

const MIN = 60_000;
const HORA = 60 * MIN;

type Estado = { verificado_em?: string; avisados?: Record<string, string>; pendente_desde?: Record<string, string> };
export type Problema = { chave: string; texto: string };

/** Batida do relógio: cada rota grava a hora em que rodou, para a outra saber se ela parou. */
export async function baterRelogio(db: DbDoAtendente, qual: 'tick' | 'pesquisa'): Promise<void> {
  const agora = new Date().toISOString();
  await db.from('ia_config').update(qual === 'tick' ? { tick_em: agora } : { pesquisa_em: agora }).eq('id', true);
}

/** Problemas de agora (também usados no Bom dia). Atualiza o "pendente desde" dos modelos. */
export async function problemasAtuais(db: DbDoAtendente, cfg: ConfigDoAtendente, quem: 'tick' | 'pesquisa' | 'bom_dia'): Promise<{ problemas: Problema[]; estado: Estado }> {
  const { data: c } = await db
    .from('ia_config')
    .select('tick_em, pesquisa_em, saude, modelos, aviso_template_status, monthly_budget_usd')
    .eq('id', true)
    .maybeSingle();
  const estado = ((c?.saude ?? {}) as Estado) || {};
  const agora = Date.now();
  const desde = (h: number) => new Date(agora - h * HORA).toISOString();
  const problemas: Problema[] = [];

  // 1. Relógios (cada um vigia o outro).
  // Sem batida gravada ainda (logo depois da 0105) não é alarme: espera a primeira.
  const parado = (iso: string | null | undefined, limite: number) => !!iso && agora - new Date(iso).getTime() > limite;
  if (quem !== 'tick' && parado(c?.tick_em, 5 * MIN))
    problemas.push({ chave: 'relogio_tick', texto: `⏱️ O relógio da Lia (a cada minuto) não roda desde ${hora(c?.tick_em)}: ela não retoma conversas, não manda lembretes nem avisos.` });
  if (quem !== 'pesquisa' && parado(c?.pesquisa_em, 20 * MIN))
    problemas.push({ chave: 'relogio_pesquisa', texto: `🔎 O relógio da pesquisa de leads não roda desde ${hora(c?.pesquisa_em)}.` });

  // 2. Modelos da Meta.
  const modelos = { ...((c?.modelos ?? {}) as Record<string, string>), aviso_ao_arthur: c?.aviso_template_status ?? '' };
  const pendenteDesde = { ...(estado.pendente_desde ?? {}) };
  const recusados: string[] = [];
  const demorados: string[] = [];
  for (const [nome, status] of Object.entries(modelos)) {
    if (status === 'REJECTED' || status?.startsWith('ERRO')) recusados.push(nome);
    if (status === 'PENDING' || status === 'IN_APPEAL') {
      pendenteDesde[nome] ??= new Date(agora).toISOString();
      if (agora - new Date(pendenteDesde[nome]).getTime() > 24 * HORA) demorados.push(nome);
    } else delete pendenteDesde[nome];
  }
  estado.pendente_desde = pendenteDesde;
  if (recusados.length) problemas.push({ chave: `modelos_recusados:${recusados.sort().join(',')}`, texto: `🚫 A Meta recusou ${recusados.length} modelo(s): ${recusados.join(', ')}. A Lia não consegue usá-los fora da janela de 24 h.` });
  if (demorados.length) problemas.push({ chave: 'modelos_demorando', texto: `⏳ ${demorados.length} modelo(s) da Meta em análise há mais de 24 h: ${demorados.slice(0, 6).join(', ')}${demorados.length > 6 ? '…' : ''}.` });

  // 3. Fila de pedidos do Claude parada.
  const { count: parados } = await db
    .from('ideias')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'prompt')
    .eq('status', 'pendente')
    .lt('criado_em', desde(1.5));
  if (parados) problemas.push({ chave: 'fila_parada', texto: `🤖 ${parados} pedido(s) para o Claude esperando há mais de 1h30: nem o PC nem a nuvem pegaram.` });

  // 4. Gasto da IA.
  const { data: usoHora } = await db.from('ia_usage').select('cost_usd').gte('created_at', desde(1)).limit(5000);
  const naHora = (usoHora ?? []).reduce((s, u) => s + Number(u.cost_usd), 0);
  if (naHora > 3) problemas.push({ chave: 'gasto_hora', texto: `💸 A IA gastou US$ ${naHora.toFixed(2)} na última hora (o normal é bem menos). Confira em Gastos.` });
  const teto = Number(c?.monthly_budget_usd ?? cfg.monthlyBudgetUsd);
  const mes = await gastoDoMes(db);
  if (teto > 0 && mes >= 0.8 * teto) problemas.push({ chave: `gasto_80:${new Date().toISOString().slice(0, 7)}`, texto: `💸 A IA já usou US$ ${mes.toFixed(2)} de US$ ${teto.toFixed(0)} do teto do mês (${Math.round((mes / teto) * 100)}%). No teto, ela para de responder.` });

  // 5. Envios falhando.
  const [{ count: avisosFalhos }, { count: msgsFalhas }] = await Promise.all([
    db.from('ia_avisos').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', desde(1)),
    // Conversas de teste (número falso, simulador) falham de propósito: não contam para o alarme (30/10/2026).
    db
      .from('ia_messages')
      .select('id, ia_conversations!inner(is_test)', { count: 'exact', head: true })
      .eq('direction', 'out')
      .eq('status', 'failed')
      .eq('ia_conversations.is_test', false)
      .gte('created_at', desde(1)),
  ]);
  // A IA não conseguiu responder (créditos da Anthropic acabaram, chave inválida, limite): a Lia está parada.
  const { data: falhasDaIa } = await db
    .from('ia_messages')
    .select('body')
    .eq('author', 'sistema')
    .like('body', '%A IA não conseguiu responder%')
    .gte('created_at', desde(1))
    .limit(20);
  if (falhasDaIa?.length)
    problemas.push({ chave: 'ia_falhando', texto: `🚨 A IA falhou ${falhasDaIa.length} vez(es) na última hora e não respondeu os clientes. Veja em Captação → Atendimento.` });
  // Sem crédito (0108): conta quantas conversas esperam a Lia.
  const { data: semCredito } = await db.from('ia_config').select('ia_sem_credito_desde').eq('id', true).maybeSingle();
  if (semCredito?.ia_sem_credito_desde) {
    const { count: esperando } = await db.from('ia_conversations').select('id', { count: 'exact', head: true }).not('ia_pendente_desde', 'is', null);
    problemas.push({
      chave: 'ia_sem_credito',
      texto: `🚨 Sem créditos da Anthropic desde ${hora(semCredito.ia_sem_credito_desde)}${esperando ? `: ${esperando} conversa(s) esperando a Lia` : ''}. Nada se perde; ela retoma sozinha quando você recarregar: https://console.anthropic.com/settings/billing`,
    });
  }
  if ((avisosFalhos ?? 0) >= 3) problemas.push({ chave: 'avisos_falhando', texto: `📵 ${avisosFalhos} avisos para você falharam na última hora.` });
  if ((msgsFalhas ?? 0) >= 3) problemas.push({ chave: 'mensagens_falhando', texto: `📵 ${msgsFalhas} mensagens da Lia para clientes falharam na última hora.` });

  return { problemas, estado };
}

/** Confere a cada 10 min (por qualquer um dos relógios) e avisa só o que é novo ou voltou depois de 12 h. */
export async function verificarSaude(db: DbDoAtendente, cfg: ConfigDoAtendente, quem: 'tick' | 'pesquisa'): Promise<number> {
  const { data: c } = await db.from('ia_config').select('saude').eq('id', true).maybeSingle();
  const anterior = (c?.saude ?? {}) as Estado;
  if (anterior.verificado_em && Date.now() - new Date(anterior.verificado_em).getTime() < 10 * MIN) return 0;
  // Marca antes: o outro relógio não confere junto.
  await db.from('ia_config').update({ saude: { ...anterior, verificado_em: new Date().toISOString() } as unknown as Json }).eq('id', true);

  const { problemas, estado } = await problemasAtuais(db, cfg, quem);
  const avisados = { ...(anterior.avisados ?? {}) };
  const ativos = new Set(problemas.map((p) => p.chave));
  for (const k of Object.keys(avisados)) if (!ativos.has(k)) delete avisados[k];
  const novos = problemas.filter((p) => !avisados[p.chave] || Date.now() - new Date(avisados[p.chave]).getTime() > 12 * HORA);
  for (const p of novos) avisados[p.chave] = new Date().toISOString();
  await db
    .from('ia_config')
    .update({ saude: { ...estado, verificado_em: new Date().toISOString(), avisados } as unknown as Json })
    .eq('id', true);
  if (!novos.length) return 0;
  // Pedido do Arthur (30/10/2026): alarme já vira "resolva os erros e pendências" na fila do Claude.
  const consertaveis = novos.filter((p) => !SO_O_ARTHUR_RESOLVE.has(p.chave));
  const pedido = consertaveis.length
    ? await pedirConserto(db, 'alarme', `Alarme do sistema: ${consertaveis.map((p) => p.chave).join(', ')}`, consertaveis.map((p) => p.texto).join('\n'))
    : false;
  await avisarArthur(db, cfg, {
    titulo: '⚠️ Alarme do sistema',
    texto: novos.map((p) => p.texto).join('\n') + (pedido ? '\n\n🔧 Já pedi ao Claude para resolver; o resultado chega aqui.' : ''),
    link: `${SITE_URL}/admin/time`,
  });
  return novos.length;
}

const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nunca';
