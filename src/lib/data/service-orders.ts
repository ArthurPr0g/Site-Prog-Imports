import { createClient } from '@/lib/supabase/server';
import {
  lancamentosDaPrestacao,
  type BillingType,
  type ServiceOrder,
  type ServiceOrderItem,
  type ServiceOrderStatus,
  type ServicePaymentStatus,
} from '@/lib/services';
import type { Desconto } from '@/lib/discount';
import { listInstallments, listInstallmentsBySource } from '@/lib/data/installments';
import { OFFSET_PARCELA_PIX, dataDeCaixa, type Installment } from '@/lib/installments';

type ItemRow = {
  id: string;
  internal_service_id: string | null;
  name: string;
  description: string;
  amount: number;
  billing_type: string;
  lead_time_days: number;
  position: number;
};

type OrderRow = {
  id: string;
  customer_id: string | null;
  quote_id: string | null;
  title: string;
  notes: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  monthly_amount: number;
  discount_type: string;
  discount_value: number;
  discount_note: string;
  plan_months: number | null;
  plan_start_date: string | null;
  installment_count: number;
  down_payment: number;
  interest_pct: number;
  first_due_date: string | null;
  installment_notes: string;
  lead_time_days: number;
  start_date: string;
  due_date: string | null;
  customers: { name: string } | null;
  service_order_items: ItemRow[] | null;
};

function toItem(r: ItemRow): ServiceOrderItem {
  return {
    id: r.id,
    internalServiceId: r.internal_service_id,
    name: r.name,
    description: r.description,
    amount: Number(r.amount),
    billingType: r.billing_type as BillingType,
    leadTimeDays: r.lead_time_days,
  };
}

function toOrder(r: OrderRow, parcelas: Installment[] = []): ServiceOrder {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customers?.name ?? '',
    quoteId: r.quote_id,
    title: r.title,
    notes: r.notes,
    status: r.status as ServiceOrderStatus,
    paymentStatus: r.payment_status as ServicePaymentStatus,
    paymentMethod: r.payment_method,
    totalAmount: Number(r.total_amount),
    monthlyAmount: Number(r.monthly_amount),
    desconto: {
      tipo: r.discount_type as Desconto['tipo'],
      valor: Number(r.discount_value),
      descricao: r.discount_note ?? '',
    },
    planMonths: r.plan_months,
    planStartDate: r.plan_start_date,
    installmentCount: r.installment_count,
    downPayment: Number(r.down_payment),
    interestPct: Number(r.interest_pct),
    firstDueDate: r.first_due_date,
    installmentNotes: r.installment_notes,
    installments: parcelas,
    leadTimeDays: r.lead_time_days,
    startDate: r.start_date,
    dueDate: r.due_date,
    items: (r.service_order_items ?? []).sort((a, b) => a.position - b.position).map(toItem),
  };
}

export async function listServiceOrders(): Promise<ServiceOrder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_orders')
    .select('*, customers(name), service_order_items(*)')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false });

  const linhas = (data ?? []) as unknown as OrderRow[];
  const parcelas = await listInstallmentsBySource('servico', linhas.map((r) => r.id));

  return linhas.map((r) => toOrder(r, parcelas.get(r.id) ?? []));
}

/** Deixa o Financeiro coerente com a prestação: cria, atualiza ou remove os
 *  lançamentos que a representam — um do trabalho e uma parcela por mês do
 *  plano.
 *
 *  Roda depois de todo salvamento em vez de na criação apenas, porque os
 *  lançamentos dependem de campos que mudam ao longo da vida da prestação —
 *  valor, prazo, status, pagamento e duração do plano.
 *
 *  **Preserva o status das parcelas já baixadas.** Casar alvo com existente
 *  pelo NÚMERO da parcela é o que torna isso possível: sem esse casamento, a
 *  única saída seria apagar e recriar, e as parcelas que o dono marcou como
 *  recebidas voltariam para Previsto — o caixa perderia meses de recebimento
 *  por causa de uma correção de título. O lançamento do trabalho é a exceção:
 *  o status dele vem do `payment_status` da prestação, que é onde o dono o
 *  controla.
 *
 *  Não é transacional: se o Financeiro falhar, a prestação continua salva e um
 *  novo salvamento conserta. */
export async function sincronizarFinanceiroDaPrestacao(orderId: string): Promise<void> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('service_orders')
    .select(
      'title, status, payment_status, total_amount, monthly_amount, plan_months, plan_start_date, start_date, due_date, discount_type, discount_value, discount_note'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!data) return;

  const alvos = lancamentosDaPrestacao({
    title: data.title,
    status: data.status as ServiceOrderStatus,
    paymentStatus: data.payment_status as ServicePaymentStatus,
    totalAmount: Number(data.total_amount),
    monthlyAmount: Number(data.monthly_amount),
    planMonths: data.plan_months,
    planStartDate: data.plan_start_date,
    startDate: data.start_date,
    dueDate: data.due_date,
    desconto: {
      tipo: data.discount_type as Desconto['tipo'],
      valor: Number(data.discount_value),
      descricao: data.discount_note,
    },
  });

  // Com PIX parcelado, o TRABALHO vira um carnê: as parcelas substituem a
  // receita única. As mensalidades do plano continuam intactas — são coisas
  // diferentes e podem coexistir na mesma prestação.
  const parcelasPix = await listInstallments('servico', orderId);
  const alvosFinais =
    parcelasPix.length > 0
      ? [
          ...alvos.filter((a) => a.parcela !== null),
          ...parcelasPix
            .filter((p) => p.status !== 'Cancelada')
            .map((p) => ({
              // Faixa deslocada para não colidir com as mensalidades do plano.
              parcela: OFFSET_PARCELA_PIX + p.number,
              amount: p.amount,
              status: p.status === 'Recebida' ? ('Pago' as const) : ('Previsto' as const),
              description: `Serviço: ${data.title} — ${p.number === 0 ? 'entrada' : `parcela ${p.number}`}`,
              // Mesma regra da venda: recebida entra no dia do recebimento,
              // pendente no dia do vencimento.
              entryDate: dataDeCaixa(p),
            })),
        ]
      : alvos;

  const { data: existentes } = await supabase
    .from('finance_entries')
    .select('id, installment_id, installment_number, status')
    .eq('source', 'servico')
    .eq('reference_id', orderId);

  const atuais = existentes ?? [];
  const porNumero = new Map(atuais.map((e) => [e.installment_number ?? 0, e]));

  // As parcelas do PIX têm status próprio, vindo do carnê — ao contrário das
  // mensalidades, que o dono baixa direto no Financeiro.
  const ehParcelaPix = (n: number | null) => n !== null && n >= OFFSET_PARCELA_PIX;

  // Todas as parcelas de um plano compartilham o mesmo installment_id. Reusa o
  // que já existe para o agrupamento sobreviver a edições.
  const grupoExistente = atuais.find((e) => e.installment_id)?.installment_id ?? null;
  const grupo = alvosFinais.some((a) => a.parcela !== null)
    ? grupoExistente ?? crypto.randomUUID()
    : null;

  const agora = new Date().toISOString();
  const numerosAlvo = new Set<number>();

  for (const alvo of alvosFinais) {
    const chave = alvo.parcela ?? 0;
    numerosAlvo.add(chave);
    const existente = porNumero.get(chave);

    const payload = {
      kind: 'receita' as const,
      description: alvo.description,
      amount: alvo.amount,
      entry_date: alvo.entryDate,
      source: 'servico' as const,
      reference_id: orderId,
      installment_id: alvo.parcela === null ? null : grupo,
      installment_number: alvo.parcela,
      updated_at: agora,
    };

    // Mensalidade do plano mantém o status que tiver: quem a baixou foi o dono,
    // mês a mês, direto no Financeiro. Já a parcela do PIX tem o status vindo
    // do carnê, e o trabalho segue o payment_status da prestação.
    const status =
      existente && alvo.parcela !== null && !ehParcelaPix(alvo.parcela) ? existente.status : alvo.status;

    const { error } = existente
      ? await supabase.from('finance_entries').update({ ...payload, status }).eq('id', existente.id)
      : await supabase.from('finance_entries').insert({ ...payload, status });

    if (error) {
      console.error('[financeiro/servico] linha não gravada', { orderId, parcela: alvo.parcela, error });
    }
  }

  // Sobras: plano encurtado de 24 para 12 meses, ou prestação cancelada.
  const sobras = atuais.filter((e) => !numerosAlvo.has(e.installment_number ?? 0));
  if (sobras.length > 0) {
    await supabase.from('finance_entries').delete().in('id', sobras.map((e) => e.id));
  }
}

/** Apaga os lançamentos junto com a prestação. Sem isso, o caixa continuaria
 *  afirmando receitas cuja origem não existe mais — e a tela do Financeiro
 *  recusaria a exclusão, deixando as linhas órfãs para sempre. */
export async function removerFinanceiroDaPrestacao(orderId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('finance_entries').delete().eq('source', 'servico').eq('reference_id', orderId);
}
