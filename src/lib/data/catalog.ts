import { createClient } from '@/lib/supabase/server';
import { resolveHighlights } from '@/lib/product-highlights';

export type ProductCard = {
  id: string;
  sku: string;
  name: string;
  price: number;
  promoPrice: number | null;
  category: string;
  brand: string;
  image: string;
  imageUrl: string | null;
  stock: number;
  collections: string[];
  gpu: string;
  cpu: string;
  ram: string;
  storage: string;
  screenType: string;
  color: string;
  condition: string;
  variantOf: string | null;
};

export async function listActiveProducts(): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, sku, name, price, promo_price, stock, gpu, cpu, ram, storage, screen_type, color, condition, variant_of,
       categories(name), brands(name),
       product_images(label, url, position),
       product_collections(collections(name))`
    )
    .eq('active', true)
    .order('position');

  if (error || !data) return [];

  return data.map((p) => {
    const images = (p.product_images ?? []).sort((a, b) => a.position - b.position);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: Number(p.price),
      promoPrice: p.promo_price ? Number(p.promo_price) : null,
      category: p.categories?.name ?? '',
      brand: p.brands?.name ?? '',
      image: images[0]?.label ?? p.name.toLowerCase(),
      imageUrl: images.find((img) => img.url)?.url ?? null,
      stock: p.stock,
      collections: (p.product_collections ?? []).map((pc) => pc.collections?.name).filter(Boolean) as string[],
      gpu: p.gpu ?? '',
      cpu: p.cpu ?? '',
      ram: p.ram ?? '',
      storage: p.storage ?? '',
      screenType: p.screen_type ?? '',
      color: p.color ?? '',
      condition: p.condition ?? '',
      variantOf: p.variant_of,
    };
  });
}

export async function listCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('*').eq('active', true).order('position');
  return data ?? [];
}

export async function listCollectionNames() {
  const supabase = await createClient();
  const { data } = await supabase.from('collections').select('name').order('position');
  return (data ?? []).map((c) => c.name);
}

export async function listTopCollections() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('collections')
    .select('id, name, image_url')
    .eq('show_on_site', true)
    .order('site_position')
    .order('name');
  return data ?? [];
}

export async function listFeedCollections() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('collections')
    .select('id, name, image_url')
    .eq('show_in_feed', true)
    .order('site_position')
    .order('name');
  return data ?? [];
}

export async function getCollectionById(id: string) {
  const supabase = await createClient();
  const { data: collection } = await supabase.from('collections').select('id, name').eq('id', id).maybeSingle();
  if (!collection) return null;

  const { data, error } = await supabase
    .from('products')
    .select(
      `id, sku, name, price, promo_price, stock, gpu, cpu, ram, storage, screen_type, color, condition, variant_of,
       categories(name), brands(name),
       product_images(label, url, position),
       product_collections!inner(collection_id, collections(name))`
    )
    .eq('active', true)
    .eq('product_collections.collection_id', id)
    .order('position');

  if (error || !data) return { ...collection, products: [] as ProductCard[] };

  const products = data.map((p) => {
    const images = (p.product_images ?? []).sort((a, b) => a.position - b.position);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: Number(p.price),
      promoPrice: p.promo_price ? Number(p.promo_price) : null,
      category: p.categories?.name ?? '',
      brand: p.brands?.name ?? '',
      image: images[0]?.label ?? p.name.toLowerCase(),
      imageUrl: images.find((img) => img.url)?.url ?? null,
      stock: p.stock,
      collections: (p.product_collections ?? []).map((pc) => pc.collections?.name).filter(Boolean) as string[],
      gpu: p.gpu ?? '',
      cpu: p.cpu ?? '',
      ram: p.ram ?? '',
      storage: p.storage ?? '',
      screenType: p.screen_type ?? '',
      color: p.color ?? '',
      condition: p.condition ?? '',
      variantOf: p.variant_of,
    };
  });

  return { ...collection, products };
}

export async function getProductBySku(sku: string) {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from('products')
    .select(
      `*, categories(name), brands(name),
       product_images(id, label, url, position),
       product_specs(k, v, position),
       reviews(id, author_name, rating, text, created_at)`
    )
    .eq('sku', sku)
    .maybeSingle();

  if (error || !product) return null;

  // Variações de configuração são produtos completos ligados via variant_of —
  // o grupo inteiro é: o produto de origem (variant_of nulo) + todos que
  // apontam pra ele.
  const groupId = product.variant_of ?? product.id;
  const { data: groupRows } = await supabase
    .from('products')
    .select(
      `id, sku, name, price, promo_price, stock, gpu, cpu, ram, storage, screen_type, color, condition, variant_of,
       categories(name), brands(name), product_images(label, url, position)`
    )
    .or(`id.eq.${groupId},variant_of.eq.${groupId}`)
    .eq('active', true);

  const siblings: ProductCard[] = (groupRows ?? []).map((p) => {
    const images = (p.product_images ?? []).sort((a, b) => a.position - b.position);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: Number(p.price),
      promoPrice: p.promo_price ? Number(p.promo_price) : null,
      category: p.categories?.name ?? '',
      brand: p.brands?.name ?? '',
      image: images[0]?.label ?? p.name.toLowerCase(),
      imageUrl: images.find((img) => img.url)?.url ?? null,
      stock: p.stock,
      collections: [],
      gpu: p.gpu ?? '',
      cpu: p.cpu ?? '',
      ram: p.ram ?? '',
      storage: p.storage ?? '',
      screenType: p.screen_type ?? '',
      color: p.color ?? '',
      condition: p.condition ?? '',
      variantOf: p.variant_of,
    };
  });
  const siblingIds = new Set(siblings.map((s) => s.id));

  // Sugestões automáticas: outros produtos ativos da mesma categoria — não depende de
  // curadoria manual, então passa a aparecer sozinho conforme o catálogo cresce.
  let related: ProductCard[] = [];
  if (product.category_id) {
    const { data: relatedProducts } = await supabase
      .from('products')
      .select(`id, sku, name, price, promo_price, stock, categories(name), brands(name), product_images(label, url, position)`)
      .eq('category_id', product.category_id)
      .eq('active', true)
      .neq('id', product.id)
      .order('created_at', { ascending: false })
      .limit(8);
    related = (relatedProducts ?? [])
      .filter((p) => !siblingIds.has(p.id))
      .map((p) => {
        const images = (p.product_images ?? []).sort((a, b) => a.position - b.position);
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          price: Number(p.price),
          promoPrice: p.promo_price ? Number(p.promo_price) : null,
          category: p.categories?.name ?? '',
          brand: p.brands?.name ?? '',
          image: images[0]?.label ?? p.name.toLowerCase(),
          imageUrl: images.find((img) => img.url)?.url ?? null,
          stock: p.stock,
          collections: [],
          gpu: '',
          cpu: '',
          ram: '',
          storage: '',
          screenType: '',
          color: '',
          condition: '',
          variantOf: null,
        };
      });
  }

  return {
    ...product,
    price: Number(product.price),
    promoPrice: product.promo_price ? Number(product.promo_price) : null,
    category: product.categories?.name ?? '',
    brand: product.brands?.name ?? '',
    images: (product.product_images ?? []).sort((a, b) => a.position - b.position),
    specs: (product.product_specs ?? []).sort((a, b) => a.position - b.position),
    // Sem curadoria no admin, os destaques saem da própria descrição. Derivado
    // aqui em vez de gravado para não dessincronizar quando a descrição mudar.
    highlights: resolveHighlights(product.highlights, product.description),
    reviews: product.reviews ?? [],
    siblings,
    related,
  };
}
