import { createClient } from '@/lib/supabase/server';

export type ProductVariant = {
  id: string;
  gpu: string;
  cpu: string;
  ram: string;
  storage: string;
  screenType: string;
  price: number;
  promoPrice: number | null;
  stock: number;
};

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
  variants: ProductVariant[];
};

const VARIANT_SELECT = 'product_variants(id, gpu, cpu, ram, storage, screen_type, price, promo_price, stock, position)';

function mapVariants(raw: unknown): ProductVariant[] {
  const list = (raw ?? []) as {
    id: string;
    gpu: string | null;
    cpu: string | null;
    ram: string | null;
    storage: string | null;
    screen_type: string | null;
    price: number;
    promo_price: number | null;
    stock: number;
    position: number;
  }[];
  return [...list]
    .sort((a, b) => a.position - b.position)
    .map((v) => ({
      id: v.id,
      gpu: v.gpu ?? '',
      cpu: v.cpu ?? '',
      ram: v.ram ?? '',
      storage: v.storage ?? '',
      screenType: v.screen_type ?? '',
      price: Number(v.price),
      promoPrice: v.promo_price ? Number(v.promo_price) : null,
      stock: v.stock,
    }));
}

export async function listActiveProducts(): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, sku, name, price, promo_price, stock, gpu, cpu, ram, storage, screen_type, color, condition,
       categories(name), brands(name),
       product_images(label, url, position),
       product_collections(collections(name)),
       ${VARIANT_SELECT}`
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
      variants: mapVariants(p.product_variants),
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
      `id, sku, name, price, promo_price, stock, gpu, cpu, ram, storage, screen_type, color, condition,
       categories(name), brands(name),
       product_images(label, url, position),
       product_collections!inner(collection_id, collections(name)),
       ${VARIANT_SELECT}`
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
      variants: mapVariants(p.product_variants),
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
       reviews(id, author_name, rating, text, created_at),
       ${VARIANT_SELECT}`
    )
    .eq('sku', sku)
    .maybeSingle();

  if (error || !product) return null;

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
    related = (relatedProducts ?? []).map((p) => {
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
        variants: [],
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
    reviews: product.reviews ?? [],
    variants: mapVariants(product.product_variants),
    related,
  };
}
