'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthResult = { error?: string };

export async function signInAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const next = String(formData.get('next') || '');

  if (!email || !password) return { error: 'Preencha e-mail e senha.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: 'E-mail ou senha inválidos.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();

  if (next) redirect(next);
  redirect(profile?.role === 'admin' ? '/admin' : '/conta');
}

export async function signUpAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');

  if (!name || !email || !password) return { error: 'Preencha todos os campos.' };
  if (password.length < 6) return { error: 'A senha deve ter pelo menos 6 caracteres.' };
  if (password !== confirm) return { error: 'As senhas não conferem.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) return { error: 'Este e-mail já está cadastrado.' };
    return { error: 'Não foi possível criar sua conta. Tente novamente.' };
  }

  if (!data.session) {
    return { error: 'Conta criada! Verifique seu e-mail para confirmar antes de entrar.' };
  }

  redirect('/conta');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
