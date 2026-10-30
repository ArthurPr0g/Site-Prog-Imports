// Créditos da Anthropic acabaram (pedido do Arthur em 30/10/2026: "não perder nada do que aconteceu enquanto
// estava sem créditos e retomar assim que tiver mais crédito, continuando a conversa com o cliente").
//  - As mensagens dos clientes já ficam gravadas; a conversa sem resposta ganha ia_pendente_desde (0108).
//  - O Arthur recebe UM aviso (não um por cliente) e o alarme de saúde lembra a cada 12 h.
//  - O relógio testa a cada 2 min com uma chamada mínima; quando volta, avisa e responde as conversas paradas,
//    em ordem, pedindo desculpas pela demora e seguindo de onde parou. Fora da janela de 24 h, vai o modelo
//    "retomar_conversa". A pesquisa e o ensaio esperam e retomam sozinhos.
// Só no servidor.

import Anthropic from '@anthropic-ai/sdk';
import type { DbDoAtendente } from './db';
import type { ConfigDoAtendente } from './regras';
import type { Json } from '@/lib/supabase/database.types';
import { avisarArthur } from './avisos';
import { SITE_URL } from '@/lib/seo';

export const LINK_DE_RECARGA = 'https://console.anthropic.com/settings/billing';

export function ehFaltaDeCredito(erro: unknown): boolean {
  const m = erro instanceof Error ? erro.message : String(erro ?? '');
  return /credit balance is too low|créditos da Anthropic/i.test(m);
}

/** Marca a IA sem crédito (e a conversa, se houver) e avisa o Arthur só na primeira vez. */
export async function marcarSemCredito(db: DbDoAtendente, cfg: ConfigDoAtendente, conversaId?: string | null): Promise<void> {
  const agora = new Date().toISOString();
  if (conversaId) await db.from('ia_conversations').update({ ia_pendente_desde: agora }).eq('id', conversaId).is('ia_pendente_desde', null);
  const { data: virou } = await db.from('ia_config').update({ ia_sem_credito_desde: agora }).eq('id', true).is('ia_sem_credito_desde', null).select('id');
  if (!virou?.length) return; // já estava marcado: o aviso já saiu
  await avisarArthur(db, cfg, {
    titulo: '🚨 Acabaram os créditos da IA',
    texto: `A Lia, a pesquisa e o ensaio pararam. Nada se perde: as mensagens dos clientes ficam guardadas e, assim que você recarregar, a Lia retoma sozinha cada conversa de onde parou.\n\nRecarregue aqui: ${LINK_DE_RECARGA}`,
    link: LINK_DE_RECARGA,
  });
}

/** Chamada mínima só para saber se o crédito voltou (falha não é cobrada). */
async function creditoVoltou(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  try {
    await new Anthropic().messages.create({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] });
    return true;
  } catch (e) {
    return !ehFaltaDeCredito(e);
  }
}

const AVISO_DE_RETOMADA =
  'Você ficou um tempo sem conseguir responder por um problema técnico do nosso lado. Comece com UMA frase curta pedindo desculpas pela demora e continue a conversa de onde parou, respondendo o que o cliente disse. Escreva SÓ a mensagem para o cliente.';

/** Relógio: testa o crédito e, quando volta, retoma as conversas paradas (2 por chamada, as mais antigas primeiro). */
export async function retomarDepoisDoCredito(db: DbDoAtendente, cfg: ConfigDoAtendente): Promise<number> {
  const { data: c } = await db.from('ia_config').select('ia_sem_credito_desde, saude').eq('id', true).maybeSingle();
  const { data: pendentes } = await db
    .from('ia_conversations')
    .select('id, contact_id, contact_name, last_inbound_at, lead_id')
    .not('ia_pendente_desde', 'is', null)
    .order('ia_pendente_desde', { ascending: true })
    .limit(2);
  if (!c?.ia_sem_credito_desde && !pendentes?.length) return 0;

  if (c?.ia_sem_credito_desde) {
    // Testa no máximo a cada 2 min.
    const saude = (c.saude ?? {}) as Record<string, unknown>;
    const ultimo = Number(new Date(String(saude.credito_testado_em ?? 0)));
    if (Date.now() - ultimo < 2 * 60_000) return 0;
    await db.from('ia_config').update({ saude: { ...saude, credito_testado_em: new Date().toISOString() } as Json }).eq('id', true);
    if (!(await creditoVoltou())) return 0;
    const { count } = await db.from('ia_conversations').select('id', { count: 'exact', head: true }).not('ia_pendente_desde', 'is', null);
    await db.from('ia_config').update({ ia_sem_credito_desde: null }).eq('id', true);
    await avisarArthur(db, cfg, {
      titulo: '✅ Créditos da IA de volta',
      texto: count ? `A Lia já está retomando ${count} conversa(s) que ficaram paradas, de onde pararam.` : 'A Lia, a pesquisa e o ensaio voltaram a funcionar.',
      link: `${SITE_URL}/admin/captacao?aba=atendimento`,
    });
  }

  // Import aqui para não criar ciclo de importação com agente.ts.
  const { responderConversa } = await import('./agente');
  const { enviarModeloAoCliente, modeloAprovado } = await import('./modelos');
  let feitas = 0;
  for (const p of pendentes ?? []) {
    const motivo = await responderConversa(p.id, AVISO_DE_RETOMADA);
    if (motivo && ehFaltaDeCredito(motivo)) return feitas; // acabou de novo
    if (motivo === 'fora da janela de 24 h' && (await modeloAprovado(db, 'retomar_conversa'))) {
      const nome = (p.contact_name ?? '').split(/\s+/)[0] || 'tudo bem';
      await enviarModeloAoCliente(db, p.id, p.contact_id, 'retomar_conversa', [nome, 'o seu projeto']);
    }
    // Respondida, fora da janela (modelo enviado ou não) ou outro motivo: sai da fila para não travar as outras.
    await db.from('ia_conversations').update({ ia_pendente_desde: null }).eq('id', p.id);
    feitas++;
  }
  return feitas;
}
