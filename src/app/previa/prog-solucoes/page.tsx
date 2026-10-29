import type { Metadata } from 'next';
import { metadadosProgSolucoes } from '@/lib/prog-solucoes-seo';

// Página só de prévia: o robô que monta a prévia do link (WhatsApp, Facebook,
// Telegram…) não está logado e, nos links do painel da Captação/Pós-venda, cairia
// na tela de login da loja. O proxy manda esses robôs para cá (sem dado nenhum).

const PAGINAS: Record<string, { titulo: string; sub: string; descricao: string }> = {
  'pos-venda': {
    titulo: 'Pós-venda · Prog Soluções',
    sub: 'Projetos, rodadas de ajuste, reuniões e entregas',
    descricao: 'Painel da Prog Soluções: projetos vendidos, rodadas de ajuste, reuniões e prazos.',
  },
  captacao: {
    titulo: 'Captação · Prog Soluções',
    sub: 'Leads, atendimento da Lia e resultados',
    descricao: 'Painel da Prog Soluções: leads, conversas da Lia, propostas e resultados.',
  },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ p?: string }> }): Promise<Metadata> {
  const { p } = await searchParams;
  const pg = PAGINAS[p ?? ''] ?? PAGINAS.captacao;
  return metadadosProgSolucoes({ titulo: pg.titulo, descricao: pg.descricao, tituloDaImagem: pg.titulo.split(' · ')[0], subtituloDaImagem: pg.sub });
}

export default function PreviaProgSolucoes() {
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <p>Prog Soluções</p>
    </main>
  );
}
