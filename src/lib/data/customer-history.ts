import { createClient } from '@/lib/supabase/server';
import { listInstallmentsBySource } from '@/lib/data/installments';
import { nomeDaVenda } from '@/lib/sales';
import { OFFSET_PARCELA_PIX, type Installment } from '@/lib/installments';
import {
  mensalidadeComoParcela,
  type HistoricoDoCliente,
  type CompraDoCliente,
  type ServicoDoCliente,
  type OrcamentoDoCliente,
  type ItemEmTransporte,
  type MensalidadeDoCliente,
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
      .select(
        'id, order_number, name, created_at, sale_date, origin, status, total, order_items(product_name, qty)'
      )
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
    // A data da venda, não a do cadastro — o histórico do cliente conta quando
    // ele comprou.
    data: v.sale_date ? `${v.sale_date}T12:00:00` : v.created_at,
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

  const mensalidades = await carregarMensalidades(linhasServico);

  return { compras, servicos: servicosDoCliente, orcamentos, emTransporte, mensalidades };
}

/** Mensalidades do plano, lidas do Financeiro.
 *
 *  Elas não existem em `payment_installments`: o plano nasce direto como
 *  lançamento, um por mês, e é lá que o dono baixa. Aqui elas são lidas de
 *  volta para o cliente ver o que deve — sem isso, um contrato de 12 meses não
 *  aparecia como dívida em lugar nenhum do histórico.
 *
 *  O corte por `OFFSET_PARCELA_PIX` separa as duas coisas que dividem a mesma
 *  coluna: abaixo dele são mensalidades do plano; acima, o carnê do PIX
 *  parcelado, que já vem por outro caminho. */
async function carregarMensalidades(
  servicos: { id: string; title: string; plan_months: number | null; status: string }[]
): Promise<(MensalidadeDoCliente & { servicoId: string })[]> {
  const ativos = servicos.filter((s) => s.status !== 'Cancelada');
  if (ativos.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('finance_entries')
    .select('id, reference_id, installment_number, amount, entry_date, status')
    .eq('source', 'servico')
    .in('reference_id', ativos.map((s) => s.id))
    .not('installment_number', 'is', null)
    .lt('installment_number', OFFSET_PARCELA_PIX)
    .order('entry_date');

  if (error) {
    console.error('[cliente] mensalidades não carregaram', error);
    return [];
  }

  const porId = new Map(ativos.map((s) => [s.id, s]));

  return (data ?? []).map((f) => {
    const servico = porId.get(f.reference_id ?? '');
    return {
      id: f.id,
      servicoId: f.reference_id ?? '',
      servico: servico?.title ?? 'Plano',
      numero: f.installment_number ?? 0,
      totalDeMeses: servico?.plan_months ?? 0,
      valor: Number(f.amount),
      vencimento: f.entry_date,
      paga: f.status === 'Pago',
    };
  });
}

/** Parcelas em aberto de todos os clientes de uma vez, para as listagens
 *  mostrarem o selo de adimplência sem uma consulta por linha. */
export async function carregarParcelasPorCliente(): Promise<Map<string, Installment[]>> {
  const supabase = await createClient();

  const [vendas, servicos] = await Promise.all([
    supabase.from('orders').select('id, erp_customer_id, customer_id, status').not('status', 'eq', 'Cancelado'),
    supabase
      .from('service_orders')
      .select('id, customer_id, status, title, plan_months')
      .not('status', 'eq', 'Cancelada'),
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

  // As mensalidades do plano contam na adimplência como qualquer outra dívida —
  // senão o selo diria "Adimplente" para quem está com hospedagem vencida.
  const mensalidades = await carregarMensalidades(
    (servicos.data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      plan_months: s.plan_months,
      status: s.status,
    }))
  );

  for (const m of mensalidades) {
    const clienteId = clienteDoServico.get(m.servicoId);
    if (clienteId) acrescentar(clienteId, [mensalidadeComoParcela(m)]);
  }

  return porCliente;
}
