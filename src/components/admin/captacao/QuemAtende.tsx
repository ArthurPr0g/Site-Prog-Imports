'use client';

// Orquestração do lead: quem atende (o Arthur, o Felipe, a IA…). Trocar tira o
// lead do link atual e põe no escolhido; para a IA, o lead precisa de e-mail.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, UserRound } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { KitDoVendedor } from '@/lib/data/leads';
import { moverLeadAction } from '@/app/actions/leads';

export function QuemAtende({ leadId, kits }: { leadId: string; kits: KitDoVendedor[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const ativos = kits.filter((k) => k.active);
  const atual = ativos.find((k) => k.leadIds.includes(leadId))?.id ?? '';
  if (!ativos.length) return null;

  return (
    <label className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-page/40 px-3 py-2 text-[12.5px]">
      {ativos.find((k) => k.id === atual)?.kind === 'ia' ? <Bot size={14} /> : <UserRound size={14} />}
      <b>Quem atende</b>
      <select
        value={atual}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const r = await moverLeadAction(leadId, e.target.value || null);
            toast(r);
            if (r.ok) router.refresh();
          })
        }
        className="rounded-control border border-border-strong bg-card px-2 py-1 text-[12.5px] font-bold"
      >
        <option value="">Você (sem vendedor)</option>
        {ativos.map((k) => (
          <option key={k.id} value={k.id}>
            {k.kind === 'ia' ? `${k.sellerName} (IA)` : k.sellerName}
          </option>
        ))}
      </select>
      {pending && <span className="text-fg-tertiary">Mudando…</span>}
    </label>
  );
}
