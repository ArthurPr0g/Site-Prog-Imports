'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { INSTALLMENT_STATUSES, type InstallmentStatus } from '@/lib/installments';
import { sincronizarFinanceiroDaVenda } from '@/lib/data/sales';
import { sincronizarFinanceiroDaPrestacao } from '@/lib/data/service-orders';
import type { SourceType } from '@/lib/data/installments';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

/** Reflete a mudança no caixa. Marcar uma parcela como recebida sem isto
 *  deixaria o Financeiro dizendo que o dinheiro ainda não entrou. */
async function ressincronizar(tipo: SourceType, sourceId: string): Promise<void> {
  if (tipo === 'venda') await sincronizarFinanceiroDaVenda(sourceId);
  else await sincronizarFinanceiroDaPrestacao(sourceId);
}

function revalidar() {
  revalidatePath('/admin/vendas');
  revalidatePath('/admin/prestacao-servico');
  revalidatePath('/admin/financeiro');
  revalidatePath('/admin');
}

export async function updateInstallmentAction(input: {
  id: string;
  status: InstallmentStatus;
  dueDate: string;
  notes: string;
}): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (!INSTALLMENT_STATUSES.includes(input.status)) return errResult('Status inválido.');
  if (!input.dueDate) return errResult('Informe a data de vencimento.');

  const { data: parcela } = await supabase
    .from('payment_installments')
    .select('source_type, source_id')
    .eq('id', input.id)
    .maybeSingle();

  if (!parcela) return errResult('Parcela não encontrada.');

  const { error } = await supabase
    .from('payment_installments')
    .update({
      status: input.status,
      due_date: input.dueDate,
      notes: input.notes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id);

  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar a parcela.'));

  await ressincronizar(parcela.source_type as SourceType, parcela.source_id);

  revalidar();
  return okResult(
    input.status === 'Recebida'
      ? 'Parcela recebida. O valor entrou na receita do Financeiro.'
      : 'Parcela atualizada.'
  );
}

/** Atalho para o botão de baixa na lista, sem abrir formulário. */
export async function toggleInstallmentReceivedAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: parcela } = await supabase
    .from('payment_installments')
    .select('source_type, source_id, status, number')
    .eq('id', id)
    .maybeSingle();

  if (!parcela) return errResult('Parcela não encontrada.');
  if (parcela.status === 'Cancelada') {
    return errResult('Parcela cancelada. Reative-a antes de marcar como recebida.');
  }

  const novo: InstallmentStatus = parcela.status === 'Recebida' ? 'Pendente' : 'Recebida';

  const { error } = await supabase
    .from('payment_installments')
    .update({ status: novo, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return errResult(friendlyDbError(error, 'Não foi possível atualizar a parcela.'));

  await ressincronizar(parcela.source_type as SourceType, parcela.source_id);

  revalidar();
  const rotulo = parcela.number === 0 ? 'Entrada' : `Parcela ${parcela.number}`;
  return okResult(
    novo === 'Recebida'
      ? `${rotulo} recebida. O valor entrou na receita do Financeiro.`
      : `${rotulo} voltou para pendente e saiu da receita.`
  );
}
