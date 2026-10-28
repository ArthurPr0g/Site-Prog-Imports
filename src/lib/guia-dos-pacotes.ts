// Guia dos pacotes para o vendedor: o que é cada produto, para quem é cada
// nível, o que inclui e o que muda de um nível para o outro.
//
// Fonte: página de planos do portfólio (ArthurPr0g/Portfolio-Arthur-Prog,
// app/src/pages/planos/planos.js, DADOS_PT: "ideal", "f" e "CMP"; FAQ em
// planos.html) e as regras do catálogo (internal_services: marca obrigatória,
// API fiscal, integração do combo). Os preços NÃO ficam aqui: vêm do catálogo.
// Mudou o texto de um pacote lá, mude aqui também.

import type { Produto } from '@/lib/simulador';

export type GuiaDoNivel = {
  /** Para quem é (frase de "ideal" da página de planos). */
  ideal: string;
  /** O que inclui, em itens curtos. */
  inclui: string[];
  prazo: string;
  /** "Mais escolhido" na página de planos. */
  maisEscolhido?: boolean;
};

export const GUIA_DO_PRODUTO: Record<Produto, { oQueE: string; quandoOferecer: string; niveis: GuiaDoNivel[] }> = {
  site: {
    oQueE: 'Vitrine da empresa no Google: quem é, o que faz e contato direto pelo WhatsApp. Não tem carrinho.',
    quandoOferecer: 'Não tem site, o site está parado ou só usa rede social.',
    niveis: [
      {
        ideal: 'Quem está começando e precisa aparecer no Google e no WhatsApp.',
        prazo: '5–10 dias úteis',
        inclui: [
          'Até 5 páginas ou landing page única',
          'Modelo profissional com as cores e a logo da marca',
          'WhatsApp, formulário por e-mail e mapa',
          'SEO básico e cadeado de segurança (SSL)',
          '2 rodadas de ajustes · 30 dias de suporte',
        ],
      },
      {
        ideal: 'Empresas que querem uma marca forte e passar mais confiança.',
        prazo: '7–14 dias úteis',
        maisEscolhido: true,
        inclui: [
          'Até 8 páginas',
          'Layout criado para a marca, não é modelo',
          'Animações ao rolar e efeitos ao passar o mouse',
          'SEO completo',
          '2 rodadas de ajustes · 30 dias de suporte',
        ],
      },
      {
        ideal: 'Quem quer se destacar e precisa de agendamento ou área do cliente.',
        prazo: '14–28 dias úteis',
        inclui: [
          'Até 15 páginas com design exclusivo e prévia aprovada',
          'Animações avançadas e transições entre páginas',
          'Painel para editar todo o site + revisão dos textos',
          'Agendamento online ou área restrita',
          'SEO avançado, site muito rápido e acessível',
          '1 integração com outro sistema',
          '3 rodadas de ajustes · 60 dias de suporte',
        ],
      },
    ],
  },
  loja: {
    oQueE: 'Catálogo com preço e carrinho. No Essencial o pedido chega pronto no WhatsApp; do Profissional para cima o cliente paga no site.',
    quandoOferecer: 'Vende pelo WhatsApp ou Instagram e perde tempo respondendo preço e disponibilidade.',
    niveis: [
      {
        ideal: 'Quem vende pelo Instagram ou WhatsApp e quer um catálogo com carrinho.',
        prazo: '7–14 dias úteis',
        inclui: [
          'Até 50 produtos (sem variações), 20 já cadastrados por nós',
          'Carrinho com finalização pelo WhatsApp',
          'Frete por tabela fixa ou Melhor Envio',
          'Painel de pedidos e produtos',
          '2 rodadas de ajustes · 30 dias de suporte',
        ],
      },
      {
        ideal: 'Quem quer receber online, com estoque e área do cliente.',
        prazo: '14–28 dias úteis',
        maisEscolhido: true,
        inclui: [
          'Até 300 produtos com variações (tamanho, cor)',
          'Boleto, parcelamento e cupons de desconto',
          'Frete grátis por valor/região, retirada e cálculo na hora',
          'Busca, filtros, avaliações e animações',
          'Área do cliente e e-mails automáticos',
          'Controle de estoque e relatório de vendas',
          '2 rodadas de ajustes · 60 dias de suporte',
        ],
      },
      {
        ideal: 'Lojas que querem uma experiência exclusiva e automações.',
        prazo: '14–28 dias úteis',
        inclui: [
          'Produtos ilimitados com página completa de gestão',
          'Design exclusivo e banners animados sob medida',
          'Favoritos, carrinho e busca inteligente',
          'Assinatura ou recorrência',
          'Rastreio do pedido por etapas',
          'Painel de vendas, dashboard e automações',
          '3 rodadas de ajustes · 90 dias de suporte',
        ],
      },
    ],
  },
  erp: {
    oQueE: 'Sistema interno da empresa: clientes, orçamentos, estoque e financeiro num lugar só. Quem usa é a equipe, não o público.',
    quandoOferecer: 'Controla tudo em planilha, caderno ou num sistema que não se encaixa no jeito dele.',
    niveis: [
      {
        ideal: 'Quem controla tudo em planilha ou caderno e quer organizar.',
        prazo: '7–14 dias úteis',
        inclui: [
          'Até 5 usuários (administrador e operador)',
          'Clientes, fornecedores e produtos/serviços',
          'Orçamentos e pedidos em PDF',
          'Estoque com alerta de estoque baixo',
          'Contas a pagar/receber, fluxo de caixa e painel',
          'Backups diários · 1h de treinamento · 30 dias de suporte',
        ],
      },
      {
        ideal: 'Quem emite nota fiscal, tem equipe e quer cobrança automática.',
        prazo: '14–28 dias úteis',
        maisEscolhido: true,
        inclui: [
          'Até 15 usuários com permissões',
          'Emissão de NF-e, NFC-e ou NFS-e (API fiscal à parte)',
          'Pix e boleto automáticos, com parcelamento',
          'Compras, comissões e integração com a loja',
          'Relatórios em Excel/PDF e registro de alterações',
          '2 treinamentos + manual · 60 dias de suporte',
        ],
      },
      {
        ideal: 'Operações com regras próprias que sistemas prontos não atendem.',
        prazo: '28–52 dias úteis',
        inclui: [
          'Usuários ilimitados com permissões detalhadas',
          'Estoque por lote, validade ou unidade',
          'Mensalidades, contratos em PDF, trocas e DRE',
          'Até 3 módulos sob medida (OS, agenda, frota…)',
          'Relatórios do jeito do cliente e histórico completo',
          'Treinamento por equipe · 90 dias de suporte',
        ],
      },
    ],
  },
};

/** Opções de marca: índice 1–3 do simulador (0 = já tem). */
export const GUIA_DA_MARCA: GuiaDoNivel[] = [
  {
    ideal: 'Não tem logo e precisa começar com o essencial bem feito.',
    prazo: '5–7 dias úteis',
    inclui: [
      '2 propostas de logo criadas do zero · 2 rodadas de ajustes',
      'Versões horizontal, vertical e ícone',
      'Paleta de cores e fontes da marca',
      'Arquivos PNG, SVG e PDF (fundo claro e escuro)',
      'Favicon e foto de perfil para redes sociais',
    ],
  },
  {
    ideal: 'Já tem logo e precisa do resto da marca: cores, fontes, padrões e redes.',
    prazo: '5–10 dias úteis',
    inclui: [
      'Logo atual revisado e vetorizado, se precisar',
      'Paleta de cores e fontes da marca',
      'Manual da marca em PDF',
      'Cartão de visita e assinatura de e-mail',
      'Kit redes sociais: perfil, capa e 5 modelos de post/story',
      'Tudo aplicado no site ou na loja',
    ],
  },
  {
    ideal: 'Não tem nada: logo + identidade juntos, mais barato que separados.',
    prazo: '7–14 dias úteis',
    maisEscolhido: true,
    inclui: [
      'Tudo do Logo Essencial, com 3 propostas e 3 rodadas',
      'Manual da marca em PDF',
      'Cartão de visita e assinatura de e-mail',
      'Kit redes sociais: perfil, capa e 5 modelos de post/story',
      'Elementos gráficos e padrões da marca',
      'Tudo aplicado no site ou na loja',
    ],
  },
];

/** Regra do catálogo para escolher a marca. */
export const REGRA_DA_MARCA = [
  'Tem logo e identidade (cores, fontes, padrão nas redes) → "Já tem".',
  'Tem só o logo → Identidade a partir do logo (obrigatória).',
  'Não tem logo nem identidade → Identidade completa (obrigatória).',
];

/** O que o combo com sistema de gestão entrega (descrições dos combos no catálogo). */
export const COMBO_INTEGRACAO: Record<'site' | 'loja', string> = {
  site: 'Site e sistema no mesmo endereço e no mesmo login; só os administradores veem o botão Site ⇄ Gestão.',
  loja: 'Cada pedido da loja vira venda no sistema, baixa o estoque e lança o valor no financeiro. Mesmo login.',
};

/** Comparativo dos 3 níveis (linha: [item, nível 1, nível 2, nível 3]). */
export const COMPARATIVO: Record<Produto, string[][]> = {
  site: [
    ['Páginas', 'até 5', 'até 8', 'até 15'],
    ['Design', 'modelo adaptado', 'criado para a marca', 'exclusivo + prévia'],
    ['Animações', '—', 'ao rolar e ao passar o mouse', 'avançadas + transições'],
    ['WhatsApp, formulário e mapa', '✓', '✓', '✓'],
    ['SEO (Google)', 'básico', 'completo', 'avançado + alta velocidade'],
    ['Painel para editar o site', '—', '—', '✓'],
    ['Revisão dos textos', '—', '—', '✓'],
    ['Agendamento ou área restrita', '—', '—', '✓ (escolher 1)'],
    ['Integração com outro sistema', '—', '—', '1'],
    ['Rodadas de ajustes', '2', '2', '3'],
    ['Suporte após a entrega', '30 dias', '30 dias', '60 dias'],
    ['Prazo', '5–10 dias úteis', '7–14 dias úteis', '14–28 dias úteis'],
  ],
  loja: [
    ['Produtos', 'até 50 (sem variações)', 'até 300 com variações', 'ilimitados'],
    ['Finalização da compra', 'WhatsApp', 'pagamento online', 'pagamento online'],
    ['Boleto, parcelamento e cupons', '—', '✓', '✓'],
    ['Assinatura / recorrência', '—', '—', '✓'],
    ['Frete', 'tabela ou Melhor Envio', '+ grátis, retirada, cálculo na hora', '+ grátis, retirada, cálculo na hora'],
    ['Busca, filtros e avaliações', '—', '✓', '✓ + busca inteligente'],
    ['Design', 'padrão de loja', 'com animações', 'exclusivo + banners animados'],
    ['Área do cliente', '—', '✓ + e-mails automáticos', '✓ + rastreio por etapas'],
    ['Gestão', 'pedidos e produtos', '+ estoque e relatórios', '+ dashboard e automações'],
    ['Rodadas de ajustes', '2', '2', '3'],
    ['Suporte após a entrega', '30 dias', '60 dias', '90 dias'],
    ['Prazo', '7–14 dias úteis', '14–28 dias úteis', '14–28 dias úteis'],
  ],
  erp: [
    ['Usuários', 'até 5', 'até 15', 'ilimitados'],
    ['Clientes, fornecedores e produtos', '✓', '✓', '✓'],
    ['Orçamentos e pedidos', '✓ com PDF', '✓ + comissões', '✓ + contratos e trocas'],
    ['Estoque', 'entradas, saídas e alerta', '+ compras', 'por lote, validade ou unidade'],
    ['Financeiro', 'pagar, receber e caixa', '+ Pix/boleto automáticos', '+ mensalidades e DRE'],
    ['Nota fiscal (NF-e/NFC-e/NFS-e)', '—', '✓ (API à parte)', '✓ (API à parte)'],
    ['Integração com a loja virtual', '—', '✓', '✓'],
    ['Relatórios', 'painel principal', 'filtros + Excel/PDF', 'sob medida'],
    ['Módulos sob medida', '—', '—', 'até 3'],
    ['Treinamento', '1h', '2 sessões + manual', 'por equipe'],
    ['Suporte após a entrega', '30 dias', '60 dias', '90 dias'],
    ['Prazo', '7–14 dias úteis', '14–28 dias úteis', '28–52 dias úteis'],
  ],
};

/** FAQ da página de planos: o que fica de fora. */
export const NAO_INCLUSO =
  'E-mail corporativo, certificado digital A1 (para emitir nota), a API de nota fiscal (cerca de R$ 100 a 200 por mês, conforme o volume) e as taxas de pagamento da loja. Textos e fotos vêm do cliente; no Premium, revisamos os textos.';

/** FAQ da página de planos: respostas curtas que ajudam a fechar. */
export const BOM_SABER = [
  'Pode começar no Essencial e subir de nível em até 6 meses pagando só a diferença.',
  'O domínio fica no CPF ou CNPJ do cliente. O 1º ano é por nossa conta; depois, cerca de R$ 40 por ano.',
  'O prazo começa quando recebemos todo o material: textos, fotos e acessos.',
];
