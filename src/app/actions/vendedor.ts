'use server';

// Ações da página do vendedor. Quem tem o link não tem conta: tudo passa pelas
// funções lead_kit_* do banco (security definer), que conferem se o link está
// ativo e se o lead é daquele link.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { type ActionResult, okResult, errResult } from '@/lib/action-result';
import { limparRespostas, type RespostasDoChecklist } from '@/lib/checklist-descoberta';
import { ETAPAS_QUE_O_VENDEDOR_MARCA } from '@/lib/vendedor';
import type { LeadStatus } from '@/lib/captacao';
import { metaDoVendedor } from '@/lib/data/meta-do-vendedor';
import type { ResumoDaMeta } from '@/lib/meta-captacao';
import { dbDoAtendente } from '@/lib/atendente/db';
import { lerConfig } from '@/lib/atendente/agente';
import { avisarArthur } from '@/lib/atendente/avisos';
import { calcularProposta } from '@/lib/atendente/regras';
import { tabelaBRL, TABELA_USD } from '@/lib/precos-captacao';
import { criarProjetoDaVenda, escolhaDoJson } from '@/lib/pos-venda';
import type { Escolha } from '@/lib/simulador';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidar(token: string) {
  revalidatePath(`/vendedor/${token}`);
  revalidatePath('/admin/captacao');
}

/** Etapa, anotação e/ou mensagem enviada (etapa da sequência 0–3). */
export async function registrarPeloVendedorAction(
  token: string,
  leadId: string,
  dados: { status?: LeadStatus; nota?: string; etapaEnviada?: number }
): Promise<ActionResult> {
  if (!UUID.test(token) || !UUID.test(leadId)) return errResult('Link inválido.');
  if (dados.status && !ETAPAS_QUE_O_VENDEDOR_MARCA.includes(dados.status)) return errResult('Essa etapa é com o Arthur.');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('lead_kit_atualizar', {
    p_token: token,
    p_lead: leadId,
    p_status: dados.status,
    p_nota: dados.nota?.trim() || undefined,
    p_etapa: dados.etapaEnviada,
  });
  if (error) return errResult('Não foi possível salvar. Tente de novo.');
  if (data !== 'ok') return errResult(String(data));
  revalidar(token);
  // V2: lead quente com o vendedor (pediu proposta ou marcou reunião) avisa o Arthur na hora.
  if (dados.status === 'reuniao' || dados.status === 'proposta') await avisarDoVendedor(token, leadId, dados.status, dados.nota);
  return okResult(dados.etapaEnviada !== undefined ? 'Envio registrado.' : 'Salvo.');
}

/** "Pedir mais leads": avisa o Arthur no painel (ele adiciona mais 20 ao link). */
export async function pedirMaisLeadsAction(token: string): Promise<ActionResult> {
  if (!UUID.test(token)) return errResult('Link inválido.');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('lead_kit_pedir_mais', { p_token: token });
  if (error) return errResult('Não foi possível enviar o pedido. Tente de novo.');
  if (data !== 'ok') return errResult(String(data));
  revalidar(token);
  return okResult('Pedido enviado. O Arthur vai adicionar mais leads aqui.');
}

export async function salvarChecklistDoVendedorAction(
  token: string,
  leadId: string,
  respostas: RespostasDoChecklist
): Promise<ActionResult> {
  if (!UUID.test(token) || !UUID.test(leadId)) return errResult('Link inválido.');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('lead_kit_descoberta', {
    p_token: token,
    p_lead: leadId,
    p_dados: limparRespostas(respostas),
  });
  if (error) return errResult('Não foi possível salvar o checklist. Tente de novo.');
  if (data !== 'ok') return errResult(String(data));
  revalidar(token);
  return okResult('Checklist salvo. O Arthur já vê no painel.');
}

/** Meta e dinheiro na mesa, para a página do vendedor se atualizar sozinha. */
export async function metaDoVendedorAction(token: string): Promise<ResumoDaMeta | null> {
  if (!UUID.test(token)) return null;
  return metaDoVendedor(token);
}

async function avisarDoVendedor(token: string, leadId: string, status: 'reuniao' | 'proposta', nota?: string) {
  try {
    const db = dbDoAtendente();
    const [{ data: kit }, { data: lead }] = await Promise.all([
      db.from('lead_seller_kits').select('seller_name').eq('token', token).maybeSingle(),
      db.from('leads').select('name').eq('id', leadId).maybeSingle(),
    ]);
    const quem = kit?.seller_name ?? 'O vendedor';
    await avisarArthur(db, await lerConfig(db), {
      titulo: status === 'reuniao' ? 'Reunião marcada pelo vendedor' : 'Cliente quer proposta',
      texto: `${quem} marcou ${lead?.name ?? 'um lead'} como ${status === 'reuniao' ? 'reunião marcada' : 'quer proposta'}.${nota?.trim() ? ` Nota: ${nota.trim().slice(0, 200)}` : ''}`,
      leadId,
    });
  } catch (e) {
    console.error('[vendedor] aviso ao Arthur falhou', e);
  }
}

/**
 * "Venda feita" pelo vendedor (decisão do dono em 28/10/2026: o Felipe também fecha).
 * Valida o link e o lead, marca o lead como fechado com o valor do pacote (tabela do
 * catálogo guardado no link) e cria o projeto do pós-venda. O Arthur é avisado.
 */
export async function vendaFeitaPeloVendedorAction(
  token: string,
  leadId: string,
  escolha: Escolha,
  moeda: 'BRL' | 'USD'
): Promise<ActionResult> {
  if (!UUID.test(token) || !UUID.test(leadId)) return errResult('Link inválido.');
  const e = escolhaDoJson(escolha);
  if (!e) return errResult('Pacote inválido.');
  const db = dbDoAtendente();
  const { data: kit } = await db.from('lead_seller_kits').select('id, seller_name, catalog, active').eq('token', token).maybeSingle();
  if (!kit?.active) return errResult('Link desativado.');
  const { data: item } = await db.from('lead_kit_items').select('leads(id, name, closed_at)').match({ kit_id: kit.id, lead_id: leadId }).maybeSingle();
  const lead = item?.leads;
  if (!lead) return errResult('Lead fora deste link.');
  const catalogo = (kit.catalog ?? []) as { nome: string; preco: number; prazoDias?: number }[];
  const tabela = moeda === 'USD' ? TABELA_USD : tabelaBRL(new Map(catalogo.map((c) => [c.nome, Number(c.preco)])));
  const prop = calcularProposta(e, tabela, 0, new Map(catalogo.map((c) => [c.nome, Number(c.prazoDias ?? 0)])));
  const agora = new Date().toISOString();
  await db
    .from('leads')
    .update({
      status: 'fechado',
      closed_at: lead.closed_at ?? agora,
      closed_value: prop.total,
      closed_monthly: prop.mensal,
      closed_currency: moeda,
      pacote: e as never,
      next_contact: null,
      updated_at: agora,
    })
    .eq('id', leadId);
  const r = await criarProjetoDaVenda(db, { leadId, cliente: lead.name, vendidoPor: kit.seller_name, escolha: e, moeda, valor: prop.total, mensal: prop.mensal });
  if ('erro' in r) return errResult('A venda foi marcada, mas o projeto não foi criado. Avise o Arthur.');
  await avisarArthur(db, await lerConfig(db), {
    titulo: 'Venda feita pelo vendedor',
    texto: `${kit.seller_name} fechou ${lead.name}: ${prop.linhas.map((l) => l.nome).join(' + ')} (${moeda === 'USD' ? '$' : 'R$ '}${Math.round(prop.total).toLocaleString(moeda === 'USD' ? 'en-US' : 'pt-BR')}). Mande o contrato e o sinal; o projeto já está no Pós-venda.`,
    leadId,
  });
  revalidar(token);
  revalidatePath('/admin/pos-venda');
  return okResult('Venda registrada! O Arthur foi avisado e manda o contrato e o sinal.');
}
