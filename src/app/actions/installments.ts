'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { INSTALLMENT_STATUSES, gerarParcelas, type InstallmentStatus } from '@/lib/installments';
import { aplicarDesconto, type Desconto } from '@/lib/discount';
import { sincronizarFinanceiroDaVenda } from '@/lib/data/sales';
import { sincronizarFinanceiroDaPrestacao } from '@/lib/data/service-orders';
import { salvarParcelas, type SourceType } from '@/lib/data/installments';

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
  revalidatePath('/admin/clientes', 'layout');
  revalidatePath('/admin');
}

export async function updateInstallmentAction(input: {
  id: string;
  amount: number;
  status: InstallmentStatus;
  dueDate: string;
  notes: string;
}): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (!INSTALLMENT_STATUSES.includes(input.status)) return errResult('Status inválido.');
  if (!input.dueDate) return errResult('Informe a data de vencimento.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return errResult('O valor da parcela precisa ser maior que zero.');
  }

  const { data: parcela } = await supabase
    .from('payment_installments')
    .select('source_type, source_id')
    .eq('id', input.id)
    .maybeSingle();

  if (!parcela) return errResult('Parcela não encontrada.');

  const { error } = await supabase
    .from('payment_installments')
    .update({
      amount: Math.round(input.amount * 100) / 100,
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

/** Refaz o carnê a partir das condições gravadas na venda ou na prestação.
 *
 *  É a saída para quando os ajustes manuais deixaram o carnê sem fechar com o
 *  valor devido. Precisa ser um botão explícito porque salvar a venda não faz
 *  mais isso sozinho — justamente para não desfazer ajuste manual sem pedir.
 *
 *  O status de cada parcela sobrevive: valor e vencimento voltam ao calculado,
 *  mas o que já foi recebido continua recebido. Zerar isso apagaria registro de
 *  dinheiro que entrou. */
export async function regenerateInstallmentsAction(input: {
  tipo: SourceType;
  sourceId: string;
}): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const condicoes =
    input.tipo === 'venda'
      ? await condicoesDaVenda(supabase, input.sourceId)
      : await condicoesDaPrestacao(supabase, input.sourceId);

  if (!condicoes) return errResult('Não foi possível ler as condições do parcelamento.');
  if (!condicoes.primeiroVencimento || condicoes.parcelas < 1) {
    return errResult('Esta venda não tem condições de parcelamento gravadas.');
  }

  await salvarParcelas(input.tipo, input.sourceId, gerarParcelas(condicoes), { redefinirDatas: true });
  await ressincronizar(input.tipo, input.sourceId);

  revalidar();
  return okResult('Carnê refeito a partir das condições da venda. As baixas foram mantidas.');
}

type Condicoes = {
  total: number;
  parcelas: number;
  entrada: number;
  jurosPct: number;
  primeiroVencimento: string;
};

async function condicoesDaVenda(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<Condicoes | null> {
  const { data } = await supabase
    .from('orders')
    .select('total, installment_count, down_payment, interest_pct, first_due_date')
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;
  return {
    total: Number(data.total),
    parcelas: data.installment_count,
    entrada: Number(data.down_payment),
    jurosPct: Number(data.interest_pct),
    primeiroVencimento: data.first_due_date ?? '',
  };
}

/** O carnê do serviço é sobre o trabalho já com desconto, não sobre o preço
 *  cheio — mesma conta que a action de prestação faz ao salvar. */
async function condicoesDaPrestacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<Condicoes | null> {
  const { data } = await supabase
    .from('service_orders')
    .select(
      'total_amount, discount_type, discount_value, installment_count, down_payment, interest_pct, first_due_date'
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;
  return {
    total: aplicarDesconto(Number(data.total_amount), {
      tipo: data.discount_type as Desconto['tipo'],
      valor: Number(data.discount_value),
      descricao: '',
    }),
    parcelas: data.installment_count,
    entrada: Number(data.down_payment),
    jurosPct: Number(data.interest_pct),
    primeiroVencimento: data.first_due_date ?? '',
  };
}

/** Apaga uma parcela do carnê.
 *
 *  Existe porque um carnê real muda depois de combinado: o cliente antecipa e
 *  quita duas de uma vez, ou uma parcela foi combinada e desfeita. Sem isto a
 *  única saída era cancelá-la — o que deixa a linha na tela para sempre.
 *
 *  A ressincronização é o que impede a linha da parcela de continuar no
 *  Financeiro cobrando um dinheiro que ninguém mais espera. */
export async function deleteInstallmentAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: parcela } = await supabase
    .from('payment_installments')
    .select('source_type, source_id, number, status')
    .eq('id', id)
    .maybeSingle();

  if (!parcela) return errResult('Parcela não encontrada.');

  const { error } = await supabase.from('payment_installments').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir a parcela.'));

  await ressincronizar(parcela.source_type as SourceType, parcela.source_id);

  revalidar();
  const rotulo = parcela.number === 0 ? 'Entrada' : `Parcela ${parcela.number}`;
  return okResult(
    parcela.status === 'Recebida'
      ? `${rotulo} excluída. O valor saiu da receita do Financeiro.`
      : `${rotulo} excluída e removida do Financeiro.`
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
