'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { STATUS_TO_STAGE, type OrderStatus } from '@/lib/constants';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) throw new Error('unauthorized');
  return createClient();
}

// ============ PRODUCTS ============
export type ProductFormInput = {
  id?: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  collection: string;
  price: number;
  promoPrice: number | null;
  stock: number;
  description: string;
};

export async function saveProductAction(input: ProductFormInput) {
  const supabase = await adminClient();

  let brandId: string | null = null;
  if (input.brand.trim()) {
    const { data: brand } = await supabase
      .from('brands')
      .upsert({ name: input.brand.trim() }, { onConflict: 'name' })
      .select('id')
      .single();
    brandId = brand?.id ?? null;
  }

  const { data: category } = await supabase.from('categories').select('id').eq('name', input.category).maybeSingle();

  const payload = {
    name: input.name,
    sku: input.sku,
    brand_id: brandId,
    category_id: category?.id ?? null,
    price: input.price,
    promo_price: input.promoPrice,
    stock: input.stock,
    description: input.description,
  };

  let productId = input.id;
  if (input.id) {
    await supabase.from('products').update(payload).eq('id', input.id);
  } else {
    const { data } = await supabase.from('products').insert({ ...payload, active: true }).select('id').single();
    productId = data?.id;
  }

  if (productId) {
    await supabase.from('product_collections').delete().eq('product_id', productId);
    if (input.collection.trim()) {
      const { data: col } = await supabase.from('collections').select('id').eq('name', input.collection).maybeSingle();
      if (col) {
        await supabase.from('product_collections').insert({ product_id: productId, collection_id: col.id });
      }
    }
  }

  revalidatePath('/admin/produtos');
  revalidatePath('/');
}

export async function toggleProductActiveAction(id: string, active: boolean) {
  const supabase = await adminClient();
  await supabase.from('products').update({ active: !active }).eq('id', id);
  revalidatePath('/admin/produtos');
  revalidatePath('/');
}

export async function deleteProductAction(id: string) {
  const supabase = await adminClient();
  await supabase.from('products').delete().eq('id', id);
  revalidatePath('/admin/produtos');
  revalidatePath('/');
}

// ============ ORDERS ============
export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const supabase = await adminClient();
  await supabase
    .from('orders')
    .update({ status, timeline_stage: STATUS_TO_STAGE[status], updated_at: new Date().toISOString() })
    .eq('id', orderId);
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}

export async function createOrderAction(input: {
  clientName: string;
  status: OrderStatus;
  items: { productId: string; qty: number }[];
}) {
  const supabase = await adminClient();

  const productIds = input.items.map((i) => i.productId);
  const { data: products } = await supabase.from('products').select('id, name, price').in('id', productIds);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const total = input.items.reduce((sum, it) => {
    const p = byId.get(it.productId);
    return sum + (p ? Number(p.price) * it.qty : 0);
  }, 0);

  const { data: seq } = await supabase.rpc('next_order_number');
  let orderNumber: number;
  if (typeof seq === 'number') {
    orderNumber = seq;
  } else {
    const { data: maxRow } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1).maybeSingle();
    orderNumber = (maxRow?.order_number ?? 1047) + 1;
  }

  const { data: order } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_name: input.clientName,
      status: input.status,
      timeline_stage: STATUS_TO_STAGE[input.status],
      subtotal: total,
      total,
    })
    .select('id')
    .single();

  if (order) {
    const rows = input.items.map((it) => {
      const p = byId.get(it.productId);
      return {
        order_id: order.id,
        product_id: it.productId,
        product_name: p?.name ?? 'Produto',
        qty: it.qty,
        unit_price: p ? Number(p.price) : 0,
      };
    });
    await supabase.from('order_items').insert(rows);
  }

  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}

// ============ COUPONS ============
export async function createCouponAction(code: string, pct: number) {
  const supabase = await adminClient();
  await supabase.from('coupons').insert({ code: code.toUpperCase(), pct, active: true, uses: 0 });
  revalidatePath('/admin/cupons');
}

export async function toggleCouponAction(id: string, active: boolean) {
  const supabase = await adminClient();
  await supabase.from('coupons').update({ active: !active }).eq('id', id);
  revalidatePath('/admin/cupons');
}

export async function deleteCouponAction(id: string) {
  const supabase = await adminClient();
  await supabase.from('coupons').delete().eq('id', id);
  revalidatePath('/admin/cupons');
}

// ============ CATALOG (categories/brands/collections) ============
type CatalogTable = 'categories' | 'brands' | 'collections';

export async function addCatalogItemAction(table: CatalogTable, name: string) {
  const supabase = await adminClient();
  await supabase.from(table).insert({ name: name.trim() } as never);
  revalidatePath('/admin/catalogo');
}

export async function deleteCatalogItemAction(table: CatalogTable, id: string) {
  const supabase = await adminClient();
  await supabase.from(table).delete().eq('id', id);
  revalidatePath('/admin/catalogo');
}

// ============ BANNERS ============
export async function updateBannerAction(id: string, patch: { tag?: string; title?: string; subtitle?: string }) {
  const supabase = await adminClient();
  await supabase.from('banners').update(patch).eq('id', id);
  revalidatePath('/admin/banners');
  revalidatePath('/');
}

// ============ SERVICES ============
export async function addServiceAction(name: string, priceLabel: string) {
  const supabase = await adminClient();
  await supabase.from('services').insert({ name: name.trim(), price_label: priceLabel.trim() || 'sob consulta', glyph: name.trim().slice(0, 2).toUpperCase() });
  revalidatePath('/admin/servicos');
  revalidatePath('/');
}

export async function deleteServiceAction(id: string) {
  const supabase = await adminClient();
  await supabase.from('services').delete().eq('id', id);
  revalidatePath('/admin/servicos');
  revalidatePath('/');
}

// ============ TESTIMONIALS ============
export async function addTestimonialAction(name: string, text: string) {
  const supabase = await adminClient();
  await supabase.from('testimonials').insert({ name: name.trim(), text: text.trim() });
  revalidatePath('/admin/depoimentos');
  revalidatePath('/');
}

export async function deleteTestimonialAction(id: string) {
  const supabase = await adminClient();
  await supabase.from('testimonials').delete().eq('id', id);
  revalidatePath('/admin/depoimentos');
  revalidatePath('/');
}
