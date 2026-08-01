'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
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
      .select('source')
      .eq('id', input.id)
      .maybeSingle();

    // Lançamento gerado por venda ou serviço só aceita mudança de STATUS. É o
    // que permite baixar as parcelas de um plano mês a mês, sem abrir caminho
    // para o valor ou a data divergirem da origem — que os reescreveria na
    // próxima sincronização, em silêncio.
    if (existente && existente.source !== 'manual') {
      const { error } = await supabase
        .from('finance_entries')
        .update({ status: input.status, updated_at: payload.updated_at })
        .eq('id', input.id);
      if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o lançamento.'));
      revalidatePath('/admin/financeiro');
      return okResult(
        input.status === 'Pago' ? 'Marcado como recebido.' : 'Marcado como previsto.'
      );
    }

    const { error } = await supabase.from('finance_entries').update(payload).eq('id', input.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o lançamento.'));
    revalidatePath('/admin/financeiro');
    return okResult('Lançamento atualizado.');
  }

  // Só o formulário cria lançamento 'manual'. Origem 'venda' e 'servico' são
  // gravadas pelos módulos M4 e M6, nunca escolhidas à mão.
  const { error } = await supabase.from('finance_entries').insert({ ...payload, source: 'manual' });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível criar o lançamento.'));

  revalidatePath('/admin/financeiro');
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

  revalidatePath('/admin/financeiro');
  return okResult('Lançamento excluído.');
}
