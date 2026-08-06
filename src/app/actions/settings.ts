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
  /** Dados que saem no PDF de proposta. Ficam no banco e não no código porque
   *  o repositório é público — CPF versionado fica exposto para sempre. */
  contractorName: string;
  contractorDoc: string;
  contractorRole: string;
  contractForum: string;
  /** Remetente impresso na etiqueta de transporte. Mesmo motivo dos dados de
   *  contrato para estar no banco: endereço com documento não vai para código
   *  versionado num repositório público. */
  senderName: string;
  senderDoc: string;
  senderPhone: string;
  senderCep: string;
  senderAddressLine: string;
  senderAddressNumber: string;
  senderComplement: string;
  senderDistrict: string;
  senderCity: string;
  senderState: string;
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
        // Reaplica o desconto já acordado: sem isto o recálculo devolveria
        // lucro e margem do preço cheio, apagando o desconto do painel.
        desconto: {
          tipo: q.discount_type as 'percentual' | 'valor',
          valor: Number(q.discount_value),
          descricao: q.discount_note,
        },
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
      contractor_name: input.contractorName.trim(),
      contractor_doc: input.contractorDoc.trim(),
      contractor_role: input.contractorRole.trim(),
      contract_forum: input.contractForum.trim(),
      sender_name: input.senderName.trim(),
      sender_doc: input.senderDoc.trim(),
      sender_phone: input.senderPhone.trim(),
      sender_cep: input.senderCep.trim(),
      sender_address_line: input.senderAddressLine.trim(),
      sender_address_number: input.senderAddressNumber.trim(),
      sender_complement: input.senderComplement.trim(),
      sender_district: input.senderDistrict.trim(),
      sender_city: input.senderCity.trim(),
      sender_state: input.senderState.trim().toUpperCase(),
    })
    .eq('id', true);

  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar os parâmetros.'));

  let recalculados = 0;
  if (input.usdRate && input.usdRate > 0) {
    recalculados = await reaplicarCotacao(supabase, input.usdRate);
  }

  revalidatePath('/admin/configuracoes');
  revalidatePath('/admin/orcamentos-loja');
  // A etiqueta de transporte lê o remetente daqui.
  revalidatePath('/admin/vendas');

  return okResult(
    recalculados > 0
      ? `Parâmetros salvos. ${recalculados} orçamento(s) não aprovado(s) recalculado(s).`
      : 'Parâmetros salvos.'
  );
}

/** Diferença a partir da qual vale avisar que a cotação salva está velha.
 *  Cinco centavos por dólar são R$ 50 num orçamento de US$ 1.000 — abaixo
 *  disso o aviso viraria ruído e o operador aprenderia a ignorá-lo. */
const DIFERENCA_RELEVANTE = 0.05;

/** Compara a cotação salva com a de mercado. Existe porque a atualização é
 *  manual, por decisão do dono: sem um aviso, um orçamento sai com câmbio de
 *  semanas atrás e o erro só aparece na hora de pagar o fornecedor. */
export async function checkUsdRateFreshnessAction(): Promise<{
  ok: boolean;
  stale: boolean;
  saved: number | null;
  suggested: number | null;
  market: number | null;
}> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, stale: false, saved: null, suggested: null, market: null };

  const { data } = await supabase.from('site_settings').select('usd_rate, usd_rate_spread').maybeSingle();
  const salva = data?.usd_rate !== null && data?.usd_rate !== undefined ? Number(data.usd_rate) : null;
  const taxa = Number(data?.usd_rate_spread ?? 0.1);

  const resultado = await buscarCotacaoMercado();
  // API fora do ar não é motivo para alarmar: sem referência, não há como dizer
  // que a cotação salva está errada.
  if (!resultado.ok) return { ok: true, stale: false, saved: salva, suggested: null, market: null };

  const sugerida = cotacaoComTaxa(resultado.cotacao.valor, taxa);
  const stale = salva === null || Math.abs(salva - sugerida) >= DIFERENCA_RELEVANTE;

  return { ok: true, stale, saved: salva, suggested: sugerida, market: resultado.cotacao.valor };
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

  const resultado = await buscarCotacaoMercado();
  if (!resultado.ok) {
    // O motivo entra na mensagem de propósito: é tela de admin, e "não deu
    // certo" sem causa transformaria qualquer diagnóstico em tentativa e erro.
    return errResult(
      `Não foi possível consultar a cotação agora (${resultado.motivo}). Preencha à mão ou tente de novo.`
    );
  }

  const { valor, atualizadaEm, fonte } = resultado.cotacao;
  const comTaxa = cotacaoComTaxa(valor, taxa);
  return {
    ...okResult(
      `Mercado R$ ${valor.toFixed(4)} + taxa R$ ${taxa.toFixed(2)} = R$ ${comTaxa.toFixed(4)} (${fonte}). Confira e salve.`
    ),
    rate: comTaxa,
    market: valor,
    when: atualizadaEm,
  };
}
