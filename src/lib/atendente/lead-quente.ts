// Aviso de lead quente (pedido do dono em 28/10/2026): o lead abriu o diagnóstico
// e, 15 min depois, ainda não chamou no WhatsApp. O Arthur recebe no WhatsApp dele
// quem é, de quem é o lead (Felipe ou Lia) e o telefone, para alguém ligar enquanto
// o lead está pensando no assunto. Uma vez por visita, das 8h às 21h (Brasília),
// visitas de até 12 h atrás, no máximo 10 por dia. Chamado pelo relógio.

import type { DbDoAtendente } from '@/lib/atendente/db';
import type { ConfigDoAtendente } from '@/lib/atendente/regras';
import { avisarArthur } from '@/lib/atendente/avisos';

const ESPERA_MS = 15 * 60_000;
const ATE_MS = 12 * 3600_000;
const POR_DIA = 10;

const horaEmBrasilia = () =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(new Date()));

const inicioDoDiaEmBrasilia = () => {
  const d = new Date(Date.now() - 3 * 3600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3)).toISOString();
};

export async function avisarLeadsQuentes(db: DbDoAtendente, cfg: ConfigDoAtendente): Promise<number> {
  const hora = horaEmBrasilia();
  if (hora < 8 || hora >= 21) return 0;
  const { count: hoje } = await db
    .from('ia_avisos')
    .select('id', { count: 'exact', head: true })
    .like('titulo', 'Lead quente%')
    .gte('created_at', inicioDoDiaEmBrasilia());
  if ((hoje ?? 0) >= POR_DIA) return 0;

  const agora = Date.now();
  const { data: leads } = await db
    .from('leads')
    .select('id, name, city, phone, status, source, diag_views, diag_last_view_at, diag_aviso_em, lead_kit_items(lead_seller_kits(kind, active, seller_name))')
    .gte('diag_last_view_at', new Date(agora - ATE_MS).toISOString())
    .lte('diag_last_view_at', new Date(agora - ESPERA_MS).toISOString())
    .in('status', ['novo', 'contatado'])
    .limit(20);

  let avisados = 0;
  for (const l of leads ?? []) {
    if (avisados >= 3 || (hoje ?? 0) + avisados >= POR_DIA) break;
    if ((l.source ?? '').startsWith('teste')) continue;
    if (l.diag_aviso_em && l.diag_last_view_at && l.diag_aviso_em >= l.diag_last_view_at) continue;
    // Chamou no WhatsApp depois de abrir? Então já está com a Lia: não avisa.
    const { count: chamou } = await db
      .from('ia_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', l.id)
      .gte('last_inbound_at', l.diag_last_view_at!);
    if (chamou) continue;

    // Marca antes de avisar: o próximo tick não repete esta visita.
    await db.from('leads').update({ diag_aviso_em: new Date().toISOString() }).eq('id', l.id);
    const kit = (l.lead_kit_items ?? []).map((i) => i.lead_seller_kits).find((k) => k?.active);
    const dono = kit ? (kit.kind === 'ia' ? cfg.personaName : kit.seller_name) : 'sem vendedor';
    const quando = new Date(l.diag_last_view_at!).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    const vezes = l.diag_views > 1 ? ` (${l.diag_views}ª vez)` : '';
    const fone = l.phone ? ` Telefone: ${l.phone}.` : '';
    const dica = kit?.kind === 'ia' ? ' Ele ainda não chamou a Lia: vale uma ligação sua.' : kit ? ` Avise o ${dono} para ligar agora.` : '';
    await avisarArthur(db, cfg, {
      titulo: 'Lead quente',
      texto: `${l.name}${l.city ? ` (${l.city})` : ''} abriu o diagnóstico às ${quando}${vezes} e não chamou. Lista: ${dono}.${fone}${dica}`,
      leadId: l.id,
    });
    avisados++;
  }
  return avisados;
}
