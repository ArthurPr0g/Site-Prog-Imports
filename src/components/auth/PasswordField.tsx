'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

export function PasswordField({
  name,
  placeholder,
  minLength,
  autoComplete,
}: {
  name: string;
  placeholder: string;
  minLength?: number;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faded" />
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-full border border-border-strong bg-input py-3.5 pl-11 pr-11 text-[13.5px] outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-faded hover:text-accent"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
