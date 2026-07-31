'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/Toast';
import { saveSystemSettingsAction } from '@/app/actions/settings';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

export function SystemSettings({
  usdRate,
  defaultDeliveryTime,
}: {
  usdRate: number | null;
  defaultDeliveryTime: string;
}) {
  const [cotacao, setCotacao] = useState(usdRate !== null ? String(usdRate) : '');
  const [prazo, setPrazo] = useState(defaultDeliveryTime);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function salvar() {
    startTransition(async () => {
      const result = await saveSystemSettingsAction({
        usdRate: cotacao.trim() === '' ? null : Number(cotacao.replace(',', '.')),
        defaultDeliveryTime: prazo,
      });
      toast(result.message);
    });
  }

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-1 text-[15px] font-extrabold">Parâmetros do sistema</div>
      <div className="mb-4 text-[12.5px] text-fg-tertiary">
        Usados pelos módulos do ERP. A cotação é a fonte única dos orçamentos — ela nunca é digitada
        no formulário do orçamento, para que todos usem o mesmo câmbio.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Cotação do dólar (R$)
          </div>
          <input
            value={cotacao}
            onChange={(e) => setCotacao(e.target.value)}
            inputMode="decimal"
            placeholder="Ex: 5,42"
            className={`w-full ${inputClass}`}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Prazo de entrega padrão
          </div>
          <input
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            placeholder="Ex: 15 a 25 dias úteis"
            className={`w-full ${inputClass}`}
          />
        </div>
      </div>

      <button
        onClick={salvar}
        disabled={pending}
        className="mt-4 rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Salvar parâmetros'}
      </button>
    </div>
  );
}
