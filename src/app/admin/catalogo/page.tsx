import { listCatalogData } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CatalogGroup } from '@/components/admin/CatalogGroup';
import { CoverImageCatalogGroup } from '@/components/admin/CoverImageCatalogGroup';

export default async function AdminCatalogPage() {
  const { categories, brands, collections } = await listCatalogData();

  return (
    <div>
      <AdminPageHeader title="Coleções · Categorias · Marcas" subtitle="Organização do catálogo" />
      <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-3">
        <CoverImageCatalogGroup title="Coleções" kind="collections" items={collections} placeholder="Nova coleção…" />
        <CoverImageCatalogGroup title="Categorias" kind="categories" items={categories} placeholder="Nova categoria…" />
        <CatalogGroup title="Marcas" table="brands" items={brands} placeholder="Nova marca…" />
      </div>
    </div>
  );
}
