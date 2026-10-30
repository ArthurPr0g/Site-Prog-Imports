/**
 * Prepara (ou apaga) um cliente fictício em modo projeto, numa conversa do SIMULADOR, para a Lia responder
 * pela rota /api/atendente/ensaio no servidor (que tem a chave da IA). Nada sai pelo WhatsApp.
 *   npx -y tsx scripts/ensaio-preparar.ts              # cria e imprime os ids
 *   npx -y tsx scripts/ensaio-preparar.ts limpar <enc> # apaga tudo dessa encomenda
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.WHATSAPP_TOKEN = '';
process.env.ANTHROPIC_API_KEY = '';
const DONO = '5500000000001';

async function main() {
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const db = dbDoAtendente();
  if (process.argv[2] === 'limpar') {
    const { data: e } = await db.from('encomendas').select('lead_id, conversation_id').eq('id', process.argv[3]).single();
    if (e?.conversation_id) {
      await db.from('ia_messages').delete().eq('conversation_id', e.conversation_id);
      await db.from('ia_avisos').delete().eq('conversation_id', e.conversation_id);
      await db.from('reunioes').delete().eq('conversation_id', e.conversation_id);
    }
    await db.from('encomendas').delete().eq('id', process.argv[3]);
    if (e?.conversation_id) await db.from('ia_conversations').delete().eq('id', e.conversation_id);
    if (e?.lead_id) {
      await db.from('lead_search_requests').delete().eq('lead_id', e.lead_id);
      await db.from('ia_avisos').delete().eq('lead_id', e.lead_id);
      await db.from('ia_usage').update({ lead_id: null }).eq('lead_id', e.lead_id);
      await db.from('leads').delete().eq('id', e.lead_id);
    }
    return console.log('apagado', process.argv[3]);
  }
  const { tratarEncomenda, decidirFinanceiro } = await import('../src/lib/atendente/encomenda');
  await tratarEncomenda(db, DONO, '[o cliente mandou um contato: Ensaio Personal Trainer +55 62 90000-0042]');
  await tratarEncomenda(db, DONO, 'Lia, faça todo o projeto: personal trainer em Goiânia, quer site com sistema de gestão de alunos (cadastro, treinos, pagamentos, evolução). Ele já sabe que você vai chamar.');
  const { data: e0 } = await db.from('encomendas').select('id').order('criado_em', { ascending: false }).limit(1).single();
  await tratarEncomenda(db, DONO, 'sim');
  await decidirFinanceiro(db, 'pag', 'gratis', e0!.id, DONO);
  const { data: e } = await db.from('encomendas').select('*').eq('id', e0!.id).single();
  // Simulador: a Lia responde sem janela de 24 h e nada sai pelo WhatsApp.
  await db.from('ia_conversations').update({ contact_id: `simulador:ensaio-${Date.now()}`, last_inbound_at: new Date().toISOString() }).eq('id', e!.conversation_id!);
  await db.from('ia_messages').insert({ conversation_id: e!.conversation_id!, direction: 'in', author: 'lead', body: 'Pode perguntar' });
  // Pesquisa fica para depois (o relógio pegaria o lead fictício agora).
  await db.from('leads').update({ pesquisa_status: null }).eq('id', e!.lead_id!);
  console.log(JSON.stringify({ enc: e!.id, status: e!.status, pagamento: e!.pagamento, lead: e!.lead_id, conv: e!.conversation_id }));
}
main().catch((e) => console.error(e));
