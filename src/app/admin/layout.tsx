import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/entrar?next=/admin');

  return <AdminShell>{children}</AdminShell>;
}
