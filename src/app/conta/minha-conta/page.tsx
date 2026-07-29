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

        {/* Sair da conta: aponta pro route handler /auth/signout, não pra uma
            server action. A action quebrava a tela no error.tsx — ela limpa os
            cookies e o Next re-renderiza este segmento na mesma resposta, aí o
            layout de /conta não acha mais usuário e dispara outro redirect. O
            handler responde 303 e o navegador sai daqui sozinho.
            Botão secundário de propósito, pra não competir com os "Salvar
            alterações" logo acima. */}
        <div className="rounded-[20px] border border-border bg-card p-7">
          <div className="mb-1.5 text-sm font-extrabold">Sair da conta</div>
          <p className="mb-3.5 text-[13px] text-fg-tertiary">
            Você será desconectado neste dispositivo e voltará para a página inicial.
          </p>
          <form action="/auth/signout" method="post">
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
