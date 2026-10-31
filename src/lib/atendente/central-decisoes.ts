// Central de decisões do Arthur (pedido de 31/10/2026, tabela decisoes, 0117). Só no servidor.
//
// Cada decisão que espera o Arthur vira um card em /admin/decisoes: de onde veio, o que decidir, o contexto
// (cliente, valores, links) e as mesmas opções dos botões do WhatsApp. O card nasce de três jeitos:
//  1. avisarArthur com opções (desconto, assumir conversa, financeiro, indicação...);
//  2. os pontos que mandam botões direto (dúvida e confirmação da encomenda, "onde foi pago");
//  3. o relógio (sincronizarDecisoes): pedido "Aguardando você", projeto do pedido, prazo da pré-venda e o que
//     ficou pendente de antes da central existir.
// A "chave" é a ação sem o valor ("desc:<pedido>"): uma decisão pendente por chave. Quando o Arthur toca o botão
// no WhatsApp ou responde pela tela, o card sai da lista e fica no histórico (status resolvida).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbDoAtendente } from './db';
import { SITE_URL } from '@/lib/seo';

// A tabela é nova (0117) e os tipos gerados do banco são editados por outras frentes ao mesmo tempo: acesso sem tipo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const semTipos = (db: DbDoAtendente) => db as unknown as SupabaseClient<any>;

export type OpcaoDaDecisao = { id: string; titulo: string };
export type ContextoDaDecisao = {
  cliente?: string | null;
  valores?: string[];
  links?: { rotulo: string; url: string }[];
};
export type NovaDecisao = {
  chave: string;
  tipo: string;
  origem: string;
  titulo: string;
  resumo?: string | null;
  pergunta?: string | null;
  contexto?: ContextoDaDecisao;
  opcoes?: OpcaoDaDecisao[];
  conversaId?: string | null;
  leadId?: string | null;
  ideiaId?: string | null;
};

export const linkDaCentral = (id?: string | null) => `${SITE_URL}/admin/decisoes${id ? `#d-${id}` : ''}`;
export const linkDaConversa = (id: string) => `${SITE_URL}/admin/atendimento?conversa=${id}`;
export const linkDaFicha = (id: string) => `${SITE_URL}/admin/captacao?lead=${id}`;

/** Tipo e origem pela ação do botão ("desc:ok:<id>" → desconto, Lia). */
const PELO_PREFIXO: Record<string, { tipo: string; origem: string }> = {
  enc: { tipo: 'encomenda', origem: 'Pedido seu à Lia' },
  duv: { tipo: 'duvida', origem: 'Pedido seu à Lia' },
  pag: { tipo: 'financeiro', origem: 'Lia (financeiro)' },
  pagou: { tipo: 'financeiro', origem: 'Lia (financeiro)' },
  desc: { tipo: 'desconto', origem: 'Lia (desconto)' },
  conv: { tipo: 'conversa', origem: 'Lia (cliente chamou você)' },
  proj: { tipo: 'projeto', origem: 'Fila do Claude' },
  ind: { tipo: 'indicacao', origem: 'Lia (indicação)' },
  neg: { tipo: 'negociacao', origem: 'Negociação' },
};

/** "desc:ok:<uuid>" → "desc:<uuid>". Para ids que não seguem o padrão, devolve o próprio id. */
export function chaveDoBotao(botaoId: string): string {
  const m = botaoId.match(/^([a-z]+):[a-z]+:([0-9a-f-]{36})$/);
  return m ? `${m[1]}:${m[2]}` : botaoId;
}

export function tipoDoBotao(botaoId: string): { tipo: string; origem: string } {
  return PELO_PREFIXO[botaoId.split(':')[0]] ?? { tipo: 'outro', origem: 'Aviso' };
}

/** Links do contexto pela conversa e pelo lead (o que existir). */
export function linksDoContexto(conversaId?: string | null, leadId?: string | null): { rotulo: string; url: string }[] {
  return [
    ...(conversaId ? [{ rotulo: 'Conversa', url: linkDaConversa(conversaId) }] : []),
    ...(leadId ? [{ rotulo: 'Ficha', url: linkDaFicha(leadId) }, { rotulo: 'Pré-venda', url: `${SITE_URL}/admin/pre-venda` }] : []),
  ];
}

/**
 * Cria a decisão (ou atualiza a pendente com a mesma chave) e devolve o id. Nunca lança erro: se o banco falhar,
 * o aviso no WhatsApp sai do mesmo jeito.
 */
export async function registrarDecisao(db: DbDoAtendente, d: NovaDecisao): Promise<string | null> {
  try {
    const linha = {
      chave: d.chave.slice(0, 200),
      tipo: d.tipo.slice(0, 40),
      origem: d.origem.slice(0, 60),
      titulo: d.titulo.slice(0, 300),
      resumo: d.resumo?.slice(0, 4000) ?? null,
      pergunta: d.pergunta?.slice(0, 500) ?? null,
      contexto: d.contexto ?? {},
      opcoes: d.opcoes ?? [],
      conversation_id: d.conversaId ?? null,
      lead_id: d.leadId ?? null,
      ideia_id: d.ideiaId ?? null,
    };
    const t = semTipos(db).from('decisoes');
    const { data: ja } = await t.select('id').eq('chave', linha.chave).eq('status', 'pendente').maybeSingle();
    if (ja) {
      await t.update({ ...linha, atualizada_em: new Date().toISOString() }).eq('id', ja.id);
      return ja.id as string;
    }
    const { data, error } = await t.insert(linha).select('id').single();
    if (error) {
      // Corrida com outro tick (índice único da pendente): usa a que ganhou.
      const { data: outra } = await t.select('id').eq('chave', linha.chave).eq('status', 'pendente').maybeSingle();
      return (outra?.id as string) ?? null;
    }
    return data.id as string;
  } catch (e) {
    console.error('[decisoes] falha ao registrar', e);
    return null;
  }
}

/** Tira da lista (fica no histórico). Por chave ou por id. Nunca lança erro. */
export async function resolverDecisao(
  db: DbDoAtendente,
  alvo: { chave?: string; id?: string; ideiaId?: string },
  r: { resposta?: string | null; por: 'whatsapp' | 'painel' | 'sistema'; status?: 'resolvida' | 'descartada' },
): Promise<void> {
  try {
    let q = semTipos(db)
      .from('decisoes')
      .update({
        status: r.status ?? 'resolvida',
        resposta: r.resposta?.slice(0, 4000) ?? null,
        resolvida_por: r.por,
        resolvida_em: new Date().toISOString(),
        atualizada_em: new Date().toISOString(),
      })
      .eq('status', 'pendente');
    if (alvo.id) q = q.eq('id', alvo.id);
    else if (alvo.chave) q = q.eq('chave', alvo.chave);
    else if (alvo.ideiaId) q = q.eq('ideia_id', alvo.ideiaId).eq('tipo', 'prompt');
    else return;
    await q;
  } catch (e) {
    console.error('[decisoes] falha ao resolver', e);
  }
}

export async function contarPendentes(db: DbDoAtendente): Promise<number> {
  const { count } = await semTipos(db).from('decisoes').select('id', { count: 'exact', head: true }).eq('status', 'pendente');
  return count ?? 0;
}

const DIA = 24 * 3600_000;
const nomeDoPedido = (i: { titulo: string | null; texto: string }) => i.titulo || (i.texto.length > 80 ? i.texto.slice(0, 77) + '…' : i.texto);

/** Origem do pedido "Aguardando você" pelo agente que o fez. */
function origemDoPedido(agente: string | null, origem: string | null): string {
  if (agente === 'conserto') return 'Conserto automático';
  if (origem === 'cliente') return 'Ajuste de cliente';
  return agente ? `Agente ${agente.charAt(0).toUpperCase()}${agente.slice(1)}` : 'Pedido ao Claude';
}

/** O que o pedido espera do Arthur (as linhas depois de "Aguardando você:"). */
export function oQueEspera(resultado: string | null): string {
  const t = (resultado ?? '').replace(/\[(PC|Nuvem)\]\s*/g, '');
  const k = t.search(/Aguardando você:/);
  return (k >= 0 ? t.slice(k + 'Aguardando você:'.length) : t).trim().slice(0, 1500);
}

/** Card do pedido com "Aguardando você" (prompt parcial ou concluído com pendência). */
export async function registrarPedidoAguardando(
  db: DbDoAtendente,
  i: { id: string; titulo: string | null; texto: string; resultado: string | null; agente: string | null; origem: string | null; projeto: string | null; conversation_id?: string | null },
): Promise<string | null> {
  return registrarDecisao(db, {
    chave: `prompt:${i.id}`,
    tipo: 'prompt',
    origem: origemDoPedido(i.agente, i.origem),
    titulo: nomeDoPedido(i),
    resumo: oQueEspera(i.resultado),
    pergunta: 'Escreva como seguir (ou o número da opção). Vira uma continuação na fila, com o mesmo agente e projeto.',
    contexto: {
      valores: i.projeto ? [`Projeto: ${i.projeto}`] : [],
      links: [{ rotulo: 'Pedido no Hub', url: 'https://hub-prog.vercel.app/ideias' }, ...(i.conversation_id ? [{ rotulo: 'Conversa', url: linkDaConversa(i.conversation_id) }] : [])],
    },
    opcoes: [{ id: 'painel:ok', titulo: 'Já resolvi' }],
    conversaId: i.conversation_id ?? null,
    ideiaId: i.id,
  });
}

/**
 * Relógio: cria os cards do que está pendente sem card e tira da lista o que já foi resolvido por outro caminho
 * (painel do atendimento, Hub, prazo mudado na pré-venda...). Barato: poucas consultas pequenas.
 */
export async function sincronizarDecisoes(db: DbDoAtendente): Promise<number> {
  let mudou = 0;
  const agora = Date.now();
  const t = semTipos(db);

  // 1. Pedidos "Aguardando você" dos últimos 3 dias (o Bom dia usa a mesma janela).
  const { data: aguardando } = await db
    .from('ideias')
    .select('id, titulo, texto, resultado, agente, origem, projeto, conversation_id')
    .eq('tipo', 'prompt')
    .in('status', ['feito', 'parcial'])
    .ilike('resultado', '%Aguardando você:%')
    .not('resultado', 'ilike', '%[resolvido%')
    .gte('atualizado_em', new Date(agora - 3 * DIA).toISOString())
    .limit(20);
  const { data: comCard } = await t.from('decisoes').select('ideia_id').eq('tipo', 'prompt').in('ideia_id', (aguardando ?? []).map((i) => i.id).concat('00000000-0000-0000-0000-000000000000'));
  const jaTem = new Set((comCard ?? []).map((c) => c.ideia_id as string));
  for (const i of aguardando ?? []) {
    // Card já existiu (pendente ou resolvido): não recria.
    if (jaTem.has(i.id)) continue;
    if (await registrarPedidoAguardando(db, i)) mudou++;
  }

  // 2. Pedidos sem projeto escolhido.
  const { data: semProjeto } = await db.from('ideias').select('id, titulo, texto').eq('status', 'aguardando_projeto').limit(10);
  const { PROJETOS } = semProjeto?.length ? await import('./ideias') : { PROJETOS: {} as Record<string, { nome: string }> };
  for (const i of semProjeto ?? []) {
    const { data: ja } = await t.from('decisoes').select('id').eq('chave', `proj:${i.id}`).limit(1).maybeSingle();
    if (ja) continue;
    await registrarDecisao(db, {
      chave: `proj:${i.id}`,
      ...PELO_PREFIXO.proj,
      titulo: `Em qual projeto é o pedido "${nomeDoPedido(i)}"?`,
      resumo: i.texto.slice(0, 1500),
      opcoes: [...Object.entries(PROJETOS).map(([k, p]) => ({ id: `proj:${k}:${i.id}`, titulo: p.nome }))],
      ideiaId: i.id,
    });
    mudou++;
  }

  // 3. Prazo do próximo passo da pré-venda vencido ou vencendo em 1 dia.
  const limite = new Date(agora - 3 * 3600_000 + DIA).toISOString().slice(0, 10);
  const { data: prazos } = await t
    .from('prevenda')
    .select('lead_id, proximo_passo, proximo_responsavel, proximo_prazo, leads(name, status)')
    .not('proximo_prazo', 'is', null)
    .lte('proximo_prazo', limite)
    .limit(20);
  for (const p of (prazos ?? []) as unknown as { lead_id: string; proximo_passo: string | null; proximo_responsavel: string | null; proximo_prazo: string; leads: { name: string; status: string } | null }[]) {
    if (!p.leads || ['ganho', 'perdido', 'nao_contatar'].includes(p.leads.status)) continue;
    const chave = `prazo:${p.lead_id}:${p.proximo_prazo}`;
    const { data: ja } = await t.from('decisoes').select('id').eq('chave', chave).limit(1).maybeSingle();
    if (ja) continue;
    const venceu = Date.parse(`${p.proximo_prazo}T23:59:59-03:00`) < agora;
    const dataBr = p.proximo_prazo.split('-').reverse().join('/');
    await registrarDecisao(db, {
      chave,
      tipo: 'prevenda',
      origem: 'Pré-venda (prazo)',
      titulo: `${p.leads.name}: ${p.proximo_passo ?? 'próximo passo'}`,
      resumo: `${venceu ? 'O prazo venceu' : 'O prazo vence'} em ${dataBr}${p.proximo_responsavel ? ` (responsável: ${p.proximo_responsavel})` : ''}.`,
      pergunta: 'Já foi feito, adia ou escreve o que fazer?',
      contexto: { cliente: p.leads.name, links: linksDoContexto(null, p.lead_id) },
      opcoes: [
        { id: `painel:feito`, titulo: 'Já foi feito' },
        { id: `painel:adiar2`, titulo: 'Adiar 2 dias' },
      ],
      leadId: p.lead_id,
    });
    mudou++;
  }

  // 4. Tira da lista o que foi resolvido por outro caminho.
  const { data: pendentes } = await t.from('decisoes').select('id, chave, tipo, ideia_id').eq('status', 'pendente').limit(100);
  for (const d of (pendentes ?? []) as { id: string; chave: string; tipo: string; ideia_id: string | null }[]) {
    const [prefixo, id, extra] = d.chave.split(':');
    let resolvida = false;
    if (prefixo === 'desc') {
      const { data } = await db.from('ia_discount_requests').select('status').eq('id', id).maybeSingle();
      resolvida = !data || data.status !== 'aguardando';
    } else if (prefixo === 'conv') {
      const { data } = await db.from('ia_conversations').select('needs_human, mode').eq('id', id).maybeSingle();
      resolvida = !data || !data.needs_human || data.mode === 'humano';
    } else if (prefixo === 'enc' || prefixo === 'duv') {
      const { data } = await db.from('encomendas').select('status').eq('id', id).maybeSingle();
      resolvida = !data || data.status !== (prefixo === 'enc' ? 'aguardando_confirmacao' : 'aguardando_resposta');
    } else if (prefixo === 'pag') {
      const { data } = await db.from('encomendas').select('pagamento, status').eq('id', id).maybeSingle();
      resolvida = !data || !!data.pagamento || data.status === 'cancelada';
    } else if (prefixo === 'pagou') {
      const { data } = await semTipos(db).from('encomendas').select('pago_onde, status').eq('id', id).maybeSingle();
      resolvida = !data || !!data.pago_onde || data.status === 'cancelada';
    } else if (prefixo === 'proj') {
      const { data } = await db.from('ideias').select('status').eq('id', id).maybeSingle();
      resolvida = !data || data.status !== 'aguardando_projeto';
    } else if (prefixo === 'prompt') {
      const { data } = await db.from('ideias').select('resultado, status').eq('id', id).maybeSingle();
      resolvida = !data || /\[resolvido/i.test(data.resultado ?? '') || data.status === 'arquivada';
    } else if (prefixo === 'prazo') {
      const { data } = await t.from('prevenda').select('proximo_prazo').eq('lead_id', id).maybeSingle();
      resolvida = !data || data.proximo_prazo !== extra;
    }
    if (resolvida) {
      await resolverDecisao(db, { id: d.id }, { por: 'sistema', resposta: 'Resolvida por outro caminho (painel, WhatsApp ou mudança nos dados).' });
      mudou++;
    }
  }

  // 5. Respostas em texto que foram para a fila do PC: resolvidas quando o pedido termina.
  const { data: enviadas } = await t.from('decisoes').select('id, resposta, resposta_ideia_id').eq('status', 'enviada').not('resposta_ideia_id', 'is', null).limit(50);
  for (const d of (enviadas ?? []) as { id: string; resposta: string | null; resposta_ideia_id: string }[]) {
    const { data: i } = await db.from('ideias').select('status').eq('id', d.resposta_ideia_id).maybeSingle();
    if (i && !['feito', 'parcial', 'arquivada', 'feita', 'entregue'].includes(i.status)) continue;
    await t
      .from('decisoes')
      .update({ status: 'resolvida', resolvida_em: new Date().toISOString(), atualizada_em: new Date().toISOString() })
      .eq('id', d.id)
      .eq('status', 'enviada');
    mudou++;
  }
  return mudou;
}
