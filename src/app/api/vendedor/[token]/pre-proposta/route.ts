import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { dbDoAtendente } from '@/lib/atendente/db';
import { tabelaBRL, TABELA_USD } from '@/lib/precos-captacao';
import type { Escolha } from '@/lib/simulador';
import { PrePropostaDocument } from '@/lib/pdf/pre-proposta';
import { montarPreProposta } from '@/lib/pdf/montar-pre-proposta';
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
  const pre = montarPreProposta(e, tabela, prazos, { cliente, vendedor: kit.seller_name });
  if (!pre) return new Response('Pacote sem preço no catálogo', { status: 400 });

  const buffer = await renderToBuffer(PrePropostaDocument(pre.dados));
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDispositionDoPdf(pre.nomeDoArquivo),
      'Cache-Control': 'no-store',
    },
  });
}
