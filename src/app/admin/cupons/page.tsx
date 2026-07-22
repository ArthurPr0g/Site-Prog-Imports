import { listAdminCoupons } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CouponsPanel } from '@/components/admin/CouponsPanel';

export default async function AdminCouponsPage() {
  const coupons = await listAdminCoupons();

  return (
    <div>
      <AdminPageHeader title="Cupons" subtitle="Cupons promocionais" />
      <CouponsPanel coupons={coupons} />
    </div>
  );
}
