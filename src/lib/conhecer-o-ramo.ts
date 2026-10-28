// "Conheça o ramo": o básico de cada tipo de negócio para o vendedor chegar na
// conversa entendendo o dia a dia do cliente (pedido do dono, 27/10/2026).
// Por grupo de ramo, não por empresa: é orientação geral, não dado do lead.
// O que é do lead (avaliações, horário, região) vem do Google, na ficha.

export type GuiaDoRamo = {
  grupo: string;
  comoFunciona: string;
  dores: string[];
  perguntas: string[];
  argumento: string;
};

const GUIAS: { chaves: string[]; guia: GuiaDoRamo }[] = [
  {
    chaves: ['odonto', 'dentist', 'dental', 'clínica médica', 'clinica medica', 'fisioterapia', 'psicolog', 'nutricion', 'consultório', 'consultorio', 'médic', 'medic', 'laborat'],
    guia: {
      grupo: 'Saúde (clínicas e consultórios)',
      comoFunciona:
        'Vive de agenda: consultas marcadas, retornos e tratamentos em várias sessões. O paciente pesquisa no Google, lê avaliações e escolhe quem passa mais confiança. A recepção costuma fazer tudo pelo WhatsApp.',
      dores: [
        'Faltas e remarcações sem aviso, que deixam horário vazio',
        'Recepção sobrecarregada respondendo as mesmas perguntas no WhatsApp',
        'Ficha do paciente espalhada em papel, planilha e conversa',
        'Depender só de indicação e convênio para trazer paciente novo',
      ],
      perguntas: [
        'Como o paciente marca hoje: telefone, WhatsApp ou algum sistema?',
        'Quantas faltas vocês têm numa semana normal?',
        'De onde vem a maioria dos pacientes novos?',
      ],
      argumento:
        'Um site com os tratamentos, a equipe e os depoimentos transforma quem pesquisa no Google em paciente; com o sistema de gestão, a agenda e a ficha ficam num lugar só e os lembretes reduzem as faltas.',
    },
  },
  {
    chaves: ['salão', 'salao', 'barbearia', 'barber', 'estética', 'estetica', 'sobrancelha', 'beleza', 'manicure', 'cabeleireir', 'hair', 'salon', 'spa'],
    guia: {
      grupo: 'Beleza e estética',
      comoFunciona:
        'Atendimento por horário, cliente fiel que volta todo mês e muita venda pelo Instagram. Profissionais costumam trabalhar por comissão. Promoções e pacotes movimentam os meses fracos.',
      dores: [
        'Agenda no caderno ou no WhatsApp, com horário duplicado ou esquecido',
        'Calcular comissão de cada profissional no fim do mês',
        'Cliente que some e ninguém chama de volta',
        'Instagram bonito, mas sem um lugar para ver preços e agendar',
      ],
      perguntas: [
        'Como o cliente agenda hoje e quem cuida da agenda?',
        'Como vocês calculam a comissão dos profissionais?',
        'Vocês têm pacotes ou planos mensais?',
      ],
      argumento:
        'Site com serviços, fotos dos trabalhos e botão de agendar, mais um sistema que organiza agenda, comissão e lembra o cliente de voltar.',
    },
  },
  {
    chaves: ['academia', 'pilates', 'crossfit', 'yoga', 'fitness', 'gym', 'personal'],
    guia: {
      grupo: 'Academias e estúdios',
      comoFunciona:
        'Receita recorrente de mensalidades e planos. Ganha na matrícula e perde no cancelamento: manter o aluno frequentando é o que segura o caixa. Aulas com horário e turma limitada.',
      dores: [
        'Mensalidade atrasada e cobrança feita no boca a boca',
        'Aluno que para de ir e cancela sem ninguém perceber antes',
        'Controle de turmas, horários e vagas',
        'Pouca presença no Google perto das academias grandes',
      ],
      perguntas: [
        'Como vocês controlam quem pagou a mensalidade?',
        'Quantos alunos ativos vocês têm hoje, mais ou menos?',
        'Como o aluno novo chega até vocês?',
      ],
      argumento:
        'Site com planos, horários e aula experimental para captar aluno; sistema que controla mensalidades, frequência e avisa quem está sumindo.',
    },
  },
  {
    chaves: ['pet', 'veterinár', 'veterinar', 'animais', 'banho e tosa'],
    guia: {
      grupo: 'Pet shops e veterinárias',
      comoFunciona:
        'Mistura de loja (ração, acessórios) e serviço com agenda (banho e tosa, consulta, vacina). Cliente fiel, que volta em ciclos (banho a cada 15 dias, ração todo mês, vacina todo ano).',
      dores: [
        'Agenda de banho e tosa no papel ou no WhatsApp',
        'Esquecer de lembrar a vacina e o retorno do pet',
        'Controle de estoque de ração e produtos',
        'Concorrência com grandes redes e lojas online',
      ],
      perguntas: [
        'O que pesa mais hoje: a loja ou os serviços?',
        'Vocês lembram o cliente da vacina e do próximo banho?',
        'Já pensaram em vender ração com entrega pelo site?',
      ],
      argumento:
        'Loja virtual para ração e acessórios com entrega no bairro, e sistema com a ficha de cada pet, agenda de serviços e lembretes automáticos.',
    },
  },
  {
    chaves: ['escola', 'idiomas', 'autoescola', 'curso', 'infantil', 'school', 'academy', 'ensino', 'condutores'],
    guia: {
      grupo: 'Educação',
      comoFunciona:
        'Matrículas concentradas em algumas épocas do ano, mensalidades recorrentes e muita comparação entre opções antes de decidir. Os pais (ou o aluno) pesquisam bastante no Google.',
      dores: [
        'Inadimplência e controle de mensalidades',
        'Muita pergunta repetida no WhatsApp sobre preço, horário e turma',
        'Captação concentrada na época de matrícula',
        'Controle de turmas, frequência e aulas',
      ],
      perguntas: [
        'Quando é o pico de matrículas de vocês?',
        'Como os interessados chegam: Google, Instagram ou indicação?',
        'Como vocês controlam as mensalidades?',
      ],
      argumento:
        'Site que responde as dúvidas e capta matrícula o ano todo, e sistema que organiza turmas, frequência e cobrança.',
    },
  },
  {
    chaves: ['advoga', 'advocacia', 'lawyer', 'attorney', 'contab', 'contador', 'accounting', 'arquitet', 'imobili', 'real estate', 'despachante', 'corretor', 'insurance', 'seguro'],
    guia: {
      grupo: 'Serviços profissionais',
      comoFunciona:
        'Vende confiança e especialização. O cliente decide pela reputação, pela indicação e pelo que encontra quando pesquisa o nome do escritório. Contratos maiores, ciclo de decisão mais longo.',
      dores: [
        'Depender quase só de indicação',
        'Site antigo ou inexistente, que não mostra a especialidade',
        'Prazos, documentos e clientes controlados em planilha',
        'Muito tempo gasto em atendimento que não vira contrato',
      ],
      perguntas: [
        'Qual tipo de cliente vocês mais querem atrair?',
        'Como chega um cliente novo hoje?',
        'Como vocês controlam prazos e documentos de cada cliente?',
      ],
      argumento:
        'Site profissional que mostra a especialidade e gera contato qualificado, e sistema para clientes, prazos e documentos.',
    },
  },
  {
    chaves: ['loja', 'ótica', 'otica', 'joalheria', 'floricultura', 'cosmétic', 'cosmetic', 'suplemento', 'calçado', 'calcado', 'móveis', 'moveis', 'decoração', 'decoracao', 'materiais de construção', 'materiais de construcao', 'ferrag', 'bicicleta', 'roupa', 'moda', 'boutique', 'store', 'shop', 'distribuidora', 'bebidas', 'conveniência', 'conveniencia', 'mercado', 'utilidades'],
    guia: {
      grupo: 'Comércio e varejo',
      comoFunciona:
        'Vive de giro de estoque e de movimento: vitrine, Instagram e WhatsApp. Muita gente pergunta preço e disponibilidade antes de ir até a loja. Datas como Dia das Mães, Black Friday e Natal pesam no ano.',
      dores: [
        'Vender pelo WhatsApp um a um, sem catálogo organizado',
        'Controle de estoque e de vendas na mão',
        'Perder venda fora do horário da loja',
        'Concorrência com marketplaces e lojas online',
      ],
      perguntas: [
        'Vocês já vendem online ou só na loja física?',
        'Quantos pedidos chegam pelo WhatsApp numa semana?',
        'Como vocês controlam o estoque hoje?',
      ],
      argumento:
        'Loja virtual com catálogo, pagamento e entrega, vendendo 24 horas, e sistema que junta estoque e vendas da loja física e da online.',
    },
  },
  {
    chaves: ['lavanderia', 'dedetiza', 'assistência técnica', 'assistencia tecnica', 'oficina', 'mecânic', 'mecanic', 'buffet', 'festas', 'cleaning', 'limpeza', 'auto', 'contractor', 'construction', 'reforma'],
    guia: {
      grupo: 'Serviços locais',
      comoFunciona:
        'Atende quem está perto e precisa resolver algo agora, ou planeja um evento. Pedido de orçamento chega por telefone e WhatsApp; quem responde primeiro e passa confiança fecha.',
      dores: [
        'Orçamentos feitos à mão, um por um',
        'Ordem de serviço e status do pedido sem controle',
        'Cliente que não encontra preço nem como pedir orçamento',
        'Agenda de visitas, equipe e entregas',
      ],
      perguntas: [
        'Como o cliente pede orçamento hoje?',
        'Quanto tempo leva para vocês responderem um orçamento?',
        'Como vocês acompanham cada serviço até a entrega?',
      ],
      argumento:
        'Site que aparece no Google e já recebe o pedido de orçamento, e sistema de ordens de serviço com status e histórico de cada cliente.',
    },
  },
];

const GERAL: GuiaDoRamo = {
  grupo: 'Negócio local',
  comoFunciona:
    'Negócio que depende de ser encontrado por quem está perto e de passar confiança na primeira pesquisa no Google.',
  dores: [
    'Depender só de indicação e do movimento da rua',
    'Atendimento e pedidos espalhados no WhatsApp',
    'Controles do dia a dia em papel ou planilha',
  ],
  perguntas: [
    'Como o cliente novo encontra vocês hoje?',
    'O que mais toma tempo da equipe no dia a dia?',
    'O que vocês gostariam de vender mais?',
  ],
  argumento: 'Presença profissional no Google com um site próprio, e um sistema simples para organizar o dia a dia.',
};

/** Guia do grupo do ramo (pela categoria do Google e pelo termo da busca). */
export function guiaDoRamo(category: string | null, niche: string | null): GuiaDoRamo {
  const texto = `${niche ?? ''} ${category ?? ''}`.toLowerCase();
  return GUIAS.find((g) => g.chaves.some((c) => texto.includes(c)))?.guia ?? GERAL;
}
