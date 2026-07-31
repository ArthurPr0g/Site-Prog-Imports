'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { STOCK_STATUSES, type StockStatus } from '@/lib/stock';

export type StockFormInput = {
  id?: string;
  status: StockStatus;
  productId: string | null;
  reservedCustomerId: string | null;
  name: string;
  category: string;
  specs: string;
  productLink: string;
  purchaseDate: string;
  entryDate: string;
  usdRate: number | null;
  paidAmount: number;
  saleAmount: number;
  notes: string;
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

export async function saveStockItemAction(input: StockFormInput): Promise<ActionResult & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const name = input.name.trim();
  if (!name) return errResult('Informe o nome do produto.');
  if (!STOCK_STATUSES.includes(input.status)) return errResult('Status inválido.');
  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0) {
    return errResult('O valor pago precisa ser um número igual ou maior que zero.');
  }
  if (!Number.isFinite(input.saleAmount) || input.saleAmount < 0) {
    return errResult('O valor de venda precisa ser um número igual ou maior que zero.');
  }

  // "Reservado" sem cliente é um estado que não diz nada: quem olha a lista não
  // sabe para quem, e o item fica parado sem dono.
  if (input.status === 'Reservado' && !input.reservedCustomerId) {
    return errResult('Para marcar como Reservado, escolha o cliente que reservou.');
  }

  const payload = {
    status: input.status,
    product_id: input.productId,
    reserved_customer_id: input.reservedCustomerId,
    name,
    category: input.category.trim() || null,
    specs: input.specs.trim() || null,
    product_link: input.productLink.trim() || null,
    purchase_date: input.purchaseDate || null,
    entry_date: input.entryDate || null,
    usd_rate: input.usdRate,
    paid_amount: input.paidAmount,
    sale_amount: input.saleAmount,
    notes: input.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from('stock_items').update(payload).eq('id', input.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar as alterações do item.'));
    revalidatePath('/admin/estoque');
    revalidatePath('/');
    return { ...okResult('Item atualizado.'), id: input.id };
  }

  // Só o formulário cria item; origem 'Orçamento' e 'Troca' são gravadas pelos
  // módulos M3 e M8, nunca escolhidas à mão.
  const { data, error } = await supabase
    .from('stock_items')
    .insert({ ...payload, origin: 'Manual' })
    .select('id')
    .single();

  if (error) return errResult(friendlyDbError(error, 'Não foi possível adicionar o item ao estoque.'));
  revalidatePath('/admin/estoque');
  revalidatePath('/');
  return { ...okResult('Item adicionado ao estoque.'), id: data?.id };
}

export async function deleteStockItemAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  // As proteções de integridade do documento (item já vendido, item que é
  // produto principal de uma troca, item recebido em troca) dependem das
  // tabelas de Vendas e Trocas, que ainda não existem. Quando M4 e M8
  // chegarem, a verificação entra aqui antes do delete.
  const { error } = await supabase.from('stock_items').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return errResult(
        'Este item tem registros vinculados (venda ou troca). Remova-os antes de excluir o item do estoque.'
      );
    }
    return errResult(friendlyDbError(error, 'Não foi possível excluir o item.'));
  }

  revalidatePath('/admin/estoque');
  revalidatePath('/');
  return okResult('Item excluído do estoque.');
}
