// Testa as regras novas contra o codigo REAL (importado, nao copiado):
// nome da venda, conferencia do carne e parcelas com origem.

import { nomeDaVenda, etiquetaDaVenda, descricaoDaVenda, lancamentosDaVenda } from '@/lib/sales';
import { somaDoCarne, divergenciaDoCarne, calcularParcelamento, gerarParcelas } from '@/lib/installments';
import { parcelasComOrigem } from '@/lib/customer-history';
import type { Installment } from '@/lib/installments';
import type { HistoricoDoCliente } from '@/lib/customer-history';

let falhas = 0;
let total = 0;

function ok(nome: string, real: unknown, esperado: unknown) {
  total++;
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a !== b) {
    falhas++;
    console.log(`FALHOU  ${nome}\n        real     ${a}\n        esperado ${b}`);
  } else {
    console.log(`ok      ${nome}  ${a}`);
  }
}

const item = (productName: string, qty = 1) => ({ productName, qty });

// --- nome da venda ---------------------------------------------------------
ok('apelido vence os itens', nomeDaVenda({ name: 'Troca do Joao', items: [item('iPhone 15')] }), 'Troca do Joao');
ok('apelido so de espacos e ignorado', nomeDaVenda({ name: '   ', items: [item('iPhone 15')] }), 'iPhone 15');
ok('um item', nomeDaVenda({ items: [item('iPhone 15 Pro')] }), 'iPhone 15 Pro');
ok('um item com quantidade', nomeDaVenda({ items: [item('Capa', 3)] }), '3× Capa');
ok('varios itens contam o resto', nomeDaVenda({ items: [item('iPhone 15'), item('Capa'), item('Pelicula')] }), 'iPhone 15 +2');
ok('sem itens fica vazio', nomeDaVenda({ items: [] }), '');
ok('item so com espaco nao conta', nomeDaVenda({ items: [item('  ')] }), '');

ok('etiqueta com nome', etiquetaDaVenda({ orderNumber: 1051, items: [item('iPhone 15')] }), '#1051 · iPhone 15');
ok('etiqueta sem nome cai no numero', etiquetaDaVenda({ orderNumber: 1051, items: [] }), 'Venda #1051');

ok('descricao no financeiro', descricaoDaVenda({ orderNumber: 1051, items: [item('iPhone 15')] }), 'Venda #1051 — iPhone 15');
ok('descricao sem nome', descricaoDaVenda({ orderNumber: 1051, items: [] }), 'Venda #1051');
ok(
  'nome longo e cortado',
  descricaoDaVenda({ orderNumber: 7, name: 'x'.repeat(80), items: [] }),
  `Venda #7 — ${'x'.repeat(45)}…`
);

// A descricao chega pronta nos lancamentos, inclusive na despesa.
const lanc = lancamentosDaVenda({
  orderNumber: 1051,
  descricao: 'Venda #1051 — iPhone 15',
  status: 'Pago',
  total: 3000,
  costTotal: 2000,
  createdAt: '2026-08-05T10:00:00Z',
});
ok('receita usa a descricao', lanc[0].description, 'Venda #1051 — iPhone 15');
ok('despesa deriva da mesma descricao', lanc[1].description, 'Custo da venda #1051 — iPhone 15');
ok('sem descricao volta ao padrao', lancamentosDaVenda({ orderNumber: 9, status: 'Pago', total: 10, costTotal: 5, createdAt: '2026-08-05' })[1].description, 'Custo da venda #9');

// --- conferencia do carne --------------------------------------------------
const parcela = (n: number, amount: number, status: Installment['status'] = 'Pendente'): Installment => ({
  id: `p${n}`,
  number: n,
  amount,
  dueDate: `2026-0${n + 1}-10`,
  status,
  notes: '',
});

const carne = [parcela(1, 1000), parcela(2, 1000), parcela(3, 1000)];
ok('soma do carne', somaDoCarne(carne), 3000);
ok('cancelada nao soma', somaDoCarne([...carne, parcela(4, 500, 'Cancelada')]), 3000);
ok('carne fechado', divergenciaDoCarne(carne, 3000), 0);
// Poeira de ponto flutuante nao vira aviso, mas um centavo de verdade vira:
// o carne gerado ja fecha no centavo, entao um centavo sobrando e edicao.
ok('poeira de float nao acusa', divergenciaDoCarne(carne, 3000.0000001), 0);
ok('um centavo acusa', divergenciaDoCarne(carne, 3000.01), -0.01);
ok('sobra e positiva', divergenciaDoCarne(carne, 2500), 500);
ok('falta e negativa', divergenciaDoCarne(carne, 3500), -500);

// O caso que motivou o aviso: o dono edita uma parcela e o carne para de fechar.
const editado = [parcela(1, 1200), parcela(2, 1000), parcela(3, 1000)];
ok('edicao manual acusa divergencia', divergenciaDoCarne(editado, 3000), 200);

// E o caso de excluir uma parcela.
ok('exclusao acusa falta', divergenciaDoCarne([parcela(1, 1000), parcela(2, 1000)], 3000), -1000);

// Com juros, o carne fecha contra total + juros, nao contra o total puro.
const condicoes = { total: 3000, parcelas: 3, entrada: 0, jurosPct: 10, primeiroVencimento: '2026-09-10' };
const resumo = calcularParcelamento(condicoes);
const geradas = gerarParcelas(condicoes);
ok('carne gerado fecha com total mais juros', divergenciaDoCarne(geradas, resumo.totalComJuros), 0);
ok('carne gerado NAO fecha com o total puro', divergenciaDoCarne(geradas, 3000), 300);

// Arredondamento: 1000 em 3x sobra centavo na ultima e ainda fecha.
const tres = gerarParcelas({ total: 1000, parcelas: 3, entrada: 0, jurosPct: 0, primeiroVencimento: '2026-09-10' });
ok('sobra de centavo continua fechando', divergenciaDoCarne(tres, 1000), 0);

// Com entrada, a parcela 0 conta na soma.
const comEntrada = gerarParcelas({ total: 1000, parcelas: 2, entrada: 200, jurosPct: 0, primeiroVencimento: '2026-09-10' });
ok('entrada entra na soma', somaDoCarne(comEntrada), 1000);

// --- parcelas com origem ---------------------------------------------------
const historico: HistoricoDoCliente = {
  compras: [
    {
      id: 'v1',
      orderNumber: 1051,
      nome: 'iPhone 15',
      apelidada: false,
      data: '2026-08-01',
      itens: 'iPhone 15',
      origem: 'Manual',
      status: 'Pago',
      total: 3000,
      parcelas: [parcela(1, 1500), parcela(2, 1500)],
    },
    {
      id: 'v2',
      orderNumber: 1052,
      nome: 'nao deve aparecer',
      apelidada: false,
      data: '2026-08-02',
      itens: '—',
      origem: 'Manual',
      status: 'Cancelado',
      total: 100,
      parcelas: [{ ...parcela(1, 100), id: 'cancelada' }],
    },
  ],
  servicos: [
    {
      id: 's1',
      titulo: 'Site institucional',
      status: 'Em andamento',
      pagamento: 'Pendente',
      inicio: '2026-07-01',
      entrega: null,
      total: 2000,
      mensal: 0,
      planoMeses: null,
      parcelas: [{ ...parcela(1, 2000), id: 'sp1', dueDate: '2026-01-10' }],
    },
  ],
  orcamentos: [],
  emTransporte: [],
};

const linhas = parcelasComOrigem(historico);
ok('venda cancelada fica de fora', linhas.length, 3);
ok('ordenado por vencimento', linhas.map((l) => l.parcela.dueDate), ['2026-01-10', '2026-02-10', '2026-03-10']);
ok('origem do servico e o titulo', linhas[0].origem, 'Site institucional');
ok('origem da venda leva numero e nome', linhas[1].origem, '#1051 · iPhone 15');
ok('total do grupo e por origem', [linhas[0].totalDoGrupo, linhas[1].totalDoGrupo], [1, 2]);

// Venda sem nome nenhum ainda diz de onde veio.
const semNome = parcelasComOrigem({
  ...historico,
  servicos: [],
  compras: [{ ...historico.compras[0], nome: '' }],
});
ok('venda sem nome cai no numero', semNome[0].origem, 'Venda #1051');

console.log(`\n${total - falhas}/${total} asserções passaram`);
process.exit(falhas === 0 ? 0 : 1);
