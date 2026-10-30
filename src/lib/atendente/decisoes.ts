// Decisões do Arthur por botão no WhatsApp da Lia (pedido de 30/10/2026). Só no servidor.
// O id de cada botão diz a ação: "<tipo>:<valor>:<id>".
//   enc:ok|nao:<encomenda>            chamar (ou não) o cliente indicado
//   pag:nada|sinal|total|gratis|depois:<enc> em que pé está o financeiro
//   pagou:asaas|pix|cartao:<enc>      onde foi pago
//   desc:ok|nao:<pedido de desconto>  desconto extra pedido pela Lia
//   conv:assumir|lia:<conversa>       cliente chamou o Arthur

import type { DbDoAtendente } from './db';
import { enviarTexto, type MensagemRecebida } from './whatsapp-api';
import { decidirEncomenda, decidirFinanceiro } from './encomenda';
import { SITE_URL } from '@/lib/seo';

const ACAO = /^(enc|pag|pagou|desc|conv):([a-z]+):([0-9a-f-]{36})$/;

export const ehDecisao = (m: MensagemRecebida) => !!m.botaoId && ACAO.test(m.botaoId);

export async function tratarDecisao(db: DbDoAtendente, m: MensagemRecebida): Promise<void> {
  const [, tipo, valor, id] = m.botaoId!.match(ACAO)!;
  const de = m.de;
  switch (tipo) {
    case 'enc':
      return decidirEncomenda(db, id, valor === 'ok', de);
    case 'pag':
    case 'pagou':
      return decidirFinanceiro(db, tipo, valor, id, de);
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
      const link = `${SITE_URL}/admin/captacao?aba=atendimento&conversa=${id}`;
      if (valor === 'assumir') {
        await db.from('ia_conversations').update({ mode: 'humano', needs_human: false }).eq('id', id);
        return void (await enviarTexto(de, `🙋 Conversa com você: a Lia parou de responder. Responda pelo painel:\n${link}`));
      }
      await db.from('ia_conversations').update({ needs_human: false, needs_human_reason: null }).eq('id', id);
      return void (await enviarTexto(de, `🤖 Combinado: a Lia segue com a conversa.\n${link}`));
    }
  }
}
