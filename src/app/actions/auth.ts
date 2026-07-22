'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthResult = { error?: string };

const GENERIC_ERROR = 'Não foi possível completar a ação. Tente novamente em instantes.';

export async function signInAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const next = String(formData.get('next') || '');

  if (!email || !password) return { error: 'Preencha e-mail e senha.' };

  let redirectTo: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: 'E-mail ou senha inválidos.' };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    redirectTo = next && next.startsWith('/') ? next : profile?.role === 'admin' ? '/admin' : '/conta';
  } catch {
    return { error: GENERIC_ERROR };
  }

  redirect(redirectTo);
}

export async function signUpAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');

  if (!name || !email || !password) return { error: 'Preencha todos os campos.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Informe um e-mail válido.' };
  if (password.length < 8) return { error: 'A senha deve ter pelo menos 8 caracteres.' };
  if (password !== confirm) return { error: 'As senhas não conferem.' };

  let hasSession: boolean;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already')) return { error: 'Este e-mail já está cadastrado.' };
      if (error.message.toLowerCase().includes('password')) return { error: 'Senha muito fraca — escolha uma senha mais forte.' };
      return { error: 'Não foi possível criar sua conta. Tente novamente.' };
    }
    if (!data.user) return { error: GENERIC_ERROR };

    hasSession = !!data.session;
  } catch {
    return { error: GENERIC_ERROR };
  }

  if (!hasSession) {
    return { error: 'Conta criada! Verifique seu e-mail para confirmar antes de entrar.' };
  }

  redirect('/conta');
}

export async function signOutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // best-effort: even if this fails, send the user home
  }
  redirect('/');
}
