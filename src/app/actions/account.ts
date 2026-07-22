'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export type ActionResult = { ok: boolean; message: string };

export async function saveAddressAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Você precisa estar logado.' };

  const supabase = await createClient();
  const payload = {
    customer_id: user.id,
    rua: String(formData.get('rua') || ''),
    complemento: String(formData.get('complemento') || ''),
    bairro: String(formData.get('bairro') || ''),
    cidade: String(formData.get('cidade') || ''),
    cep: String(formData.get('cep') || ''),
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase.from('addresses').select('id').eq('customer_id', user.id).maybeSingle();

  const { error } = existing
    ? await supabase.from('addresses').update(payload).eq('id', existing.id)
    : await supabase.from('addresses').insert(payload);

  if (error) return { ok: false, message: 'Não foi possível salvar o endereço.' };
  revalidatePath('/conta/endereco');
  return { ok: true, message: 'Endereço atualizado' };
}

export async function updateProfileAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Você precisa estar logado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      name: String(formData.get('nome') || '').trim(),
      phone: String(formData.get('fone') || '').trim(),
    })
    .eq('id', user.id);

  if (error) return { ok: false, message: 'Não foi possível atualizar seus dados.' };
  revalidatePath('/conta/minha-conta');
  return { ok: true, message: 'Dados atualizados' };
}

export async function changePasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Você precisa estar logado.' };

  const atual = String(formData.get('atual') || '');
  const nova = String(formData.get('nova') || '');
  const conf = String(formData.get('conf') || '');

  if (!nova || nova !== conf) return { ok: false, message: 'As senhas não conferem' };
  if (nova.length < 6) return { ok: false, message: 'A nova senha deve ter pelo menos 6 caracteres' };

  const supabase = await createClient();
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: atual });
  if (reauthError) return { ok: false, message: 'Senha atual incorreta' };

  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) return { ok: false, message: 'Não foi possível alterar a senha' };
  return { ok: true, message: 'Senha alterada com sucesso' };
}

export async function toggleFavoriteAction(productId: string, isFavorite: boolean) {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const supabase = await createClient();
  if (isFavorite) {
    await supabase.from('favorites').delete().eq('customer_id', user.id).eq('product_id', productId);
  } else {
    await supabase.from('favorites').insert({ customer_id: user.id, product_id: productId });
  }
  revalidatePath('/conta/favoritos');
  return { ok: true };
}
