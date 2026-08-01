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

export async function getSiteSettings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('site_settings')
    .select(
      'show_small_banners, usd_rate, usd_rate_spread, default_delivery_time, contractor_name, contractor_doc, contractor_role, contract_forum'
    )
    .maybeSingle();
  return {
    showSmallBanners: data?.show_small_banners ?? true,
    // Parâmetros do ERP. Cotação nula significa "ainda não configurada" — os
    // orçamentos precisam recusar o cálculo nesse caso em vez de assumir 1.
    usdRate: data?.usd_rate !== null && data?.usd_rate !== undefined ? Number(data.usd_rate) : null,
    usdRateSpread: data?.usd_rate_spread !== null && data?.usd_rate_spread !== undefined ? Number(data.usd_rate_spread) : 0.1,
    defaultDeliveryTime: data?.default_delivery_time ?? '',
    // Dados que saem no PDF de proposta e contrato.
    contractorName: data?.contractor_name ?? '',
    contractorDoc: data?.contractor_doc ?? '',
    contractorRole: data?.contractor_role ?? '',
    contractForum: data?.contract_forum ?? '',
  };
}
