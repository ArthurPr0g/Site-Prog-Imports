'use server';
// Custo da IA por venda (pedido do Arthur em 30/10/2026): quanto se gasta, onde e com o quê, e quanto
// custou cada venda fechada. Só fatos do ia_usage (nada de estimativa com chance inventada); a projeção
// fica no texto do painel, separada e marcada como estimativa.
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export type CustoDaIa = {
  mes: number;
  total: number;
  desde: string | null;
  porFinalidade: { nome: string; usd: number }[];
  porModelo: { nome: string; usd: number }[];
  porDia: { dia: string; usd: number }[];
  vendas: number;
  custoDasVendas: number;
  conversasReais: number;
  custoMedioConversa: number;
  custoPorResposta: number;
  maisCaros: { nome: string; status: string; usd: number }[];
};

const FINALIDADE: Record<string, string> = {
  atendimento: 'Atendimento da Lia',
  pesquisa_lead: 'Pesquisa do lead (internet)',
  interpretar_encomenda: 'Ler pedido do Arthur',
  assunto_encomenda: 'Ler pedido do Arthur',
  organizar_ideia: 'Organizar ideias',
  organizar_prompt: 'Organizar prompts',
  aprender: 'Lia aprendendo',
};

export async function custoDaIaAction(): Promise<CustoDaIa | null> {
  const admin = await requireAdmin();
  if (!admin) return null;
  const db = await createClient();
  const { data: usos } = await db
    .from('ia_usage')
    .select('created_at, model, cost_usd, finalidade, conversation_id, lead_id')
    .order('created_at', { ascending: true })
    .limit(20000);
  const lista = usos ?? [];
  const soma = (xs: { cost_usd: number }[]) => xs.reduce((s, x) => s + Number(x.cost_usd), 0);
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(3, 0, 0, 0);

  const agrupar = (chave: (u: (typeof lista)[number]) => string) => {
    const m = new Map<string, number>();
    for (const u of lista) m.set(chave(u), (m.get(chave(u)) ?? 0) + Number(u.cost_usd));
    return [...m].map(([nome, usd]) => ({ nome, usd })).sort((a, b) => b.usd - a.usd);
  };

  // Conversas → lead → etapa. Simulador fica de fora das contas de venda.
  const ids = [...new Set(lista.map((u) => u.conversation_id).filter(Boolean))] as string[];
  const { data: convs } = ids.length
    ? await db.from('ia_conversations').select('id, contact_id, lead_id, leads(name, status)').in('id', ids)
    : { data: [] };
  const conv = new Map((convs ?? []).map((c) => [c.id, c]));
  const leadDe = (u: (typeof lista)[number]) => u.lead_id ?? (u.conversation_id ? conv.get(u.conversation_id)?.lead_id : null) ?? null;
  const reais = lista.filter((u) => !u.conversation_id || !conv.get(u.conversation_id)?.contact_id.startsWith('simulador:'));

  const porLead = new Map<string, number>();
  for (const u of reais) {
    const l = leadDe(u);
    if (l) porLead.set(l, (porLead.get(l) ?? 0) + Number(u.cost_usd));
  }
  const leadIds = [...porLead.keys()];
  const { data: leads } = leadIds.length ? await db.from('leads').select('id, name, status').in('id', leadIds) : { data: [] };
  const fechados = (leads ?? []).filter((l) => l.status === 'fechado');
  const { count: vendas } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'fechado');

  const convReais = new Map<string, number>();
  for (const u of reais) if (u.conversation_id) convReais.set(u.conversation_id, (convReais.get(u.conversation_id) ?? 0) + Number(u.cost_usd));
  const { count: respostas } = convReais.size
    ? await db.from('ia_messages').select('id', { count: 'exact', head: true }).eq('author', 'ia').in('conversation_id', [...convReais.keys()])
    : { count: 0 };
  const atendimento = reais.filter((u) => (u.finalidade ?? 'atendimento') === 'atendimento' && u.conversation_id);

  const dias = new Map<string, number>();
  for (const u of lista) {
    const d = new Date(new Date(u.created_at).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
    dias.set(d, (dias.get(d) ?? 0) + Number(u.cost_usd));
  }

  return {
    mes: soma(lista.filter((u) => new Date(u.created_at) >= inicioMes)),
    total: soma(lista),
    desde: lista[0]?.created_at ?? null,
    porFinalidade: agrupar((u) => FINALIDADE[u.finalidade ?? 'atendimento'] ?? u.finalidade ?? 'Outros'),
    porModelo: agrupar((u) => u.model.replace('claude-', '').replace(/-(\d)-(\d)$/, ' $1.$2')),
    porDia: [...dias].map(([dia, usd]) => ({ dia, usd })).slice(-30),
    vendas: vendas ?? 0,
    custoDasVendas: fechados.reduce((s, l) => s + (porLead.get(l.id) ?? 0), 0),
    conversasReais: convReais.size,
    custoMedioConversa: convReais.size ? [...convReais.values()].reduce((a, b) => a + b, 0) / convReais.size : 0,
    custoPorResposta: respostas ? soma(atendimento) / respostas : 0,
    maisCaros: (leads ?? [])
      .map((l) => ({ nome: l.name, status: l.status, usd: porLead.get(l.id) ?? 0 }))
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 6),
  };
}
