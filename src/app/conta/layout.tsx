import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AccountHeader } from '@/components/account/AccountHeader';
import { AccountSidebar } from '@/components/account/AccountSidebar';

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
