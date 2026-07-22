import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/entrar?next=/admin');

  return (
    <div className="flex min-h-screen bg-page">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-8 pb-12 pt-7">{children}</main>
    </div>
  );
}
