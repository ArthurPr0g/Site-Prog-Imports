'use server';
// Painel do modo projeto (0094-0097): pesquisa do lead (a confirmar/confirmado), briefing que a Lia
// gravou, financeiro da encomenda e status dos modelos de mensagem da Meta.
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { MODELOS } from '@/lib/atendente/modelos';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

export type PesquisaDoPainel = {
  status: string | null;
  resumo: string | null;
  itens: { campo: string; valor: string; fonte?: string; situacao?: string; correcao?: string }[];
  briefing: Record<string, string | string[]>;
  financeiro: { pagamento: string | null; pagoOnde: string | null; valorTotal: number | null; asaas: string | null } | null;
  /** Resumos das reuniões que o Arthur contou à Lia pelo WhatsApp (0112), do mais novo ao mais antigo. */
  atualizacoes: AtualizacaoDoDono[];
};

export type AtualizacaoDoDono = {
  em: string;
  resumo: string;
  escopo: string | null;
  orcamento: string | null;
  prazo: string | null;
  decisoes: string[];
  proximos_passos: { quem: string; o_que: string; quando?: string }[];
  etapa_antes: string | null;
  etapa_depois: string | null;
};

export async function pesquisaEBriefingAction(leadId: string): Promise<PesquisaDoPainel | null> {
  const supabase = await adminClient();
  if (!supabase) return null;
  const [{ data: l }, { data: e }] = await Promise.all([
    supabase.from('leads').select('pesquisa, pesquisa_status, briefing, atualizacoes_do_dono').eq('id', leadId).maybeSingle(),
    supabase
      .from('encomendas')
      .select('pagamento, pago_onde, valor_total, asaas_resumo')
      .eq('lead_id', leadId)
      .neq('status', 'cancelada')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!l) return null;
  const p = (l.pesquisa ?? null) as { resumo?: string; itens?: PesquisaDoPainel['itens'] } | null;
  return {
    status: l.pesquisa_status,
    resumo: p?.resumo ?? null,
    itens: p?.itens ?? [],
    briefing: (l.briefing ?? {}) as Record<string, string | string[]>,
    financeiro: e ? { pagamento: e.pagamento, pagoOnde: e.pago_onde, valorTotal: e.valor_total, asaas: e.asaas_resumo } : null,
    atualizacoes: (Array.isArray(l.atualizacoes_do_dono) ? (l.atualizacoes_do_dono as unknown as AtualizacaoDoDono[]) : []).slice().reverse(),
  };
}

export async function modelosDaMetaAction(): Promise<{ nome: string; quando: string; status: string; botoes: string[]; para: string }[]> {
  const supabase = await adminClient();
  if (!supabase) return [];
  const { data } = await supabase.from('ia_config').select('modelos').eq('id', true).maybeSingle();
  const st = (data?.modelos ?? {}) as Record<string, string>;
  return MODELOS.map((m) => ({ nome: m.nome, quando: m.quando, status: st[m.nome] ?? 'criando', botoes: m.botoes, para: m.para }));
}
