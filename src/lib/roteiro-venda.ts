// Roteiro de venda de cada lead, para a página do vendedor: como abrir a
// conversa, o que perguntar, quais argumentos usar e como responder as
// objeções mais comuns. Sai do achado sobre o site (situacaoDoSite) e dos
// serviços sugeridos. Só usa fatos do próprio lead (nada de estatística
// inventada): avaliações, nota, o que encontramos no site.
//
// Sempre em português: o vendedor é brasileiro, mesmo quando o lead é dos EUA
// (as mensagens prontas para o lead é que saem em inglês).

import { situacaoDoSite, type SituacaoDoSite } from '@/lib/captacao';

export type Roteiro = {
  /** Em uma frase: por que este lead é uma oportunidade. */
  oportunidade: string;
  abertura: string;
  perguntas: string[];
  argumentos: string[];
  objecoes: { objecao: string; resposta: string }[];
  proximoPasso: string;
};

type LeadDoRoteiro = {
  name: string;
  country: string;
  website: string | null;
  site_check: string | null;
  rating: number | null;
  review_count: number | null;
  suggested_services: string[];
  instagram?: boolean | string | null;
};

const OPORTUNIDADE: Record<SituacaoDoSite, string> = {
  sem_site: 'Não tem site próprio: quem procura no Google não acha uma página da empresa e pode ir para um concorrente.',
  rede_social:
    'O link do Google leva para uma rede social: funciona para quem já segue, mas não para quem pesquisa e ainda não conhece.',
  parado: 'O endereço do site está à venda: o site saiu do ar e qualquer pessoa pode comprar o domínio.',
  fora: 'O site não abre: quem clica no Google vê erro e desiste.',
  sem_celular: 'O site não se adapta ao celular: no telefone, a página fica pequena e difícil de usar.',
  sem_https: 'O navegador mostra o site como "não seguro", o que tira a confiança de quem visita.',
  vende_online: 'Já vende online: a oportunidade está em organizar a gestão (estoque, pedidos, financeiro) ou melhorar a loja.',
  ok: 'Tem site funcionando: a oportunidade está na gestão do negócio ou numa versão mais profissional do site.',
};

const ARGUMENTO_DO_SITE: Record<SituacaoDoSite, string> = {
  sem_site:
    'Sem site, o cliente novo depende de achar o Instagram ou o telefone. Um site aparece no Google e já leva para o WhatsApp.',
  rede_social:
    'O Instagram é ótimo para relacionamento; o site é a vitrine para quem pesquisa no Google e ainda não conhece. Os dois se completam.',
  parado:
    'Domínio à venda é urgente: além de perder clientes, o endereço pode ser comprado por outra pessoa (até por um concorrente).',
  fora: 'Site fora do ar passa a impressão de empresa fechada. Colocar um site novo no ar resolve isso rápido.',
  sem_celular:
    'A maioria das pessoas pesquisa pelo celular; um site que não se adapta à tela faz o cliente desistir antes de chamar.',
  sem_https:
    'O aviso de "não seguro" aparece antes mesmo de o cliente ver o conteúdo. Site novo já vem com conexão segura (SSL).',
  vende_online: 'Quem já vende online ganha tempo com estoque, pedidos e financeiro num lugar só, ligado à loja.',
  ok: 'Mesmo com site, vale mostrar o que um site mais profissional ou um sistema de gestão mudam no dia a dia.',
};

function temServico(l: LeadDoRoteiro, prefixo: string) {
  return l.suggested_services.some((s) => s.startsWith(prefixo));
}

export function roteiroDoLead(l: LeadDoRoteiro): Roteiro {
  const sit = situacaoDoSite(l.website, l.site_check);
  const eua = l.country === 'US';
  const n = l.review_count ?? 0;
  const boaFama = n >= 30 && (l.rating ?? 0) >= 4.3;
  const loja = temServico(l, 'Loja');
  const gestao = temServico(l, 'Sistema');
  const site = temServico(l, 'Site');

  const elogio = boaFama
    ? `Comece pelo elogio verdadeiro: ${n} avaliações e nota ${String(l.rating).replace('.', ',')} no Google.`
    : 'Comece se apresentando e dizendo como encontrou a empresa (Google Maps).';

  const perguntas = [
    'Hoje, como os clientes novos chegam até vocês? (indicação, Instagram, Google, passando na frente)',
    sit === 'parado' || sit === 'fora'
      ? 'Vocês sabiam que o site não está abrindo? Quem cuidava dele?'
      : sit === 'sem_site' || sit === 'rede_social'
        ? 'Vocês já pensaram em ter um site próprio? O que travou até agora?'
        : 'O site atual traz cliente ou fica mais como cartão de visita?',
  ];
  if (loja)
    perguntas.push('Vocês vendem pelo WhatsApp ou Instagram? Quanto tempo por dia vai respondendo preço e disponibilidade?');
  if (gestao) perguntas.push('Como vocês controlam agenda, clientes e o financeiro hoje? Planilha, caderno, algum sistema?');
  perguntas.push('Se isso estivesse resolvido, o que mudaria no dia a dia de vocês?');

  const argumentos = [ARGUMENTO_DO_SITE[sit]];
  if (boaFama)
    argumentos.push(`A reputação já existe (${n} avaliações): falta uma vitrine à altura para converter quem pesquisa.`);
  if (gestao) {
    argumentos.push(
      'O sistema de gestão junta clientes, agenda ou estoque, orçamentos e financeiro; com o site, sai em combo com desconto e uma mensalidade só.'
    );
  }
  if (loja)
    argumentos.push(
      'A loja virtual mostra o catálogo com preço e manda o pedido pronto no WhatsApp: menos tempo respondendo, mais venda.'
    );
  argumentos.push(
    'Inclui hospedagem, segurança, backups e ajustes do mês na mensalidade: o cliente não precisa entender de tecnologia.'
  );

  const parcelamento = eua
    ? '50% para começar e 50% só depois de aprovar o projeto pronto.'
    : 'Dá para pagar 50% no fechamento e 50% na entrega, em 2x sem juros no cartão ou parcelar em até 12x (simulador abaixo).';

  const objecoes = [
    {
      objecao: '"Está caro."',
      resposta: `${parcelamento} E o domínio do 1º ano é grátis. Compare com quanto vale um cliente novo por mês.`,
    },
    {
      objecao: '"Já tenho Instagram."',
      resposta:
        'Ótimo, ele continua! O site complementa: aparece no Google para quem ainda não segue vocês e leva direto para o Instagram e o WhatsApp.',
    },
    {
      objecao: '"Vou pensar."',
      resposta:
        'Claro. Posso mandar a proposta por escrito, com tudo detalhado, para você comparar com calma? Quando posso te chamar de volta?',
    },
    {
      objecao: '"Um conhecido/sobrinho faz para mim."',
      resposta:
        'Vale comparar: aqui tem contrato, prazo definido, hospedagem, segurança, backups e suporte todo mês, sem depender de favor.',
    },
    {
      objecao: '"Não tenho tempo para isso."',
      resposta:
        'A Prog Soluções cuida de tudo. Do cliente, só precisamos de uns 30 minutos para aprovar o layout e passar as informações.',
    },
  ];
  if (gestao) {
    objecoes.push({
      objecao: '"Planilha resolve."',
      resposta:
        'Resolve até crescer: no sistema ninguém apaga fórmula, os dados ficam com backup e dá para ver tudo pelo celular.',
    });
  }

  return {
    oportunidade: OPORTUNIDADE[sit],
    abertura: `${elogio} Depois, aponte o que encontramos: ${OPORTUNIDADE[sit].charAt(0).toLowerCase()}${OPORTUNIDADE[sit].slice(1)} Mande o link do diagnóstico, que mostra isso com os dados da própria empresa.`,
    perguntas,
    argumentos,
    objecoes,
    proximoPasso:
      'Objetivo da conversa: marcar uma conversa de 20 minutos ou pedir a proposta. Quando o cliente topar, marque "Quer proposta" aqui: o Arthur monta a proposta e o contrato. ' +
      (site || loja
        ? 'Use o simulador para mostrar o preço na hora, se perguntarem.'
        : 'Use o simulador para mostrar o preço do sistema na hora, se perguntarem.'),
  };
}
