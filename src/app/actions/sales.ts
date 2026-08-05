'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { totalizarVenda, SALE_STATUSES, type SaleItem, type SaleStatus } from '@/lib/sales';
import { sincronizarFinanceiroDaVenda, removerFinanceiroDaVenda } from '@/lib/data/sales';

export type SaleFormInput = {
  id?: string;
  customerId: string | null;
  customerName: string;
  status: SaleStatus;
  paymentMethod: string;
  discount: number;
  shipping: number;
  items: SaleItem[];
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

function revalidar() {
  revalidatePath('/admin/vendas');
  revalidatePath('/admin/financeiro');
  revalidatePath('/admin/estoque');
}

export async function saveSaleAction(input: SaleFormInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const nome = input.customerName.trim();
  if (!nome) return errResult('Informe o nome do cliente.');
  if (!SALE_STATUSES.includes(input.status)) return errResult('Status inválido.');

  const itens = input.items.filter((i) => i.productName.trim());
  if (itens.length === 0) return errResult('Adicione ao menos um produto à venda.');
  if (itens.some((i) => !Number.isFinite(i.unitPrice) || i.unitPrice < 0)) {
    return errResult('Todos os preços precisam ser números iguais ou maiores que zero.');
  }
  if (itens.some((i) => !Number.isInteger(i.qty) || i.qty < 1)) {
    return errResult('A quantidade de cada item precisa ser um número inteiro de pelo menos 1.');
  }

  const totais = totalizarVenda(itens, input.discount, input.shipping);

  const payload = {
    customer_id: input.customerId,
    customer_name: nome,
    status: input.status,
    payment_method: input.paymentMethod.trim(),
    subtotal: totais.subtotal,
    discount: input.discount,
    shipping: input.shipping,
    total: totais.total,
    cost_total: totais.custo,
    updated_at: new Date().toISOString(),
  };

  let orderId = input.id;

  if (orderId) {
    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar a venda.'));
    await supabase.from('order_items').delete().eq('order_id', orderId);
  } else {
    // O número da venda vem de uma sequência no banco, não de count()+1: duas
    // vendas criadas ao mesmo tempo receberiam o mesmo número.
    const { data: numero } = await supabase.rpc('next_order_number');
    const { data, error } = await supabase
      .from('orders')
      .insert({ ...payload, order_number: numero ?? 1, origin: 'Manual', is_import: false })
      .select('id')
      .single();
    if (error || !data) return errResult(friendlyDbError(error, 'Não foi possível criar a venda.'));
    orderId = data.id;
  }

  const { error: erroItens } = await supabase.from('order_items').insert(
    itens.map((i) => ({
      order_id: orderId,
      product_id: i.productId,
      stock_item_id: i.stockItemId,
      product_name: i.productName.trim(),
      qty: i.qty,
      unit_price: i.unitPrice,
      unit_cost: i.unitCost,
    }))
  );
  if (erroItens) return errResult(friendlyDbError(erroItens, 'A venda foi salva, mas os itens não.'));

  await sincronizarFinanceiroDaVenda(orderId);
  await baixarEstoqueDaVenda(supabase, orderId, input.status);

  revalidar();
  revalidatePath('/');
  return okResult(input.id ? 'Venda atualizada.' : 'Venda criada.');
}

/** Marca como Vendido os itens de estoque que a venda consumiu, e devolve para
 *  Disponível se a venda foi cancelada.
 *
 *  Sem isso o mesmo notebook continuaria aparecendo como pronta entrega no site
 *  depois de vendido — e o selo de disponibilidade mentiria para o visitante. */
async function baixarEstoqueDaVenda(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  status: SaleStatus
): Promise<void> {
  const { data: itens } = await supabase
    .from('order_items')
    .select('stock_item_id')
    .eq('order_id', orderId)
    .not('stock_item_id', 'is', null);

  const ids = (itens ?? []).map((i) => i.stock_item_id).filter((id): id is string => !!id);
  if (ids.length === 0) return;

  await supabase
    .from('stock_items')
    .update({ status: status === 'Cancelado' ? 'Disponível' : 'Vendido', updated_at: new Date().toISOString() })
    .in('id', ids);
}

export async function deleteSaleAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  // Devolve o estoque antes de apagar: depois do delete os itens somem e não há
  // como saber o que precisa voltar a ficar disponível.
  await baixarEstoqueDaVenda(supabase, id, 'Cancelado');
  await removerFinanceiroDaVenda(id);

  const { data: venda } = await supabase.from('orders').select('budget_id').eq('id', id).maybeSingle();

  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir a venda.'));

  // Devolve o orçamento para Aprovado, como fazem Estoque e Prestação: sem
  // isso ele ficaria em 'Convertido' sem venda nenhuma.
  if (venda?.budget_id) {
    await supabase
      .from('store_quotes')
      .update({ status: 'Aprovado', updated_at: new Date().toISOString() })
      .eq('id', venda.budget_id);
    revalidatePath('/admin/orcamentos-loja');
  }

  revalidar();
  revalidatePath('/');
  return okResult(
    venda?.budget_id
      ? 'Venda excluída. O orçamento de origem voltou para Aprovado.'
      : 'Venda excluída.'
  );
}

/** O botão "Gerar Venda" pedido pelo dono: de um orçamento aprovado sai a venda
 *  com preço e custo já preenchidos, o Financeiro recebe receita e despesa, e o
 *  orçamento é marcado como convertido.
 *
 *  O custo vem de `total_brl` (o que a Prog paga) e o preço de `sale_price_brl`
 *  menos o desconto — os mesmos números que a tela do orçamento mostra. */
export async function generateSaleFromQuoteAction(quoteId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: q } = await supabase.from('store_quotes').select('*').eq('id', quoteId).maybeSingle();
  if (!q) return errResult('Não foi possível ler o orçamento.');

  if (q.status === 'Convertido em Estoque') {
    return errResult('Este orçamento virou item de estoque. Venda o item pela tela de Vendas.');
  }
  if (q.status !== 'Aprovado') {
    return errResult('Só orçamento aprovado vira venda. Marque como Aprovado antes de gerar.');
  }

  const { data: jaExiste } = await supabase
    .from('orders')
    .select('order_number')
    .eq('budget_id', quoteId)
    .limit(1)
    .maybeSingle();
  if (jaExiste) {
    return errResult(`Este orçamento já gerou a venda #${jaExiste.order_number}.`);
  }

  const { data: cliente } = q.customer_id
    ? await supabase.from('customers').select('name').eq('id', q.customer_id).maybeSingle()
    : { data: null };

  const preco = Number(q.sale_price_brl) - descontoEmReais(q);
  const custo = Number(q.total_brl);

  const { data: numero } = await supabase.rpc('next_order_number');
  const { data: venda, error } = await supabase
    .from('orders')
    .insert({
      order_number: numero ?? 1,
      customer_name: cliente?.name ?? q.name,
      // `customer_id` de orders aponta para profiles (quem tem conta no site),
      // enquanto o orçamento guarda um customer do ERP — deixar nulo evita
      // gravar um id na tabela errada.
      customer_id: null,
      origin: 'Orçamento',
      status: 'Aguardando pagamento',
      payment_method: q.payment_method ?? '',
      subtotal: preco,
      discount: 0,
      shipping: 0,
      total: preco,
      cost_total: custo,
      budget_id: quoteId,
      is_import: true,
    })
    .select('id, order_number')
    .single();

  if (error || !venda) return errResult(friendlyDbError(error, 'Não foi possível criar a venda.'));

  const { error: erroItem } = await supabase.from('order_items').insert({
    order_id: venda.id,
    product_id: q.product_id,
    product_name: q.name,
    qty: 1,
    unit_price: preco,
    unit_cost: custo,
  });
  if (erroItem) {
    return errResult('A venda foi criada, mas o item não. Ajuste na tela de Vendas.');
  }

  await sincronizarFinanceiroDaVenda(venda.id);

  const { error: erroStatus } = await supabase
    .from('store_quotes')
    .update({ status: 'Convertido em Estoque', updated_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (erroStatus) {
    return errResult('A venda foi criada, mas o status do orçamento não mudou. Ajuste manualmente.');
  }

  revalidar();
  revalidatePath('/admin/orcamentos-loja');
  return okResult(`Venda #${venda.order_number} criada a partir do orçamento.`);
}

/** Desconto do orçamento em reais, para o preço da venda bater com o que a tela
 *  do orçamento mostra. */
function descontoEmReais(q: { sale_price_brl: number; discount_type: string; discount_value: number }): number {
  const base = Number(q.sale_price_brl);
  const valor = Number(q.discount_value);
  if (!(valor > 0) || !(base > 0)) return 0;
  const bruto = q.discount_type === 'percentual' ? (base * Math.min(valor, 100)) / 100 : valor;
  return Math.round(Math.min(bruto, base) * 100) / 100;
}
