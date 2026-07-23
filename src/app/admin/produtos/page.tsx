import { listAdminProducts, listCatalogData } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ProductsTable } from '@/components/admin/ProductsTable';

export default async function AdminProductsPage() {
  const [products, catalog] = await Promise.all([listAdminProducts(), listCatalogData()]);

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.categories?.name ?? '',
    brand: p.brands?.name ?? '',
    collections: (p.product_collections ?? []).map((pc) => pc.collections?.name).filter(Boolean) as string[],
    price: Number(p.price),
    stock: p.stock,
    active: p.active,
    description: p.description,
    imageUrl: p.product_images.find((img) => img.url)?.url ?? null,
    images: p.product_images.map((img) => ({ id: img.id, url: img.url, label: img.label })),
    rating: Number(p.rating),
    reviewCount: p.review_count,
    highlights: p.highlights ?? [],
  }));

  return (
    <div>
      <AdminPageHeader title="Produtos" subtitle={`${products.length} produtos cadastrados`} />
      <ProductsTable products={rows} collections={catalog.collections.map((c) => c.name)} />
    </div>
  );
}
