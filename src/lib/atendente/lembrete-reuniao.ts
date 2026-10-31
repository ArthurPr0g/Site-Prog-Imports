// Lembrete da reunião com o Arthur ao cliente, ~2 h antes (0094). Só no servidor; roda no relógio.
// Dentro das 24 h vai como mensagem com botões; fora, pelo modelo lembrete_reuniao (botões também).
// "Preciso remarcar" volta como texto para a Lia, que oferece novos horários (horarios_livres).

import type { DbDoAtendente } from './db';
import { enviarComOpcoes, JANELA_MS } from './whatsapp-api';
import { enviarModeloAoCliente } from './modelos';
import { SIMULADOR } from './agente';
import { linkDoCliente } from '@/lib/reunioes/sala';

export async function lembrarReunioes(db: DbDoAtendente): Promise<number> {
  const agora = Date.now();
  const { data } = await db
    .from('reunioes')
    .select('id, inicio, meet_link, sala_token, conversation_id, titulo, leads(name)')
    .eq('status', 'marcada')
    .is('lembrete_em', null)
    .not('conversation_id', 'is', null)
    .gte('inicio', new Date(agora + 30 * 60_000).toISOString())
    .lte('inicio', new Date(agora + 2.5 * 3600_000).toISOString())
    .limit(3);
  let n = 0;
  for (const r of data ?? []) {
    // Marca antes: o próximo minuto não repete.
    await db.from('reunioes').update({ lembrete_em: new Date().toISOString() }).eq('id', r.id);
    const { data: c } = await db.from('ia_conversations').select('contact_id, contact_name, last_inbound_at').eq('id', r.conversation_id!).maybeSingle();
    if (!c || c.contact_id.startsWith(SIMULADOR) || c.contact_id.includes('#')) continue;
    const nome = (c.contact_name ?? r.leads?.name ?? '').trim().split(/\s+/)[0] || 'tudo bem';
    const quando = new Date(r.inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    // Sala própria (0113) primeiro; o Meet fica de plano B.
    const link = r.sala_token ? linkDoCliente(r.sala_token) : (r.meet_link ?? 'o link vai por aqui antes da reunião');
    const janela = !!c.last_inbound_at && agora - new Date(c.last_inbound_at).getTime() < JANELA_MS - 5 * 60_000;
    if (janela) {
      const texto = `Oi, ${nome}! 📅 Lembrete da sua reunião com o Arthur, da Prog Soluções:\n\n🗓️ ${quando}\n🔗 ${link}\n\nAté já!`;
      const e = await enviarComOpcoes(c.contact_id, texto, ['Confirmo presença', 'Preciso remarcar']);
      await db.from('ia_messages').insert({
        conversation_id: r.conversation_id!,
        direction: 'out',
        author: 'ia',
        body: `${texto}\n[[opções: Confirmo presença | Preciso remarcar]]`,
        ...(e.ok ? { external_id: e.id, status: 'sent' } : { status: 'failed', error: e.erro }),
      });
      if (e.ok) n++;
    } else {
      const e = await enviarModeloAoCliente(db, r.conversation_id!, c.contact_id, 'lembrete_reuniao', [nome, quando, link]);
      if (e.ok) n++;
    }
  }
  return n;
}
