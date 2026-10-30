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
  gastos: {
    titulo: 'Gastos · Prog Soluções',
    sub: 'IA, mensagens e custos da operação',
    descricao: 'Painel da Prog Soluções: quanto custa a operação e cada venda.',
  },
  dashboards: {
    titulo: 'Dashboards · Prog Soluções',
    sub: 'Números, meta, funil e resultados',
    descricao: 'Painel da Prog Soluções: dinheiro na mesa, meta, funil, placar e resultados da Lia.',
  },
  atendimento: {
    titulo: 'Atendimento · Prog Soluções',
    sub: 'Conversas da Lia no WhatsApp',
    descricao: 'Painel da Prog Soluções: conversas da Lia com os clientes.',
  },
  vendedores: {
    titulo: 'Vendedores · Prog Soluções',
    sub: 'Links, leads e placar',
    descricao: 'Painel da Prog Soluções: vendedores e os leads de cada um.',
  },
  lia: {
    titulo: 'Lia · Prog Soluções',
    sub: 'Atendente de IA',
    descricao: 'Painel da Prog Soluções: situação, simulador e configuração da Lia.',
  },
  time: {
    titulo: 'Time e fluxo · Prog Soluções',
    sub: 'Agentes, processo e funções',
    descricao: 'Painel da Prog Soluções: o time de agentes, o fluxo do lead ao pós-venda e as funções do sistema.',
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
