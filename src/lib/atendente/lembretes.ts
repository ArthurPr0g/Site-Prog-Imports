// Lembrete dentro das 24 h (pedido do dono em 28/10/2026): o cliente parou de
// responder e a última mensagem foi da Lia; 3 h depois ela manda UMA retomada
// curta, no idioma da conversa, com opções para tocar. Só em horário comercial
// do cliente (8h às 20h no fuso dele) e ainda dentro da janela de 24 h do WhatsApp.
// Chamado pelo relógio (no máximo 2 por minuto).

import type { DbDoAtendente } from '@/lib/atendente/db';
import { responderConversa, SIMULADOR } from '@/lib/atendente/agente';
import { fusoDoCliente } from '@/lib/idioma-do-lead';
import { mesmoTelefone } from '@/lib/atendente/avisos';

const LEMBRETE_DEPOIS_MS = 3 * 3600_000;
// Margem antes de a janela de 24 h fechar (a resposta precisa sair antes disso).
const JANELA_UTIL_MS = 22 * 3600_000;
const ENCERRADOS = ['fechado', 'perdido', 'nao_contatar'];

function horaNoFuso(fuso: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: fuso, hour: 'numeric', hour12: false }).format(new Date()));
}

export async function lembrarConversasParadas(db: DbDoAtendente): Promise<number> {
  const agora = Date.now();
  const { data: candidatas } = await db
    .from('ia_conversations')
    .select('id, contact_id, last_inbound_at, lembrete_em, needs_human, leads(status, country, state)')
    .eq('mode', 'ia')
    .eq('needs_human', false)
    .gte('last_inbound_at', new Date(agora - JANELA_UTIL_MS).toISOString())
    .lte('last_inbound_at', new Date(agora - LEMBRETE_DEPOIS_MS).toISOString())
    .limit(30);

  const { data: cfg } = await db.from('ia_config').select('owner_whatsapp').eq('id', true).maybeSingle();
  let enviados = 0;
  for (const c of candidatas ?? []) {
    if (enviados >= 2) break;
    // Simulador e conversa arquivada ("…:arquivo-…") não têm WhatsApp de verdade;
    // o número do Arthur nunca recebe lembrete de venda.
    if (c.contact_id.startsWith(SIMULADOR) || c.contact_id.includes(':')) continue;
    if (mesmoTelefone(c.contact_id, cfg?.owner_whatsapp)) continue;
    if (ENCERRADOS.includes(c.leads?.status ?? '')) continue;
    // Um lembrete por silêncio: se já lembrou depois da última mensagem do cliente, não repete.
    if (c.lembrete_em && c.last_inbound_at && c.lembrete_em > c.last_inbound_at) continue;
    const hora = horaNoFuso(fusoDoCliente(c.leads?.country, c.leads?.state) ?? 'America/Sao_Paulo');
    if (hora < 8 || hora >= 20) continue;

    // A última mensagem precisa ser da Lia, enviada há 3 h ou mais (não do cliente nem do Arthur).
    const { data: ultima } = await db
      .from('ia_messages')
      .select('author, created_at')
      .eq('conversation_id', c.id)
      .neq('author', 'sistema')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultima?.author !== 'ia' || agora - new Date(ultima.created_at).getTime() < LEMBRETE_DEPOIS_MS) continue;

    // Pedido de desconto esperando o Arthur: não pressiona.
    const { count: aguardando } = await db
      .from('ia_discount_requests')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', c.id)
      .eq('status', 'aguardando');
    if (aguardando) continue;

    // Marca antes: o próximo tick não pega a mesma conversa enquanto a Lia escreve.
    await db.from('ia_conversations').update({ lembrete_em: new Date().toISOString() }).eq('id', c.id);
    const motivo = await responderConversa(
      c.id,
      'O cliente parou de responder há algumas horas e a última mensagem foi sua. Mande UMA retomada curta (1 a 2 frases), leve e sem pressão, no idioma da conversa, puxando pelo último assunto (ex.: se já mandou o preço, pergunte se ficou alguma dúvida). Termine com 2 ou 3 opções para tocar. Não repita o preço nem a proposta, não cobre resposta e não diga que é um lembrete automático.'
    );
    if (!motivo) enviados++;
  }
  return enviados;
}
