'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { STATUS_TO_STAGE, type OrderStatus } from '@/lib/constants';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
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
  rating: number;
  reviewCount: number;
  highlights: string[];
};

export async function saveProductAction(input: ProductFormInput): Promise<ActionResult & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (!input.name.trim()) return errResult('Informe o nome do produto.');
  if (!input.sku.trim()) return errResult('Informe o SKU do produto.');
  if (!Number.isFinite(input.price) || input.price <= 0) return errResult('Informe um preço válido, maior que zero.');
  if (input.promoPrice !== null && (!Number.isFinite(input.promoPrice) || input.promoPrice <= 0)) {
    return errResult('O preço promocional precisa ser um número válido maior que zero.');
  }
  if (input.promoPrice !== null && input.promoPrice >= input.price) {
    return errResult('O preço promocional precisa ser menor que o preço original.');
  }
  if (!Number.isFinite(input.stock) || input.stock < 0) return errResult('Informe um estoque válido (0 ou mais).');
  if (!Number.isFinite(input.rating) || input.rating < 0 || input.rating > 5) {
    return errResult('A avaliação precisa ser um número entre 0 e 5.');
  }
  if (!Number.isFinite(input.reviewCount) || input.reviewCount < 0) {
    return errResult('Informe um número de avaliações válido (0 ou mais).');
  }

  let brandId: string | null = null;
  if (input.brand.trim()) {
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .upsert({ name: input.brand.trim() }, { onConflict: 'name' })
      .select('id')
      .single();
    if (brandError) return errResult(friendlyDbError(brandError, 'Não foi possível salvar a marca.'));
    brandId = brand?.id ?? null;
  }

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('name', input.category)
    .maybeSingle();
  if (categoryError) return errResult('Não foi possível validar a categoria selecionada.');

  const highlights = input.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 8);

  const payload = {
    name: input.name.trim(),
    sku: input.sku.trim(),
    brand_id: brandId,
    category_id: category?.id ?? null,
    price: input.price,
    promo_price: input.promoPrice,
    stock: input.stock,
    description: input.description.trim(),
    rating: input.rating,
    review_count: input.reviewCount,
    highlights,
  };

  let productId = input.id;
  if (input.id) {
    const { error } = await supabase.from('products').update(payload).eq('id', input.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar as alterações do produto.'));
  } else {
    const { data, error } = await supabase.from('products').insert({ ...payload, active: true }).select('id').single();
    if (error) return errResult(friendlyDbError(error, 'Não foi possível criar o produto.'));
    productId = data?.id;
  }

  if (productId) {
    const { error: delError } = await supabase.from('product_collections').delete().eq('product_id', productId);
    if (delError) return errResult('Produto salvo, mas não foi possível atualizar a coleção.');
    if (input.collection.trim()) {
      const { data: col } = await supabase.from('collections').select('id').eq('name', input.collection).maybeSingle();
      if (col) {
        const { error: colError } = await supabase
          .from('product_collections')
          .insert({ product_id: productId, collection_id: col.id });
        if (colError) return errResult('Produto salvo, mas não foi possível vincular a coleção.');
      }
    }
  }

  revalidatePath('/admin/produtos');
  revalidatePath('/');
  return { ...okResult('Produto salvo com sucesso.'), id: productId };
}

export async function toggleProductActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('products').update({ active: !active }).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível atualizar o status do produto.'));
  revalidatePath('/admin/produtos');
  revalidatePath('/');
  return okResult();
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o produto — verifique se ele não está em algum pedido.'));
  revalidatePath('/admin/produtos');
  revalidatePath('/');
  return okResult();
}

// ============ ORDERS ============
export async function updateOrderStatusAction(orderId: string, status: OrderStatus): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase
    .from('orders')
    .update({ status, timeline_stage: STATUS_TO_STAGE[status], updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível atualizar o status do pedido.'));
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
  return okResult();
}

export async function createOrderAction(input: {
  clientName: string;
  status: OrderStatus;
  items: { productId: string; qty: number }[];
}): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (!input.clientName.trim()) return errResult('Informe o nome do cliente.');
  if (input.items.length === 0) return errResult('Adicione ao menos um item ao pedido.');
  if (input.items.some((i) => !i.productId || i.qty < 1)) {
    return errResult('Verifique os itens do pedido: produto e quantidade são obrigatórios.');
  }

  const productIds = input.items.map((i) => i.productId);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price')
    .in('id', productIds);
  if (productsError) return errResult('Não foi possível carregar os produtos selecionados.');

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const missing = input.items.find((it) => !byId.has(it.productId));
  if (missing) return errResult('Um dos produtos selecionados não existe mais — remova-o e tente novamente.');

  const total = input.items.reduce((sum, it) => sum + Number(byId.get(it.productId)!.price) * it.qty, 0);

  const { data: seq, error: seqError } = await supabase.rpc('next_order_number');
  let orderNumber: number;
  if (!seqError && typeof seq === 'number') {
    orderNumber = seq;
  } else {
    const { data: maxRow } = await supabase
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    orderNumber = (maxRow?.order_number ?? 1047) + 1;
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_name: input.clientName.trim(),
      status: input.status,
      timeline_stage: STATUS_TO_STAGE[input.status],
      subtotal: total,
      total,
    })
    .select('id')
    .single();
  if (orderError || !order) return errResult(friendlyDbError(orderError, 'Não foi possível lançar o pedido.'));

  const rows = input.items.map((it) => {
    const p = byId.get(it.productId)!;
    return {
      order_id: order.id,
      product_id: it.productId,
      product_name: p.name,
      qty: it.qty,
      unit_price: Number(p.price),
    };
  });
  const { error: itemsError } = await supabase.from('order_items').insert(rows);
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id);
    return errResult('Não foi possível registrar os itens do pedido. Nada foi salvo — tente novamente.');
  }

  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
  return okResult('Pedido lançado com sucesso.');
}

export async function deleteOrderAction(orderId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o pedido.'));
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
  return okResult('Pedido excluído.');
}

// ============ COUPONS ============
export async function createCouponAction(code: string, pct: number): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const normalized = code.trim().toUpperCase();
  if (!normalized) return errResult('Informe o código do cupom.');
  if (!Number.isFinite(pct) || pct < 1 || pct > 100) return errResult('O desconto deve ser um número entre 1 e 100.');

  const { error } = await supabase.from('coupons').insert({ code: normalized, pct, active: true, uses: 0 });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível criar o cupom.'));
  revalidatePath('/admin/cupons');
  return okResult('Cupom criado.');
}

export async function toggleCouponAction(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('coupons').update({ active: !active }).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível atualizar o cupom.'));
  revalidatePath('/admin/cupons');
  return okResult();
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o cupom.'));
  revalidatePath('/admin/cupons');
  return okResult();
}

// ============ CATALOG (categories/brands/collections) ============
type CatalogTable = 'categories' | 'brands' | 'collections';

export async function addCatalogItemAction(table: CatalogTable, name: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const trimmed = name.trim();
  if (!trimmed) return errResult('Informe um nome.');
  const { error } = await supabase.from(table).insert({ name: trimmed } as never);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível adicionar o item.'));
  revalidatePath('/admin/catalogo');
  return okResult();
}

export async function deleteCatalogItemAction(table: CatalogTable, id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    return errResult(
      friendlyDbError(error, 'Não foi possível excluir — verifique se não há produtos usando este item.')
    );
  }
  revalidatePath('/admin/catalogo');
  return okResult();
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type CoverImageTable = 'collections' | 'categories';
const COVER_IMAGE_BUCKET: Record<CoverImageTable, string> = {
  collections: 'collection-images',
  categories: 'category-images',
};
const COVER_IMAGE_LABEL: Record<CoverImageTable, string> = {
  collections: 'coleção',
  categories: 'categoria',
};

function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

async function uploadCoverImageAction(table: CoverImageTable, id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return errResult('Selecione uma imagem.');
  if (!file.type.startsWith('image/')) return errResult('O arquivo precisa ser uma imagem (PNG, JPG, WEBP...).');
  if (file.size > MAX_IMAGE_BYTES) return errResult('A imagem deve ter no máximo 5MB.');

  const bucket = COVER_IMAGE_BUCKET[table];
  const { data: current } = await supabase.from(table).select('image_url').eq('id', id).maybeSingle();

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const path = `${id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return errResult('Não foi possível enviar a imagem. Tente novamente.');

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

  const { error } = await supabase.from(table).update({ image_url: pub.publicUrl }).eq('id', id);
  if (error) {
    await supabase.storage.from(bucket).remove([path]);
    return errResult(friendlyDbError(error, `Não foi possível salvar a capa da ${COVER_IMAGE_LABEL[table]}.`));
  }

  if (current?.image_url) {
    const oldPath = storagePathFromPublicUrl(current.image_url, bucket);
    if (oldPath) await supabase.storage.from(bucket).remove([oldPath]);
  }

  revalidatePath('/admin/catalogo');
  revalidatePath('/');
  return okResult('Capa atualizada.');
}

async function removeCoverImageAction(table: CoverImageTable, id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const bucket = COVER_IMAGE_BUCKET[table];
  const { data: current } = await supabase.from(table).select('image_url').eq('id', id).maybeSingle();

  const { error } = await supabase.from(table).update({ image_url: null }).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível remover a capa.'));

  if (current?.image_url) {
    const oldPath = storagePathFromPublicUrl(current.image_url, bucket);
    if (oldPath) await supabase.storage.from(bucket).remove([oldPath]);
  }

  revalidatePath('/admin/catalogo');
  revalidatePath('/');
  return okResult('Capa removida.');
}

export async function uploadCollectionImageAction(id: string, formData: FormData): Promise<ActionResult> {
  return uploadCoverImageAction('collections', id, formData);
}
export async function removeCollectionImageAction(id: string): Promise<ActionResult> {
  return removeCoverImageAction('collections', id);
}

export async function uploadCategoryImageAction(id: string, formData: FormData): Promise<ActionResult> {
  return uploadCoverImageAction('categories', id, formData);
}
export async function removeCategoryImageAction(id: string): Promise<ActionResult> {
  return removeCoverImageAction('categories', id);
}

const PRODUCT_IMAGES_BUCKET = 'product-images';
const MAX_PRODUCT_IMAGES = 8;

export async function uploadProductImageAction(
  productId: string,
  formData: FormData
): Promise<ActionResult & { image?: { id: string; url: string; label: string } }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return errResult('Selecione uma imagem.');
  if (!file.type.startsWith('image/')) return errResult('O arquivo precisa ser uma imagem (PNG, JPG, WEBP...).');
  if (file.size > MAX_IMAGE_BYTES) return errResult('A imagem deve ter no máximo 5MB.');

  const { data: product } = await supabase.from('products').select('name').eq('id', productId).maybeSingle();
  if (!product) return errResult('Produto não encontrado.');

  const { count } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  if ((count ?? 0) >= MAX_PRODUCT_IMAGES) return errResult(`Cada produto pode ter no máximo ${MAX_PRODUCT_IMAGES} imagens.`);

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return errResult('Não foi possível enviar a imagem. Tente novamente.');

  const { data: pub } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);

  const { data: last } = await supabase
    .from('product_images')
    .select('position')
    .eq('product_id', productId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (last?.position ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from('product_images')
    .insert({ product_id: productId, label: product.name.toLowerCase(), url: pub.publicUrl, position: nextPosition })
    .select('id, url, label')
    .single();
  if (error || !inserted) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
    return errResult(friendlyDbError(error, 'Não foi possível salvar a imagem.'));
  }

  revalidatePath('/admin/produtos');
  revalidatePath('/');
  return { ...okResult('Imagem adicionada.'), image: { id: inserted.id, url: inserted.url ?? pub.publicUrl, label: inserted.label } };
}

export async function removeProductImageAction(imageId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: image } = await supabase.from('product_images').select('url').eq('id', imageId).maybeSingle();
  if (!image) return errResult('Imagem não encontrada.');

  const { error } = await supabase.from('product_images').delete().eq('id', imageId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível remover a imagem.'));

  if (image.url) {
    const oldPath = storagePathFromPublicUrl(image.url, PRODUCT_IMAGES_BUCKET);
    if (oldPath) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([oldPath]);
  }

  revalidatePath('/admin/produtos');
  revalidatePath('/');
  return okResult('Imagem removida.');
}

// ============ BANNERS ============
export async function updateBannerAction(
  id: string,
  patch: { tag?: string; title?: string; subtitle?: string }
): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('banners').update(patch).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o banner.'));
  revalidatePath('/admin/banners');
  revalidatePath('/');
  return okResult('Banner atualizado.');
}

// ============ SERVICES ============
export async function addServiceAction(name: string, priceLabel: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const trimmed = name.trim();
  if (!trimmed) return errResult('Informe o nome do serviço.');
  const { error } = await supabase.from('services').insert({
    name: trimmed,
    price_label: priceLabel.trim() || 'sob consulta',
    glyph: trimmed.slice(0, 2).toUpperCase(),
  });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível adicionar o serviço.'));
  revalidatePath('/admin/servicos');
  revalidatePath('/');
  return okResult();
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o serviço.'));
  revalidatePath('/admin/servicos');
  revalidatePath('/');
  return okResult();
}

// ============ TESTIMONIALS ============
export async function addTestimonialAction(name: string, text: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const trimmedName = name.trim();
  const trimmedText = text.trim();
  if (!trimmedName || !trimmedText) return errResult('Preencha nome e depoimento.');
  const { error } = await supabase.from('testimonials').insert({ name: trimmedName, text: trimmedText });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível publicar o depoimento.'));
  revalidatePath('/admin/depoimentos');
  revalidatePath('/');
  return okResult();
}

export async function deleteTestimonialAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('testimonials').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o depoimento.'));
  revalidatePath('/admin/depoimentos');
  revalidatePath('/');
  return okResult();
}
