'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** Aceita texto solto (assume sucesso) ou o próprio ActionResult. Recusa
 *  mostrada com ✓ verde é pior que não mostrar nada: o usuário lê o ícone antes
 *  da frase e sai achando que deu certo. */
type ToastInput = string | { ok: boolean; message: string };

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(true);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((input: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    const texto = typeof input === 'string' ? input : input.message;
    if (!texto) return;
    setMessage(texto);
    setOk(typeof input === 'string' ? true : input.ok);
    setShow(true);
    // Recusa costuma vir com explicação do que fazer; dá tempo de ler.
    timer.current = setTimeout(() => setShow(false), typeof input !== 'string' && !input.ok ? 5000 : 2400);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {show && (
        <div
          className={`fixed bottom-7 left-1/2 z-[110] max-w-[min(90vw,560px)] -translate-x-1/2 animate-toast-in rounded-[22px] bg-input-alt px-6 py-3.5 text-sm font-bold text-fg shadow-[0_16px_48px_rgba(0,0,0,.6)] ${
            ok ? 'border border-accent/50' : 'border border-error/60'
          }`}
          role="status"
        >
          <span className={`mr-2 ${ok ? 'text-accent' : 'text-error'}`}>{ok ? '✓' : '✕'}</span>
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
