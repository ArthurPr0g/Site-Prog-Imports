'use client';

import { useActionState } from 'react';
import { saveAddressAction, type ActionResult } from '@/app/actions/account';
import type { Tables } from '@/lib/supabase/database.types';

const inputClass =
  'rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent';

export function AddressForm({ address }: { address: Tables<'addresses'> | null }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveAddressAction, {
    ok: false,
    message: '',
  });

  return (
    <form action={formAction} className="max-w-[560px] rounded-[20px] border border-border bg-card p-7">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="rua" defaultValue={address?.rua} placeholder="Rua e número" className={`sm:col-span-2 ${inputClass}`} />
        <input name="complemento" defaultValue={address?.complemento} placeholder="Complemento" className={inputClass} />
        <input name="bairro" defaultValue={address?.bairro} placeholder="Bairro" className={inputClass} />
        <input name="cidade" defaultValue={address?.cidade} placeholder="Cidade / UF" className={inputClass} />
        <input name="cep" defaultValue={address?.cep} placeholder="CEP" className={inputClass} />
      </div>
      {state.message && (
        <div className={`mt-3 text-[13px] font-semibold ${state.ok ? 'text-accent' : 'text-error'}`}>{state.message}</div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-control bg-accent px-6.5 py-3 text-[13.5px] font-extrabold text-page disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Salvar endereço'}
      </button>
    </form>
  );
}
