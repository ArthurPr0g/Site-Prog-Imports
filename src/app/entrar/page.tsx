'use client';

import { Suspense, useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, ArrowRight } from 'lucide-react';
import { signInAction, type AuthResult } from '@/app/actions/auth';
import { AuthShell, OrDivider } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { GoogleButton } from '@/components/auth/GoogleButton';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '';
  const oauthError = searchParams.get('error') === 'oauth';
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(signInAction, {});

  return (
    <>
      <GoogleButton next={next} label="Entrar com Google" />
      <OrDivider />
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <div className="relative">
          <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faded" />
          <input
            name="email"
            type="email"
            required
            placeholder="E-mail"
            className="w-full rounded-full border border-border-strong bg-input py-3.5 pl-11 pr-4 text-[13.5px] outline-none focus:border-accent"
          />
        </div>
        <PasswordField name="password" placeholder="Senha" autoComplete="current-password" />
        {(state.error || oauthError) && (
          <div className="text-[13px] font-semibold text-error">
            {state.error || 'Não foi possível entrar com o Google. Tente novamente.'}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-[14px] font-extrabold text-page transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(242,135,5,.4)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {pending ? 'Entrando…' : (
            <>
              Entrar <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre para acompanhar seus pedidos e favoritos."
      footer={
        <>
          Não tem conta?{' '}
          <Link href="/cadastro" className="font-bold text-accent">
            Cadastre-se
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
