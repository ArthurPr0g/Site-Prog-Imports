import { createClient } from '@/lib/supabase/server';

// Dados do Painel (/admin). Vem tudo de uma vez e cru: a troca de período
// (7 dias, 30, 90, 12 meses) acontece no navegador, sem ida ao servidor a cada
// clique. O volume é de uma loja pequena — centenas de linhas por ano.
//
// O dinheiro sai do Financeiro, não das vendas: é lá que estão as parcelas do
// PIX parcelado, as mensalidades e a compra de estoque na data certa. Somar
// `orders.total` diria que entrou uma venda inteira no dia em que ela foi
// fechada, e o caixa da Prog não funciona assim.

export type LancamentoPainel = {
  tipo: 'receita' | 'despesa';
  valor: number;
  data: string; // AAAA-MM-DD
  pago: boolean;
  origem: string;
  descricao: string;
};

export type VendaPainel = {
  numero: number;
  nome: string;
  cliente: string;
  total: number;
  data: string;
  pagamento: string;
  semCusto: boolean;
};

export type AtividadePainel = {
  tipo: 'venda' | 'estoque' | 'prestacao' | 'cliente' | 'orcamento';
  titulo: string;
  detalhe: string;
  valor: number | null;
  quando: string; // ISO
  href: string;
};

export type PainelDados = {
  hoje: string;
  lancamentos: LancamentoPainel[];
  vendas: VendaPainel[];
  estoque: { disponiveis: number; investido: number; parados: { nome: string; dias: number }[] };
  prestacoesAbertas: number;
  clientes: number;
  produtosSemFoto: number;
  atividade: AtividadePainel[];
};

/** Hoje no fuso da loja. A Vercel roda em UTC: depois das 21h o "hoje" do
 *  servidor já seria amanhã, e o painel marcaria parcela de hoje como atrasada. */
export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86_400_000);

export async function getPainel(): Promise<PainelDados> {
  const supabase = await createClient();
  const hoje = hojeEmSaoPaulo();

  const [fin, ord, est, prest, cli, prod, orc] = await Promise.all([
    supabase.from('finance_entries').select('kind, amount, entry_date, status, source, description'),
    supabase
      .from('orders')
      .select('order_number, name, customer_name, total, cost_total, status, payment_method, sale_date, created_at, order_items(product_name, qty)')
      .neq('status', 'Cancelado')
      .order('created_at', { ascending: false }),
    supabase.from('stock_items').select('name, status, paid_amount, entry_date, created_at').order('created_at', { ascending: false }),
    supabase
      .from('service_orders')
      .select('title, status, total_amount, created_at, customers(name)')
      .order('created_at', { ascending: false }),
    supabase.from('customers').select('name, created_at').order('created_at', { ascending: false }),
    supabase.from('products').select('active, product_images(url)').eq('active', true),
    supabase.from('store_quotes').select('name, status, created_at, customers(name)').order('created_at', { ascending: false }).limit(5),
  ]);

  const lancamentos: LancamentoPainel[] = (fin.data ?? []).map((f) => ({
    tipo: f.kind === 'despesa' ? 'despesa' : 'receita',
    valor: Number(f.amount),
    data: f.entry_date,
    pago: f.status === 'Pago',
    origem: f.source ?? 'manual',
    descricao: f.description ?? '',
  }));

  const pedidos = ord.data ?? [];
  const vendas: VendaPainel[] = pedidos.map((o) => ({
    numero: o.order_number,
    nome: o.name || nomeDosItens(o.order_items ?? []) || `Venda #${o.order_number}`,
    cliente: o.customer_name ?? '',
    total: Number(o.total),
    data: o.sale_date ?? String(o.created_at).slice(0, 10),
    pagamento: o.payment_method ?? '',
    semCusto: !Number(o.cost_total),
  }));

  const itens = est.data ?? [];
  const disponiveis = itens.filter((i) => i.status === 'Disponível');
  const estoque = {
    disponiveis: disponiveis.length,
    investido: disponiveis.reduce((a, i) => a + Number(i.paid_amount ?? 0), 0),
    // Dinheiro parado: unidade em mãos há mais de 60 dias
    parados: disponiveis
      .map((i) => ({ nome: i.name, dias: diasEntre(i.entry_date ?? String(i.created_at).slice(0, 10), hoje) }))
      .filter((i) => i.dias > 60)
      .sort((a, b) => b.dias - a.dias),
  };

  const prestacoes = prest.data ?? [];
  const clientes = cli.data ?? [];

  // Linha do tempo: o que aconteceu por último em cada módulo, misturado por data
  const atividade: AtividadePainel[] = [
    ...pedidos.slice(0, 6).map((o) => ({
      tipo: 'venda' as const,
      titulo: `Venda #${o.order_number} · ${o.name || nomeDosItens(o.order_items ?? [])}`,
      detalhe: [o.customer_name || 'Sem cliente', o.payment_method].filter(Boolean).join(' · '),
      valor: Number(o.total),
      quando: o.created_at,
      href: '/admin/vendas',
    })),
    ...itens.slice(0, 6).map((i) => ({
      tipo: 'estoque' as const,
      titulo: `Chegou: ${i.name}`,
      detalhe: i.status,
      valor: i.paid_amount == null ? null : Number(i.paid_amount),
      quando: i.created_at,
      href: '/admin/estoque',
    })),
    ...prestacoes.slice(0, 6).map((s) => ({
      tipo: 'prestacao' as const,
      titulo: s.title,
      detalhe: [nomeDoCliente(s.customers), s.status].filter(Boolean).join(' · '),
      valor: s.total_amount == null ? null : Number(s.total_amount),
      quando: s.created_at,
      href: '/admin/prestacao-servico',
    })),
    ...(orc.data ?? []).map((q) => ({
      tipo: 'orcamento' as const,
      titulo: `Orçamento · ${q.name}`,
      detalhe: [nomeDoCliente(q.customers), q.status].filter(Boolean).join(' · '),
      valor: null,
      quando: q.created_at,
      href: '/admin/orcamentos-loja',
    })),
    ...clientes.slice(0, 6).map((c) => ({
      tipo: 'cliente' as const,
      titulo: `Novo cliente · ${c.name}`,
      detalhe: 'Cadastro',
      valor: null,
      quando: c.created_at,
      href: '/admin/clientes',
    })),
  ]
    .filter((a) => a.quando)
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice(0, 7);

  return {
    hoje,
    lancamentos,
    vendas,
    estoque,
    prestacoesAbertas: prestacoes.filter((s) => s.status !== 'Concluída' && s.status !== 'Cancelada').length,
    clientes: clientes.length,
    produtosSemFoto: (prod.data ?? []).filter((p) => !(p.product_images ?? []).some((img) => img.url)).length,
    atividade,
  };
}

function nomeDosItens(itens: { product_name: string; qty: number }[]): string {
  if (!itens.length) return '';
  return itens.length > 1 ? `${itens[0].product_name} +${itens.length - 1}` : itens[0].product_name;
}

// O join volta como objeto ou lista dependendo de como o Supabase lê a relação
function nomeDoCliente(c: unknown): string {
  const um = Array.isArray(c) ? c[0] : c;
  return (um as { name?: string } | null)?.name ?? '';
}
