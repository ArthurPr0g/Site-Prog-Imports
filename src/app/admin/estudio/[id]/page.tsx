import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EditorDePeca } from '@/components/estudio/EditorDePeca';
import { modeloPorCodigo } from '@/lib/estudio/modelos';
import { listarProdutosDoEstudio } from '@/lib/estudio/catalogo';

export const metadata: Metadata = { title: 'Peça' };

export default async function PecaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('studio_pieces')
    .select('id, modelo, titulo, conteudo, product_id, legenda, status')
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();
  const modelo = modeloPorCodigo(data.modelo);
  if (!modelo) notFound();

  const produtos = await listarProdutosDoEstudio();

  return (
    <div>
      <AdminPageHeader
        area="estudio"
        title={data.titulo}
        subtitle={`${modelo.secao} · ${modelo.nome}`}
        action={
          <Link
            href="/admin/estudio"
            className="rounded-control border border-border-strong px-4 py-2 text-[13px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent"
          >
            Voltar
          </Link>
        }
      />
      <EditorDePeca
        modelo={modelo}
        produtos={produtos}
        peca={{
          id: data.id,
          titulo: data.titulo,
          conteudo: (data.conteudo ?? {}) as Record<string, string>,
          product_id: data.product_id,
          legenda: data.legenda,
          status: data.status,
        }}
      />
    </div>
  );
}
