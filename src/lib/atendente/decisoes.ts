// Decisões do Arthur por botão no WhatsApp da Lia (pedido de 30/10/2026). Só no servidor.
// O id de cada botão diz a ação: "<tipo>:<valor>:<id>".
//   enc:ok|nao:<encomenda>            chamar (ou não) o cliente indicado
//   duv:a|b|c|d:<encomenda>           resposta a uma dúvida da Lia sobre o pedido
//   pag:nada|sinal|total|gratis|depois:<enc> em que pé está o financeiro
//   pagou:asaas|pix|cartao:<enc>      onde foi pago
//   desc:ok|nao:<pedido de desconto>  desconto extra pedido pela Lia
//   conv:assumir|lia:<conversa>       cliente chamou o Arthur
//   proj:<chave>|outro:<ideia>        projeto de um pedido "Claude, ..." (0100)
//   ind:sim|gratis|nao:<lead>         contato novo disse que foi indicado pelo Arthur (0107)
//   neg:<ação>:<sessão>               atualizar a negociação de um cliente (0112, negociacao.ts)

import type { DbDoAtendente } from './db';
import { enviarTexto, type MensagemRecebida } from './whatsapp-api';
import { abrirProjetoDeCortesia, decidirEncomenda, decidirFinanceiro, responderDuvida } from './encomenda';
import { SITE_URL } from '@/lib/seo';
import { responderConversa } from './agente';
import { escolherProjeto } from './ideias';
import { decidirNegociacao } from './negociacao';

const ACAO = /^(enc|duv|pag|pagou|desc|conv|proj|ind|neg):([a-z]+):([0-9a-f-]{36})$/;

export const ehDecisao = (m: MensagemRecebida) => !!m.botaoId && ACAO.test(m.botaoId);

export async function tratarDecisao(db: DbDoAtendente, m: MensagemRecebida): Promise<void> {
  const [, tipo, valor, id] = m.botaoId!.match(ACAO)!;
  const de = m.de;
  switch (tipo) {
    case 'enc':
      return decidirEncomenda(db, id, valor === 'ok', de);
    case 'proj':
      return escolherProjeto(db, id, valor, null, de);
    case 'neg':
      return decidirNegociacao(db, valor, id, de);
    case 'duv':
      return responderDuvida(db, id, { letra: valor }, de);
    case 'pag':
    case 'pagou':
      return decidirFinanceiro(db, tipo, valor, id, de);
    case 'ind':
      return confirmarIndicacao(db, id, valor as 'sim' | 'gratis' | 'nao', de);
    case 'desc': {
      const { data: p } = await db.from('ia_discount_requests').select('status, percent').eq('id', id).maybeSingle();
      if (!p) return void (await enviarTexto(de, 'Não achei esse pedido de desconto.'));
      if (p.status !== 'aguardando') return void (await enviarTexto(de, `Esse pedido já foi resolvido (${p.status}).`));
      const status = valor === 'ok' ? 'aprovado' : 'negado';
      // O relógio vê o pedido resolvido e manda a Lia voltar ao cliente (resolverDescontos).
      await db.from('ia_discount_requests').update({ status, decided_by: 'arthur', decided_at: new Date().toISOString() }).eq('id', id).eq('status', 'aguardando');
      return void (await enviarTexto(de, status === 'aprovado' ? `✅ Desconto de ${Number(p.percent)}% aprovado. A Lia já volta ao cliente.` : '❌ Desconto negado. A Lia oferece outra saída ao cliente.'));
    }
    case 'conv': {
      const link = `${SITE_URL}/admin/atendimento?conversa=${id}`;
      if (valor === 'assumir') {
        await db.from('ia_conversations').update({ mode: 'humano', needs_human: false }).eq('id', id);
        return void (await enviarTexto(de, `🙋 Conversa com você: a Lia parou de responder. Responda pelo painel:\n${link}`));
      }
      await db.from('ia_conversations').update({ needs_human: false, needs_human_reason: null }).eq('id', id);
      return void (await enviarTexto(de, `🤖 Combinado: a Lia segue com a conversa.\n${link}`));
    }
  }
}

/**
 * Contato novo disse "O Arthur me indicou" (0107): o Arthur confirma (cobrança normal), confirma de graça
 * (vira projeto de indicação em cortesia, como "Lia, ..." + contato) ou não reconhece.
 */
async function confirmarIndicacao(db: DbDoAtendente, leadId: string, valor: 'sim' | 'gratis' | 'nao', de: string): Promise<void> {
  const { data: l } = await db.from('leads').select('id, name, phone, notes, source').eq('id', leadId).maybeSingle();
  if (!l) return void (await enviarTexto(de, 'Não achei esse contato.'));
  const { data: conv } = await db.from('ia_conversations').select('id').eq('lead_id', leadId).not('contact_id', 'like', 'simulador:%').order('last_message_at', { ascending: false }).limit(1).maybeSingle();
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const anotar = (linha: string) => db.from('leads').update({ notes: `${l.notes ? l.notes + '\n' : ''}${linha}`.slice(0, 8000) }).eq('id', leadId);
  if (valor === 'nao') {
    await anotar(`[${hoje}] O Arthur NÃO reconhece a indicação.`);
    if (conv) await responderConversa(conv.id, 'O Arthur não reconhece essa indicação. Siga o atendimento normal (descoberta e proposta), sem citar indicação nem o Arthur. Escreva SÓ a mensagem para o cliente, se fizer sentido responder agora; se não, não escreva nada.');
    return void (await enviarTexto(de, `👍 Anotado: você não conhece ${l.name}. A Lia segue como atendimento normal.`));
  }
  if (valor === 'sim') {
    await anotar(`[${hoje}] Indicação confirmada pelo Arthur (cobrança normal).`);
    return void (await enviarTexto(de, `✅ Indicação de ${l.name} confirmada. A Lia faz o processo completo e fala de valores normalmente.`));
  }
  // De graça: vira indicação em cortesia (modo projeto da Lia, sem preço) e abre o projeto no Pós-venda.
  await anotar(`[${hoje}] Indicação confirmada pelo Arthur: projeto DE GRAÇA (cortesia).`);
  await db.from('leads').update({ source: 'indicacao_dono' }).eq('id', leadId);
  const { data: enc } = await db
    .from('encomendas')
    .insert({
      nome: l.name,
      telefone: l.phone,
      lead_id: leadId,
      conversation_id: conv?.id ?? null,
      status: 'contatado',
      pagamento: 'gratis',
      instrucoes: 'O cliente chamou a Lia dizendo que foi indicado pelo Arthur; o Arthur confirmou e disse que é de graça.',
      assunto: 'o seu projeto',
    })
    .select('id')
    .single();
  const aberto = enc ? await abrirProjetoDeCortesia(db, enc.id) : '';
  if (conv) await responderConversa(conv.id, 'O Arthur confirmou a indicação: este projeto é cortesia dele. Siga o MODO PROJETO (descoberta completa) sem falar de preço. Escreva SÓ a mensagem para o cliente, se fizer sentido responder agora.');
  await enviarTexto(de, `🎁 Indicação de ${l.name} confirmada como *de graça*. A Lia não fala de preço.${aberto}`);
}
