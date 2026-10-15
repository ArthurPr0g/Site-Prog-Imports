'use server';

import { createClient } from '@/lib/supabase/server';

export async function validateCouponAction(code: string): Promise<{ valid: boolean; pct: number }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, pct: 0 };

  try {
    const supabase = await createClient();
    // Função e não a tabela: visitante não pode listar os cupons (migração 0060).
    // Devolve o percentual só para código existente e ativo; nulo nos outros casos.
    const { data: pct } = await supabase.rpc('validar_cupom', { p_codigo: normalized });
    if (pct == null) return { valid: false, pct: 0 };
    return { valid: true, pct };
  } catch {
    return { valid: false, pct: 0 };
  }
}

export async function subscribeNewsletterAction(email: string): Promise<{ ok: boolean }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { ok: false };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: normalized });
    if (error && error.code !== '23505') return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
