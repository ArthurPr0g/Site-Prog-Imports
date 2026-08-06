import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { totalizarItens, type BillingType, type ServiceOrderItem } from '@/lib/services';
import { PropostaDocument } from '@/lib/pdf/proposta';
import type { Desconto } from '@/lib/discount';

// react-pdf precisa do runtime Node: usa APIs de arquivo e fontes que o edge
// não tem.
export const runtime = 'nodejs';

/** Nome de arquivo seguro: acentos e barras viram traço. Sem isso o navegador
 *  pode recusar o download ou salvar com o nome truncado. */
function nomeDoArquivo(titulo: string, numero: string): string {
  const limpo = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `proposta-${numero}-${limpo || 'servicos'}.pdf`;
}

/** Logo em data URI. Falha aqui não impede a proposta de sair — um PDF sem logo
 *  ainda é entregável; um erro 500 na hora de mandar para o cliente, não. */
async function carregarLogo(): Promise<string | undefined> {
  try {
    const arquivo = path.join(process.cwd(), 'public', 'images', 'logo.png');
    const bytes = await readFile(arquivo);
    return `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    return undefined;
  }
}

/** Assinatura do contratado em data URI.
 *
 *  Baixada aqui, no servidor, porque o bucket é privado: o navegador não tem
 *  como ler o arquivo, e é justamente esse o ponto — a assinatura só existe
 *  dentro do PDF que a Prog gera.
 *
 *  Falha não impede o contrato de sair: sem a imagem ele volta a ter a linha em
 *  branco, que é assinável à mão. Um 500 na hora de mandar a proposta, não. */
async function carregarAssinatura(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string
): Promise<string | undefined> {
  if (!path) return undefined;
  try {
    const { data, error } = await supabase.storage.from('signatures').download(path);
    if (error || !data) {
      console.error('[contrato] assinatura não carregou', error);
      return undefined;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    return `data:${data.type || 'image/png'};base64,${bytes.toString('base64')}`;
  } catch (e) {
    console.error('[contrato] assinatura não carregou', e);
    return undefined;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return new Response('Não autorizado', { status: 403 });

  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: q } = await supabase
    .from('service_quotes')
    .select('*, customers(name, doc, email, phone, city), service_quote_items(*)')
    .eq('id', id)
    .maybeSingle();

  if (!q) return new Response('Orçamento não encontrado', { status: 404 });

  const { data: settings } = await supabase.from('site_settings').select('*').maybeSingle();

  const itens: ServiceOrderItem[] = (q.service_quote_items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((i) => ({
      id: i.id,
      internalServiceId: i.internal_service_id,
      name: i.name,
      description: i.description,
      amount: Number(i.amount),
      billingType: i.billing_type as BillingType,
      leadTimeDays: i.lead_time_days,
    }));

  // Recalcula em vez de ler as colunas: garante que o PDF nunca contradiga os
  // itens listados logo acima dele na mesma página.
  const totais = totalizarItens(itens);

  const cliente = q.customers;

  const buffer = await renderToBuffer(
    PropostaDocument({
      // Os 8 primeiros caracteres do uuid bastam para identificar a proposta e
      // cabem no cabeçalho; o id inteiro ficaria ilegível.
      numero: q.id.slice(0, 8).toUpperCase(),
      criadoEm: q.created_at,
      titulo: q.title,
      observacoes: q.notes,
      cliente: {
        nome: cliente?.name ?? '',
        documento: cliente?.doc ?? '',
        email: cliente?.email ?? '',
        telefone: cliente?.phone ?? '',
        cidade: cliente?.city ?? '',
      },
      itens,
      totalUnico: totais.total,
      totalMensal: totais.mensal,
      mesesPlano: q.plan_months,
      prazoDias: totais.prazoDias,
      incluirContrato: q.include_contract,
      clientePossuiDominio: q.client_has_domain,
      desconto: {
        tipo: q.discount_type as Desconto['tipo'],
        valor: Number(q.discount_value),
        descricao: q.discount_note,
      },
      marca: {
        nome: BRAND.name,
        tagline: BRAND.tagline,
        accent: BRAND.accent,
        logo: await carregarLogo(),
      },
      contratado: {
        nome: settings?.contractor_name || BRAND.name,
        documento: settings?.contractor_doc ?? '',
        cargo: settings?.contractor_role ?? '',
        foro: settings?.contract_forum ?? '',
        assinatura: await carregarAssinatura(supabase, settings?.signature_path ?? ''),
      },
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      // inline: abre no visualizador do navegador, de onde dá para conferir
      // antes de mandar e salvar se estiver certo.
      'Content-Disposition': `inline; filename="${nomeDoArquivo(q.title, q.id.slice(0, 8))}"`,
      'Cache-Control': 'no-store',
    },
  });
}
