'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import {
  totalizarTroca,
  statusDaVendaGerada,
  valorDaVendaGerada,
  MAX_ITENS_RECEBIDOS,
  type TradeItem,
} from '@/lib/trades';
import { geraParcelas, gerarParcelas, MAX_JUROS_PCT } from '@/lib/installments';
import { salvarParcelas, removerParcelas } from '@/lib/data/installments';
import { sincronizarFinanceiroDaVenda, removerFinanceiroDaVenda } from '@/lib/data/sales';
import { revalidarDinheiro } from '@/lib/data/revalidate';

export type TradeFormInput = {
  customerId: string | null;
  stockItemId: string;
  tradeDate: string;
  paymentMethod: string;
  installmentCount: number;
  downPayment: number;
  interestPct: number;
  firstDueDate: string;
  installmentNotes: string;
  notes: string;
  items: TradeItem[];
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

/** A troca gera venda, mexe no estoque e no caixa — e o estoque muda o selo de
 *  pronta entrega na vitrine. */
function revalidar() {
  revalidarDinheiro('/admin/avaliacao-troca', '/admin/estoque', '/');
}

/** Conclui a negociação: uma sequência com vários efeitos.
 *
 *  1. Cada produto recebido vira um item de estoque com origem `Troca`.
 *  2. Nasce uma venda do produto principal, e o item dele passa a `Vendido`.
 *  3. O Financeiro recebe **só a diferença em dinheiro** — produto recebido não
 *     é caixa, é ativo.
 *
 *  Não é transacional: o Supabase não expõe transação pelo cliente HTTP. A ordem
 *  é escolhida para que uma falha no meio deixe o estado mais fácil de entender
 *  — a troca é gravada primeiro e a venda por último, então uma interrupção
 *  deixa uma negociação sem venda (visível e corrigível) em vez de uma venda
 *  órfã sem negociação. */
export async function createTradeAction(input: TradeFormInput): Promise<ActionResult & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (!input.stockItemId) return errResult('Escolha o produto do estoque que está sendo vendido.');
  if (!input.tradeDate) return errResult('Informe a data da negociação.');

  const itens = input.items.filter((i) => i.name.trim());
  if (itens.length > MAX_ITENS_RECEBIDOS) {
    return errResult(`No máximo ${MAX_ITENS_RECEBIDOS} produtos recebidos por negociação.`);
  }
  if (itens.some((i) => !Number.isFinite(i.paidValue) || i.paidValue < 0)) {
    return errResult('Os valores dos produtos recebidos precisam ser números iguais ou maiores que zero.');
  }

  const { data: principal } = await supabase
    .from('stock_items')
    .select('*')
    .eq('id', input.stockItemId)
    .maybeSingle();

  if (!principal) return errResult('Item de estoque não encontrado.');
  if (principal.status === 'Vendido') {
    return errResult('Este item de estoque já foi vendido. Escolha outro.');
  }

  const precoPrincipal = Number(principal.sale_amount);
  const custoPrincipal = Number(principal.paid_amount);
  if (!(precoPrincipal > 0)) {
    return errResult('O item de estoque não tem valor de venda definido. Preencha-o no Estoque antes de trocar.');
  }

  const totais = totalizarTroca(itens, precoPrincipal, custoPrincipal);

  const parcelado = geraParcelas(input.paymentMethod) && totais.diferenca > 0;
  if (parcelado) {
    if (!input.firstDueDate) return errResult('Informe a data da primeira parcela.');
    if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1) {
      return errResult('Informe a quantidade de parcelas.');
    }
    if (!Number.isFinite(input.interestPct) || input.interestPct < 0 || input.interestPct > MAX_JUROS_PCT) {
      return errResult(`A taxa de juros precisa ficar entre 0% e ${MAX_JUROS_PCT}%.`);
    }
    if (input.downPayment > totais.diferenca) {
      return errResult('A entrada não pode ser maior que a diferença a pagar.');
    }
  }

  // 1) A negociação, antes de tudo: se algo falhar adiante, ela fica visível
  //    para o dono corrigir em vez de sumir.
  const { data: troca, error: erroTroca } = await supabase
    .from('trades')
    .insert({
      customer_id: input.customerId,
      stock_item_id: input.stockItemId,
      main_product_name: principal.name,
      main_sale_price: precoPrincipal,
      main_cost: custoPrincipal,
      total_received: totais.totalRecebido,
      difference_to_pay: totais.diferenca,
      total_profit: totais.lucroTotal,
      margin_pct: totais.margemPct,
      payment_method: input.paymentMethod.trim(),
      installment_count: parcelado ? input.installmentCount : 0,
      down_payment: parcelado ? input.downPayment : 0,
      interest_pct: parcelado ? input.interestPct : 0,
      first_due_date: parcelado ? input.firstDueDate : null,
      installment_notes: parcelado ? input.installmentNotes.trim() : '',
      notes: input.notes.trim(),
      trade_date: input.tradeDate,
    })
    .select('id')
    .single();

  if (erroTroca || !troca) {
    return errResult(friendlyDbError(erroTroca, 'Não foi possível criar a negociação.'));
  }

  // 2) Produtos recebidos: cada um vira item de estoque e a linha da troca
  //    guarda o vínculo.
  for (const [indice, item] of itens.entries()) {
    const { data: novoEstoque } = await supabase
      .from('stock_items')
      .insert({
        origin: 'Troca',
        status: 'Disponível',
        name: item.name.trim(),
        category: item.category.trim() || null,
        specs: item.specs.trim() || null,
        purchase_date: input.tradeDate,
        entry_date: input.tradeDate,
        // O que a loja abateu por ele é o custo; o que espera tirar, a venda.
        paid_amount: item.paidValue,
        sale_amount: item.resaleValue,
        notes: `Recebido em troca (${principal.name}). Estado: ${item.condition}.${item.notes.trim() ? ` ${item.notes.trim()}` : ''}`,
        reserved_customer_id: null,
      })
      .select('id')
      .single();

    await supabase.from('trade_items').insert({
      trade_id: troca.id,
      name: item.name.trim(),
      category: item.category.trim(),
      specs: item.specs.trim(),
      condition: item.condition,
      market_value: item.marketValue,
      paid_value: item.paidValue,
      resale_value: item.resaleValue,
      notes: item.notes.trim(),
      position: indice,
      stock_item_id: novoEstoque?.id ?? null,
    });

    if (novoEstoque) {
      await supabase.from('stock_items').update({ trade_item_id: troca.id }).eq('id', novoEstoque.id);
    }
  }

  // 3) A venda do produto principal.
  const { total, custo } = valorDaVendaGerada(totais, custoPrincipal);
  const statusVenda = statusDaVendaGerada(totais.diferenca, input.paymentMethod);

  const { data: numero } = await supabase.rpc('next_order_number');
  const { data: venda, error: erroVenda } = await supabase
    .from('orders')
    .insert({
      order_number: numero ?? 1,
      customer_name: principal.name,
      erp_customer_id: input.customerId,
      origin: 'Troca',
      status: statusVenda,
      payment_method: input.paymentMethod.trim(),
      subtotal: total,
      discount: 0,
      shipping: 0,
      total,
      cost_total: custo,
      trade_id: troca.id,
      is_import: false,
      installment_count: parcelado ? input.installmentCount : 0,
      down_payment: parcelado ? input.downPayment : 0,
      interest_pct: parcelado ? input.interestPct : 0,
      first_due_date: parcelado ? input.firstDueDate : null,
      installment_notes: parcelado ? input.installmentNotes.trim() : '',
    })
    .select('id, order_number')
    .single();

  if (erroVenda || !venda) {
    return errResult(
      'A negociação foi criada e os produtos entraram no estoque, mas a venda não. Exclua a negociação e refaça.'
    );
  }

  await supabase.from('order_items').insert({
    order_id: venda.id,
    product_id: principal.product_id,
    stock_item_id: principal.id,
    product_name: principal.name,
    qty: 1,
    unit_price: total,
    unit_cost: custo,
  });

  await supabase.from('trades').update({ order_id: venda.id }).eq('id', troca.id);

  // O item vendido sai do estoque disponível.
  await supabase
    .from('stock_items')
    .update({ status: 'Vendido', updated_at: new Date().toISOString() })
    .eq('id', principal.id);

  if (parcelado) {
    await salvarParcelas(
      'venda',
      venda.id,
      gerarParcelas({
        // O carnê é sobre a DIFERENÇA, não sobre o preço do produto: o resto já
        // foi pago em mercadoria.
        total: totais.diferenca,
        parcelas: input.installmentCount,
        entrada: input.downPayment,
        jurosPct: input.interestPct,
        primeiroVencimento: input.firstDueDate,
      })
    );
  }

  await sincronizarFinanceiroDaVenda(venda.id);

  revalidar();
  return {
    ...okResult(
      `Negociação concluída. Venda #${venda.order_number} criada${itens.length > 0 ? ` e ${itens.length} produto(s) no estoque` : ''}.`
    ),
    id: troca.id,
  };
}

/** Exclui a negociação, revertendo tudo o que ela criou.
 *
 *  Os itens recebidos **saem do estoque junto** (decisão do dono): se a
 *  negociação não aconteceu, aqueles produtos nunca entraram na loja, e deixá-los
 *  no estoque inventaria mercadoria que não existe.
 *
 *  Com uma trava: item que já seguiu adiante — vendido, reservado, em transporte
 *  ou dentro de alguma venda — **impede a exclusão inteira**. Apagá-lo furaria o
 *  histórico de uma venda real por causa de um acerto administrativo, e apagar
 *  só os livres deixaria a negociação meio revertida, que é pior que não
 *  reverter. */
export async function deleteTradeAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: troca } = await supabase
    .from('trades')
    .select('order_id, stock_item_id, trade_items(stock_item_id, name)')
    .eq('id', id)
    .maybeSingle();

  if (!troca) return errResult('Negociação não encontrada.');

  const recebidos = (troca.trade_items ?? [])
    .filter((i): i is { stock_item_id: string; name: string } => !!i.stock_item_id);
  const idsRecebidos = recebidos.map((i) => i.stock_item_id);

  if (idsRecebidos.length > 0) {
    const { data: emUso } = await supabase
      .from('stock_items')
      .select('id, name, status')
      .in('id', idsRecebidos)
      .neq('status', 'Disponível');

    if (emUso && emUso.length > 0) {
      const nomes = emUso.map((i) => `${i.name} (${i.status})`).join(', ');
      return errResult(
        `Não dá para excluir: ${nomes} já saiu do estoque livre. Reverta essa movimentação antes, ou o histórico dela ficaria sem origem.`
      );
    }

    const { data: emVendas } = await supabase
      .from('order_items')
      .select('product_name')
      .in('stock_item_id', idsRecebidos)
      .limit(1);

    if (emVendas && emVendas.length > 0) {
      return errResult(
        `Não dá para excluir: "${emVendas[0].product_name}" recebido nesta troca já está em uma venda. Exclua a venda primeiro.`
      );
    }
  }

  if (troca.order_id) {
    await removerFinanceiroDaVenda(troca.order_id);
    await removerParcelas('venda', troca.order_id);
    await supabase.from('orders').delete().eq('id', troca.order_id);
  }

  // O produto principal volta a ficar disponível.
  if (troca.stock_item_id) {
    await supabase
      .from('stock_items')
      .update({ status: 'Disponível', updated_at: new Date().toISOString() })
      .eq('id', troca.stock_item_id);
  }

  // Os recebidos saem do estoque: eles só existiam por causa desta negociação.
  if (idsRecebidos.length > 0) {
    await supabase.from('stock_items').delete().in('id', idsRecebidos);
  }

  const { error } = await supabase.from('trades').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir a negociação.'));

  revalidar();
  return okResult(
    idsRecebidos.length > 0
      ? `Negociação excluída. A venda foi revertida, o produto voltou ao estoque e ${idsRecebidos.length} item(ns) recebido(s) saíram do estoque.`
      : 'Negociação excluída. A venda foi revertida e o produto voltou ao estoque.'
  );
}
