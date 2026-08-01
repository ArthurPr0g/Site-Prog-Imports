'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import {
  totalizarItens,
  calcularEntrega,
  SERVICE_ORDER_STATUSES,
  SERVICE_PAYMENT_STATUSES,
  type ServiceOrderItem,
  type ServiceOrderStatus,
  type ServicePaymentStatus,
} from '@/lib/services';
import { sincronizarFinanceiroDaPrestacao, removerFinanceiroDaPrestacao } from '@/lib/data/service-orders';

export type ServiceOrderInput = {
  id?: string;
  customerId: string | null;
  title: string;
  notes: string;
  status: ServiceOrderStatus;
  paymentStatus: ServicePaymentStatus;
  paymentMethod: string;
  startDate: string;
  items: ServiceOrderItem[];
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

function revalidar() {
  revalidatePath('/admin/prestacao-servico');
  revalidatePath('/admin/financeiro');
}

export async function saveServiceOrderAction(input: ServiceOrderInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const title = input.title.trim();
  if (!title) return errResult('Informe o título da prestação.');
  if (!SERVICE_ORDER_STATUSES.includes(input.status)) return errResult('Status inválido.');
  if (!SERVICE_PAYMENT_STATUSES.includes(input.paymentStatus)) return errResult('Situação de pagamento inválida.');
  if (!input.startDate) return errResult('Informe a data de início.');

  const itens = input.items.filter((i) => i.name.trim());
  if (itens.length === 0) return errResult('Adicione ao menos um serviço à prestação.');
  if (itens.some((i) => !Number.isFinite(i.amount) || i.amount < 0)) {
    return errResult('Todos os valores precisam ser números iguais ou maiores que zero.');
  }

  // Total e prazo são derivados dos itens e gravados: o histórico não pode
  // mudar se o preço do catálogo mudar depois.
  const { total, prazoDias } = totalizarItens(itens);

  const payload = {
    customer_id: input.customerId,
    title,
    notes: input.notes.trim(),
    status: input.status,
    payment_status: input.paymentStatus,
    payment_method: input.paymentMethod.trim(),
    total_amount: total,
    lead_time_days: prazoDias,
    start_date: input.startDate,
    due_date: calcularEntrega(input.startDate, prazoDias),
    updated_at: new Date().toISOString(),
  };

  let orderId = input.id;

  if (orderId) {
    const { error } = await supabase.from('service_orders').update(payload).eq('id', orderId);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar a prestação.'));
    // Substitui os itens em bloco: casar linha a linha exigiria rastrear quais
    // foram removidas na tela, e o ganho não paga a complexidade neste volume.
    await supabase.from('service_order_items').delete().eq('order_id', orderId);
  } else {
    const { data, error } = await supabase.from('service_orders').insert(payload).select('id').single();
    if (error || !data) return errResult(friendlyDbError(error, 'Não foi possível criar a prestação.'));
    orderId = data.id;
  }

  const { error: erroItens } = await supabase.from('service_order_items').insert(
    itens.map((i, indice) => ({
      order_id: orderId,
      internal_service_id: i.internalServiceId,
      name: i.name.trim(),
      description: i.description.trim(),
      amount: i.amount,
      lead_time_days: Number.isFinite(i.leadTimeDays) ? i.leadTimeDays : 0,
      position: indice,
    }))
  );
  if (erroItens) return errResult(friendlyDbError(erroItens, 'A prestação foi salva, mas os serviços não.'));

  await sincronizarFinanceiroDaPrestacao(orderId);

  revalidar();
  return okResult(input.id ? 'Prestação atualizada.' : 'Prestação criada.');
}

export async function deleteServiceOrderAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  // Guarda a origem antes de apagar: depois do delete o vínculo some e não há
  // como saber de qual orçamento esta prestação veio.
  const { data: prestacao } = await supabase
    .from('service_orders')
    .select('quote_id')
    .eq('id', id)
    .maybeSingle();

  // O lançamento sai primeiro: a tela do Financeiro recusa excluir linha de
  // origem 'servico', então apagar a prestação antes deixaria a receita órfã
  // e impossível de remover pela interface.
  await removerFinanceiroDaPrestacao(id);

  const { error } = await supabase.from('service_orders').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir a prestação.'));

  // Devolve o orçamento para 'Aprovado'. Sem isto ele fica preso em
  // 'Convertido em Prestação' sem prestação nenhuma: não pode ser editado (a
  // action bloqueia convertidos) nem reconvertido (só 'Aprovado' converte) —
  // um beco sem saída, e exatamente o oposto do que a mensagem de exclusão do
  // orçamento promete ao mandar apagar a prestação primeiro.
  if (prestacao?.quote_id) {
    await supabase
      .from('service_quotes')
      .update({ status: 'Aprovado', updated_at: new Date().toISOString() })
      .eq('id', prestacao.quote_id);
    revalidatePath('/admin/orcamentos-servicos');
  }

  revalidar();
  return okResult(
    prestacao?.quote_id
      ? 'Prestação excluída. O orçamento de origem voltou para Aprovado e pode ser convertido de novo.'
      : 'Prestação excluída.'
  );
}
