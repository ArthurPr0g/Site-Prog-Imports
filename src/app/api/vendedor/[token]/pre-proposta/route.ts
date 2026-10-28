import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { dbDoAtendente } from '@/lib/atendente/db';
import { calcularProposta } from '@/lib/atendente/regras';
import { tabelaBRL, TABELA_USD, formatMoeda } from '@/lib/precos-captacao';
import { parcela, NOMES, type Escolha } from '@/lib/simulador';
import { GUIA_DO_PRODUTO, GUIA_DA_MARCA } from '@/lib/guia-dos-pacotes';
import { PrePropostaDocument } from '@/lib/pdf/pre-proposta';
import { contentDispositionDoPdf } from '@/lib/pdf/nome-arquivo';

// Pré-proposta em PDF do simulador da página do vendedor (V6). Quem tem o link
// do vendedor não tem conta: o token do link (ativo) é a autorização, como nas
// funções lead_kit_*. Preços e prazos do retrato do catálogo guardado no link.

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nivel = (v: unknown) => (v === 1 || v === 2 ? v : 0) as 0 | 1 | 2;

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!UUID.test(token)) return new Response('Link inválido', { status: 404 });
  const p = req.nextUrl.searchParams;

  let bruto: Partial<Escolha>;
  try {
    bruto = JSON.parse(p.get('e') ?? '{}');
  } catch {
    return new Response('Escolha inválida', { status: 400 });
  }
  const produto = (['site', 'loja', 'erp'] as const).includes(bruto.produto as 'site') ? bruto.produto! : 'site';
  const e: Escolha = {
    produto,
    nivel: nivel(bruto.nivel),
    comGestao: !!bruto.comGestao && produto !== 'erp',
    nivelGestao: nivel(bruto.nivelGestao),
    marca: ([1, 2, 3].includes(Number(bruto.marca)) ? Number(bruto.marca) : 0) as Escolha['marca'],
  };
  const moeda = p.get('moeda') === 'USD' ? 'USD' : 'BRL';

  const db = dbDoAtendente();
  const { data: kit } = await db.from('lead_seller_kits').select('id, seller_name, catalog, active').eq('token', token).maybeSingle();
  if (!kit?.active) return new Response('Link desativado', { status: 404 });

  // Nome do cliente só se o lead é deste link.
  let cliente: string | null = null;
  const leadId = p.get('lead');
  if (leadId && UUID.test(leadId)) {
    const { data: item } = await db.from('lead_kit_items').select('leads(name)').match({ kit_id: kit.id, lead_id: leadId }).maybeSingle();
    cliente = item?.leads?.name ?? null;
  }

  const catalogo = (kit.catalog ?? []) as { nome: string; preco: number; prazoDias?: number }[];
  const tabela = moeda === 'USD' ? TABELA_USD : tabelaBRL(new Map(catalogo.map((c) => [c.nome, Number(c.preco)])));
  const prazos = new Map(catalogo.map((c) => [c.nome, Number(c.prazoDias ?? 0)]));
  const r = calcularProposta(e, tabela, 0, prazos);
  if (r.total <= 0) return new Response('Pacote sem preço no catálogo', { status: 400 });

  const m = (v: number) => formatMoeda(v, moeda);
  // O que cada item inclui (guia em português, o mesmo do simulador).
  const guias = [
    GUIA_DO_PRODUTO[e.produto].niveis[e.nivel],
    ...(e.comGestao ? [GUIA_DO_PRODUTO.erp.niveis[e.nivelGestao]] : []),
    ...(e.marca ? [GUIA_DA_MARCA[e.marca - 1]] : []),
  ];
  const itens = r.linhas.map((l, i) => ({ nome: l.nome, valor: m(l.valor), inclui: guias[i]?.inclui ?? [] }));

  const buffer = await renderToBuffer(
    PrePropostaDocument({
      cliente,
      vendedor: kit.seller_name,
      emitidaEm: new Date(),
      validadeDias: 7,
      itens,
      desconto: r.desconto > 0 ? m(r.desconto) : null,
      total: m(r.total),
      aPartirDe: r.aPartirDe,
      mensal: m(r.mensal),
      economiaMensal: r.mensalSeparadas
        ? `Economia de ${m(r.mensalSeparadas - r.mensal)}/mês por contratar junto (separados: ${m(r.mensalSeparadas)}/mês).`
        : null,
      prazoDias: r.prazoDias,
      pagamento:
        moeda === 'USD'
          ? [`50% to start: ${m(r.total / 2)}`, `50% on delivery: ${m(r.total / 2)}`]
          : [
              `Pix ou boleto: ${m(r.total / 2)} no fechamento + ${m(r.total / 2)} na entrega`,
              `Cartão 2x sem juros: 2x de ${m(r.total / 2)}`,
              `Cartão em 12x: 12x de ${m(parcela(r.total, 12))} (com a taxa da operadora)`,
            ],
    })
  );

  const nome = `Pré-proposta Prog Soluções${cliente ? ` - ${cliente}` : ''} - ${NOMES.BRL[e.produto][e.nivel]}`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDispositionDoPdf(nome),
      'Cache-Control': 'no-store',
    },
  });
}
