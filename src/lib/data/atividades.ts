import { createClient } from '@/lib/supabase/server';
import type { Atividade, Modelo } from '@/lib/atividades';

type LinhaAtividade = {
  id: string;
  service_order_id: string;
  title: string;
  notes: string | null;
  due_date: string;
  done: boolean;
  done_at: string | null;
  position: number;
};

export function paraAtividade(r: LinhaAtividade): Atividade {
  return {
    id: r.id,
    prestacaoId: r.service_order_id,
    titulo: r.title,
    notas: r.notes ?? '',
    data: r.due_date,
    feita: r.done,
    feitaEm: r.done_at,
    posicao: r.position,
  };
}

/** Atividades de várias prestações, agrupadas por prestação. */
export async function atividadesDasPrestacoes(ids: string[]): Promise<Record<string, Atividade[]>> {
  const porPrestacao: Record<string, Atividade[]> = {};
  if (!ids.length) return porPrestacao;
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_activities')
    .select('id, service_order_id, title, notes, due_date, done, done_at, position')
    .in('service_order_id', ids)
    .order('position');
  for (const r of data ?? []) (porPrestacao[r.service_order_id] ??= []).push(paraAtividade(r));
  return porPrestacao;
}

export async function listarModelos(): Promise<Modelo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('work_templates')
    .select('id, name, description, work_template_items(id, title, notes, day_offset, position)')
    .order('name');
  return (data ?? []).map((m) => ({
    id: m.id,
    nome: m.name,
    descricao: m.description ?? '',
    itens: [...(m.work_template_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, titulo: i.title, notas: i.notes ?? '', dias: i.day_offset })),
  }));
}

export type AtividadeDoPainel = Atividade & { prestacao: string; cliente: string };

/** O que ainda falta fazer, de prestações que não foram canceladas — para o Painel. */
export async function atividadesPendentes(): Promise<AtividadeDoPainel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_activities')
    .select(
      'id, service_order_id, title, notes, due_date, done, done_at, position, service_orders!inner(title, status, customers(name, company))'
    )
    .eq('done', false)
    .neq('service_orders.status', 'Cancelada')
    .order('due_date');
  return (data ?? []).map((r) => {
    const p = (Array.isArray(r.service_orders) ? r.service_orders[0] : r.service_orders) as {
      title: string;
      customers: { name: string; company: string | null } | { name: string; company: string | null }[] | null;
    } | null;
    const c = Array.isArray(p?.customers) ? p?.customers[0] : p?.customers;
    return { ...paraAtividade(r), prestacao: p?.title ?? '', cliente: c?.company?.trim() || c?.name || '' };
  });
}
