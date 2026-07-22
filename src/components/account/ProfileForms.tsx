'use client';

import { useActionState } from 'react';
import { updateProfileAction, changePasswordAction, type ActionResult } from '@/app/actions/account';

const inputClass =
  'rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent';

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(updateProfileAction, {
    ok: false,
    message: '',
  });

  return (
    <div className="rounded-[20px] border border-border bg-card p-7">
      <div className="mb-3.5 text-sm font-extrabold">Informações pessoais</div>
      <form action={formAction} className="flex flex-col gap-3">
        <input name="nome" defaultValue={name} required placeholder="Nome completo" className={inputClass} />
        <input defaultValue={email} disabled placeholder="E-mail" className={`${inputClass} opacity-60`} />
        <input name="fone" defaultValue={phone} placeholder="Telefone" className={inputClass} />
        {state.message && (
          <div className={`text-[13px] font-semibold ${state.ok ? 'text-accent' : 'text-error'}`}>{state.message}</div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 self-start rounded-control bg-accent px-6.5 py-3 text-[13.5px] font-extrabold text-page disabled:opacity-60"
        >
          {pending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(changePasswordAction, {
    ok: false,
    message: '',
  });

  return (
    <div className="rounded-[20px] border border-border bg-card p-7">
      <div className="mb-3.5 text-sm font-extrabold">Alterar senha</div>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="password" name="atual" required autoComplete="current-password" placeholder="Senha atual" className={inputClass} />
        <input
          type="password"
          name="nova"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Nova senha (mín. 8 caracteres)"
          className={inputClass}
        />
        <input type="password" name="conf" required autoComplete="new-password" placeholder="Confirmar nova senha" className={inputClass} />
        {state.message && (
          <div className={`text-[13px] font-semibold ${state.ok ? 'text-accent' : 'text-error'}`}>{state.message}</div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 self-start rounded-control bg-accent px-6.5 py-3 text-[13.5px] font-extrabold text-page disabled:opacity-60"
        >
          {pending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  );
}
