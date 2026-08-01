'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { buscarCotacaoMercado } from '@/lib/usd-rate';
import { cotacaoComTaxa, calculateQuote, podeRecalcular, type QuoteStatus } from '@/lib/quotes';

export type SystemSettingsInput = {
  usdRate: number | null;
  usdRateSpread: number;
  defaultDeliveryTime: string;
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

/** Reaplica a cotação nos orçamentos que ainda não foram aprovados.
 *
 *  Proposta não aprovada acompanha o câmbio: se o cliente fechar amanhã, o
 *  preço é o de amanhã. A partir de "Aprovado" o valor vira compromisso e
 *  congela — mexer nele mudaria retroativamente um preço já acordado.
 *
 *  Roda sozinho ao salvar a cotação, em vez de depender de alguém lembrar de
 *  apertar um botão. Esquecer significaria enviar proposta com câmbio velho. */
async function reaplicarCotacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taxa: number
): Promise<number> {
  const { data: quotes } = await supabase.from('store_quotes').select('*');
  if (!quotes?.length) return 0;

  let atualizados = 0;
  for (const q of quotes) {
    if (!podeRecalcular(q.status as QuoteStatus)) continue;

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
  return atualizados;
}

export async function saveSystemSettingsAction(input: SystemSettingsInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (input.usdRate !== null && (!Number.isFinite(input.usdRate) || input.usdRate <= 0)) {
    return errResult('A cotação precisa ser um número maior que zero.');
  }
  if (!Number.isFinite(input.usdRateSpread) || input.usdRateSpread < 0) {
    return errResult('A taxa por dólar precisa ser um número igual ou maior que zero.');
  }

  const { error } = await supabase
    .from('site_settings')
    .update({
      usd_rate: input.usdRate,
      usd_rate_spread: input.usdRateSpread,
      default_delivery_time: input.defaultDeliveryTime.trim() || null,
    })
    .eq('id', true);

  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar os parâmetros.'));

  let recalculados = 0;
  if (input.usdRate && input.usdRate > 0) {
    recalculados = await reaplicarCotacao(supabase, input.usdRate);
  }

  revalidatePath('/admin/configuracoes');
  revalidatePath('/admin/orcamentos-loja');

  return okResult(
    recalculados > 0
      ? `Parâmetros salvos. ${recalculados} orçamento(s) não aprovado(s) recalculado(s).`
      : 'Parâmetros salvos.'
  );
}

/** Busca a cotação de mercado e devolve já com a taxa somada, para o operador
 *  conferir antes de salvar. Não grava sozinha: cotação é a base de todo preço,
 *  e mudança automática sem confirmação é o tipo de coisa que se descobre
 *  tarde. */
export async function fetchUsdRateAction(): Promise<ActionResult & { rate?: number; market?: number; when?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data } = await supabase.from('site_settings').select('usd_rate_spread').maybeSingle();
  const taxa = Number(data?.usd_rate_spread ?? 0.1);

  const mercado = await buscarCotacaoMercado();
  if (!mercado) {
    return errResult('Não foi possível consultar a cotação agora. Tente de novo ou preencha à mão.');
  }

  const comTaxa = cotacaoComTaxa(mercado.valor, taxa);
  return {
    ...okResult(
      `Cotação de mercado R$ ${mercado.valor.toFixed(4)} + taxa R$ ${taxa.toFixed(2)} = R$ ${comTaxa.toFixed(4)}. Confira e salve.`
    ),
    rate: comTaxa,
    market: mercado.valor,
    when: mercado.atualizadaEm,
  };
}
