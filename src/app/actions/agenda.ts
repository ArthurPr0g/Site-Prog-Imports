'use server';
// Agenda do Arthur (Atendimento › Agenda e reuniões, migration 0092): dias e faixas em que a Lia pode
// oferecer reunião, e o controle das reuniões marcadas (cancelar, marcar como realizada).
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { agendaDe, type AgendaConfig } from '@/lib/google-agenda';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

export type ReuniaoDoPainel = {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  inicio: string;
  fim: string;
  meetLink: string | null;
  conversaId: string | null;
  leadId: string | null;
  projetoId: string | null;
};

export async function agendaEReunioesAction(): Promise<{ agenda: AgendaConfig; reunioes: ReuniaoDoPainel[] } | null> {
  const supabase = await adminClient();
  if (!supabase) return null;
  const desde = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
  const [cfg, r] = await Promise.all([
    supabase.from('ia_config').select('agenda').eq('id', true).maybeSingle(),
    supabase
      .from('reunioes')
      .select('id, titulo, tipo, status, inicio, fim, meet_link, conversation_id, lead_id, projeto_id')
      .gte('inicio', desde)
      .order('inicio', { ascending: true })
      .limit(100),
  ]);
  return {
    agenda: agendaDe(cfg.data?.agenda),
    reunioes: (r.data ?? []).map((x) => ({
      id: x.id,
      titulo: x.titulo,
      tipo: x.tipo,
      status: x.status,
      inicio: x.inicio,
      fim: x.fim,
      meetLink: x.meet_link,
      conversaId: x.conversation_id,
      leadId: x.lead_id,
      projetoId: x.projeto_id,
    })),
  };
}

export async function salvarAgendaAction(agenda: AgendaConfig): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Sem permissão.');
  const limpa = agendaDe(agenda);
  // Faixas válidas: HH:MM, início antes do fim; dias sem faixa somem.
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  const dias: AgendaConfig['dias'] = {};
  for (const [dia, faixas] of Object.entries(limpa.dias)) {
    if (!/^[0-6]$/.test(dia) || !Array.isArray(faixas)) continue;
    const ok = faixas.filter((f) => Array.isArray(f) && hora.test(f[0]) && hora.test(f[1]) && f[0] < f[1]);
    if (ok.length) dias[dia] = ok.slice(0, 6);
  }
  if (!Object.keys(dias).length) return errResult('Deixe pelo menos um dia com horário, senão a Lia não consegue oferecer reunião.');
  const { error } = await supabase.from('ia_config').update({ agenda: { ...limpa, dias } }).eq('id', true);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar a agenda.'));
  revalidatePath('/admin/captacao');
  return okResult('Agenda salva: a Lia já usa os novos horários.');
}

export async function mudarReuniaoAction(id: string, status: 'marcada' | 'cancelada' | 'realizada'): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Sem permissão.');
  const { error } = await supabase.from('reunioes').update({ status }).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível atualizar a reunião.'));
  revalidatePath('/admin/captacao');
  return okResult(status === 'cancelada' ? 'Reunião cancelada: o horário volta a ficar livre para a Lia.' : status === 'realizada' ? 'Marcada como realizada.' : 'Reunião reativada.');
}
