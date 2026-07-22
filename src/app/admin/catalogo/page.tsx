import { listCatalogData } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CatalogGroup } from '@/components/admin/CatalogGroup';

export default async function AdminCatalogPage() {
  const { categories, brands, collections } = await listCatalogData();

  return (
    <div>
      <AdminPageHeader title="Coleções · Categorias · Marcas" subtitle="Organização do catálogo" />
      <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-3">
        <CatalogGroup title="Coleções" table="collections" items={collections} placeholder="Nova coleção…" />
        <CatalogGroup title="Categorias" table="categories" items={categories} placeholder="Nova categoria…" />
        <CatalogGroup title="Marcas" table="brands" items={brands} placeholder="Nova marca…" />
      </div>
    </div>
  );
}
