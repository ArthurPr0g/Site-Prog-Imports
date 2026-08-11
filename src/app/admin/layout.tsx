import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminSidebar';

/** O painel não é conteúdo de busca. Fora do índice pelo mesmo motivo da área
 *  do cliente — e aqui vale duplamente: são telas com preço de custo, margem e
 *  dados de cliente. */
export const metadata: Metadata = {
  title: 'Gerenciamento',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/entrar?next=/admin');

  return <AdminShell>{children}</AdminShell>;
}
