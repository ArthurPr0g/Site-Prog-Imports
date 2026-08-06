// Modelo de contrato de prestação de serviços, montado a partir do orçamento.
//
// O texto veio dos dois .docx do dono ("com domínio" e "sem domínio"), que são
// idênticos exceto por uma linha da Cláusula 2 — por isso aqui é um documento
// só, com a linha condicional.
//
// Nenhum dado pessoal mora neste arquivo: nome, documento e foro do contratado
// vêm de `site_settings`. O repositório é público, e CPF em arquivo versionado
// fica exposto para sempre, inclusive no histórico do git.

import { formatBRL } from '@/lib/format';

export type DadosDoContratado = {
  nome: string;
  documento: string;
  cargo: string;
  foro: string;
  /** Assinatura digitalizada em data URI, quando cadastrada. Vem do bucket
   *  privado e é resolvida na hora de gerar o PDF — o arquivo não pode viver
   *  no repositório, que é público. */
  assinatura?: string;
};

export type DadosDoContrato = {
  contratante: string;
  documentoContratante: string;
  /** Valor do desenvolvimento (serviços de cobrança única). */
  valorDesenvolvimento: number;
  /** Mensalidade do plano, 0 quando não há. */
  valorMensal: number;
  /** Duração do plano em meses, null quando não há plano. */
  mesesPlano: number | null;
  /** Prazo somado dos serviços, em dias. */
  prazoDias: number;
  clientePossuiDominio: boolean;
  contratado: DadosDoContratado;
};

export type ClausulaContrato = {
  /** Sem o "CLÁUSULA N –": o número é atribuído no fim, pela ordem. Escrever o
   *  número à mão quebraria a sequência toda vez que uma cláusula condicional
   *  (Plano, Prazo Mínimo) entrasse ou saísse — e um contrato que pula da 9
   *  para a 11 é o tipo de erro que só aparece depois de assinado. */
  titulo: string;
  /** Parágrafos corridos. */
  paragrafos?: string[];
  /** Lista com marcador, quando a cláusula enumera itens. */
  itens?: string[];
  /** Segundo bloco de lista, com seu próprio rótulo (ex: "Não estão inclusos"). */
  rotuloSegundaLista?: string;
  segundaLista?: string[];
  /** Texto de fecho depois das listas. */
  fecho?: string;
};

/** Metade do valor, arredondada ao centavo. Se o total for ímpar em centavos, a
 *  primeira parcela leva o centavo a mais — o contrato precisa que as duas
 *  somem exatamente o total, senão o cliente encontra a diferença. */
export function metadesDoPagamento(total: number): { primeira: number; segunda: number } {
  const centavos = Math.round(total * 100);
  const segunda = Math.floor(centavos / 2);
  return { primeira: (centavos - segunda) / 100, segunda: segunda / 100 };
}

function prazoPorExtenso(dias: number): string {
  if (dias <= 0) return 'a combinar entre as partes';
  return dias === 1 ? 'até 1 (um) dia' : `até ${dias} (${porExtenso(dias)}) dias`;
}

const UNIDADES = [
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];

/** Números por extenso até 99. Contrato escreve "12 (doze) meses"; acima disso
 *  o texto sai só com o algarismo, que continua válido e evita inventar formas
 *  erradas para números que este documento nunca usa. */
function porExtenso(n: number): string {
  if (n < 20) return UNIDADES[n] ?? String(n);
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }
  return String(n);
}

/** Monta as cláusulas com os valores do orçamento no lugar dos do modelo.
 *
 *  Substituir é o ponto: o contrato sai no mesmo PDF, logo depois da proposta.
 *  Um contrato dizendo R$ 1.000 atrás de uma proposta de R$ 4.500 é o erro mais
 *  caro que este documento pode conter. */
export type ClausulaNumerada = ClausulaContrato & { numero: number };

export function montarClausulas(d: DadosDoContrato): ClausulaNumerada[] {
  const { primeira, segunda } = metadesDoPagamento(d.valorDesenvolvimento);
  const temPlano = d.valorMensal > 0 && (d.mesesPlano ?? 0) > 0;
  const meses = d.mesesPlano ?? 0;

  const inclusos = [
    ...(d.clientePossuiDominio ? [] : ['Domínio']),
    'Desenvolvimento do site institucional',
    'Layout responsivo',
    'Publicação do site',
    'Configuração de domínio',
    'Configuração do certificado SSL',
    'Otimizações para desempenho',
    'Configuração da hospedagem',
  ];

  const naoInclusos = [
    ...(d.clientePossuiDominio ? ['Domínio'] : []),
    'Sistemas personalizados',
    'Área de membros',
    'Loja virtual',
    'Blog (salvo contratação)',
    'Integrações não previstas',
    'Criação de identidade visual',
    'Produção de fotos ou vídeos',
  ];

  const clausulas: ClausulaContrato[] = [
    {
      titulo: 'OBJETO',
      paragrafos: [
        'O presente contrato tem como objeto o desenvolvimento, publicação, hospedagem e manutenção de um website institucional personalizado, conforme as especificações acordadas entre as partes.',
      ],
    },
    {
      titulo: 'ESCOPO DO DESENVOLVIMENTO',
      paragrafos: ['O serviço de desenvolvimento inclui:'],
      itens: inclusos,
      rotuloSegundaLista: 'Não estão inclusos:',
      segundaLista: naoInclusos,
      fecho: 'Qualquer funcionalidade adicional será objeto de orçamento específico.',
    },
    {
      titulo: 'PRAZO',
      paragrafos: [
        `O prazo para conclusão do desenvolvimento é de ${prazoPorExtenso(d.prazoDias)}, contados a partir do recebimento de todo o material necessário fornecido pelo contratante.`,
        'Caso o contratante demore para enviar informações, fotos, textos ou aprovar etapas do projeto, o prazo será automaticamente prorrogado pelo mesmo período correspondente ao atraso.',
      ],
    },
    {
      titulo: 'MATERIAL FORNECIDO PELO CLIENTE',
      paragrafos: ['É responsabilidade do contratante fornecer:'],
      itens: [
        'Logotipo',
        'Fotografias',
        'Dados da empresa',
        'Informações institucionais',
        'Contatos',
        'Endereço',
        'Redes sociais',
        'Demais conteúdos necessários para a criação do website',
      ],
      fecho: 'O contratado não será responsável por atrasos decorrentes da ausência dessas informações.',
    },
    {
      titulo: 'REVISÕES',
      paragrafos: [
        'O contratante terá direito a até 02 (duas) rodadas de revisão durante o desenvolvimento do projeto.',
        'Cada rodada poderá conter todas as solicitações de alteração desejadas pelo cliente.',
        'Após a utilização das duas rodadas, novas alterações serão cobradas conforme orçamento previamente aprovado.',
      ],
    },
    {
      titulo: 'VALOR DO DESENVOLVIMENTO',
      paragrafos: [
        `O valor para desenvolvimento do website é de ${formatBRL(d.valorDesenvolvimento)}.`,
        'O pagamento será realizado da seguinte forma:',
      ],
      itens: [
        `50% (cinquenta por cento), equivalente a ${formatBRL(primeira)}, no ato da assinatura deste contrato, como sinal para início dos trabalhos`,
        `50% (cinquenta por cento), equivalente a ${formatBRL(segunda)}, na conclusão do desenvolvimento, antes da publicação do website`,
      ],
      fecho:
        'O pagamento poderá ser realizado à vista ou parcelado, sendo que, na hipótese de parcelamento, poderão incidir juros e/ou taxas da instituição financeira ou da plataforma de pagamento utilizada. ' +
        'O desenvolvimento do website terá início somente após a confirmação do pagamento da primeira parcela. ' +
        'A publicação do website e a entrega definitiva ocorrerão somente após a confirmação do pagamento integral do valor do desenvolvimento. ' +
        'Em caso de desistência do contratante após o início da execução dos serviços, o valor pago como entrada não será reembolsado, tendo em vista sua natureza de sinal e o início da prestação dos serviços.',
    },
  ];

  if (temPlano) {
    clausulas.push({
      titulo: 'PLANO DE HOSPEDAGEM E MANUTENÇÃO',
      paragrafos: [
        `Após a entrega do projeto, o contratante contratará o Plano Mensal no valor de ${formatBRL(d.valorMensal)} por mês.`,
        'O plano inclui:',
      ],
      itens: [
        'Hospedagem',
        'Certificado SSL',
        'Backups',
        'Monitoramento',
        'Atualizações de segurança',
        'Suporte via WhatsApp',
      ],
    });
  }

  clausulas.push(
    {
      titulo: 'ALTERAÇÕES FUTURAS',
      paragrafos: [
        'O plano mensal não contempla novas páginas, mudanças completas de layout, novas funcionalidades ou qualquer desenvolvimento adicional.',
        'Toda solicitação que ultrapasse pequenas correções será previamente orçada.',
      ],
    },
    {
      titulo: 'DOMÍNIO',
      paragrafos: [
        'O domínio do website será de propriedade do contratante.',
        d.clientePossuiDominio
          ? 'O contratante já possui domínio registrado; o contratado realizará apenas a configuração e o apontamento técnico necessários para a publicação do website.'
          : 'O contratado realizará o registro do domínio em nome do contratante, mediante sua autorização.',
        'Durante a vigência do contrato de manutenção, o contratado poderá administrar tecnicamente as configurações do domínio, sem que isso implique em transferência de propriedade, permanecendo o domínio sempre em nome do contratante.',
      ],
    },
    {
      titulo: 'INADIMPLÊNCIA',
      paragrafos: ['Em caso de atraso no pagamento da mensalidade:'],
      itens: [
        'haverá tolerância de 10 (dez) dias',
        'será aplicada multa de 10% sobre o valor devido',
        'após 15 dias de inadimplência, o website poderá ser suspenso',
        'após 30 dias de inadimplência, o contrato poderá ser rescindido e o website removido da hospedagem',
      ],
    }
  );

  if (temPlano) {
    clausulas.push({
      titulo: 'PRAZO MÍNIMO',
      paragrafos: [
        `O contrato possui permanência mínima de ${meses} (${porExtenso(meses)}) meses.`,
        'Caso o contratante solicite o cancelamento antes desse período, será devida multa proporcional ao tempo restante do compromisso mínimo.',
      ],
    });
  }

  clausulas.push(
    {
      titulo: 'CANCELAMENTO',
      paragrafos: [
        'O contratante poderá solicitar o cancelamento a qualquer momento.',
        'Após a quitação de todos os valores pendentes:',
      ],
      itens: [
        'o domínio permanecerá de propriedade do contratante',
        'será disponibilizada uma cópia dos arquivos do website, desde que solicitada antes da remoção da hospedagem',
        'a hospedagem e os serviços de manutenção serão encerrados',
      ],
    },
    {
      titulo: 'RESPONSABILIDADES DO CONTRATADO',
      paragrafos: ['São responsabilidades do contratado:'],
      itens: [
        'desenvolver o website conforme o escopo contratado',
        'manter a hospedagem durante a vigência do plano mensal',
        'realizar backups periódicos',
        'manter o certificado SSL ativo',
        'prestar suporte via WhatsApp dentro do horário comercial',
      ],
    },
    {
      titulo: 'RESPONSABILIDADES DO CONTRATANTE',
      paragrafos: ['São responsabilidades do contratante:'],
      itens: [
        'fornecer todas as informações necessárias',
        'manter os pagamentos em dia',
        'responder às solicitações de aprovação do projeto',
      ],
    },
    {
      titulo: 'LIMITAÇÃO DE RESPONSABILIDADE',
      paragrafos: ['O contratado não responderá por:'],
      itens: [
        'interrupções causadas por provedores de internet',
        'falhas em serviços de terceiros',
        'indisponibilidades ocasionadas por ataques cibernéticos, força maior ou eventos imprevisíveis',
      ],
    },
    {
      titulo: 'PROPRIEDADE INTELECTUAL',
      paragrafos: [
        'Após o pagamento integral do desenvolvimento, o website passa a ser de propriedade do contratante.',
        'Ferramentas, componentes reutilizáveis, metodologias e códigos de uso genérico desenvolvidos pelo contratado permanecem de sua propriedade intelectual e poderão ser utilizados em outros projetos.',
      ],
    },
    {
      titulo: 'FORO',
      paragrafos: [
        `Fica eleito o foro da comarca de ${d.contratado.foro || '_______________'}, com renúncia de qualquer outro, por mais privilegiado que seja, para dirimir quaisquer controvérsias decorrentes deste contrato.`,
      ],
    }
  );

  // Numera pela ordem final, depois de as condicionais entrarem ou não.
  return clausulas.map((c, i) => ({ ...c, numero: i + 1 }));
}

export const TITULO_CONTRATO =
  'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO E MANUTENÇÃO DE SITE INSTITUCIONAL';
