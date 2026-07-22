'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';

export type { ActionResult };

const GENERIC_ERROR = 'Algo deu errado. Tente novamente em instantes.';

export async function saveAddressAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return errResult('Você precisa estar logado.');

  const rua = String(formData.get('rua') || '').trim();
  const cidade = String(formData.get('cidade') || '').trim();
  const cep = String(formData.get('cep') || '').trim();
  if (!rua) return errResult('Informe a rua e o número.');
  if (!cidade) return errResult('Informe a cidade.');
  if (!cep) return errResult('Informe o CEP.');

  try {
    const supabase = await createClient();
    const payload = {
      customer_id: user.id,
      rua,
      complemento: String(formData.get('complemento') || '').trim(),
      bairro: String(formData.get('bairro') || '').trim(),
      cidade,
      cep,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: lookupError } = await supabase
      .from('addresses')
      .select('id')
      .eq('customer_id', user.id)
      .maybeSingle();
    if (lookupError) return errResult(GENERIC_ERROR);

    const { error } = existing
      ? await supabase.from('addresses').update(payload).eq('id', existing.id)
      : await supabase.from('addresses').insert(payload);

    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o endereço.'));
    revalidatePath('/conta/endereco');
    return okResult('Endereço atualizado.');
  } catch {
    return errResult(GENERIC_ERROR);
  }
}

export async function updateProfileAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return errResult('Você precisa estar logado.');

  const nome = String(formData.get('nome') || '').trim();
  if (!nome) return errResult('Informe seu nome.');

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ name: nome, phone: String(formData.get('fone') || '').trim() })
      .eq('id', user.id);

    if (error) return errResult(friendlyDbError(error, 'Não foi possível atualizar seus dados.'));
    revalidatePath('/conta/minha-conta');
    return okResult('Dados atualizados.');
  } catch {
    return errResult(GENERIC_ERROR);
  }
}

export async function changePasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return errResult('Você precisa estar logado.');

  const atual = String(formData.get('atual') || '');
  const nova = String(formData.get('nova') || '');
  const conf = String(formData.get('conf') || '');

  if (!atual) return errResult('Informe sua senha atual.');
  if (!nova) return errResult('Informe a nova senha.');
  if (nova.length < 8) return errResult('A nova senha deve ter pelo menos 8 caracteres.');
  if (nova !== conf) return errResult('As senhas não conferem.');
  if (nova === atual) return errResult('A nova senha precisa ser diferente da atual.');

  try {
    const supabase = await createClient();
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: atual });
    if (reauthError) return errResult('Senha atual incorreta.');

    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) return errResult('Não foi possível alterar a senha. Tente novamente.');
    return okResult('Senha alterada com sucesso.');
  } catch {
    return errResult(GENERIC_ERROR);
  }
}

export async function toggleFavoriteAction(productId: string, isFavorite: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return errResult('Você precisa estar logado.');
  if (!productId) return errResult('Produto inválido.');

  try {
    const supabase = await createClient();
    const { error } = isFavorite
      ? await supabase.from('favorites').delete().eq('customer_id', user.id).eq('product_id', productId)
      : await supabase.from('favorites').insert({ customer_id: user.id, product_id: productId });

    if (error) return errResult(friendlyDbError(error, 'Não foi possível atualizar os favoritos.'));
    revalidatePath('/conta/favoritos');
    return okResult();
  } catch {
    return errResult(GENERIC_ERROR);
  }
}
