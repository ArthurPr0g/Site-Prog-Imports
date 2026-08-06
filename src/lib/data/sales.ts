import { createClient } from '@/lib/supabase/server';
import {
  lancamentosDaVenda,
  descricaoDaVenda,
  type Sale,
  type SaleItem,
  type SaleOrigin,
  type SaleStatus,
} from '@/lib/sales';
import { listInstallments, listInstallmentsBySource } from '@/lib/data/installments';
import { listProductCovers } from '@/lib/data/product-covers';
import { dataDeCaixa, type Installment } from '@/lib/installments';

type ItemRow = {
  id: string;
  product_id: string | null;
  stock_item_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
};

type SaleRow = {
  id: string;
  order_number: number;
  name: string;
  customer_id: string | null;
  erp_customer_id: string | null;
  customer_name: string;
  origin: string;
  status: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  cost_total: number;
  budget_id: string | null;
  created_at: string;
  installment_count: number;
  down_payment: number;
  interest_pct: number;
  first_due_date: string | null;
  installment_notes: string;
  address_snapshot: Record<string, string | null> | null;
  order_items: ItemRow[] | null;
  erp_customer: {
    name: string;
    doc: string;
    phone: string;
    cep: string;
    address_line: string;
    address_number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  } | null;
};

function toSale(r: SaleRow, parcelas: Installment[] = [], capas = new Map<string, string>()): Sale {
  return {
    id: r.id,
    orderNumber: r.order_number,
    name: r.name ?? '',
    customerId: r.customer_id,
    erpCustomerId: r.erp_customer_id,
    customerName: r.customer_name,
    origin: r.origin as SaleOrigin,
    status: r.status as SaleStatus,
    paymentMethod: r.payment_method,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    shipping: Number(r.shipping),
    total: Number(r.total),
    costTotal: Number(r.cost_total),
    budgetId: r.budget_id,
    createdAt: r.created_at,
    installmentCount: r.installment_count,
    downPayment: Number(r.down_payment),
    interestPct: Number(r.interest_pct),
    firstDueDate: r.first_due_date,
    installmentNotes: r.installment_notes,
    installments: parcelas,
    shippingAddress: r.address_snapshot
      ? {
          rua: r.address_snapshot.rua,
          complemento: r.address_snapshot.complemento,
          bairro: r.address_snapshot.bairro,
          cidade: r.address_snapshot.cidade,
          cep: r.address_snapshot.cep,
        }
      : null,
    customer: r.erp_customer
      ? {
          name: r.erp_customer.name,
          doc: r.erp_customer.doc,
          phone: r.erp_customer.phone,
          cep: r.erp_customer.cep,
          addressLine: r.erp_customer.address_line,
          addressNumber: r.erp_customer.address_number,
          complement: r.erp_customer.complement,
          district: r.erp_customer.district,
          city: r.erp_customer.city,
          state: r.erp_customer.state,
        }
      : null,
    items: (r.order_items ?? []).map(
      (i): SaleItem => ({
        id: i.id,
        productId: i.product_id,
        stockItemId: i.stock_item_id,
        productName: i.product_name,
        qty: i.qty,
        unitPrice: Number(i.unit_price),
        unitCost: Number(i.unit_cost),
        coverUrl: i.product_id ? capas.get(i.product_id) : undefined,
      })
    ),
  };
}

export async function listSales(): Promise<Sale[]> {
  const supabase = await createClient();
  // O cadastro do cliente vem junto por causa da etiqueta de transporte: é dele
  // que saem documento, telefone e o endereço das vendas lançadas à mão. A
  // chave é nomeada porque `orders` aponta para dois cadastros diferentes
  // (`customer_id` para profiles, `erp_customer_id` para customers).
  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, order_items(*), erp_customer:customers!orders_erp_customer_id_fkey(name, doc, phone, cep, address_line, address_number, complement, district, city, state)'
    )
    .order('created_at', { ascending: false });

  if (error) console.error('[vendas] listagem falhou', error);

  const linhas = (data ?? []) as unknown as SaleRow[];
  // Uma consulta só para o carnê e outra para as capas, em vez de duas por linha.
  const [parcelas, capas] = await Promise.all([
    listInstallmentsBySource('venda', linhas.map((r) => r.id)),
    listProductCovers(linhas.flatMap((r) => (r.order_items ?? []).map((i) => i.product_id))),
  ]);

  return linhas.map((r) => toSale(r, parcelas.get(r.id) ?? [], capas));
}

/** Deixa o Financeiro coerente com a venda: uma receita do total e uma despesa
 *  do custo.
 *
 *  Casa alvo com existente pelo `kind` — uma venda tem no máximo uma linha de
 *  cada tipo. É o que preserva uma baixa manual e evita duplicar a cada
 *  salvamento.
 *
 *  Roda depois de todo salvamento porque valor, custo e status mudam ao longo
 *  da vida da venda. Não é transacional: se o Financeiro falhar, a venda
 *  continua salva e um novo salvamento conserta. */
export async function sincronizarFinanceiroDaVenda(orderId: string): Promise<void> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select('order_number, name, status, total, cost_total, created_at, order_items(product_name, qty)')
    .eq('id', orderId)
    .maybeSingle();

  if (!data) return;

  // O nome entra na descrição do caixa: um extrato de "Venda #1051, Venda
  // #1052, Venda #1053" não diz nada sobre o que foi vendido.
  const descricao = descricaoDaVenda({
    orderNumber: data.order_number,
    name: data.name ?? '',
    items: (data.order_items ?? []).map((i) => ({ productName: i.product_name, qty: i.qty })),
  });

  const alvos = lancamentosDaVenda({
    orderNumber: data.order_number,
    descricao,
    status: data.status as SaleStatus,
    total: Number(data.total),
    costTotal: Number(data.cost_total),
    createdAt: data.created_at,
  });

  // Com PIX parcelado, as PARCELAS são a receita: uma linha por parcela, em vez
  // de uma receita única do total. É o que faz o fluxo de caixa mostrar o
  // dinheiro entrando mês a mês, e o que impede o valor cheio de contar como
  // recebido no dia da venda.
  const parcelas = await listInstallments('venda', orderId);
  const receitas: LinhaFinanceira[] =
    parcelas.length > 0
      ? parcelas
          .filter((p) => p.status !== 'Cancelada')
          .map((p) => ({
            chave: `receita:${p.number}`,
            kind: 'receita' as const,
            description: `${descricao} (${p.number === 0 ? 'entrada' : `parcela ${p.number}`})`,
            amount: p.amount,
            // Recebida entra no dia em que o dinheiro entrou; pendente, no dia
            // em que é esperado. Usar sempre o vencimento arquivava pagamento
            // atrasado no mês errado — e o caixa do mês não se mexia com a baixa.
            entryDate: dataDeCaixa(p),
            // Só "Recebida" vira dinheiro no caixa. Pendente e atrasada seguem
            // Previsto, que é a verdade: o valor ainda não entrou.
            status: p.status === 'Recebida' ? ('Pago' as const) : ('Previsto' as const),
            installmentNumber: p.number,
          }))
      : alvos
          .filter((a) => a.kind === 'receita')
          .map((a) => ({
            chave: 'receita',
            kind: a.kind,
            description: a.description,
            amount: a.amount,
            entryDate: a.entryDate,
            status: a.status,
            installmentNumber: null,
          }));

  const despesas: LinhaFinanceira[] = alvos
    .filter((a) => a.kind === 'despesa')
    .map((a) => ({
      chave: 'despesa',
      kind: a.kind,
      description: a.description,
      amount: a.amount,
      entryDate: a.entryDate,
      status: a.status,
      installmentNumber: null,
    }));

  await aplicarLinhas(supabase, orderId, [...receitas, ...despesas]);
}

type LinhaFinanceira = {
  /** Identidade estável da linha, para casar com o que já existe sem duplicar. */
  chave: string;
  kind: 'receita' | 'despesa';
  description: string;
  amount: number;
  entryDate: string;
  status: 'Pago' | 'Previsto';
  installmentNumber: number | null;
};

/** Escreve as linhas da venda no Financeiro, casando por `chave` e apagando o
 *  que sobrou. Um `installment_id` comum agrupa as parcelas. */
async function aplicarLinhas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  linhas: LinhaFinanceira[]
): Promise<void> {
  const { data: existentes } = await supabase
    .from('finance_entries')
    .select('id, kind, installment_id, installment_number')
    .eq('source', 'venda')
    .eq('reference_id', orderId);

  const atuais = existentes ?? [];
  const chaveDe = (e: { kind: string; installment_number: number | null }) =>
    e.installment_number === null ? e.kind : `${e.kind}:${e.installment_number}`;

  const porChave = new Map(atuais.map((e) => [chaveDe(e), e]));
  const chavesAlvo = new Set(linhas.map((l) => l.chave));

  // Reusa o agrupamento existente para ele sobreviver a edições.
  const grupo = atuais.find((e) => e.installment_id)?.installment_id ?? crypto.randomUUID();
  const agora = new Date().toISOString();

  for (const l of linhas) {
    const payload = {
      kind: l.kind,
      description: l.description,
      amount: l.amount,
      entry_date: l.entryDate,
      status: l.status,
      source: 'venda' as const,
      reference_id: orderId,
      installment_id: l.installmentNumber === null ? null : grupo,
      installment_number: l.installmentNumber,
      updated_at: agora,
    };

    const existente = porChave.get(l.chave);
    const { error } = existente
      ? await supabase.from('finance_entries').update(payload).eq('id', existente.id)
      : await supabase.from('finance_entries').insert(payload);

    // Falha aqui era engolida em silêncio, e foi assim que a entrada do
    // parcelamento sumiu do caixa sem nada indicar o motivo: o check da coluna
    // recusava a parcela 0. Registrar não conserta, mas o próximo problema
    // aparece no log em vez de virar um número errado na tela.
    if (error) {
      console.error('[financeiro/venda] linha não gravada', { orderId, chave: l.chave, error });
    }
  }

  const sobras = atuais.filter((e) => !chavesAlvo.has(chaveDe(e)));
  if (sobras.length > 0) {
    await supabase.from('finance_entries').delete().in('id', sobras.map((e) => e.id));
  }
}

/** Apaga os lançamentos junto com a venda: a tela do Financeiro recusa excluir
 *  linha de origem 'venda', então a ordem inversa deixaria as linhas órfãs e
 *  impossíveis de remover pela interface. */
export async function removerFinanceiroDaVenda(orderId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('finance_entries').delete().eq('source', 'venda').eq('reference_id', orderId);
}
