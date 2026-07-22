import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ProfileForm, PasswordForm } from '@/components/account/ProfileForms';

export default async function MyAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/conta');

  return (
    <div>
      <h1 className="mb-6 font-display text-[26px] font-bold tracking-[-.02em]">Dados da conta</h1>
      <div className="flex max-w-[560px] flex-col gap-3.5">
        <ProfileForm name={user.name} email={user.email} phone={user.phone} />
        <PasswordForm />
      </div>
    </div>
  );
}
