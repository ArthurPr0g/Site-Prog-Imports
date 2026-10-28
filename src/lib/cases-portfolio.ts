// Cases do portfólio para o vendedor mostrar ao cliente (prova social).
// Fonte: ArthurPr0g/Portfolio-Arthur-Prog, app/src/data/content.js (PROJECTS),
// só os trabalhos para pequenas e médias empresas, com o texto já publicado lá.
// Mudou um case no portfólio, mude aqui. Sem números inventados: o portfólio
// não publica métricas de resultado desses cases.

import { situacaoDoSite } from '@/lib/captacao';

export type CaseDoPortfolio = {
  slug: string;
  titulo: string;
  tipo: string;
  resumo: string;
  antes: string;
  depois: string;
};

const PORTFOLIO = 'https://portfolio-arthur-prog.vercel.app';
export const linkDoCase = (slug: string, eua: boolean) =>
  eua ? `${PORTFOLIO}/en/projects/${slug}` : `${PORTFOLIO}/pt/projetos/${slug}`;

export const CASES: Record<string, CaseDoPortfolio> = {
  tecnopallet: {
    slug: 'tecnopallet',
    titulo: 'TecnoPallet Logística',
    tipo: 'Redesign de site institucional',
    resumo: 'Do site antigo e datado a uma presença digital à altura de duas décadas de operação.',
    antes: 'Site com layout de 2020, textos corridos, fotos pequenas e nenhuma chamada clara para orçamento.',
    depois:
      'Site novo com prova social (4,7★ no Google) no topo e o pedido de orçamento a um clique em qualquer seção. Tem antes e depois na página.',
  },
  vitaliti: {
    slug: 'vitaliti',
    titulo: 'VitaliTI Soluções',
    tipo: 'Site institucional + painel de gestão',
    resumo: 'Site de credibilidade e conversão, com painel próprio para clientes e orçamentos.',
    antes: 'Serviços técnicos fortes, mas nenhuma presença digital que gerasse orçamentos.',
    depois:
      'Caminho curto do visitante até o orçamento pelo WhatsApp e a operação comercial (clientes, propostas, valores) organizada num só lugar.',
  },
  'prog-imports': {
    slug: 'prog-imports',
    titulo: 'Prog Imports',
    tipo: 'Loja virtual + sistema de gestão',
    resumo: 'Loja, gestão, estoque e financeiro num só lugar.',
    antes: 'Operação em planilhas soltas e controles manuais, sem visão única de estoque, vendas e financeiro.',
    depois: 'Catálogo online integrado ao estoque e indicadores de vendas e financeiro em tempo real.',
  },
  'controle-saloes': {
    slug: 'controle-saloes',
    titulo: 'Controle de Serviços para Salões',
    tipo: 'Sistema web para salões',
    resumo: 'Lançamento de serviços por profissional e fechamento do dia em poucos toques.',
    antes: 'Serviços anotados em caderno ou planilha; fechar o dia e calcular o de cada profissional levava tempo e dava erro.',
    depois: 'Fechamento do dia instantâneo, no celular, com a marca de cada salão (atende vários salões).',
  },
  'sistema-consorcio': {
    slug: 'sistema-consorcio',
    titulo: 'Sistema de Consórcio',
    tipo: 'Sistema de gestão sob medida',
    resumo: 'Gestão de grupos, cotas, contemplações e inadimplência.',
    antes: 'Regras de grupos, cotas e parcelas que nenhuma planilha sustentava sem erro.',
    depois: 'Operação padronizada e auditável, com visão imediata de quem está em dia.',
  },
};

const tem = (texto: string, termos: string[]) => termos.some((t) => texto.includes(t));
const BELEZA = [
  'salão',
  'salao',
  'barbearia',
  'estética',
  'estetica',
  'sobrancelha',
  'spa',
  'salon',
  'barber',
  'nail',
  'wax',
  'beauty',
];
const VAREJO = [
  'loja',
  'store',
  'boutique',
  'ótica',
  'otica',
  'joalheria',
  'pet shop',
  'móveis',
  'moveis',
  'decoração',
  'floricultura',
  'cosmético',
  'suplemento',
  'market',
  'bakery',
  'padaria',
  'materiais de construção',
  'distribuidora',
];

/** Até 3 cases mais parecidos com o lead, com a frase de por que mostrar. */
export function casesDoLead(l: {
  niche: string | null;
  category: string | null;
  website: string | null;
  site_check: string | null;
  suggested_services: string[];
}): { caso: CaseDoPortfolio; porque: string }[] {
  const ramo = `${l.niche ?? ''} ${l.category ?? ''}`.toLowerCase();
  const sit = situacaoDoSite(l.website, l.site_check);
  const servicos = l.suggested_services.join(' ');
  const lista: { caso: CaseDoPortfolio; porque: string }[] = [];
  const add = (slug: string, porque: string) => {
    if (!lista.some((x) => x.caso.slug === slug)) lista.push({ caso: CASES[slug], porque });
  };

  if (tem(ramo, BELEZA)) add('controle-saloes', 'Mesmo ramo: sistema feito para salões, usado no celular no balcão.');
  if (tem(ramo, VAREJO) || servicos.includes('Loja'))
    add('prog-imports', 'Loja virtual ligada ao estoque e ao financeiro, como a que oferecemos.');
  if (['sem_celular', 'sem_https', 'fora', 'parado', 'ok'].includes(sit) && (servicos.includes('Site') || !servicos)) {
    add('tecnopallet', 'Mesmo caso: site antigo que virou site novo (tem antes e depois para mostrar).');
  }
  if (servicos.includes('Site') || sit === 'sem_site' || sit === 'rede_social') {
    add('vitaliti', 'Site que leva o visitante ao orçamento pelo WhatsApp, com painel de gestão junto.');
  }
  if (servicos.includes('Sistema')) add('prog-imports', 'Gestão de clientes, estoque, vendas e financeiro num só sistema.');
  add('tecnopallet', 'Exemplo de site profissional com prova social do Google no topo.');
  return lista.slice(0, 3);
}
