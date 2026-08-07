'use client';

import { useTransition } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL, formatDateBR } from '@/lib/format';
import type { MensalidadeDoCliente } from '@/lib/customer-history';
import { togglePlanMonthPaidAction } from '@/app/actions/finance';

const VERDE = '#4ade80';
const VERMELHO = '#e05555';
const AMARELO = '#d9a441';

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** As mensalidades do plano de hospedagem, na página do cliente.
 *
 *  Elas ficam num bloco à parte do carnê porque são outra coisa: o carnê é um
 *  parcelamento com fim, a mensalidade é assinatura enquanto o plano durar. Mas
 *  contam junto no total em aberto e na adimplência — para o cliente as duas são
 *  dívida igual.
 *
 *  A baixa acontece aqui mesmo. Antes ela só existia no Financeiro, o que
 *  obrigava a sair da página do cliente e caçar a linha do mês certo. */
export function MensalidadesList({ mensalidades }: { mensalidades: MensalidadeDoCliente[] }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  if (mensalidades.length === 0) return null;

  const hoje = hojeISO();
  const pagas = mensalidades.filter((m) => m.paga);
  const emAberto = mensalidades.filter((m) => !m.paga);
  const atrasadas = emAberto.filter((m) => m.vencimento < hoje);
  const recebido = pagas.reduce((s, m) => s + m.valor, 0);
  const aReceber = emAberto.reduce((s, m) => s + m.valor, 0);

  function baixar(m: MensalidadeDoCliente) {
    startTransition(async () => {
      toast(await togglePlanMonthPaidAction(m.id));
    });
  }

  return (
    <div className="mt-4 rounded-control border border-border bg-card-dark p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
          Mensalidades do plano ({mensalidades.length})
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
          <span className="text-fg-tertiary">
            Recebido <strong style={{ color: VERDE }}>{formatBRL(recebido)}</strong>
          </span>
          <span className="text-fg-tertiary">
            A receber <strong className="text-fg-secondary">{formatBRL(aReceber)}</strong>
          </span>
          {atrasadas.length > 0 && (
            <span className="text-fg-tertiary">
              Vencidas <strong style={{ color: VERMELHO }}>{atrasadas.length}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1.4fr)_90px_110px_108px_60px] gap-2 border-b border-divider pb-2 text-[10.5px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
        <div>Plano</div>
        <div>Mês</div>
        <div className="text-right">Valor</div>
        <div>Vencimento</div>
        <div className="text-right">Baixa</div>
      </div>

      {mensalidades.map((m) => {
        const vencida = !m.paga && m.vencimento < hoje;
        const cor = m.paga ? VERDE : vencida ? VERMELHO : AMARELO;
        const rotulo = m.paga ? 'Paga' : vencida ? 'Vencida' : 'A vencer';
        return (
          <div
            key={m.id}
            className="grid grid-cols-[minmax(0,1.4fr)_90px_110px_108px_60px] items-center gap-2 border-b border-divider py-2 text-[12.5px] last:border-b-0"
          >
            <div className="min-w-0 truncate font-bold" title={m.servico}>
              {m.servico}
            </div>
            <div className="text-fg-secondary">
              {m.numero}
              {m.totalDeMeses > 0 ? `/${m.totalDeMeses}` : ''}
            </div>
            <div className="text-right font-bold">{formatBRL(m.valor)}</div>
            <div className="text-fg-secondary">
              {formatDateBR(m.vencimento + 'T12:00:00')}
              <div className="text-[10.5px]" style={{ color: cor }}>
                {rotulo}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => baixar(m)}
                disabled={pending}
                title={m.paga ? 'Desfazer recebimento' : 'Marcar como recebida'}
                aria-label={`${m.paga ? 'Desfazer recebimento da' : 'Marcar como recebida a'} mensalidade ${m.numero}`}
                className="grid h-6 w-6 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-30"
              >
                {m.paga ? <Undo2 size={11} /> : <Check size={11} />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
