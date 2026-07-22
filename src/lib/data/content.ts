import { createClient } from '@/lib/supabase/server';

export async function listBanners() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('banners')
    .select('*, products(sku, price, promo_price)')
    .order('position');
  return data ?? [];
}

export async function listServices() {
  const supabase = await createClient();
  const { data } = await supabase.from('services').select('*').order('position');
  return data ?? [];
}

export async function listTestimonials() {
  const supabase = await createClient();
  const { data } = await supabase.from('testimonials').select('*').order('position');
  return data ?? [];
}
