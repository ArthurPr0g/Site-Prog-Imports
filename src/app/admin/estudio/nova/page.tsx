import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EditorDePeca } from '@/components/estudio/EditorDePeca';
import { modeloPorCodigo } from '@/lib/estudio/modelos';
import { listarProdutosDoEstudio } from '@/lib/estudio/catalogo';

export const metadata: Metadata = { title: 'Nova peça' };

export default async function NovaPecaPage({
  searchParams,
}: {
  searchParams: Promise<{ modelo?: string; assunto?: string }>;
}) {
  const { modelo: codigo, assunto } = await searchParams;
  const modelo = codigo ? modeloPorCodigo(codigo) : undefined;
  if (!modelo) notFound();

  const produtos = await listarProdutosDoEstudio();

  return (
    <div>
      <AdminPageHeader
        area="estudio"
        title="Nova peça"
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
      {/* `assunto` chega da pauta: o dono clicou em produzir numa notícia, e o
          editor abre com o campo preenchido para ele só conferir e mandar
          escrever. */}
      <EditorDePeca modelo={modelo} produtos={produtos} assuntoInicial={assunto} />
    </div>
  );
}
