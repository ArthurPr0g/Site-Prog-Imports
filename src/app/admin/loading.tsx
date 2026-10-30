'use client';

import { usePathname } from 'next/navigation';
import { PageLoader } from '@/brand/loaders';

// Nome de cada área para o texto do carregamento dizer o que está abrindo
// (o design system proíbe "Carregando..." genérico).
const AREAS: Record<string, string> = {
  '': 'O PAINEL',
  colecoes: 'AS COLEÇÕES',
  cupons: 'OS CUPONS',
  banners: 'OS BANNERS',
  depoimentos: 'OS DEPOIMENTOS',
  servicos: 'OS SERVIÇOS',
  clientes: 'OS CLIENTES',
  produtos: 'OS PRODUTOS',
  financeiro: 'O FINANCEIRO',
  estoque: 'O ESTOQUE',
  relatorios: 'OS RELATÓRIOS',
  'orcamentos-loja': 'OS ORÇAMENTOS DA LOJA',
  vendas: 'AS VENDAS',
  'avaliacao-troca': 'AS AVALIAÇÕES DE TROCA',
  estudio: 'O ESTÚDIO',
  configuracoes: 'AS CONFIGURAÇÕES',
  dashboards: 'OS DASHBOARDS',
  captacao: 'A CAPTAÇÃO',
  atendimento: 'O ATENDIMENTO',
  vendedores: 'OS VENDEDORES',
  'pos-venda': 'O PÓS-VENDA',
  lia: 'A LIA',
  'prestacao-servico': 'A PRESTAÇÃO DE SERVIÇO',
  'orcamentos-servicos': 'OS ORÇAMENTOS DE SERVIÇOS',
  time: 'O TIME E O FLUXO',
  gastos: 'OS GASTOS',
  'servicos-internos': 'O CATÁLOGO DE SERVIÇOS',
  carregamento: 'A PRÉVIA DOS CARREGAMENTOS',
};

/** Carregamento de rota do admin: o arco do P como spinner (cena 2 da marca). */
export default function AdminLoading() {
  const area = (usePathname() ?? '').split('/')[2] ?? '';
  return <PageLoader rotulo={`ABRINDO ${AREAS[area] ?? 'A TELA'}`} />;
}
