'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';

export type SystemSettingsInput = {
  usdRate: number | null;
  defaultDeliveryTime: string;
};

export async function saveSystemSettingsAction(input: SystemSettingsInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return errResult('Você não tem permissão para fazer isso.');

  if (input.usdRate !== null && (!Number.isFinite(input.usdRate) || input.usdRate <= 0)) {
    return errResult('A cotação precisa ser um número maior que zero.');
  }

  const supabase = await createClient();
  // site_settings é uma linha única (a coluna `id` é boolean e sempre true),
  // por isso o update sem filtro de id específico.
  const { error } = await supabase
    .from('site_settings')
    .update({
      usd_rate: input.usdRate,
      default_delivery_time: input.defaultDeliveryTime.trim() || null,
    })
    .eq('id', true);

  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar os parâmetros.'));

  revalidatePath('/admin/configuracoes');
  // Quando o M3 existir, a mudança de cotação também dispara o recálculo em
  // massa dos orçamentos ainda não convertidos em estoque.
  return okResult('Parâmetros salvos.');
}
