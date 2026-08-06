import { createClient } from '@/lib/supabase/server';
import { listInstallmentsBySource } from '@/lib/data/installments';
import { nomeDaVenda } from '@/lib/sales';
import type { Installment } from '@/lib/installments';
import type {
  HistoricoDoCliente,
  CompraDoCliente,
  ServicoDoCliente,
  OrcamentoDoCliente,
  ItemEmTransporte,
} from '@/lib/customer-history';

/** Status de estoque que significam "ainda a caminho ou reservado para ele". */
const EM_TRANSPORTE = ['Comprado', 'Em trânsito', 'Reservado'];

/** Tudo o que o cliente tem com a loja.
 *
 *  As vendas são buscadas por `erp_customer_id` E por `customer_id`: a coluna
 *  do ERP é nova, e vendas antigas do site só têm o vínculo com `profiles`.
 *  Buscar pelos dois evita que o histórico apareça pela metade enquanto o
 *  cadastro não estiver todo ligado. */
export async function carregarHistoricoDoCliente(
  customerId: string,
  profileId: string | null
): Promise<HistoricoDoCliente> {
  const supabase = await createClient();

  const filtroVendas = profileId
    ? `erp_customer_id.eq.${customerId},customer_id.eq.${profileId}`
    : `erp_customer_id.eq.${customerId}`;

  const [vendas, servicos, orcLoja, orcServicos, estoque] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, name, created_at, origin, status, total, order_items(product_name, qty)')
      .or(filtroVendas)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_orders')
      .select('id, title, status, payment_status, start_date, due_date, total_amount, monthly_amount, plan_months')
      .eq('customer_id', customerId)
      .order('start_date', { ascending: false }),
    supabase
      .from('store_quotes')
      .select('id, name, status, created_at, sale_price_brl')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_quotes')
      .select('id, title, status, created_at, total_amount, monthly_amount, plan_months')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('stock_items')
      .select('id, name, status, entry_date')
      .eq('reserved_customer_id', customerId)
      .in('status', EM_TRANSPORTE),
  ]);

  const linhasVenda = vendas.data ?? [];
  const linhasServico = servicos.data ?? [];

  const [parcelasVenda, parcelasServico] = await Promise.all([
    listInstallmentsBySource('venda', linhasVenda.map((v) => v.id)),
    listInstallmentsBySource('servico', linhasServico.map((s) => s.id)),
  ]);

  const compras: CompraDoCliente[] = linhasVenda.map((v) => ({
    id: v.id,
    orderNumber: v.order_number,
    nome: nomeDaVenda({
      name: v.name ?? '',
      items: (v.order_items ?? []).map((i) => ({ productName: i.product_name, qty: i.qty })),
    }),
    apelidada: !!(v.name ?? '').trim(),
    data: v.created_at,
    itens:
      (v.order_items ?? [])
        .map((i) => (i.qty > 1 ? `${i.qty}× ${i.product_name}` : i.product_name))
        .join(' + ') || '—',
    origem: v.origin,
    status: v.status,
    total: Number(v.total),
    parcelas: parcelasVenda.get(v.id) ?? [],
  }));

  const servicosDoCliente: ServicoDoCliente[] = linhasServico.map((s) => ({
    id: s.id,
    titulo: s.title,
    status: s.status,
    pagamento: s.payment_status,
    inicio: s.start_date,
    entrega: s.due_date,
    total: Number(s.total_amount),
    mensal: Number(s.monthly_amount),
    planoMeses: s.plan_months,
    parcelas: parcelasServico.get(s.id) ?? [],
  }));

  const orcamentos: OrcamentoDoCliente[] = [
    ...(orcLoja.data ?? []).map(
      (q): OrcamentoDoCliente => ({
        id: q.id,
        tipo: 'Loja',
        titulo: q.name,
        status: q.status,
        criadoEm: q.created_at,
        valor: Number(q.sale_price_brl),
      })
    ),
    ...(orcServicos.data ?? []).map(
      (q): OrcamentoDoCliente => ({
        id: q.id,
        tipo: 'Serviços',
        titulo: q.title,
        status: q.status,
        criadoEm: q.created_at,
        // Valor de contrato, para o orçamento de serviço não parecer menor do
        // que é só por ter a maior parte na mensalidade.
        valor: Number(q.total_amount) + Number(q.monthly_amount) * (q.plan_months ?? 0),
      })
    ),
  ].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  const emTransporte: ItemEmTransporte[] = (estoque.data ?? []).map((i) => ({
    id: i.id,
    nome: i.name,
    status: i.status,
    entrada: i.entry_date,
  }));

  return { compras, servicos: servicosDoCliente, orcamentos, emTransporte };
}

/** Parcelas em aberto de todos os clientes de uma vez, para as listagens
 *  mostrarem o selo de adimplência sem uma consulta por linha. */
export async function carregarParcelasPorCliente(): Promise<Map<string, Installment[]>> {
  const supabase = await createClient();

  const [vendas, servicos] = await Promise.all([
    supabase.from('orders').select('id, erp_customer_id, customer_id, status').not('status', 'eq', 'Cancelado'),
    supabase.from('service_orders').select('id, customer_id, status').not('status', 'eq', 'Cancelada'),
  ]);

  const { data: perfis } = await supabase.from('customers').select('id, profile_id');
  const clientePorProfile = new Map(
    (perfis ?? []).filter((c) => c.profile_id).map((c) => [c.profile_id as string, c.id])
  );

  // Origem de cada carnê: id da venda/prestação → cliente do ERP.
  const clienteDaVenda = new Map<string, string>();
  for (const v of vendas.data ?? []) {
    const cliente = v.erp_customer_id ?? (v.customer_id ? clientePorProfile.get(v.customer_id) : null);
    if (cliente) clienteDaVenda.set(v.id, cliente);
  }

  const clienteDoServico = new Map<string, string>();
  for (const s of servicos.data ?? []) {
    if (s.customer_id) clienteDoServico.set(s.id, s.customer_id);
  }

  const [pv, ps] = await Promise.all([
    listInstallmentsBySource('venda', [...clienteDaVenda.keys()]),
    listInstallmentsBySource('servico', [...clienteDoServico.keys()]),
  ]);

  const porCliente = new Map<string, Installment[]>();
  const acrescentar = (clienteId: string, lista: Installment[]) => {
    const atual = porCliente.get(clienteId) ?? [];
    atual.push(...lista);
    porCliente.set(clienteId, atual);
  };

  for (const [vendaId, clienteId] of clienteDaVenda) acrescentar(clienteId, pv.get(vendaId) ?? []);
  for (const [servicoId, clienteId] of clienteDoServico) acrescentar(clienteId, ps.get(servicoId) ?? []);

  return porCliente;
}
