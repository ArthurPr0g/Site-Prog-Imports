import { listCatalogData } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CatalogGroup } from '@/components/admin/CatalogGroup';
import { CoverImageCatalogGroup } from '@/components/admin/CoverImageCatalogGroup';

export default async function AdminCatalogPage() {
  const { categories, brands } = await listCatalogData();

  return (
    <div>
      <AdminPageHeader title="Categorias · Marcas" subtitle="Organização do catálogo — Coleções agora tem página própria" />
      <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
        <CoverImageCatalogGroup title="Categorias" items={categories} placeholder="Nova categoria…" />
        <CatalogGroup title="Marcas" table="brands" items={brands} placeholder="Nova marca…" />
      </div>
    </div>
  );
}
