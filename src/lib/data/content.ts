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

/** URL temporária para a tela de Configurações mostrar a assinatura guardada.
 *
 *  Assinada e curta porque o bucket é privado: uma URL permanente para este
 *  arquivo valeria tanto quanto o arquivo. Fica separada de `getSiteSettings`
 *  para não gerar uma assinatura a cada leitura de parâmetro — inclusive nas
 *  páginas públicas, que também leem essa tabela. */
export async function getSignaturePreviewUrl(path: string): Promise<string> {
  if (!path) return '';
  const supabase = await createClient();
  const { data } = await supabase.storage.from('signatures').createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? '';
}

export async function getSiteSettings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('site_settings')
    .select(
      'show_small_banners, usd_rate, usd_rate_spread, default_delivery_time, contractor_name, contractor_doc, contractor_role, contract_forum, signature_path, sender_name, sender_doc, sender_phone, sender_cep, sender_address_line, sender_address_number, sender_complement, sender_district, sender_city, sender_state'
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
    /** Caminho da assinatura no bucket privado. Vazio = sem assinatura. */
    signaturePath: data?.signature_path ?? '',
    // Remetente da etiqueta de transporte.
    senderName: data?.sender_name ?? '',
    senderDoc: data?.sender_doc ?? '',
    senderPhone: data?.sender_phone ?? '',
    senderCep: data?.sender_cep ?? '',
    senderAddressLine: data?.sender_address_line ?? '',
    senderAddressNumber: data?.sender_address_number ?? '',
    senderComplement: data?.sender_complement ?? '',
    senderDistrict: data?.sender_district ?? '',
    senderCity: data?.sender_city ?? '',
    senderState: data?.sender_state ?? '',
  };
}
