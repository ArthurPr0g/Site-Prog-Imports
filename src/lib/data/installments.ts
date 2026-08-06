import { createClient } from '@/lib/supabase/server';
import type { Installment, InstallmentStatus } from '@/lib/installments';

export type SourceType = 'venda' | 'servico';

type Row = {
  id: string;
  number: number;
  amount: number;
  due_date: string;
  status: string;
  notes: string;
};

function toInstallment(r: Row): Installment {
  return {
    id: r.id,
    number: r.number,
    amount: Number(r.amount),
    dueDate: r.due_date,
    status: r.status as InstallmentStatus,
    notes: r.notes,
  };
}

export async function listInstallments(tipo: SourceType, sourceId: string): Promise<Installment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payment_installments')
    .select('*')
    .eq('source_type', tipo)
    .eq('source_id', sourceId)
    .order('number');
  return (data ?? []).map((r) => toInstallment(r as Row));
}

/** Todas as parcelas de vários registros de uma vez, para a listagem não fazer
 *  uma consulta por linha. */
export async function listInstallmentsBySource(
  tipo: SourceType,
  ids: string[]
): Promise<Map<string, Installment[]>> {
  const mapa = new Map<string, Installment[]>();
  if (ids.length === 0) return mapa;

  const supabase = await createClient();
  const { data } = await supabase
    .from('payment_installments')
    .select('*, source_id')
    .eq('source_type', tipo)
    .in('source_id', ids)
    .order('number');

  for (const r of data ?? []) {
    const lista = mapa.get(r.source_id) ?? [];
    lista.push(toInstallment(r as Row));
    mapa.set(r.source_id, lista);
  }
  return mapa;
}

/** Uma parcela do próprio cliente, já com o registro de onde ela veio. */
export type MinhaParcela = Installment & { origem: string };

/** O carnê do usuário logado, para a área da conta.
 *
 *  Vem de `my_installments()`, função `security definer` no banco:
 *  `payment_installments` é admin-only e continua sendo. A função responde só o
 *  que é do usuário da sessão, buscando o vínculo pelos dois lados — conta do
 *  site e cadastro do ERP —, porque venda de PIX parcelado costuma nascer no
 *  gerenciamento, ligada só ao segundo. */
export async function listMyInstallments(): Promise<MinhaParcela[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_installments');

  if (error) {
    console.error('[conta] carnê do cliente não carregou', error);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    number: r.number,
    amount: Number(r.amount),
    dueDate: r.due_date,
    status: r.status as InstallmentStatus,
    notes: '',
    origem: r.origem ?? '',
  }));
}

/** Regrava o carnê inteiro.
 *
 *  Preserva status, vencimento e observação das parcelas que já existem, casando
 *  pelo NÚMERO: o dono edita datas e dá baixas uma a uma, e recriar do zero
 *  apagaria esse trabalho a cada salvamento da venda. Só o VALOR é reescrito,
 *  porque ele vem do cálculo — se o total da venda mudou, a parcela tem que
 *  mudar junto.
 *
 *  `redefinirDatas` é o "refazer o carnê" pedido de propósito pelo dono: aí os
 *  vencimentos também voltam ao calculado. O status continua preservado mesmo
 *  nesse caso — perder o registro de quais parcelas já foram pagas seria
 *  destruir histórico de dinheiro recebido para consertar um cálculo. */
export async function salvarParcelas(
  tipo: SourceType,
  sourceId: string,
  parcelas: Installment[],
  opcoes?: { redefinirDatas?: boolean }
): Promise<void> {
  const supabase = await createClient();

  const { data: existentes } = await supabase
    .from('payment_installments')
    .select('id, number, due_date, status, notes')
    .eq('source_type', tipo)
    .eq('source_id', sourceId);

  const atuais = existentes ?? [];
  const porNumero = new Map(atuais.map((e) => [e.number, e]));
  const numerosAlvo = new Set(parcelas.map((p) => p.number));
  const agora = new Date().toISOString();

  for (const p of parcelas) {
    const existente = porNumero.get(p.number);
    if (existente) {
      await supabase
        .from('payment_installments')
        .update({
          amount: p.amount,
          ...(opcoes?.redefinirDatas ? { due_date: p.dueDate } : {}),
          updated_at: agora,
        })
        .eq('id', existente.id);
    } else {
      await supabase.from('payment_installments').insert({
        source_type: tipo,
        source_id: sourceId,
        number: p.number,
        amount: p.amount,
        due_date: p.dueDate,
        status: p.status,
        notes: p.notes,
      });
    }
  }

  // Sobras: carnê encurtado, ou parcelamento removido da venda.
  const sobras = atuais.filter((e) => !numerosAlvo.has(e.number));
  if (sobras.length > 0) {
    await supabase.from('payment_installments').delete().in('id', sobras.map((e) => e.id));
  }
}

export async function removerParcelas(tipo: SourceType, sourceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('payment_installments').delete().eq('source_type', tipo).eq('source_id', sourceId);
}
