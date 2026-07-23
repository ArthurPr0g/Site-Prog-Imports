'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { User, Mail, ArrowRight } from 'lucide-react';
import { signUpAction, type AuthResult } from '@/app/actions/auth';
import { AuthShell, OrDivider } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { GoogleButton } from '@/components/auth/GoogleButton';

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(signUpAction, {});

  return (
    <AuthShell
      title="Criar sua conta"
      subtitle="Acompanhe pedidos, favoritos e rastreamento."
      footer={
        <>
          Já tem conta?{' '}
          <Link href="/entrar" className="font-bold text-accent">
            Entrar
          </Link>
        </>
      }
    >
      <GoogleButton label="Cadastrar com Google" />
      <OrDivider />
      <form action={formAction} className="flex flex-col gap-3">
        <div className="relative">
          <User size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faded" />
          <input
            name="name"
            required
            placeholder="Nome completo"
            className="w-full rounded-full border border-border-strong bg-input py-3.5 pl-11 pr-4 text-[13.5px] outline-none focus:border-accent"
          />
        </div>
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
        <PasswordField name="password" placeholder="Senha (mín. 8 caracteres)" minLength={8} autoComplete="new-password" />
        <PasswordField name="confirm" placeholder="Confirmar senha" autoComplete="new-password" />
        {state.error && <div className="text-[13px] font-semibold text-error">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-[14px] font-extrabold text-page transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(242,135,5,.4)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {pending ? 'Criando conta…' : (
            <>
              Criar conta <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
