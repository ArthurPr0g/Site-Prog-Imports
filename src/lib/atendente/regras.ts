// Atendente de IA: tipos, cálculos e textos puros (servem ao servidor e à tela).
// O que fala com WhatsApp, e-mail, banco e Claude fica nos outros arquivos
// desta pasta e só roda no servidor.

import { simular, parcela, NOMES, type Escolha, type Simulacao } from '@/lib/simulador';
import { formatMoeda, type TabelaPrecos } from '@/lib/precos-captacao';
import { EM_NEGOCIACAO, type Lead, type LeadStatus } from '@/lib/captacao';

/* ------------------------------------------------------------ configuração */

export const MODELOS_DA_IA = [
  { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5 (melhor vendedor)', entrada: 4, saida: 20, cacheLido: 0.2 },
  { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5 (meio-termo)', entrada: 2, saida: 10, cacheLido: 0.2 },
  { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5 (mais barato)', entrada: 0.1, saida: 0.5, cacheLido: 0.01 },
] as const;
export type ModeloDaIA = (typeof MODELOS_DA_IA)[number]['id'];

/** Custo em dólar de uma chamada (preço por milhão de tokens; escrita no cache vale 1,25× a entrada). */
export function custoDaChamada(
  modelo: string,
  u: { entrada: number; saida: number; cacheLido: number; cacheEscrito: number }
): number {
  const m = MODELOS_DA_IA.find((x) => x.id === modelo) ?? MODELOS_DA_IA[0];
  return (u.entrada * m.entrada + u.cacheEscrito * m.entrada * 1.25 + u.cacheLido * m.cacheLido + u.saida * m.saida) / 1e6;
}

export type ConfigDoAtendente = {
  personaName: string;
  active: boolean;
  model: ModeloDaIA;
  monthlyBudgetUsd: number;
  extraDiscountMax: number;
  discountWaitMinutes: number;
  dailyEmailCap: number;
  ownerEmail: string | null;
};

/* ------------------------------------------------------------ preço */

/** Simulação do simulador do vendedor + desconto extra aprovado (só no valor do trabalho, nunca na mensalidade). */
export type Proposta = Simulacao & { descontoExtraPct: number; totalComExtra: number; texto: string };

export function calcularProposta(e: Escolha, t: TabelaPrecos, descontoExtraPct: number): Proposta {
  const s = simular(e, t);
  const m = (v: number) => formatMoeda(v, t.moeda);
  // Arredonda para o final 7 (reais) ou 0 (dólar) mais próximo: o final 97 da
  // tabela desce até 100 e, num pedido de 8%, virava 10%.
  const fim = t.moeda === 'BRL' ? 7 : 0;
  const comExtra =
    descontoExtraPct > 0 ? Math.round((s.total * (1 - descontoExtraPct / 100) - fim) / 10) * 10 + fim : s.total;
  const br = t.moeda === 'BRL';
  const linhas = [
    ...s.linhas.map((l) => `${l.nome}: ${m(l.valor)}`),
    ...(s.desconto > 0 ? [`Desconto do combo: -${m(s.desconto)}`] : []),
    `Total do trabalho${s.aPartirDe ? ' (a partir de)' : ''}: ${m(s.total)}`,
    ...(descontoExtraPct > 0
      ? [`Com a condição especial aprovada: ${m(comExtra)} (economia de ${m(s.total - comExtra)} no trabalho)`]
      : []),
    `Mensalidade (hospedagem, segurança, backups e suporte): ${m(s.mensal)}/mês`,
    ...(s.mensalSeparadas ? [`Separados seriam ${m(s.mensalSeparadas)}/mês`] : []),
    ...(br
      ? [
          `Pix ou boleto: ${m(comExtra / 2)} no fechamento + ${m(comExtra / 2)} na entrega`,
          `Cartão 2x sem juros: 2x de ${m(comExtra / 2)}`,
          `Cartão 6x: 6x de ${m(parcela(comExtra, 6))}; 12x: 12x de ${m(parcela(comExtra, 12))} (com a taxa da operadora)`,
        ]
      : [`50% to start: ${m(comExtra / 2)}; 50% on delivery: ${m(comExtra / 2)}`]),
  ];
  return { ...s, descontoExtraPct, totalComExtra: comExtra, texto: linhas.join('\n') };
}

export { NOMES as NOMES_DOS_PACOTES };

/* ------------------------------------------------------------ e-mails de primeiro contato */

export const ENDERECO_COMERCIAL =
  'Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO';

/** Dias depois do 1º e-mail para cada retorno por e-mail (etapas 1, 2 e 3). */
export const DIAS_DOS_RETORNOS = [3, 7, 14] as const;

export type DadosDoEmail = {
  persona: string;
  empresa: string;
  problema: string;
  elogio: string;
  diagnostico: string;
  whatsapp: string;
  ingles: boolean;
};

/** Texto mandado em cada etapa (0 = primeiro contato). Fatos só do próprio lead. */
export function emailDaEtapa(etapa: number, d: DadosDoEmail): { assunto: string; corpo: string } {
  const assinatura = d.ingles
    ? `${d.persona}\nProg Soluções · websites, online stores and management systems\n${ENDERECO_COMERCIAL}\nIf you'd rather not hear from us, just reply "no".`
    : `${d.persona}\nProg Soluções · sites, lojas virtuais e sistemas de gestão\n${ENDERECO_COMERCIAL}\nSe não quiser mais receber mensagens, é só responder "não".`;
  if (d.ingles) {
    const textos = [
      {
        assunto: `${d.empresa}: a quick look at your online presence`,
        corpo: `Hi there,\n\nI'm ${d.persona} from Prog Soluções. I found ${d.empresa} on Google Maps${d.elogio} and ${d.problema}.\n\nI put together a free review, no strings attached, with what I found and how other businesses nearby show up online:\n${d.diagnostico}\n\nIf it makes sense, message me on WhatsApp and I'll walk you through it in 5 minutes:\n${d.whatsapp}\n\nBest,\n${assinatura}`,
      },
      {
        assunto: `Re: ${d.empresa}: a quick look at your online presence`,
        corpo: `Hi! Just checking whether you had a chance to see the review I prepared for ${d.empresa}:\n${d.diagnostico}\n\nAny questions, I'm on WhatsApp: ${d.whatsapp}\n\n${assinatura}`,
      },
      {
        assunto: `${d.empresa}: one idea`,
        corpo: `Hi! One last idea for ${d.empresa}: most new customers check Google before calling. A simple, fast website with a WhatsApp button usually turns those searches into conversations.\n\nThe review is still here: ${d.diagnostico}\nWhatsApp: ${d.whatsapp}\n\n${assinatura}`,
      },
      {
        assunto: `Closing the loop on ${d.empresa}`,
        corpo: `Hi! I won't take more of your time. If this becomes a priority later, just message me on WhatsApp: ${d.whatsapp}\n\nAll the best,\n${assinatura}`,
      },
    ];
    return textos[etapa] ?? textos[0];
  }
  const textos = [
    {
      assunto: `${d.empresa}: uma análise rápida da presença online`,
      corpo: `Olá, tudo bem?\n\nAqui é a ${d.persona}, da Prog Soluções. Encontrei a ${d.empresa} no Google Maps${d.elogio} e ${d.problema}.\n\nPreparei um diagnóstico gratuito, sem compromisso, com o que encontrei e como os concorrentes da região aparecem:\n${d.diagnostico}\n\nSe fizer sentido, me chama no WhatsApp que eu te explico em 5 minutos:\n${d.whatsapp}\n\nAbraço,\n${assinatura}`,
    },
    {
      assunto: `Re: ${d.empresa}: uma análise rápida da presença online`,
      corpo: `Oi! Passando para saber se você conseguiu ver o diagnóstico que preparei para a ${d.empresa}:\n${d.diagnostico}\n\nQualquer dúvida, estou no WhatsApp: ${d.whatsapp}\n\n${assinatura}`,
    },
    {
      assunto: `${d.empresa}: uma ideia`,
      corpo: `Oi! Uma última ideia para a ${d.empresa}: a maioria dos clientes novos procura no Google antes de ligar. Um site simples, rápido e com botão de WhatsApp costuma transformar essas buscas em conversas.\n\nO diagnóstico continua aqui: ${d.diagnostico}\nWhatsApp: ${d.whatsapp}\n\n${assinatura}`,
    },
    {
      assunto: `Encerrando o contato sobre a ${d.empresa}`,
      corpo: `Oi! Não vou tomar mais o seu tempo. Se isso virar prioridade mais para frente, é só me chamar no WhatsApp: ${d.whatsapp}\n\nSucesso!\n${assinatura}`,
    },
  ];
  return textos[etapa] ?? textos[0];
}

/** O texto que o botão do e-mail e do diagnóstico já preenchem (o webhook reconhece o lead por ele). */
export const textoDoBotao = (empresa: string, persona: string, ingles: boolean) =>
  ingles
    ? `Hi ${persona}! I saw the review for ${empresa} and I'd like to talk.`
    : `Oi, ${persona}! Vi o diagnóstico de ${empresa} e quero conversar.`;

/** Nome da empresa no texto do botão (ou null). */
export function empresaDoTexto(texto: string): string | null {
  const m = texto.match(/diagn[óo]stico d[aeo]s?\s+(.+?)\s+e quero conversar/i) ?? texto.match(/review for\s+(.+?)\s+and I'd like/i);
  return m ? m[1].trim() : null;
}

/* ------------------------------------------------------------ placar */

export type Vendedor = { chave: string; nome: string; ia: boolean; leadIds: string[] };

export type LinhaDoPlacar = {
  chave: string;
  nome: string;
  ia: boolean;
  leads: number;
  contatados: number;
  responderam: number;
  emNegociacao: number;
  reunioes: number;
  propostas: number;
  fechados: number;
  perdidos: number;
  valorFechado: number;
  mensalFechado: number;
  taxaResposta: number | null;
  taxaFechamento: number | null;
  ultimoFechamento: string | null;
};

const PASSOU_DA_REUNIAO: LeadStatus[] = ['reuniao', 'proposta', 'fechado'];
const PASSOU_DA_PROPOSTA: LeadStatus[] = ['proposta', 'fechado'];

/**
 * Placar por vendedor: o funil dos leads que cada um recebeu. Valor fechado
 * pela tabela (mesma estimativa do painel). Taxas sobre quem foi contatado.
 */
export function placar(
  vendedores: Vendedor[],
  leads: Pick<Lead, 'id' | 'status' | 'firstContactAt' | 'repliedAt' | 'closedAt'>[],
  valor: (id: string) => { unico: number; mensal: number }
): LinhaDoPlacar[] {
  const porId = new Map(leads.map((l) => [l.id, l]));
  return vendedores
    .map((v) => {
      const meus = v.leadIds.map((id) => porId.get(id)).filter((l): l is NonNullable<typeof l> => !!l);
      const contatados = meus.filter((l) => l.firstContactAt || l.status !== 'novo').length;
      const responderam = meus.filter((l) => l.repliedAt || EM_NEGOCIACAO.includes(l.status) || l.status === 'fechado').length;
      const fechados = meus.filter((l) => l.status === 'fechado');
      const fechamentos = fechados.map((l) => l.closedAt).filter((d): d is string => !!d).sort();
      return {
        chave: v.chave,
        nome: v.nome,
        ia: v.ia,
        leads: meus.length,
        contatados,
        responderam,
        emNegociacao: meus.filter((l) => EM_NEGOCIACAO.includes(l.status)).length,
        reunioes: meus.filter((l) => PASSOU_DA_REUNIAO.includes(l.status)).length,
        propostas: meus.filter((l) => PASSOU_DA_PROPOSTA.includes(l.status)).length,
        fechados: fechados.length,
        perdidos: meus.filter((l) => l.status === 'perdido' || l.status === 'nao_contatar').length,
        valorFechado: fechados.reduce((s, l) => s + valor(l.id).unico, 0),
        mensalFechado: fechados.reduce((s, l) => s + valor(l.id).mensal, 0),
        taxaResposta: contatados ? responderam / contatados : null,
        taxaFechamento: contatados ? fechados.length / contatados : null,
        ultimoFechamento: fechamentos.at(-1) ?? null,
      };
    })
    .sort((a, b) => b.fechados - a.fechados || b.valorFechado - a.valorFechado || b.responderam - a.responderam);
}

/* ------------------------------------------------------------ painel */

export type ConversaDoPainel = {
  id: string;
  channel: 'whatsapp' | 'instagram';
  contactId: string;
  contactName: string | null;
  leadId: string | null;
  leadName: string | null;
  leadStatus: LeadStatus | null;
  kitId: string | null;
  mode: 'ia' | 'humano';
  needsHuman: boolean;
  needsHumanReason: string | null;
  summary: string | null;
  lastInboundAt: string | null;
  lastMessageAt: string;
  unread: number;
  ultimaMensagem: string | null;
};

export type MensagemDoPainel = {
  id: string;
  direction: 'in' | 'out';
  author: 'lead' | 'ia' | 'arthur' | 'sistema';
  body: string;
  status: string | null;
  error: string | null;
  createdAt: string;
};

export type PedidoDeDesconto = {
  id: string;
  conversationId: string;
  leadName: string | null;
  percent: number;
  reason: string | null;
  status: 'aguardando' | 'aprovado' | 'negado';
  releaseAt: string;
  createdAt: string;
};

export type PainelDoAtendente = {
  config: ConfigDoAtendente;
  conversas: ConversaDoPainel[];
  pedidos: PedidoDeDesconto[];
  gastoDoMes: number;
  mensagensDoMes: number;
  emailsHoje: number;
  integracoes: { whatsapp: boolean; email: boolean; ia: boolean; banco: boolean; relogio: boolean };
};
