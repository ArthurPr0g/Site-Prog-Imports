'use client';

import { formatBRL, parseNumeroBR } from '@/lib/format';
import { temDesconto, valorDoDesconto, aplicarDesconto, rotuloDoDesconto, type Desconto, type DiscountType } from '@/lib/discount';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

/** Campos de desconto compartilhados pelo Orçamento de Serviços e pela
 *  Prestação. Um componente só porque as duas telas precisam mostrar
 *  exatamente a mesma conta — duplicar abriria espaço para divergirem. */
export function DescontoFields({
  desconto,
  base,
  onChange,
  rotuloBase = 'Valor dos serviços',
}: {
  desconto: Desconto;
  /** Sobre o que o desconto incide. Aqui é sempre o valor único: a mensalidade
   *  é preço de tabela recorrente e não entra. */
  base: number;
  onChange: (patch: Partial<Desconto>) => void;
  rotuloBase?: string;
}) {
  const valor = valorDoDesconto(base, desconto);
  const final = aplicarDesconto(base, desconto);

  return (
    <div className="mb-4 rounded-control border border-border bg-card-dark p-4">
      <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Desconto</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
        <div>
          <div className="mb-1.5 text-[11px] text-fg-faded">Tipo e valor</div>
          <div className="flex gap-1.5">
            <select
              value={desconto.tipo}
              onChange={(e) => onChange({ tipo: e.target.value as DiscountType })}
              className={`w-[64px] flex-shrink-0 ${inputClass}`}
            >
              <option value="valor">R$</option>
              <option value="percentual">%</option>
            </select>
            <input
              // Recria o campo ao trocar o tipo: "10" como reais e como
              // porcentagem são coisas diferentes, e manter o número anterior
              // faria um desconto de R$ 10 virar 10% sem ninguém digitar nada.
              key={desconto.tipo}
              defaultValue={desconto.valor || ''}
              onChange={(e) => onChange({ valor: parseNumeroBR(e.target.value) })}
              inputMode="decimal"
              placeholder="0"
              className={`min-w-0 flex-1 ${inputClass}`}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] text-fg-faded">Descrição do desconto (sai na proposta)</div>
          <input
            value={desconto.descricao}
            onChange={(e) => onChange({ descricao: e.target.value })}
            placeholder="Ex: cliente indicado, pagamento à vista, primeira contratação"
            className={`w-full ${inputClass}`}
          />
        </div>
      </div>

      {temDesconto(desconto) && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-divider pt-3 text-[12.5px]">
          <span className="text-fg-tertiary">{rotuloBase}:</span>
          <span className="font-bold text-fg-secondary line-through">{formatBRL(base)}</span>
          <span className="text-fg-tertiary">por</span>
          <span className="text-[15px] font-extrabold text-accent">{formatBRL(final)}</span>
          <span className="text-fg-tertiary">
            — {rotuloDoDesconto(desconto)} de desconto ({formatBRL(valor)})
          </span>
        </div>
      )}

      <div className="mt-2 text-[11px] text-fg-faded">
        O desconto incide sobre o valor dos serviços cobrados uma vez. A mensalidade não entra — para
        ajustá-la, mude o valor do próprio serviço na lista acima.
      </div>
    </div>
  );
}
