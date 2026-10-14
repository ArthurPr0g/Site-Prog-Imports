'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { mesclarModelos, somarDias, type ItemDeModelo } from '@/lib/atividades';
import { hojeEmSaoPaulo } from '@/lib/data/painel';
import { sincronizarFinanceiroDaPrestacao } from '@/lib/data/service-orders';
import { revalidarDinheiro } from '@/lib/data/revalidate';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

// A lista da prestação e a seção do Painel mostram as mesmas atividades
function revalidarAtividades() {
  revalidatePath('/admin/prestacao-servico');
  revalidatePath('/admin');
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------ atividades */

export type AtividadeInput = { id?: string; prestacaoId: string; titulo: string; notas: string; data: string };

export async function salvarAtividadeAction(input: AtividadeInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const titulo = input.titulo.trim();
  if (!titulo) return errResult('Escreva o que precisa ser feito.');
  // Decisão do dono: toda atividade tem data — é ela que diz se está atrasada
  if (!DATA.test(input.data)) return errResult('Informe a data prevista.');

  const campos = { title: titulo, notes: input.notas.trim() || null, due_date: input.data, updated_at: new Date().toISOString() };

  if (input.id) {
    const { error } = await supabase.from('service_activities').update(campos).eq('id', input.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar a atividade.'));
    revalidarAtividades();
    return okResult('Atividade atualizada.');
  }

  // Entra no fim da lista da prestação
  const { data: ultima } = await supabase
    .from('service_activities')
    .select('position')
    .eq('service_order_id', input.prestacaoId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('service_activities')
    .insert({ ...campos, service_order_id: input.prestacaoId, position: (ultima?.position ?? -1) + 1 });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível criar a atividade.'));
  revalidarAtividades();
  return okResult('Atividade adicionada.');
}

/** Marca ou desmarca como feita. `todasFeitas` avisa a tela para perguntar se a
 *  prestação pode ser finalizada — a decisão fica com o dono, nunca automática. */
export async function marcarAtividadeAction(
  id: string,
  feita: boolean
): Promise<ActionResult & { todasFeitas?: boolean }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data, error } = await supabase
    .from('service_activities')
    .update({ done: feita, done_at: feita ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('service_order_id')
    .single();
  if (error || !data) return errResult(friendlyDbError(error, 'Não foi possível atualizar a atividade.'));

  let todasFeitas = false;
  if (feita) {
    const { count } = await supabase
      .from('service_activities')
      .select('id', { count: 'exact', head: true })
      .eq('service_order_id', data.service_order_id)
      .eq('done', false);
    todasFeitas = count === 0;
  }

  revalidarAtividades();
  return { ...okResult(feita ? 'Atividade concluída.' : 'Atividade reaberta.'), todasFeitas };
}

export async function excluirAtividadeAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('service_activities').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir a atividade.'));
  revalidarAtividades();
  return okResult('Atividade excluída.');
}

/** Copia o roteiro de UM OU MAIS modelos para a prestação, mesclado sem etapa
 *  repetida (`mesclarModelos`) e sem repetir o que a prestação já tem. As datas
 *  contam a partir do `inicio` escolhido na tela (o início da prestação, por
 *  padrão). Copiar — e não ligar — é o que deixa editar o modelo depois sem
 *  mexer em quem já o usou. */
export async function aplicarModelosAction(prestacaoId: string, modeloIds: string[], inicio: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  if (!modeloIds.length) return errResult('Escolha pelo menos um modelo.');
  const base = DATA.test(inicio) ? inicio : hojeEmSaoPaulo();

  const [{ data: linhas }, { data: atuais }] = await Promise.all([
    supabase
      .from('work_template_items')
      .select('template_id, title, notes, day_offset, position')
      .in('template_id', modeloIds)
      .order('position'),
    supabase.from('service_activities').select('title, position').eq('service_order_id', prestacaoId),
  ]);

  // Na ordem em que os modelos foram escolhidos: desempate de etapas no mesmo dia
  const modelos = modeloIds.map((id) => ({
    id,
    itens: (linhas ?? [])
      .filter((l) => l.template_id === id)
      .map((l) => ({ titulo: l.title, notas: l.notes ?? '', dias: l.day_offset })),
  }));
  const itens = mesclarModelos(modelos, (atuais ?? []).map((a) => a.title));
  if (!itens.length) {
    return errResult(
      (linhas ?? []).length ? 'Todas as atividades desses modelos já estão nesta prestação.' : 'Esses modelos ainda não têm atividades.'
    );
  }

  const inicioPosicao = Math.max(-1, ...(atuais ?? []).map((a) => a.position)) + 1;
  const { error } = await supabase.from('service_activities').insert(
    itens.map((i, k) => ({
      service_order_id: prestacaoId,
      template_id: i.modeloId,
      title: i.titulo,
      notes: i.notas || null,
      due_date: somarDias(base, i.dias),
      position: inicioPosicao + k,
    }))
  );
  if (error) return errResult(friendlyDbError(error, 'Não foi possível aplicar os modelos.'));
  revalidarAtividades();
  return okResult(`${itens.length} atividade${itens.length > 1 ? 's' : ''} adicionada${itens.length > 1 ? 's' : ''}.`);
}

/** Finaliza a prestação depois que o dono confirmou que não falta mais nada.
 *  O status entra no cálculo do Financeiro, então a sincronização roda junto. */
export async function concluirPrestacaoAction(prestacaoId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase
    .from('service_orders')
    .update({ status: 'Concluída', updated_at: new Date().toISOString() })
    .eq('id', prestacaoId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível finalizar a prestação.'));
  await sincronizarFinanceiroDaPrestacao(prestacaoId);
  revalidarDinheiro('/admin/prestacao-servico');
  revalidarAtividades();
  return okResult('Prestação finalizada como Concluída.');
}

/* ------------------------------------------------------------ modelos */

export type ModeloInput = { id?: string; nome: string; descricao: string; itens: ItemDeModelo[] };

export async function salvarModeloAction(input: ModeloInput): Promise<ActionResult & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const nome = input.nome.trim();
  if (!nome) return errResult('Dê um nome ao modelo.');
  const itens = input.itens
    .map((i) => ({ ...i, titulo: i.titulo.trim(), dias: Math.max(0, Math.round(Number(i.dias) || 0)) }))
    .filter((i) => i.titulo);
  if (!itens.length) return errResult('Adicione pelo menos uma atividade ao modelo.');

  const campos = { name: nome, description: input.descricao.trim() || null, updated_at: new Date().toISOString() };
  let id = input.id;
  if (id) {
    const { error } = await supabase.from('work_templates').update(campos).eq('id', id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o modelo.'));
    // Os itens são trocados inteiros: é um roteiro curto, editado de uma vez na
    // mesma tela, e as atividades já criadas a partir dele são cópias.
    const { error: erroLimpar } = await supabase.from('work_template_items').delete().eq('template_id', id);
    if (erroLimpar) return errResult(friendlyDbError(erroLimpar, 'Não foi possível salvar o modelo.'));
  } else {
    const { data, error } = await supabase.from('work_templates').insert(campos).select('id').single();
    if (error || !data) return errResult(friendlyDbError(error, 'Não foi possível criar o modelo.'));
    id = data.id;
  }

  const { error } = await supabase.from('work_template_items').insert(
    itens.map((i, k) => ({ template_id: id!, title: i.titulo, notes: i.notas.trim() || null, day_offset: i.dias, position: k }))
  );
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar as atividades do modelo.'));

  revalidatePath('/admin/prestacao-servico');
  return { ...okResult(input.id ? 'Modelo atualizado.' : 'Modelo criado.'), id };
}

export async function excluirModeloAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  // As atividades que vieram dele continuam: a FK é `on delete set null`
  const { error } = await supabase.from('work_templates').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o modelo.'));
  revalidatePath('/admin/prestacao-servico');
  return okResult('Modelo excluído. As atividades já criadas a partir dele continuam nas prestações.');
}
