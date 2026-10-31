'use server';
// Lixeira de testes (pedido do Arthur, 31/10/2026): o Supabase recusa exclusões diretas pelo MCP, então o
// Arthur apaga por aqui, um registro por vez, com confirmação. Só entra na lista o que é claramente teste:
// nome começando com "TESTE", source com "teste", conversa marcada como teste (is_test) há mais de 24 h,
// aviso com título "Teste..." e o que pertence a um lead ou projeto de teste. Cada exclusão confere de novo,
// no servidor, que o registro continua sendo teste, e apaga em cascata o que é do mesmo teste.

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { dbDoAtendente } from '@/lib/atendente/db';
import { type ActionResult, okResult, errResult } from '@/lib/action-result';

export type TipoDeTeste = 'lead' | 'projeto' | 'conversa' | 'aviso' | 'reuniao' | 'negociacao';
export type ItemDeTeste = { tipo: TipoDeTeste; id: string; nome: string; detalhe: string; quando: string | null; confira?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ehTeste = (nome: string | null | undefined) => /^\s*teste\b/i.test(nome ?? '');
const DIA = 24 * 60 * 60 * 1000;

type Conjunto = { leads: Set<string>; projetos: Set<string>; conversas: Set<string> };

/** Leads, projetos e conversas de teste (base para decidir o resto). */
async function conjuntoDeTeste(): Promise<{ db: ReturnType<typeof dbDoAtendente>; c: Conjunto; leads: { id: string; name: string; source: string | null; status: string; created_at: string }[] }> {
  const db = dbDoAtendente();
  const [{ data: leads }, { data: projetos }, { data: conversas }] = await Promise.all([
    db.from('leads').select('id, name, source, status, created_at').or('name.ilike.TESTE%,source.ilike.%teste%').limit(200),
    db.from('projetos').select('id').ilike('cliente', 'TESTE%').limit(200),
    db.from('ia_conversations').select('id').eq('is_test', true).limit(500),
  ]);
  return {
    db,
    leads: leads ?? [],
    c: {
      leads: new Set((leads ?? []).map((l) => l.id)),
      projetos: new Set((projetos ?? []).map((p) => p.id)),
      conversas: new Set((conversas ?? []).map((x) => x.id)),
    },
  };
}

export async function listarDadosDeTesteAction(): Promise<ItemDeTeste[] | null> {
  if (!(await requireAdmin())) return null;
  const { db, c, leads } = await conjuntoDeTeste();
  const idsLeads = [...c.leads];
  const antes = new Date(Date.now() - DIA).toISOString();
  const [{ data: projetos }, { data: conversas }, { data: avisos }, { data: reunioes }, { data: negs }, { data: cobs }, { data: projDosLeads }] = await Promise.all([
    db.from('projetos').select('id, cliente, status, created_at').ilike('cliente', 'TESTE%').limit(200),
    db.from('ia_conversations').select('id, contact_name, contact_id, lead_id, last_message_at').eq('is_test', true).lt('last_message_at', antes).order('last_message_at').limit(200),
    db
      .from('ia_avisos')
      .select('id, titulo, created_at, lead_id, conversation_id')
      .or(['titulo.ilike.teste%', idsLeads.length ? `lead_id.in.(${idsLeads.join(',')})` : null].filter(Boolean).join(','))
      .order('created_at')
      .limit(200),
    db
      .from('reunioes')
      .select('id, titulo, inicio, lead_id, projeto_id')
      .or(['titulo.ilike.%TESTE%', idsLeads.length ? `lead_id.in.(${idsLeads.join(',')})` : null].filter(Boolean).join(','))
      .limit(200),
    idsLeads.length ? db.from('negociacao_sessoes').select('id, lead_id, conversation_id, criado_em').in('lead_id', idsLeads).limit(200) : Promise.resolve({ data: [] as { id: string; lead_id: string | null; conversation_id: string | null; criado_em: string }[] }),
    idsLeads.length ? db.from('cobrancas').select('lead_id').in('lead_id', idsLeads) : Promise.resolve({ data: [] as { lead_id: string }[] }),
    idsLeads.length ? db.from('projetos').select('lead_id, cliente').in('lead_id', idsLeads) : Promise.resolve({ data: [] as { lead_id: string | null; cliente: string }[] }),
  ]);
  const nomeDoLead = new Map(leads.map((l) => [l.id, l.name]));
  const itens: ItemDeTeste[] = [];
  for (const p of projetos ?? []) itens.push({ tipo: 'projeto', id: p.id, nome: p.cliente, detalhe: `Projeto (${p.status}): leva junto serviços, rodadas e reuniões dele`, quando: p.created_at });
  for (const l of leads) {
    const cob = (cobs ?? []).filter((x) => x.lead_id === l.id).length;
    const proj = (projDosLeads ?? []).filter((x) => x.lead_id === l.id && !ehTeste(x.cliente)).length;
    itens.push({
      tipo: 'lead',
      id: l.id,
      nome: l.name,
      detalhe: `Lead (${l.status}, source ${l.source ?? '–'}): leva junto conversas, mensagens, avisos, reuniões e negociação dele`,
      quando: l.created_at,
      confira: cob || proj ? `Tem ${cob} cobrança(s) e ${proj} projeto(s) de verdade: não dá para apagar por aqui.` : ehTeste(l.name) ? undefined : 'O nome não começa com "TESTE" (só o source diz teste): confira antes.',
    });
  }
  for (const x of conversas ?? [])
    if (!x.lead_id || !c.leads.has(x.lead_id))
      itens.push({ tipo: 'conversa', id: x.id, nome: x.contact_name || x.contact_id, detalhe: 'Conversa de teste: leva junto as mensagens e os avisos dela', quando: x.last_message_at });
  for (const a of avisos ?? [])
    if (!(a.lead_id && c.leads.has(a.lead_id)))
      itens.push({ tipo: 'aviso', id: a.id, nome: a.titulo, detalhe: 'Aviso ao Arthur', quando: a.created_at });
  for (const r of reunioes ?? [])
    if (!(r.lead_id && c.leads.has(r.lead_id)) && !(r.projeto_id && c.projetos.has(r.projeto_id)))
      itens.push({ tipo: 'reuniao', id: r.id, nome: r.titulo, detalhe: 'Reunião (e o áudio dela, se houver)', quando: r.inicio });
  // Itens que vão junto com o lead também aparecem soltos, para o Arthur apagar só eles se quiser.
  for (const a of avisos ?? []) if (a.lead_id && c.leads.has(a.lead_id)) itens.push({ tipo: 'aviso', id: a.id, nome: a.titulo, detalhe: `Aviso do lead de teste ${nomeDoLead.get(a.lead_id) ?? ''}`, quando: a.created_at });
  for (const r of reunioes ?? []) if (r.lead_id && c.leads.has(r.lead_id)) itens.push({ tipo: 'reuniao', id: r.id, nome: r.titulo, detalhe: `Reunião do lead de teste ${nomeDoLead.get(r.lead_id) ?? ''}`, quando: r.inicio });
  for (const n of negs ?? []) itens.push({ tipo: 'negociacao', id: n.id, nome: `Negociação de ${nomeDoLead.get(n.lead_id ?? '') ?? 'lead de teste'}`, detalhe: 'Sessão de "Atualizar a negociação"', quando: n.criado_em });
  return itens;
}

/** Apaga as reuniões (e os áudios delas no Storage). */
async function apagarReunioes(db: ReturnType<typeof dbDoAtendente>, ids: string[]) {
  if (!ids.length) return;
  const { data } = await db.from('reunioes').select('id, audio_path').in('id', ids);
  const audios = (data ?? []).map((r) => r.audio_path).filter((p): p is string => !!p);
  if (audios.length) await db.storage.from('reunioes').remove(audios);
  // Registro de arquivamento (0116) da reunião de teste: o arquivo já saiu do Storage, o registro vai junto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela da 0116 fora dos tipos gerados
  await (db as unknown as SupabaseClient<any>).from('arquivos_arquivados').delete().in('reuniao_id', ids);
  const { error } = await db.from('reunioes').delete().in('id', ids);
  if (error) throw new Error(`reuniões: ${error.message}`);
}

async function apagarConversas(db: ReturnType<typeof dbDoAtendente>, ids: string[]) {
  if (!ids.length) return;
  // Mensagens e pedidos de desconto saem em cascata; avisos e negociações da conversa são do mesmo teste.
  await db.from('ia_avisos').delete().in('conversation_id', ids);
  await db.from('negociacao_sessoes').delete().in('conversation_id', ids);
  const { data: rs } = await db.from('reunioes').select('id').in('conversation_id', ids);
  await apagarReunioes(db, (rs ?? []).map((r) => r.id));
  const { error } = await db.from('ia_conversations').delete().in('id', ids);
  if (error) throw new Error(`conversas: ${error.message}`);
}

export async function apagarDadoDeTesteAction(tipo: TipoDeTeste, id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return errResult('Sem permissão.');
  if (!UUID.test(id)) return errResult('Registro inválido.');
  const { db, c } = await conjuntoDeTeste();
  try {
    if (tipo === 'lead') {
      if (!c.leads.has(id)) return errResult('Este lead não é de teste: nada foi apagado.');
      const [{ count: cob }, { data: projs }] = await Promise.all([
        db.from('cobrancas').select('id', { count: 'exact', head: true }).eq('lead_id', id),
        db.from('projetos').select('id, cliente').eq('lead_id', id),
      ]);
      if ((cob ?? 0) > 0 || (projs ?? []).some((p) => !ehTeste(p.cliente))) return errResult('Este lead tem cobrança ou projeto de verdade: não apago por aqui.');
      const { data: convs } = await db.from('ia_conversations').select('id').eq('lead_id', id);
      await apagarConversas(db, (convs ?? []).map((x) => x.id));
      const { data: rs } = await db.from('reunioes').select('id').eq('lead_id', id);
      await apagarReunioes(db, (rs ?? []).map((r) => r.id));
      await db.from('ia_avisos').delete().eq('lead_id', id);
      await db.from('negociacao_sessoes').delete().eq('lead_id', id);
      for (const p of projs ?? []) await apagarProjeto(db, p.id);
      const { error } = await db.from('leads').delete().eq('id', id);
      if (error) throw new Error(`lead: ${error.message}`);
    } else if (tipo === 'projeto') {
      if (!c.projetos.has(id)) return errResult('Este projeto não é de teste: nada foi apagado.');
      await apagarProjeto(db, id);
    } else if (tipo === 'conversa') {
      if (!c.conversas.has(id)) return errResult('Esta conversa não está marcada como teste: nada foi apagado.');
      await apagarConversas(db, [id]);
    } else if (tipo === 'aviso') {
      const { data: a } = await db.from('ia_avisos').select('titulo, lead_id, conversation_id').eq('id', id).maybeSingle();
      if (!a) return okResult('Já tinha sido apagado.');
      const teste = ehTeste(a.titulo) || (a.lead_id && c.leads.has(a.lead_id)) || (a.conversation_id && c.conversas.has(a.conversation_id));
      if (!teste) return errResult('Este aviso não é de teste: nada foi apagado.');
      const { error } = await db.from('ia_avisos').delete().eq('id', id);
      if (error) throw new Error(error.message);
    } else if (tipo === 'reuniao') {
      const { data: r } = await db.from('reunioes').select('titulo, lead_id, projeto_id, conversation_id').eq('id', id).maybeSingle();
      if (!r) return okResult('Já tinha sido apagada.');
      const teste =
        /\bteste\b/i.test(r.titulo ?? '') || (r.lead_id && c.leads.has(r.lead_id)) || (r.projeto_id && c.projetos.has(r.projeto_id)) || (r.conversation_id && c.conversas.has(r.conversation_id));
      if (!teste) return errResult('Esta reunião não é de teste: nada foi apagado.');
      await apagarReunioes(db, [id]);
    } else if (tipo === 'negociacao') {
      const { data: n } = await db.from('negociacao_sessoes').select('lead_id, conversation_id').eq('id', id).maybeSingle();
      if (!n) return okResult('Já tinha sido apagada.');
      if (!((n.lead_id && c.leads.has(n.lead_id)) || (n.conversation_id && c.conversas.has(n.conversation_id)))) return errResult('Esta negociação não é de teste: nada foi apagado.');
      const { error } = await db.from('negociacao_sessoes').delete().eq('id', id);
      if (error) throw new Error(error.message);
    } else return errResult('Tipo desconhecido.');
  } catch (e) {
    return errResult(`Não consegui apagar tudo: ${e instanceof Error ? e.message : 'erro'}. Tente de novo.`);
  }
  revalidatePath('/admin/gastos');
  return okResult('Apagado.');
}

async function apagarProjeto(db: ReturnType<typeof dbDoAtendente>, id: string) {
  // Serviços e rodadas saem em cascata; as reuniões do projeto são do mesmo teste.
  const { data: rs } = await db.from('reunioes').select('id').eq('projeto_id', id);
  await apagarReunioes(db, (rs ?? []).map((r) => r.id));
  const { error } = await db.from('projetos').delete().eq('id', id);
  if (error) throw new Error(`projeto: ${error.message}`);
}
