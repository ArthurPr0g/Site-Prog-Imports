'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { calculateQuote, QUOTE_STATUSES, type QuoteStatus } from '@/lib/quotes';

export type QuoteFormInput = {
  id?: string;
  customerId: string | null;
  productId: string | null;
  name: string;
  category: string;
  specs: string;
  productLink: string;
  productValueUsd: number;
  taxUsd: number;
  travelerFeeUsd: number;
  grabrFeeUsd: number;
  processingUsd: number;
  shippingBrl: number;
  salePriceBrl: number;
  notes: string;
  status: QuoteStatus;
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

async function cotacaoOficial(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number | null> {
  const { data } = await supabase.from('site_settings').select('usd_rate').maybeSingle();
  const taxa = data?.usd_rate;
  return taxa !== null && taxa !== undefined ? Number(taxa) : null;
}

export async function saveQuoteAction(input: QuoteFormInput): Promise<ActionResult & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (!input.name.trim()) return errResult('Informe o nome do produto.');
  if (!input.customerId) return errResult('Escolha o cliente solicitante.');
  if (!QUOTE_STATUSES.includes(input.status)) return errResult('Status inválido.');

  // A cotação vem sempre de Configurações, nunca do formulário. Sem ela o
  // cálculo inteiro sai zerado e o orçamento nasceria errado sem ninguém notar.
  const taxa = await cotacaoOficial(supabase);
  if (taxa === null || taxa <= 0) {
    return errResult('Configure a cotação do dólar em Configurações antes de criar orçamentos.');
  }

  const totais = calculateQuote(
    {
      productValue: input.productValueUsd,
      tax: input.taxUsd,
      travelerFee: input.travelerFeeUsd,
      grabrFee: input.grabrFeeUsd,
      processing: input.processingUsd,
      shippingBrl: input.shippingBrl,
      salePriceBrl: input.salePriceBrl,
    },
    taxa
  );

  const payload = {
    customer_id: input.customerId,
    product_id: input.productId,
    name: input.name.trim(),
    category: input.category.trim() || null,
    specs: input.specs.trim() || null,
    product_link: input.productLink.trim() || null,
    usd_rate: taxa,
    product_value_usd: totais.usd.productValue,
    product_value_brl: totais.brl.productValue,
    tax_usd: totais.usd.tax,
    tax_brl: totais.brl.tax,
    traveler_fee_usd: totais.usd.travelerFee,
    traveler_fee_brl: totais.brl.travelerFee,
    grabr_fee_usd: totais.usd.grabrFee,
    grabr_fee_brl: totais.brl.grabrFee,
    processing_usd: totais.usd.processing,
    processing_brl: totais.brl.processing,
    shipping_brl: totais.brl.shipping,
    shipping_usd: totais.usd.shipping,
    total_usd: totais.usd.total,
    total_brl: totais.brl.total,
    sale_price_brl: input.salePriceBrl,
    profit_brl: totais.profitBrl,
    margin_pct: totais.marginPct,
    notes: input.notes.trim() || null,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from('store_quotes').update(payload).eq('id', input.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o orçamento.'));
    revalidatePath('/admin/orcamentos-loja');
    return { ...okResult('Orçamento atualizado.'), id: input.id };
  }

  const { data, error } = await supabase.from('store_quotes').insert(payload).select('id').single();
  if (error) return errResult(friendlyDbError(error, 'Não foi possível criar o orçamento.'));
  revalidatePath('/admin/orcamentos-loja');
  return { ...okResult('Orçamento criado.'), id: data?.id };
}

export async function deleteQuoteAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  // Orçamento já convertido tem um item de estoque apontando para ele. Apagar
  // aqui deixaria o item órfão da própria origem, sem rastro de quanto custou.
  const { data: vinculado } = await supabase
    .from('stock_items')
    .select('id')
    .eq('budget_id', id)
    .limit(1)
    .maybeSingle();

  if (vinculado) {
    return errResult(
      'Este orçamento já virou item de estoque. Exclua o item do estoque primeiro — isso reabre o orçamento para nova conversão.'
    );
  }

  const { error } = await supabase.from('store_quotes').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o orçamento.'));

  revalidatePath('/admin/orcamentos-loja');
  return okResult('Orçamento excluído.');
}

/** Cópia completa com status resetado — serve para variar configuração ou preço
 *  sem perder o orçamento já enviado ao cliente. */
export async function duplicateQuoteAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: origem, error: erroLeitura } = await supabase
    .from('store_quotes')
    .select('*')
    .eq('id', id)
    .single();
  if (erroLeitura || !origem) return errResult('Não foi possível ler o orçamento de origem.');

  const copia = { ...origem } as Record<string, unknown>;
  delete copia.id;
  delete copia.created_at;
  copia.status = 'Em elaboração';
  copia.updated_at = new Date().toISOString();

  const { error } = await supabase.from('store_quotes').insert(copia as never);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível duplicar o orçamento.'));

  revalidatePath('/admin/orcamentos-loja');
  return okResult('Orçamento duplicado como "Em elaboração".');
}

/** Converte o orçamento aprovado em item de estoque, copiando o custo total
 *  como valor pago e o preço de venda pretendido. */
export async function sendQuoteToStockAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: q, error: erroLeitura } = await supabase
    .from('store_quotes')
    .select('*')
    .eq('id', id)
    .single();
  if (erroLeitura || !q) return errResult('Não foi possível ler o orçamento.');

  if (q.status === 'Convertido em Estoque') {
    return errResult('Este orçamento já foi convertido em item de estoque.');
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const { error: erroEstoque } = await supabase.from('stock_items').insert({
    origin: 'Orçamento',
    status: 'Disponível',
    product_id: q.product_id,
    reserved_customer_id: q.customer_id,
    name: q.name,
    category: q.category,
    specs: q.specs,
    product_link: q.product_link,
    purchase_date: hoje,
    entry_date: hoje,
    usd_rate: q.usd_rate,
    paid_amount: q.total_brl,
    sale_amount: q.sale_price_brl,
    budget_id: q.id,
    notes: `Convertido do orçamento de ${q.name}.`,
  });
  if (erroEstoque) return errResult(friendlyDbError(erroEstoque, 'Não foi possível criar o item de estoque.'));

  const { error: erroStatus } = await supabase
    .from('store_quotes')
    .update({ status: 'Convertido em Estoque', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (erroStatus) {
    return errResult('O item foi criado no estoque, mas o status do orçamento não mudou. Ajuste manualmente.');
  }

  revalidatePath('/admin/orcamentos-loja');
  revalidatePath('/admin/estoque');
  revalidatePath('/');
  return okResult('Item criado no estoque e orçamento marcado como convertido.');
}

/** Recalcula em massa quando a cotação oficial muda. Orçamentos já convertidos
 *  ficam de fora: o custo deles já entrou no patrimônio via item de estoque, e
 *  mudar retroativamente falsearia o histórico. */
export async function recalculateQuotesAction(): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const taxa = await cotacaoOficial(supabase);
  if (taxa === null || taxa <= 0) return errResult('Configure a cotação do dólar antes de recalcular.');

  const { data: quotes } = await supabase
    .from('store_quotes')
    .select('*')
    .neq('status', 'Convertido em Estoque');

  if (!quotes?.length) return okResult('Nenhum orçamento para recalcular.');

  let atualizados = 0;
  for (const q of quotes) {
    const totais = calculateQuote(
      {
        productValue: Number(q.product_value_usd),
        tax: Number(q.tax_usd),
        travelerFee: Number(q.traveler_fee_usd),
        grabrFee: Number(q.grabr_fee_usd),
        processing: Number(q.processing_usd),
        shippingBrl: Number(q.shipping_brl),
        salePriceBrl: Number(q.sale_price_brl),
      },
      taxa
    );
    const { error } = await supabase
      .from('store_quotes')
      .update({
        usd_rate: taxa,
        product_value_brl: totais.brl.productValue,
        tax_brl: totais.brl.tax,
        traveler_fee_brl: totais.brl.travelerFee,
        grabr_fee_brl: totais.brl.grabrFee,
        processing_brl: totais.brl.processing,
        shipping_usd: totais.usd.shipping,
        total_usd: totais.usd.total,
        total_brl: totais.brl.total,
        profit_brl: totais.profitBrl,
        margin_pct: totais.marginPct,
        updated_at: new Date().toISOString(),
      })
      .eq('id', q.id);
    if (!error) atualizados++;
  }

  revalidatePath('/admin/orcamentos-loja');
  return okResult(`${atualizados} orçamento(s) recalculado(s) com a cotação de R$ ${taxa.toFixed(2)}.`);
}
