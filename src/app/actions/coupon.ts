'use server';

import { createClient } from '@/lib/supabase/server';

export async function validateCouponAction(code: string): Promise<{ valid: boolean; pct: number }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, pct: 0 };

  const supabase = await createClient();
  const { data } = await supabase
    .from('coupons')
    .select('pct, active')
    .eq('code', normalized)
    .maybeSingle();

  if (!data || !data.active) return { valid: false, pct: 0 };
  return { valid: true, pct: data.pct };
}

export async function subscribeNewsletterAction(email: string): Promise<{ ok: boolean }> {
  if (!email.includes('@')) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from('newsletter_subscribers').insert({ email: email.trim().toLowerCase() });
  if (error && error.code !== '23505') return { ok: false };
  return { ok: true };
}
