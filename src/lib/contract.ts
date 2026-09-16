// Contrato de prestação de serviços, montado a partir do orçamento.
//
// Começou como o contrato de site institucional dos .docx do dono ("com
// domínio" e "sem domínio", idênticos exceto por uma linha). Desde 2026-09-11 é
// modular: as cláusulas gerais entram em todo contrato, e cada tipo de serviço
// do orçamento — site, sistema, Power BI, mentoria, hospedagem — acrescenta as
// suas. Orçamento de mentoria não pode sair com cláusula de domínio, e um de
// site + dashboards não pode sair calado sobre as licenças da Microsoft.
//
// Onde o Código de Defesa do Consumidor é mais restritivo, é ele que manda: boa
// parte dos clientes é pessoa física ou pequena empresa, e cláusula que o juiz
// anula não protege ninguém. As razões de cada número estão em docs/ERP.md.
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

export type DadosDoContratante = {
  nome: string;
  documento: string;
  /** Endereço numa linha, já montado por `montarEndereco`. Vazio quando o
   *  cadastro não tem logradouro. */
  endereco: string;
  email: string;
  telefone: string;
};

/** Tipos de serviço que têm cláusulas próprias. A ordem é a do contrato. */
export const MODULOS_CONTRATO = ['site', 'sistema', 'powerbi', 'mentoria', 'hospedagem', 'outro'] as const;
export type ModuloContrato = (typeof MODULOS_CONTRATO)[number];

export const NOME_DO_MODULO: Record<ModuloContrato, string> = {
  site: 'Site',
  sistema: 'Sistema',
  powerbi: 'Power BI',
  mentoria: 'Mentoria',
  hospedagem: 'Hospedagem',
  outro: 'Outros serviços',
};

export type ServicoDoContrato = {
  nome: string;
  modulo: ModuloContrato;
  cobranca: 'unico' | 'mensal';
};

export type DadosDoContrato = {
  numeroProposta: string;
  contratante: DadosDoContratante;
  servicos: ServicoDoContrato[];
  /** Valor dos serviços de cobrança única, já com desconto. */
  valorDesenvolvimento: number;
  /** Mensalidade do plano, 0 quando não há. */
  valorMensal: number;
  /** Duração do plano em meses, null quando não há plano. */
  mesesPlano: number | null;
  /** Prazo somado dos serviços, em dias. */
  prazoDias: number;
  clientePossuiDominio: boolean;
  contratado: DadosDoContratado;
  /** Cláusulas combinadas só com este cliente, entram antes do foro. Compromisso
   *  fora do padrão (uma integração prometida, um serviço extra sem custo) que
   *  não está escrito no contrato vira discussão depois. */
  clausulasExtras?: ClausulaContrato[];
};

export type ClausulaContrato = {
  /** Sem o "CLÁUSULA N –": o número é atribuído no fim, pela ordem. Escrever o
   *  número à mão quebraria a sequência toda vez que uma cláusula condicional
   *  entrasse ou saísse — e um contrato que pula da 9 para a 11 é o tipo de
   *  erro que só aparece depois de assinado. */
  titulo: string;
  /** Parágrafos corridos. */
  paragrafos?: string[];
  /** Lista com marcador, quando a cláusula enumera itens. */
  itens?: string[];
  /** Segundo bloco de lista, com seu próprio rótulo (ex: "Não estão inclusos"). */
  rotuloSegundaLista?: string;
  segundaLista?: string[];
  /** Parágrafos de fecho, depois das listas. */
  fecho?: string[];
};

export type ClausulaNumerada = ClausulaContrato & { numero: number };

/** Os números do contrato num lugar só.
 *
 *  Multa de 2% com juros e IPCA, licença de uso para sistemas, mentoria com
 *  24 h de antecedência e 90 dias de validade e reajuste anual pelo IPCA foram
 *  decididos pelo dono em 2026-09-11. Os demais vêm da lei ou do modelo
 *  original do dono. */
export const REGRAS_DO_CONTRATO = {
  /** CDC art. 52, § 1º: acima de 2% a multa é nula quando o cliente é consumidor. */
  multaAtrasoPct: 2,
  jurosMoraMensalPct: 1,
  toleranciaMensalidadeDias: 10,
  suspensaoAposDias: 15,
  avisoSuspensaoDias: 5,
  rescisaoAposDias: 30,
  rodadasDeRevisao: 2,
  aceiteDiasUteis: 5,
  /** CDC art. 26, II: prazo para reclamar de vício em serviço durável. */
  garantiaDias: 90,
  /** CDC art. 49: contratação fora do estabelecimento. */
  arrependimentoDias: 7,
  mentoriaAntecedenciaHoras: 24,
  mentoriaValidadeDias: 90,
  multaCancelamentoPlanoPct: 20,
  avisoPrevioCancelamentoDias: 30,
  arquivosDisponiveisDias: 30,
  prazoParaSanarDias: 10,
  sigiloAnos: 2,
} as const;

/** Metade do valor, arredondada ao centavo. Se o total for ímpar em centavos, a
 *  primeira parcela leva o centavo a mais — o contrato precisa que as duas
 *  somem exatamente o total, senão o cliente encontra a diferença. */
export function metadesDoPagamento(total: number): { primeira: number; segunda: number } {
  const centavos = Math.round(total * 100);
  const segunda = Math.floor(centavos / 2);
  return { primeira: (centavos - segunda) / 100, segunda: segunda / 100 };
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

/** "duas rodadas", "uma testemunha": só o último termo muda de gênero. */
function porExtensoFeminino(n: number): string {
  return porExtenso(n).replace(/\bum$/, 'uma').replace(/\bdois$/, 'duas');
}

const dias = (n: number) => (n === 1 ? '1 (um) dia' : `${n} (${porExtenso(n)}) dias`);
const diasUteis = (n: number) => `${n} (${porExtenso(n)}) dias úteis`;
const meses = (n: number) => (n === 1 ? '1 (um) mês' : `${n} (${porExtenso(n)}) meses`);
const pct = (n: number) => `${n}% (${porExtenso(n)} por cento)`;

function prazoPorExtenso(n: number): string {
  return n <= 0 ? 'a combinar entre as partes' : `até ${dias(n)}`;
}

/** "A, B e C". */
function juntar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** A ordem importa: "Hospedagem Site Mensal" é hospedagem, e "Mentoria - Power
 *  BI" é mentoria, não dashboard. */
const PADROES_DO_MODULO: [ModuloContrato, RegExp][] = [
  ['hospedagem', /hospedagem|hosting/],
  ['mentoria', /mentoria|treinamento|curso|aula/],
  ['powerbi', /power ?bi|dashboard/],
  ['sistema', /sistema|\berp\b|software|aplicativo|\bapp\b/],
  ['site', /site|landing ?page/],
];

/** Tipo de serviço de um item do orçamento.
 *
 *  A categoria do cadastro vem primeiro, porque é o dono quem a escolhe; o nome
 *  do item só decide quando a categoria não diz nada (campo livre, vazio ou
 *  item digitado à mão, sem serviço do catálogo). Sem encaixe, o item fica só
 *  com as cláusulas gerais — melhor do que ganhar cláusulas de outro serviço. */
export function classificarServico(servico: { categoria?: string | null; nome: string }): ModuloContrato {
  for (const texto of [servico.categoria ?? '', servico.nome]) {
    const t = semAcentos(texto);
    if (!t.trim()) continue;
    const achado = PADROES_DO_MODULO.find(([, padrao]) => padrao.test(t));
    if (achado) return achado[0];
  }
  return 'outro';
}

/** Módulos presentes, na ordem do contrato e sem repetição. */
export function modulosPresentes(servicos: Pick<ServicoDoContrato, 'modulo'>[]): ModuloContrato[] {
  return MODULOS_CONTRATO.filter((m) => servicos.some((s) => s.modulo === m));
}

/** Endereço numa linha para a qualificação do contratante.
 *
 *  Sem logradouro devolve vazio, mesmo havendo cidade: "com endereço em
 *  Goiânia-GO" parece qualificação completa e não é. Vazio vira lacuna no
 *  contrato, que o cliente preenche à mão na assinatura. */
export function montarEndereco(e: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}): string {
  const limpo = (v?: string | null) => (v ?? '').trim();
  if (!limpo(e.logradouro)) return '';

  const rua = [limpo(e.logradouro), limpo(e.numero) && `nº ${limpo(e.numero)}`].filter(Boolean).join(', ');
  const cidade = [limpo(e.cidade), limpo(e.uf)].filter(Boolean).join('-');
  return [rua, limpo(e.complemento), limpo(e.bairro), cidade, limpo(e.cep) && `CEP ${limpo(e.cep)}`]
    .filter(Boolean)
    .join(', ');
}

const LACUNA = '______________________________';
const LACUNA_CURTA = '____________________';

/** Qualificação das partes. Campo vazio vira lacuna em vez de sumir: contrato
 *  sem documento ou endereço do contratante enfraquece a cobrança, e a lacuna
 *  lembra de completar na hora de assinar. */
export function qualificacaoDasPartes(d: Pick<DadosDoContrato, 'contratante' | 'contratado'>): {
  contratante: string;
  contratado: string;
} {
  const c = d.contratante;
  const k = d.contratado;
  return {
    contratante:
      `${c.nome || LACUNA}, inscrito(a) no CPF/CNPJ sob o nº ${c.documento || LACUNA_CURTA}, ` +
      `com endereço em ${c.endereco || LACUNA}, ` +
      `e-mail ${c.email || LACUNA_CURTA} e telefone/WhatsApp ${c.telefone || LACUNA_CURTA}.`,
    contratado:
      `${k.nome}${k.cargo ? `, ${k.cargo}` : ''}, inscrito(a) no CPF/CNPJ sob o nº ${k.documento || LACUNA_CURTA}.`,
  };
}

export function tituloDoContrato(servicos: Pick<ServicoDoContrato, 'modulo'>[]): string {
  const modulos = modulosPresentes(servicos);
  if (modulos.length === 1 && modulos[0] === 'mentoria') return 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MENTORIA';
  return 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TECNOLOGIA';
}

/** Monta as cláusulas com os valores do orçamento.
 *
 *  Os valores vêm do orçamento, nunca de um modelo: o contrato sai no mesmo PDF,
 *  logo depois da proposta, e um contrato dizendo R$ 1.000 atrás de uma proposta
 *  de R$ 4.500 é o erro mais caro que este documento pode conter. */
export function montarClausulas(d: DadosDoContrato): ClausulaNumerada[] {
  const R = REGRAS_DO_CONTRATO;
  const tem = (m: ModuloContrato) => d.servicos.some((s) => s.modulo === m);

  const site = tem('site');
  const sistema = tem('sistema');
  const powerbi = tem('powerbi');
  const mentoria = tem('mentoria');
  const temPlano = d.valorMensal > 0 && (d.mesesPlano ?? 0) > 0;
  const mesesPlano = d.mesesPlano ?? 0;
  // Hospedagem só ganha cláusula própria quando há mensalidade que a pague:
  // sem plano não há o que manter no ar.
  const hospedagem = temPlano && tem('hospedagem');
  const entregaveis = site || sistema || powerbi;
  const trataDadosDeTerceiros = entregaveis || hospedagem;
  const unicos = d.servicos.filter((s) => s.cobranca !== 'mensal');
  const mensais = d.servicos.filter((s) => s.cobranca === 'mensal');
  const { primeira, segunda } = metadesDoPagamento(d.valorDesenvolvimento);

  const clausulas: ClausulaContrato[] = [];
  const incluir = (...lista: (ClausulaContrato | false)[]) => {
    for (const c of lista) if (c) clausulas.push(c);
  };

  // ── Objeto ────────────────────────────────────────────────────────────────
  incluir({
    titulo: 'OBJETO',
    paragrafos: [
      `O presente contrato tem por objeto a prestação, pelo CONTRATADO ao CONTRATANTE, dos serviços relacionados abaixo, nas condições, prazos e valores da Proposta Comercial nº ${d.numeroProposta}, que acompanha este instrumento e dele faz parte integrante:`,
    ],
    itens: d.servicos.map((s) => (s.cobranca === 'mensal' ? `${s.nome} (serviço mensal)` : s.nome)),
    fecho: [
      'Havendo divergência entre a proposta e este contrato, prevalece o disposto neste contrato. Serviços não relacionados acima dependem de orçamento específico e de termo aditivo.',
    ],
  });

  // ── Cláusulas de cada tipo de serviço ─────────────────────────────────────
  if (site) {
    incluir({
      titulo: 'ESCOPO DO SITE E DOMÍNIO',
      paragrafos: ['O desenvolvimento do site inclui:'],
      itens: [
        ...(d.clientePossuiDominio ? [] : ['Registro do domínio']),
        'Desenvolvimento do site institucional, com layout responsivo',
        'Publicação do site, com configuração de domínio, hospedagem e certificado SSL',
        'Otimizações para desempenho',
      ],
      rotuloSegundaLista: 'Não estão inclusos:',
      segundaLista: [
        ...(d.clientePossuiDominio ? ['Registro do domínio'] : []),
        ...(hospedagem ? [] : ['Custo mensal da hospedagem']),
        'Sistemas personalizados, loja virtual, área de membros e blog',
        'Integrações não previstas na proposta',
        'Criação de identidade visual, redação de textos e produção de fotos ou vídeos',
        'Política de privacidade e termos de uso',
      ],
      fecho: [
        d.clientePossuiDominio
          ? 'O domínio é e permanece de propriedade do CONTRATANTE, que já o possui registrado; o CONTRATADO realiza apenas a configuração e o apontamento técnico necessários à publicação.'
          : 'O domínio será registrado em nome do CONTRATANTE e permanece de sua propriedade, correndo por conta dele as taxas de renovação junto ao órgão de registro.',
        'Durante a vigência do contrato, o CONTRATADO poderá administrar tecnicamente as configurações do domínio, sem que isso implique transferência de propriedade.',
      ],
    });
  }

  if (sistema) {
    incluir({
      titulo: 'DO SISTEMA',
      paragrafos: [
        'O desenvolvimento do sistema compreende as funcionalidades descritas na proposta; funcionalidades, integrações, relatórios ou regras de negócio não descritos ali não integram o escopo.',
        'Integrações com serviços de terceiros (APIs, meios de pagamento, emissores de nota fiscal, entre outros) dependem da disponibilidade desses serviços, e eventuais taxas cobradas por eles são de responsabilidade do CONTRATANTE.',
        'Os dados inseridos no sistema pertencem ao CONTRATANTE.',
        ...(hospedagem
          ? []
          : ['O funcionamento do sistema depende de hospedagem, que será fornecida pelo CONTRATANTE ou orçada à parte.']),
      ],
    });
  }

  if (powerbi) {
    incluir({
      titulo: 'DOS DASHBOARDS (POWER BI)',
      paragrafos: [
        'O desenvolvimento compreende a modelagem dos dados, as medidas, os indicadores e as páginas descritos na proposta.',
        'As licenças da Microsoft necessárias para publicar, compartilhar e atualizar os relatórios (como Power BI Pro, Premium ou Fabric) não estão incluídas e são contratadas e pagas pelo CONTRATANTE, de quem também dependem o gateway e as credenciais da atualização automática dos dados.',
        'O CONTRATANTE fornecerá acesso às fontes de dados e responde pela exatidão, integridade e licitude dos dados nelas contidos. Os dashboards refletem essas fontes, e erros de origem não constituem defeito do serviço.',
        'Na entrega, os arquivos do projeto (.pbix) serão disponibilizados ao CONTRATANTE e, havendo acesso, os relatórios serão publicados no ambiente (workspace) dele. Mudanças posteriores na estrutura das fontes que exijam refazer consultas ou modelos serão orçadas à parte.',
      ],
    });
  }

  if (mentoria) {
    incluir({
      titulo: 'DA MENTORIA',
      paragrafos: [
        'A mentoria será realizada de forma online, em encontros agendados entre as partes, com o conteúdo, a carga horária e o número de encontros descritos na proposta.',
        `Os encontros devem ser utilizados em até ${dias(R.mentoriaValidadeDias)} contados da assinatura; os não utilizados nesse prazo por iniciativa do CONTRATANTE perdem a validade, sem direito a reembolso.`,
        `A remarcação deve ser solicitada com antecedência mínima de ${R.mentoriaAntecedenciaHoras} (${porExtenso(R.mentoriaAntecedenciaHoras)}) horas, e a ausência sem esse aviso será considerada encontro realizado. Encontros desmarcados pelo CONTRATADO são remarcados sem custo e não contam para o prazo de utilização.`,
        'A mentoria é obrigação de meio: o CONTRATADO compromete-se a transmitir o conhecimento com dedicação e técnica, mas não garante resultados específicos, aprovação em processos seletivos ou colocação profissional.',
        'Cumpridos os encontros contratados, o CONTRATADO emitirá certificado de conclusão em nome do CONTRATANTE, com o conteúdo e a carga horária realizados, que atesta a participação e não constitui diploma, título acadêmico ou registro em conselho profissional.',
        'Os encontros só poderão ser gravados com a concordância de ambas as partes, e as gravações serão de uso pessoal do CONTRATANTE.',
      ],
    });
  }

  if (temPlano) {
    const nomesMensais = mensais.map((s) => s.nome);
    incluir({
      titulo: 'PLANO MENSAL',
      paragrafos: [
        `O plano mensal compreende ${nomesMensais.length ? juntar(nomesMensais) : 'os serviços mensais da proposta'}, no valor de ${formatBRL(d.valorMensal)} por mês, pelo prazo de ${meses(mesesPlano)}, cobrado a partir da data acordada entre as partes e vencendo no mesmo dia de cada mês.`,
        `Encerrado esse prazo, o plano prossegue por prazo indeterminado, nas mesmas condições e com reajuste anual pelo IPCA/IBGE, podendo ser cancelado por qualquer das partes com aviso prévio de ${dias(R.avisoPrevioCancelamentoDias)}.`,
        // A hospedagem não tem cláusula própria: sem plano não há o que manter no
        // ar, e separá-la repetia vigência, valor e cancelamento.
        ...(hospedagem
          ? [
              'A hospedagem inclui servidor, certificado SSL, backups periódicos, monitoramento, atualizações de segurança e suporte via WhatsApp em horário comercial. O CONTRATADO empregará os meios técnicos adequados para manter o serviço disponível, sem garantia de funcionamento ininterrupto, já que a infraestrutura depende de provedores de terceiros.',
              'O CONTRATANTE responde pelo conteúdo publicado e não poderá hospedar material ilícito ou que viole direitos de terceiros; o CONTRATADO removerá conteúdo mediante ordem judicial, nos termos da Lei nº 12.965/2014 (Marco Civil da Internet).',
            ]
          : []),
        'O plano não inclui novas páginas, novas funcionalidades, mudanças de layout ou qualquer desenvolvimento adicional; solicitações que ultrapassem pequenas correções serão previamente orçadas.',
      ],
    });
  }

  // ── Execução ──────────────────────────────────────────────────────────────
  if (unicos.length > 0) {
    incluir({
      titulo: 'PRAZO DE EXECUÇÃO',
      paragrafos: [
        `O prazo para conclusão dos serviços de entrega única é de ${prazoPorExtenso(d.prazoDias)}, contados da confirmação do pagamento do sinal e do recebimento de todo o material e dos acessos necessários${unicos.length > 1 ? ', correspondendo à soma dos prazos individuais da proposta, já que os serviços são executados em sequência' : ''}.`,
        'Atrasos do CONTRATANTE no envio de informações, materiais, acessos ou aprovações prorrogam o prazo automaticamente pelo mesmo período.',
      ],
    });
  }

  incluir({
    titulo: 'MATERIAIS E ACESSOS DO CONTRATANTE',
    paragrafos: [
      'Compete ao CONTRATANTE fornecer, em tempo hábil, as informações e os acessos necessários à execução, em especial:',
    ],
    itens: [
      ...(site
        ? ['Logotipo, fotografias e textos institucionais', 'Contatos, endereço e redes sociais a serem exibidos no site']
        : []),
      ...(sistema ? ['Regras de negócio, processos e dados para cadastro ou importação no sistema'] : []),
      ...(powerbi ? ['Acesso às fontes de dados e as credenciais necessárias'] : []),
      ...(mentoria ? ['Computador, conexão à internet e os softwares indicados para os encontros'] : []),
      ...(site || sistema || powerbi || mentoria ? [] : ['Dados cadastrais e informações necessárias à execução dos serviços']),
    ],
    fecho: [
      'O CONTRATANTE declara possuir os direitos de uso do material que fornecer (textos, imagens, marcas e dados) e responde por ele perante terceiros, nos termos da Lei nº 9.610/1998; o CONTRATADO não responde por atrasos decorrentes da falta desse material.',
    ],
  });

  if (entregaveis) {
    incluir({
      titulo: 'ACEITE E GARANTIA',
      paragrafos: [
        `O CONTRATANTE terá direito a até ${R.rodadasDeRevisao} (${porExtensoFeminino(R.rodadasDeRevisao)}) rodadas de revisão por serviço, cada uma podendo reunir todas as alterações desejadas; alterações além delas serão previamente orçadas.`,
        `Concluído cada serviço, o CONTRATADO comunicará a entrega para validação, e o CONTRATANTE terá ${diasUteis(R.aceiteDiasUteis)} para aprová-la ou apontar, por escrito, os ajustes necessários dentro do escopo contratado. Sem manifestação nesse prazo, ou passando o CONTRATANTE a utilizar o serviço, a entrega será considerada aceita.`,
        `O CONTRATADO corrigirá sem custo os defeitos de funcionamento que se manifestarem em até ${dias(R.garantiaDias)} contados do aceite, nos termos do art. 26, II, do Código de Defesa do Consumidor. A garantia não cobre alterações feitas pelo CONTRATANTE ou por terceiros, uso em desacordo com as orientações do CONTRATADO nem mudanças posteriores em plataformas, navegadores, APIs ou serviços de terceiros.`,
      ],
    });
  }

  // ── Dinheiro ──────────────────────────────────────────────────────────────
  if (d.valorDesenvolvimento > 0) {
    incluir({
      titulo: 'VALOR E FORMA DE PAGAMENTO',
      paragrafos: [
        `O valor dos serviços de entrega única é de ${formatBRL(d.valorDesenvolvimento)}, já considerados os descontos da proposta, pago da seguinte forma:`,
      ],
      itens: [
        `50% (cinquenta por cento), equivalente a ${formatBRL(primeira)}, na assinatura deste contrato, como sinal para início dos trabalhos`,
        `50% (cinquenta por cento), equivalente a ${formatBRL(segunda)}, na conclusão dos serviços, antes da publicação ou entrega definitiva`,
      ],
      fecho: [
        'O pagamento poderá ser à vista ou parcelado, podendo incidir juros ou taxas da instituição financeira ou da plataforma utilizada. A execução tem início após a confirmação do sinal, e a publicação ou entrega definitiva ocorre após a confirmação do pagamento integral.',
        'Desistindo o CONTRATANTE após o início da execução, fora da hipótese de arrependimento prevista neste contrato, o CONTRATADO poderá reter do sinal o valor correspondente aos serviços já executados e às despesas comprovadamente realizadas, restituindo o saldo, se houver.',
      ],
    });
  }

  if (temPlano && mesesPlano > 12) {
    incluir({
      titulo: 'REAJUSTE',
      paragrafos: [
        'A mensalidade será reajustada a cada 12 (doze) meses de vigência pela variação acumulada do IPCA/IBGE no período. Na extinção desse índice, será aplicado o que oficialmente o substituir.',
      ],
    });
  }

  incluir({
    titulo: 'ATRASO NO PAGAMENTO',
    paragrafos: ['O atraso no pagamento de qualquer valor devido sujeita o CONTRATANTE a:'],
    itens: [
      `multa de ${pct(R.multaAtrasoPct)} sobre o valor em atraso`,
      `juros de mora de ${pct(R.jurosMoraMensalPct)} ao mês, calculados dia a dia`,
      'correção monetária pela variação do IPCA/IBGE',
    ],
    fecho: temPlano
      ? [
          `Nas mensalidades há tolerância de ${dias(R.toleranciaMensalidadeDias)} antes desses encargos. Persistindo o atraso por mais de ${dias(R.suspensaoAposDias)}, os serviços do plano poderão ser suspensos mediante aviso prévio de ${dias(R.avisoSuspensaoDias)} e, após ${dias(R.rescisaoAposDias)}, o contrato poderá ser rescindido${hospedagem ? ' e o conteúdo removido da hospedagem' : ''}.`,
        ]
      : undefined,
  });

  // ── Vigência e saída ──────────────────────────────────────────────────────
  const aoEncerrar = [
    ...(site ? ['o domínio permanece de propriedade do CONTRATANTE'] : []),
    ...(site || hospedagem
      ? [`${site ? 'os arquivos do site' : 'os arquivos hospedados'} ficam disponíveis para cópia pelo CONTRATANTE, mediante solicitação, por ${dias(R.arquivosDisponiveisDias)}`]
      : []),
    ...(sistema
      ? [`os dados do CONTRATANTE são exportados em formato aberto (como planilha), mediante solicitação feita em até ${dias(R.arquivosDisponiveisDias)}`]
      : []),
    ...(temPlano ? ['os serviços do plano mensal são encerrados'] : []),
  ];

  incluir({
    titulo: 'VIGÊNCIA E RESCISÃO',
    paragrafos: [
      `Este contrato vigora desde a assinatura até a conclusão dos serviços de entrega única${temPlano ? ' e o término do plano mensal' : ''}.`,
      ...(temPlano
        ? [
            `O plano tem permanência mínima de ${meses(mesesPlano)}; o cancelamento antes desse prazo, por iniciativa do CONTRATANTE e sem culpa do CONTRATADO, obriga ao pagamento de multa de ${pct(R.multaCancelamentoPlanoPct)} sobre as mensalidades restantes.`,
          ]
        : []),
      `Qualquer das partes poderá rescindir este contrato se a outra descumprir suas obrigações e não sanar a falta em ${dias(R.prazoParaSanarDias)} contados de notificação, sendo devidos os valores dos serviços já executados e das mensalidades vencidas até o encerramento.`,
    ],
    ...(aoEncerrar.length
      ? { rotuloSegundaLista: 'Encerrado o contrato e quitados os valores devidos:', segundaLista: aoEncerrar }
      : {}),
  });

  incluir({
    titulo: 'DIREITO DE ARREPENDIMENTO',
    paragrafos: [
      `Quando o CONTRATANTE for consumidor e a contratação ocorrer fora do estabelecimento do CONTRATADO (por internet, telefone ou WhatsApp, por exemplo), ele poderá desistir deste contrato em até ${dias(R.arrependimentoDias)} contados da assinatura, com devolução integral dos valores pagos, monetariamente atualizados, nos termos do art. 49 do Código de Defesa do Consumidor.`,
      'Dentro desse prazo, a execução só terá início mediante solicitação expressa do CONTRATANTE.',
    ],
  });

  // ── Direitos e dados ──────────────────────────────────────────────────────
  const cedidos = [site && 'o site', powerbi && 'os dashboards'].filter(Boolean) as string[];
  incluir({
    titulo: 'PROPRIEDADE INTELECTUAL',
    paragrafos: [
      ...(cedidos.length
        ? [
            `Após o pagamento integral, os direitos patrimoniais sobre ${juntar(cedidos)} desenvolvidos para o CONTRATANTE são a ele cedidos, nos termos da Lei nº 9.610/1998.`,
          ]
        : []),
      ...(sistema
        ? [
            'O sistema é licenciado ao CONTRATANTE, nos termos da Lei nº 9.609/1998. Após o pagamento integral, o CONTRATANTE recebe licença de uso permanente, não exclusiva e intransferível, para uso em sua própria atividade, sendo vedados a revenda, o sublicenciamento, a cópia para terceiros e a engenharia reversa. O código-fonte e a base do sistema permanecem de propriedade do CONTRATADO.',
            'Funcionalidades desenvolvidas exclusivamente a pedido do CONTRATANTE, que reflitam regras próprias do seu negócio, não serão oferecidas pelo CONTRATADO a terceiros.',
          ]
        : []),
      ...(mentoria
        ? [
            'O material didático da mentoria é licenciado para uso pessoal do CONTRATANTE, vedadas a reprodução, a distribuição e a comercialização, total ou parcial, sem autorização escrita do CONTRATADO.',
          ]
        : []),
      'Ferramentas, componentes reutilizáveis, metodologias e códigos de uso genérico do CONTRATADO permanecem de sua propriedade e podem ser utilizados em outros projetos. Bibliotecas e softwares de terceiros seguem as licenças de seus respectivos titulares.',
      ...(entregaveis
        ? [
            'O CONTRATADO poderá mencionar o projeto em seu portfólio, sem divulgar informações confidenciais ou dados do CONTRATANTE, salvo oposição deste por escrito.',
          ]
        : []),
    ],
  });

  incluir({
    titulo: 'CONFIDENCIALIDADE',
    paragrafos: [
      `As partes manterão sigilo sobre as informações não públicas a que tiverem acesso em razão deste contrato, inclusive dados comerciais, financeiros, técnicos e credenciais de acesso, durante a vigência e por ${R.sigiloAnos} (${porExtenso(R.sigiloAnos)}) anos após o seu término.`,
      'O sigilo não se aplica a informações já públicas, obtidas legitimamente de terceiros ou cuja divulgação seja exigida por lei ou ordem judicial.',
    ],
  });

  incluir({
    titulo: 'PROTEÇÃO DE DADOS PESSOAIS',
    paragrafos: trataDadosDeTerceiros
      ? [
          'As partes observarão a Lei nº 13.709/2018 (LGPD). Quanto aos dados pessoais tratados nos serviços objeto deste contrato, o CONTRATANTE é o controlador e o CONTRATADO atua como operador, tratando-os apenas conforme as instruções do CONTRATANTE e para a execução deste contrato.',
          'O CONTRATADO adotará medidas técnicas e administrativas aptas a proteger esses dados de acessos não autorizados e de situações acidentais ou ilícitas, e comunicará ao CONTRATANTE, em prazo razoável, incidente de segurança que possa acarretar risco ou dano relevante aos titulares.',
          'Compete ao CONTRATANTE assegurar a base legal do tratamento e manter política de privacidade adequada em seus canais. Encerrado o contrato, o CONTRATADO eliminará ou devolverá os dados pessoais tratados, ressalvada a guarda exigida por lei.',
        ]
      : [
          'Os dados pessoais do CONTRATANTE serão tratados pelo CONTRATADO apenas para a execução deste contrato e o cumprimento de obrigações legais, nos termos da Lei nº 13.709/2018 (LGPD).',
        ],
  });

  // ── Responsabilidades ─────────────────────────────────────────────────────
  // Não existe cláusula de "obrigações das partes": ela só repetia, em lista, o
  // que o escopo, o prazo, o aceite, o pagamento e as cláusulas de cada serviço
  // já obrigam. Repetir obrigação em outras palavras abre brecha de
  // interpretação em vez de fechar.
  incluir({
    titulo: 'LIMITAÇÃO DE RESPONSABILIDADE',
    paragrafos: ['O CONTRATADO não responde por danos decorrentes de:'],
    itens: [
      'caso fortuito ou força maior, nos termos do art. 393 do Código Civil',
      `falhas ou indisponibilidade de serviços de terceiros, como provedores de internet${site || hospedagem ? ', provedores de hospedagem, registradores de domínio' : ''}, plataformas e APIs`,
      'ataques cibernéticos ou eventos imprevisíveis, desde que adotadas as medidas de segurança adequadas',
      `conteúdo, dados ou materiais fornecidos pelo CONTRATANTE${powerbi ? ', inclusive decisões tomadas com base nos dados apresentados nos dashboards' : ''}`,
      'alterações realizadas pelo CONTRATANTE ou por terceiros sem participação do CONTRATADO',
    ],
    fecho: [
      'Nas relações que não sejam de consumo, a responsabilidade do CONTRATADO por perdas e danos fica limitada ao valor total efetivamente pago pelo CONTRATANTE neste contrato.',
    ],
  });

  // ── Forma ─────────────────────────────────────────────────────────────────
  incluir(
    {
      titulo: 'DISPOSIÇÕES FINAIS',
      paragrafos: [
        'As comunicações, aprovações e notificações relativas a este contrato serão válidas quando feitas por escrito, pelo e-mail ou WhatsApp informados na qualificação das partes, que se obrigam a mantê-los atualizados.',
        'O contrato pode ser assinado de forma manuscrita ou eletrônica, tendo a assinatura eletrônica plena validade jurídica (art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e Lei nº 14.063/2020). Assinado pelas partes e por 2 (duas) testemunhas, ou eletronicamente com verificação de integridade por provedor de assinatura, constitui título executivo extrajudicial (art. 784, III e § 4º, do Código de Processo Civil).',
        'A tolerância quanto ao descumprimento de qualquer cláusula não implica renúncia ou novação, e a nulidade de uma cláusula não prejudica as demais. Este contrato não gera vínculo empregatício, societário ou de representação, só pode ser alterado por termo aditivo assinado pelas partes e não pode ser cedido a terceiros sem concordância escrita da outra parte.',
      ],
    },
  );

  // As específicas entram por último, antes do foro: assim prevalecem sobre o
  // padrão e o leitor as encontra sempre no mesmo lugar.
  incluir(...(d.clausulasExtras ?? []));

  incluir({
    titulo: 'FORO',
    paragrafos: [
      `Fica eleito o foro da comarca de ${d.contratado.foro || '_______________'} para dirimir as controvérsias decorrentes deste contrato, ressalvado ao CONTRATANTE, quando consumidor, o direito de propor ação no foro de seu domicílio, nos termos do art. 101, I, do Código de Defesa do Consumidor.`,
    ],
  });

  // Numera pela ordem final, depois de as condicionais entrarem ou não.
  return clausulas.map((c, i) => ({ ...c, numero: i + 1 }));
}
