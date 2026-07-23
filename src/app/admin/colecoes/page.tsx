import { listCatalogData, listAdminProducts } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CollectionsManager } from '@/components/admin/CollectionsManager';

export default async function AdminCollectionsPage() {
  const [{ collections }, products] = await Promise.all([listCatalogData(), listAdminProducts()]);

  const productRows = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    imageUrl: p.product_images.find((img) => img.url)?.url ?? null,
    collectionNames: (p.product_collections ?? []).map((pc) => pc.collections?.name).filter(Boolean) as string[],
  }));

  return (
    <div>
      <AdminPageHeader title="Coleções" subtitle={`${collections.length} coleções cadastradas`} />
      <CollectionsManager collections={collections} products={productRows} />
    </div>
  );
}
