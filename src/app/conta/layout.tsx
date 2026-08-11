import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AccountHeader } from '@/components/account/AccountHeader';
import { AccountSidebar } from '@/components/account/AccountSidebar';

/** Área logada não vai para o índice.
 *
 *  O `robots.txt` já pede para não rastrear, mas isso não basta: uma URL
 *  bloqueada lá pode ser indexada mesmo assim se alguém a linkar de fora, e aí
 *  aparece na busca sem título nem descrição, porque o robô não pôde ler a
 *  página. O `noindex` é o que efetivamente a mantém fora. */
export const metadata: Metadata = {
  title: 'Minha conta',
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/conta');

  return (
    <div className="min-h-screen bg-page">
      <AccountHeader name={user.name} />
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-7 px-6 py-8 md:grid-cols-[230px_1fr]">
        <AccountSidebar />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
