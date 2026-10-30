import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminSidebar';
import { RegistrarAppAdmin } from '@/components/admin/RegistrarAppAdmin';
import { PuxarParaAtualizar } from '@/components/admin/PuxarParaAtualizar';
import { AvisoDeVersaoNova } from '@/components/admin/VersaoNova';

/** O painel não é conteúdo de busca. Fora do índice pelo mesmo motivo da área
 *  do cliente — e aqui vale duplamente: são telas com preço de custo, margem e
 *  dados de cliente.
 *
 *  O admin também é um app instalável, o "Prog Admin" (PWA): o manifesto em
 *  public/admin-app/ abre direto em /admin, com ícone próprio (escuro, com a
 *  etiqueta ADMIN) para não se confundir com a loja na tela inicial. No
 *  iPhone, apple-icon.png desta pasta é o ícone e `appleWebApp` dá o nome. */
export const metadata: Metadata = {
  title: 'Gerenciamento',
  robots: { index: false, follow: false },
  manifest: '/admin-app/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Prog Admin', statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/entrar?next=/admin');

  return (
    <>
      <RegistrarAppAdmin />
      <PuxarParaAtualizar />
      <AvisoDeVersaoNova />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
