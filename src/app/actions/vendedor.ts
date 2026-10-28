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
