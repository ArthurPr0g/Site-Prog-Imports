'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';

export type InternalServiceInput = {
  id?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  leadTimeDays: number;
  active: boolean;
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

function revalidar() {
  revalidatePath('/admin/servicos-internos');
  revalidatePath('/admin/prestacao-servico');
}

export async function saveInternalServiceAction(input: InternalServiceInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const name = input.name.trim();
  if (!name) return errResult('Informe o nome do serviço.');
  if (!Number.isFinite(input.price) || input.price < 0) {
    return errResult('O valor precisa ser um número igual ou maior que zero.');
  }
  if (!Number.isInteger(input.leadTimeDays) || input.leadTimeDays < 0) {
    return errResult('O prazo precisa ser um número inteiro de dias.');
  }

  const payload = {
    name,
    description: input.description.trim(),
    category: input.category.trim(),
    price: input.price,
    lead_time_days: input.leadTimeDays,
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from('internal_services').update(payload).eq('id', input.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o serviço.'));
    revalidar();
    return okResult('Serviço atualizado.');
  }

  const { error } = await supabase.from('internal_services').insert(payload);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível criar o serviço.'));

  revalidar();
  return okResult('Serviço cadastrado.');
}

export async function deleteInternalServiceAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  // Prestação já criada não pode perder a referência sem aviso. O item guarda
  // nome e valor próprios, então o histórico sobrevive — mas o dono precisa
  // saber que o serviço está em uso antes de sumir com ele do catálogo.
  const { count } = await supabase
    .from('service_order_items')
    .select('id', { count: 'exact', head: true })
    .eq('internal_service_id', id);

  if (count && count > 0) {
    return errResult(
      `Este serviço está em ${count} prestação(ões) e não pode ser excluído. Desative-o para tirá-lo de novos orçamentos.`
    );
  }

  const { error } = await supabase.from('internal_services').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o serviço.'));

  revalidar();
  return okResult('Serviço excluído.');
}
