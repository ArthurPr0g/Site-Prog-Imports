import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/lib/constants';
import { formatBRL, formatDateBR } from '@/lib/format';

export async function listAdminProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select(
      '*, brands(name), categories(name), product_collections(collections(name)), product_images(id, label, url, position), product_specs(k, v, position)'
    )
    .order('position');
  return (data ?? []).map((p) => ({
    ...p,
    product_images: (p.product_images ?? []).sort((a, b) => a.position - b.position),
    product_specs: (p.product_specs ?? []).sort((a, b) => a.position - b.position),
  }));
}

export async function listAdminOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total, created_at, order_items(product_name, qty)')
    .order('created_at', { ascending: false });

  return (data ?? []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    client: o.customer_name,
    items: o.order_items.map((i) => (i.qty > 1 ? `${i.qty}x ${i.product_name}` : i.product_name)).join(' + '),
    date: formatDateBR(o.created_at),
    total: formatBRL(Number(o.total)),
    status: o.status as OrderStatus,
  }));
}

export async function listAdminClients() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('id, name, email').eq('role', 'customer');
  const { data: orders } = await supabase.from('orders').select('customer_id, total').not('customer_id', 'is', null);
  const { data: addresses } = await supabase.from('addresses').select('customer_id, cidade');

  const byCustomer = new Map<string, { orders: number; spent: number }>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const cur = byCustomer.get(o.customer_id) ?? { orders: 0, spent: 0 };
    cur.orders += 1;
    cur.spent += Number(o.total);
    byCustomer.set(o.customer_id, cur);
  }
  const cityByCustomer = new Map((addresses ?? []).map((a) => [a.customer_id, a.cidade]));

  return (profiles ?? []).map((p) => {
    const stats = byCustomer.get(p.id) ?? { orders: 0, spent: 0 };
    return {
      id: p.id,
      name: p.name || '—',
      email: p.email,
      city: cityByCustomer.get(p.id) || '—',
      initial: (p.name || '?')[0]?.toUpperCase(),
      orders: stats.orders,
      spent: formatBRL(stats.spent),
    };
  });
}

export async function listAdminCoupons() {
  const supabase = await createClient();
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  return data ?? [];
}

export async function listCatalogData() {
  const supabase = await createClient();
  const [categories, brands, collections] = await Promise.all([
    supabase.from('categories').select('*').order('position'),
    supabase.from('brands').select('*').order('name'),
    supabase.from('collections').select('*').order('position'),
  ]);
  return {
    categories: categories.data ?? [],
    brands: brands.data ?? [],
    collections: collections.data ?? [],
  };
}

export async function listProductOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('id, name, price').order('name');
  return data ?? [];
}
