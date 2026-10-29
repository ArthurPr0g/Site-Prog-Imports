import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/seo';
import { WHATSAPP_NUMBER } from '@/lib/constants';
import type { Kit } from '@/lib/vendedor';
import { PaginaDoVendedor } from '@/components/vendedor/PaginaDoVendedor';
import { metaDoVendedor } from '@/lib/data/meta-do-vendedor';
import { metadadosProgSolucoes } from '@/lib/prog-solucoes-seo';

// Página do vendedor (link gerado na aba Vendedores da Captação). Sem login:
// quem tem o link lê os leads dele pela função lead_kit; link desativado = 404.
// Fora do índice dos buscadores.

export const metadata: Metadata = metadadosProgSolucoes({
  titulo: 'Área do vendedor · Prog Soluções',
  descricao: 'Seus leads do dia, mensagens prontas, simulador de preços e meta da Captação.',
  tituloDaImagem: 'Área do vendedor',
  subtituloDaImagem: 'Leads, mensagens prontas e simulador da Prog Soluções',
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VendedorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const supabase = await createClient();
  const [{ data }, meta] = await Promise.all([supabase.rpc('lead_kit', { p_token: token }), metaDoVendedor(token)]);
  if (!data) notFound();
  return (
    <PaginaDoVendedor
      kit={data as unknown as Kit}
      token={token}
      origem={SITE_URL}
      whatsArthur={WHATSAPP_NUMBER}
      metaInicial={meta}
    />
  );
}
