// Checklist de descoberta: o que o vendedor (ou o dono) levanta na primeira
// conversa para entender o negócio. Gravado em leads.discovery (jsonb) com as
// chaves abaixo; o card do lead no painel mostra o resumo.

export type TipoDaPergunta = 'texto' | 'textoLongo' | 'uma' | 'varias';

export type PerguntaDoChecklist = {
  chave: string;
  pergunta: string;
  dica?: string;
  tipo: TipoDaPergunta;
  opcoes?: string[];
};

export const CHECKLIST: PerguntaDoChecklist[] = [
  { chave: 'decisor', pergunta: 'Quem decide a contratação?', dica: 'Nome e cargo (dono, sócio, gerente…)', tipo: 'texto' },
  // O "gap" (Gap Selling): como está, aonde quer chegar e quanto custa ficar como está.
  { chave: 'estadoAtual', pergunta: 'Como está hoje?', dica: 'Nas palavras do cliente. Ex.: só indicação, agenda no caderno', tipo: 'textoLongo' },
  { chave: 'estadoDesejado', pergunta: 'Aonde quer chegar?', dica: 'Ex.: 20 alunos novos por mês, parar de responder preço um por um', tipo: 'textoLongo' },
  { chave: 'custoDoGap', pergunta: 'Quanto custa ficar como está?', dica: 'Clientes ou R$ por mês, nas palavras dele', tipo: 'texto' },
  {
    chave: 'origemClientes',
    pergunta: 'Como os clientes novos chegam hoje?',
    tipo: 'varias',
    opcoes: ['Indicação', 'Instagram', 'Google / Google Maps', 'WhatsApp', 'Passando na frente', 'Marketplace / iFood', 'Outro'],
  },
  {
    chave: 'dores',
    pergunta: 'Quais as principais dores do negócio?',
    tipo: 'varias',
    opcoes: [
      'Poucos clientes novos',
      'Perde tempo respondendo preço no WhatsApp',
      'Agenda desorganizada',
      'Estoque ou pedidos desorganizados',
      'Financeiro desorganizado',
      'Imagem amadora na internet',
      'Site antigo, fora do ar ou ruim no celular',
      'Não vende pela internet',
      'Depende de planilha ou caderno',
    ],
  },
  { chave: 'usaHoje', pergunta: 'O que usam hoje?', dica: 'Site, sistema, planilha, caderno, Instagram…', tipo: 'texto' },
  { chave: 'tentativas', pergunta: 'Já tentaram resolver antes? Como foi?', tipo: 'textoLongo' },
  {
    chave: 'interesse',
    pergunta: 'O que mais interessou?',
    tipo: 'varias',
    opcoes: ['Site', 'Loja virtual', 'Sistema de gestão', 'Logo / identidade visual'],
  },
  {
    chave: 'urgencia',
    pergunta: 'Quando querem resolver?',
    tipo: 'uma',
    opcoes: ['Agora', 'Nos próximos 3 meses', 'Só pesquisando'],
  },
  {
    chave: 'investimento',
    pergunta: 'Quanto pensam em investir?',
    tipo: 'uma',
    opcoes: ['Até R$ 2 mil', 'R$ 2 a 5 mil', 'R$ 5 a 10 mil', 'Acima de R$ 10 mil', 'Não disse'],
  },
  { chave: 'melhorContato', pergunta: 'Melhor horário e canal para falar', dica: 'Ex.: WhatsApp à tarde', tipo: 'texto' },
  {
    chave: 'observacoes',
    pergunta: 'Observações',
    dica: 'Objeções, concorrentes citados, detalhes da conversa',
    tipo: 'textoLongo',
  },
];

export type RespostasDoChecklist = Record<string, string | string[]>;

/** Respostas válidas: só chaves conhecidas, textos aparados, listas sem vazios. */
export function limparRespostas(r: RespostasDoChecklist): RespostasDoChecklist {
  const limpo: RespostasDoChecklist = {};
  for (const p of CHECKLIST) {
    const v = r[p.chave];
    if (Array.isArray(v)) {
      const lista = v.filter((x) => typeof x === 'string' && x.trim()).slice(0, 20);
      if (lista.length) limpo[p.chave] = lista;
    } else if (typeof v === 'string' && v.trim()) {
      limpo[p.chave] = v.trim().slice(0, 2000);
    }
  }
  return limpo;
}

export const respondidas = (r: RespostasDoChecklist | null | undefined) =>
  r ? CHECKLIST.filter((p) => r[p.chave] && (!Array.isArray(r[p.chave]) || (r[p.chave] as string[]).length)).length : 0;

/** Resumo curto para o card: dores, urgência, investimento e decisor. */
export function resumoDoChecklist(r: RespostasDoChecklist | null | undefined): string[] {
  if (!r) return [];
  const t = (k: string) => (Array.isArray(r[k]) ? (r[k] as string[]).join(', ') : (r[k] as string | undefined));
  return [
    t('decisor') && `Decide: ${t('decisor')}`,
    t('dores') && `Dores: ${t('dores')}`,
    t('urgencia') && `Urgência: ${t('urgencia')}`,
    t('investimento') && `Investimento: ${t('investimento')}`,
    t('interesse') && `Interesse: ${t('interesse')}`,
  ].filter(Boolean) as string[];
}
