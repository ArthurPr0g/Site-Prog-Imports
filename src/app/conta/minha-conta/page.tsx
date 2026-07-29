import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ProfileForm, PasswordForm } from '@/components/account/ProfileForms';
import { signOutAction } from '@/app/actions/auth';

export default async function MyAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/conta');

  return (
    <div>
      <h1 className="mb-6 font-display text-[26px] font-bold tracking-[-.02em]">Dados da conta</h1>
      <div className="flex max-w-[560px] flex-col gap-3.5">
        <ProfileForm name={user.name} email={user.email} phone={user.phone} />
        <PasswordForm />

        {/* Sair da conta: a server action já limpa a sessão e redireciona pra
            home, então um form basta — não precisa de componente client. O
            botão é secundário de propósito, pra não competir com os "Salvar
            alterações" logo acima. */}
        <div className="rounded-[20px] border border-border bg-card p-7">
          <div className="mb-1.5 text-sm font-extrabold">Sair da conta</div>
          <p className="mb-3.5 text-[13px] text-fg-tertiary">
            Você será desconectado neste dispositivo e voltará para a página inicial.
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="self-start rounded-control border border-border-strong px-6.5 py-3 text-[13.5px] font-extrabold text-fg-secondary transition-colors hover:border-error hover:text-error"
            >
              Sair da conta
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
