// Pós-entrega automático (pedido do Arthur em 30/10/2026: prova social e receita depois da entrega).
// A partir da data de entrega (projetos.entregue_em), a Lia volta ao cliente:
//   7 dias  → como está sendo; se satisfeito, avaliação no Google (ou depoimento) e autorização do portfólio;
//   30 dias → resultados; se não tem manutenção mensal, oferece com base no que se sabe do negócio;
//   90 dias → resultados e uma melhoria ou serviço novo que faça sentido.
// Dentro da janela de 24 h a Lia escreve na hora; fora dela vai o modelo "acompanhamento" e, quando o cliente
// responder, a orientação está no contexto da conversa (orientacaoDoPosEntrega). Respostas do cliente são
// gravadas com a ferramenta registrar_pos_entrega. Um envio por chamada do relógio, em horário comercial.
// Só no servidor.

import type { DbDoAtendente } from './db';
import type { ConfigDoAtendente } from './regras';
import type { Json } from '@/lib/supabase/database.types';
import { JANELA_MS } from './whatsapp-api';
import { enviarModeloAoCliente } from './modelos';
import { responderConversa, SIMULADOR, INSTAGRAM_DA_PROG } from './agente';

export type PosEntrega = {
  d7?: string;
  d30?: string;
  d90?: string;
  ultimo?: 'd7' | 'd30' | 'd90';
  portfolio?: 'sim' | 'nao';
  avaliou?: boolean;
  depoimento?: string;
  quer_manutencao?: boolean;
};

const ETAPAS: { chave: 'd7' | 'd30' | 'd90'; dias: number; rotulo: string }[] = [
  { chave: 'd90', dias: 90, rotulo: '3 meses' },
  { chave: 'd30', dias: 30, rotulo: '1 mês' },
  { chave: 'd7', dias: 7, rotulo: '1 semana' },
];

/** Orientação para a Lia, conforme a etapa (vai no contexto da conversa por 7 dias depois do envio). */
export function orientacaoDoPosEntrega(
  pe: PosEntrega,
  p: { gratis: boolean; temMensal: boolean; linkAvaliacao: string | null },
): string | null {
  const etapa = pe.ultimo;
  const quando = etapa ? pe[etapa] : null;
  if (!etapa || !quando || Date.now() - new Date(quando).getTime() > 7 * 864e5) return null;
  const pedirProva = [
    pe.avaliou || pe.depoimento
      ? null
      : p.linkAvaliacao
        ? `uma avaliação no Google (link: ${p.linkAvaliacao})`
        : 'um depoimento curto, de 1 ou 2 frases, aqui mesmo no WhatsApp',
    pe.portfolio ? null : 'autorização para mostrar o projeto no portfólio da Prog Soluções',
    p.gratis ? `que publique o que foi feito e marque ${INSTAGRAM_DA_PROG} (projeto cortesia), se ainda não pediu` : null,
  ].filter(Boolean);
  const prova = pedirProva.length ? ` Se ele estiver satisfeito, peça com leveza, numa mensagem só: ${pedirProva.join('; ')}.` : '';
  const regras =
    ' Uma pergunta por mensagem, com [[opções: ...]] quando couber. Grave cada resposta com registrar_pos_entrega. Se ele tiver um problema, entenda e use pedir_ajuste. Nunca insista mais de uma vez no mesmo pedido.';
  if (etapa === 'd7') return `PÓS-ENTREGA (1 semana): pergunte como está sendo usar o projeto.${prova}${regras}`;
  if (etapa === 'd30')
    return `PÓS-ENTREGA (1 mês): pergunte que resultado ele já percebeu (contatos, vendas, elogios).${prova}${
      p.temMensal || pe.quer_manutencao === false
        ? ''
        : ' Depois, ofereça com naturalidade a manutenção mensal (atualizar fotos, preços, promoções, Google e pequenos ajustes sem gastar rodadas), ligando ao que você sabe do negócio dele. Não diga preço de cabeça: se ele quiser, grave quer_manutencao=true e diga que o Arthur manda a proposta.'
    }${regras}`;
  return `PÓS-ENTREGA (3 meses): pergunte como está o resultado e se algo mudou no negócio. Sugira UMA melhoria ou serviço novo que faça sentido pelo que você sabe dele (sem pressão; se ele se interessar, use chamar_arthur).${prova}${regras}`;
}

const horarioComercial = () => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
  const dia = p.find((x) => x.type === 'weekday')?.value;
  const hora = Number(p.find((x) => x.type === 'hour')?.value);
  return dia !== 'Sat' && dia !== 'Sun' && hora >= 9 && hora < 19;
};

/** Relógio: no máximo um acompanhamento por chamada. */
export async function cuidarDoPosEntrega(db: DbDoAtendente, cfg: ConfigDoAtendente): Promise<number> {
  if (!cfg.active || !horarioComercial()) return 0;
  const { data: projetos } = await db
    .from('projetos')
    .select('id, cliente, lead_id, entregue_em, pos_entrega')
    .not('entregue_em', 'is', null)
    .not('lead_id', 'is', null)
    .neq('status', 'encerrado')
    .limit(200);
  for (const p of projetos ?? []) {
    const pe = (p.pos_entrega ?? {}) as PosEntrega;
    const dias = (Date.now() - Date.parse(`${p.entregue_em}T12:00:00-03:00`)) / 864e5;
    // Só a etapa mais recente que venceu (projeto antigo não recebe as três de uma vez).
    const etapa = ETAPAS.find((e) => dias >= e.dias);
    if (!etapa || pe[etapa.chave]) continue;
    const { data: conversa } = await db
      .from('ia_conversations')
      .select('id, contact_id, contact_name, last_inbound_at, mode')
      .eq('lead_id', p.lead_id!)
      .not('contact_id', 'like', `${SIMULADOR}%`)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const agora = new Date().toISOString();
    // Marca antes (inclusive as etapas anteriores puladas): o próximo tick não repete.
    const marcado: PosEntrega = { ...pe, [etapa.chave]: agora, ultimo: etapa.chave };
    for (const e of ETAPAS) if (e.dias < etapa.dias && !marcado[e.chave]) marcado[e.chave] = 'pulado';
    await db.from('projetos').update({ pos_entrega: marcado as unknown as Json }).eq('id', p.id);
    if (!conversa || conversa.mode !== 'ia') return 1;
    const naJanela = conversa.last_inbound_at && Date.now() - new Date(conversa.last_inbound_at).getTime() < JANELA_MS - 10 * 60_000;
    if (naJanela) {
      await responderConversa(conversa.id, `Faça agora o acompanhamento de ${etapa.rotulo} depois da entrega (veja PÓS-ENTREGA no contexto). Escreva SÓ a mensagem para o cliente.`);
    } else {
      const nome = (conversa.contact_name ?? '').split(/\s+/)[0] || 'tudo bem';
      await enviarModeloAoCliente(db, conversa.id, conversa.contact_id, 'acompanhamento', [nome, etapa.rotulo, 'o seu projeto']);
    }
    return 1;
  }
  return 0;
}
