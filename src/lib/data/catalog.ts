import { createClient } from '@/lib/supabase/server';

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
};

export async function listActiveProducts(): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, sku, name, price, promo_price, stock,
       categories(name), brands(name),
       product_images(label, url, position),
       product_collections(collections(name))`
    )
    .eq('active', true)
    .order('created_at', { ascending: false });

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
    };
  });
}

export async function listCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('*').order('position');
  return data ?? [];
}

export async function listCollectionNames() {
  const supabase = await createClient();
  const { data } = await supabase.from('collections').select('name').order('name');
  return (data ?? []).map((c) => c.name);
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
    related,
  };
}
