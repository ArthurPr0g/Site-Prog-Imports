import { listBanners } from '@/lib/data/content';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { BannerEditor } from '@/components/admin/BannerEditor';

export default async function AdminBannersPage() {
  const banners = await listBanners();

  return (
    <div>
      <AdminPageHeader title="Banners da home" subtitle="Edite o carrossel sem tocar em código" />
      <BannerEditor banners={banners.map((b) => ({ id: b.id, tag: b.tag, title: b.title, subtitle: b.subtitle, image_label: b.image_label }))} />
    </div>
  );
}
