import { createClient } from '@/lib/supabase/server';
import { STATUS_STYLES, type OrderStatus } from '@/lib/constants';
import { formatBRL, formatDateBR } from '@/lib/format';

export async function getDashboardData() {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [productsRes, ordersRes, monthOrdersRes, clientsRes, recentOrdersRes] = await Promise.all([
    supabase.from('products').select('id, name, stock, active'),
    supabase.from('orders').select('id, order_number, customer_name, total, status, created_at, order_items(product_name, qty)'),
    supabase.from('orders').select('total').gte('created_at', startOfMonth.toISOString()).neq('status', 'Cancelado'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase
      .from('orders')
      .select('id, order_number, customer_name, total, status, order_items(product_name, qty)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const products = productsRes.data ?? [];
  const orders = ordersRes.data ?? [];
  const monthSales = (monthOrdersRes.data ?? []).reduce((a, o) => a + Number(o.total), 0);

  const sold = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'Cancelado') continue;
    for (const it of o.order_items) {
      sold.set(it.product_name, (sold.get(it.product_name) ?? 0) + it.qty);
    }
  }
  const topSellers = [...sold.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty], i) => ({ rank: String(i + 1).padStart(2, '0'), name, sold: qty }));
  const maxSold = topSellers[0]?.sold ?? 1;

  const lowStock = products
    .filter((p) => p.stock <= 6)
    .sort((a, b) => a.stock - b.stock)
    .map((p) => ({ name: p.name, stock: p.stock }));

  const recentOrders = (recentOrdersRes.data ?? []).map((o) => {
    const style = STATUS_STYLES[o.status as OrderStatus] ?? STATUS_STYLES.Pago;
    return {
      id: `#${o.order_number}`,
      client: o.customer_name,
      items: o.order_items.map((i) => (i.qty > 1 ? `${i.qty}x ${i.product_name}` : i.product_name)).join(' + '),
      total: formatBRL(Number(o.total)),
      status: o.status,
      stBg: style.bg,
      stBorder: style.border,
      stColor: style.color,
    };
  });

  return {
    kpis: {
      monthSales: formatBRL(monthSales),
      ordersCount: orders.length,
      activeProducts: products.filter((p) => p.active).length,
      totalProducts: products.length,
      clientsCount: clientsRes.count ?? 0,
    },
    topSellers: topSellers.map((t) => ({ ...t, pct: Math.round((t.sold / maxSold) * 100) + '%' })),
    lowStock,
    recentOrders,
  };
}

export async function listAdminProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('*, brands(name), categories(name), product_collections(collections(name))')
    .order('created_at', { ascending: false });
  return data ?? [];
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
    supabase.from('collections').select('*').order('name'),
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
