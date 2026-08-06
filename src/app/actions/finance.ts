'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { OFFSET_PARCELA_PIX } from '@/lib/installments';
import { sincronizarFinanceiroDaVenda } from '@/lib/data/sales';
import { sincronizarFinanceiroDaPrestacao } from '@/lib/data/service-orders';
import { revalidarDinheiro } from '@/lib/data/revalidate';
import {
  FINANCE_KINDS,
  FINANCE_STATUSES,
  type FinanceKind,
  type FinanceSource,
  type FinanceStatus,
} from '@/lib/finance';

export type FinanceFormInput = {
  id?: string;
  kind: FinanceKind;
  description: string;
  amount: number;
  entryDate: string;
  status: FinanceStatus;
  /** Origem do lançamento sendo editado. Gerado por venda/serviço só aceita
   *  mudança de status — a action confere de novo no servidor. */
  source?: FinanceSource;
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A parcela de carnê por trás de uma linha do Financeiro, quando existe.
 *
 *  Nem toda linha com número de parcela é carnê: na prestação, os números
 *  abaixo do deslocamento são as MENSALIDADES do plano, que não têm registro
 *  próprio e são baixadas aqui mesmo. Confundir as duas faria a mensalidade
 *  procurar uma parcela que não existe. */
async function parcelaDaLinha(
  supabase: Awaited<ReturnType<typeof createClient>>,
  linha: { source: string; reference_id: string | null; installment_number: number | null }
): Promise<{ id: string; paid_at: string | null } | null> {
  if (linha.installment_number === null || !linha.reference_id) return null;

  const ehVenda = linha.source === 'venda';
  if (!ehVenda && linha.installment_number < OFFSET_PARCELA_PIX) return null;

  const numero = ehVenda ? linha.installment_number : linha.installment_number - OFFSET_PARCELA_PIX;

  const { data } = await supabase
    .from('payment_installments')
    .select('id, paid_at')
    .eq('source_type', ehVenda ? 'venda' : 'servico')
    .eq('source_id', linha.reference_id)
    .eq('number', numero)
    .maybeSingle();

  return data ?? null;
}

export async function saveFinanceEntryAction(input: FinanceFormInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const description = input.description.trim();
  if (!description) return errResult('Informe a descrição do lançamento.');
  if (!FINANCE_KINDS.includes(input.kind)) return errResult('Tipo inválido.');
  if (!FINANCE_STATUSES.includes(input.status)) return errResult('Status inválido.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return errResult('O valor precisa ser maior que zero.');
  }
  if (!input.entryDate) return errResult('Informe a data do lançamento.');

  const payload = {
    kind: input.kind,
    description,
    amount: input.amount,
    entry_date: input.entryDate,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data: existente } = await supabase
      .from('finance_entries')
      .select('source, reference_id, installment_number')
      .eq('id', input.id)
      .maybeSingle();

    // Lançamento gerado por venda ou serviço só aceita mudança de STATUS. É o
    // que permite baixar as parcelas de um plano mês a mês, sem abrir caminho
    // para o valor ou a data divergirem da origem — que os reescreveria na
    // próxima sincronização, em silêncio.
    if (existente && existente.source !== 'manual') {
      // Linha que representa parcela de carnê é baixada NO CARNÊ, não aqui.
      // Gravar só o status desta linha dava a impressão de ter dado baixa, mas
      // a parcela continuava pendente na tela do cliente — e a próxima
      // sincronização da venda reescrevia o status de volta para Previsto, sem
      // avisar. Quem manda é a parcela; esta tela é o espelho dela.
      const parcela = await parcelaDaLinha(supabase, existente);
      if (parcela) {
        const recebida = input.status === 'Pago';
        const { error: erroParcela } = await supabase
          .from('payment_installments')
          .update({
            status: recebida ? 'Recebida' : 'Pendente',
            paid_at: recebida ? (parcela.paid_at ?? hojeISO()) : null,
            updated_at: payload.updated_at,
          })
          .eq('id', parcela.id);
        if (erroParcela) {
          return errResult(friendlyDbError(erroParcela, 'Não foi possível baixar a parcela.'));
        }

        // A ressincronização é o que faz o valor cair no mês do recebimento —
        // e não no do vencimento, que é onde a linha estava até agora.
        if (existente.source === 'venda') await sincronizarFinanceiroDaVenda(existente.reference_id!);
        else await sincronizarFinanceiroDaPrestacao(existente.reference_id!);

        revalidarDinheiro();
        return okResult(
          recebida
            ? 'Parcela recebida. O carnê e o histórico do cliente foram atualizados junto.'
            : 'Parcela voltou para pendente, no carnê e aqui.'
        );
      }

      const { error } = await supabase
        .from('finance_entries')
        .update({ status: input.status, updated_at: payload.updated_at })
        .eq('id', input.id);
      if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o lançamento.'));
      revalidarDinheiro();
      return okResult(
        input.status === 'Pago' ? 'Marcado como recebido.' : 'Marcado como previsto.'
      );
    }

    const { error } = await supabase.from('finance_entries').update(payload).eq('id', input.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o lançamento.'));
    revalidarDinheiro();
    return okResult('Lançamento atualizado.');
  }

  // Só o formulário cria lançamento 'manual'. Origem 'venda' e 'servico' são
  // gravadas pelos módulos M4 e M6, nunca escolhidas à mão.
  const { error } = await supabase.from('finance_entries').insert({ ...payload, source: 'manual' });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível criar o lançamento.'));

  revalidarDinheiro();
  return okResult(input.kind === 'receita' ? 'Receita lançada.' : 'Despesa lançada.');
}

export async function deleteFinanceEntryAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  // Lançamento gerado por venda ou serviço não deve ser apagado solto: o
  // registro de origem continuaria dizendo que houve dinheiro, e o caixa
  // discordaria. Apagar tem que acontecer pelo módulo que criou.
  const { data: existente } = await supabase
    .from('finance_entries')
    .select('source')
    .eq('id', id)
    .maybeSingle();

  if (existente && existente.source !== 'manual') {
    const origem = existente.source === 'venda' ? 'uma venda' : 'uma prestação de serviço';
    return errResult(
      `Este lançamento foi gerado por ${origem} e não pode ser excluído aqui. Remova ou ajuste o registro de origem.`
    );
  }

  const { error } = await supabase.from('finance_entries').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o lançamento.'));

  revalidarDinheiro();
  return okResult('Lançamento excluído.');
}
