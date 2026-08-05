'use client';

import { formatBRL, parseNumeroBR, formatDateBR, formatNumeroInput } from '@/lib/format';
import {
  calcularParcelamento,
  gerarParcelas,
  MAX_JUROS_PCT,
  PAYMENT_METHODS,
  geraParcelas,
} from '@/lib/installments';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

export type CondicoesForm = {
  paymentMethod: string;
  installmentCount: number;
  downPayment: number;
  interestPct: number;
  firstDueDate: string;
  installmentNotes: string;
};

/** Seletor de forma de pagamento e, quando é PIX Parcelado, as condições do
 *  carnê com os números calculados ao vivo.
 *
 *  Compartilhado por Vendas e Prestação de Serviço: a conta é a mesma e duas
 *  telas com implementações próprias divergiriam. */
export function ParcelamentoFields({
  condicoes,
  total,
  onChange,
}: {
  condicoes: CondicoesForm;
  /** Valor a parcelar. Na venda é o total; no serviço, o valor do trabalho. */
  total: number;
  onChange: (patch: Partial<CondicoesForm>) => void;
}) {
  const parcelado = geraParcelas(condicoes.paymentMethod);

  const resumo = calcularParcelamento({
    total,
    parcelas: condicoes.installmentCount,
    entrada: condicoes.downPayment,
    jurosPct: condicoes.interestPct,
    primeiroVencimento: condicoes.firstDueDate,
  });

  const previa = parcelado && condicoes.firstDueDate
    ? gerarParcelas({
        total,
        parcelas: condicoes.installmentCount,
        entrada: condicoes.downPayment,
        jurosPct: condicoes.interestPct,
        primeiroVencimento: condicoes.firstDueDate,
      })
    : [];

  const ultimoVencimento = previa.length > 0 ? previa[previa.length - 1].dueDate : null;
  const parcelasIguais = resumo.valorParcela === resumo.valorUltimaParcela;

  return (
    <div className="mb-4">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] text-fg-faded">Forma de pagamento</div>
          <select
            value={condicoes.paymentMethod}
            onChange={(e) => onChange({ paymentMethod: e.target.value })}
            className={`w-full ${inputClass}`}
          >
            <option value="">Não informada</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {condicoes.paymentMethod === 'Cartão de Crédito' && (
          <div className="flex items-end">
            {/* O parcelamento do cartão é entre o cliente e o banco dele: a
                operadora repassa o valor cheio, então para o caixa da Prog é
                uma entrada só. */}
            <div className="rounded-control border border-border bg-card-dark px-3.5 py-2.5 text-[11.5px] text-fg-tertiary">
              Informativo: a operadora repassa o valor cheio, então o Financeiro recebe uma entrada só.
            </div>
          </div>
        )}
      </div>

      {parcelado && (
        <div className="rounded-control border border-accent/40 bg-[rgb(var(--brand-accent-rgb)/.05)] p-4">
          <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">
            Pagamento parcelado via PIX
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <div className="mb-1.5 text-[11px] text-fg-faded">Parcelas</div>
              <input
                value={condicoes.installmentCount || ''}
                onChange={(e) => onChange({ installmentCount: Math.max(1, Math.round(parseNumeroBR(e.target.value))) })}
                inputMode="numeric"
                placeholder="Ex: 6"
                className={`w-full ${inputClass}`}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-fg-faded">Entrada (opcional)</div>
              <input
                defaultValue={formatNumeroInput(condicoes.downPayment)}
                onChange={(e) => onChange({ downPayment: parseNumeroBR(e.target.value) })}
                inputMode="decimal"
                placeholder="0,00"
                className={`w-full ${inputClass}`}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-fg-faded">Juros (% até {MAX_JUROS_PCT})</div>
              <input
                defaultValue={condicoes.interestPct || ''}
                onChange={(e) =>
                  onChange({ interestPct: Math.min(MAX_JUROS_PCT, Math.max(0, parseNumeroBR(e.target.value))) })
                }
                inputMode="decimal"
                placeholder="0"
                className={`w-full ${inputClass}`}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-fg-faded">1ª parcela</div>
              <input
                type="date"
                value={condicoes.firstDueDate}
                onChange={(e) => onChange({ firstDueDate: e.target.value })}
                className={`w-full ${inputClass}`}
              />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 border-t border-divider pt-3 sm:grid-cols-4">
            <Numero rotulo="Valor financiado" valor={formatBRL(resumo.financiado)} />
            <Numero rotulo="Juros" valor={formatBRL(resumo.juros)} destaque={resumo.juros > 0} />
            <Numero rotulo="Valor total" valor={formatBRL(resumo.totalComJuros)} />
            <Numero
              rotulo={`${condicoes.installmentCount || 1}× de`}
              valor={formatBRL(resumo.valorParcela)}
              destaque
            />
          </div>

          {resumo.entrada > 0 && (
            <div className="mb-2 text-[11.5px] text-fg-tertiary">
              Entrada de <strong className="text-fg-secondary">{formatBRL(resumo.entrada)}</strong> — os juros
              incidem só sobre o que sobra a financiar.
            </div>
          )}

          {!parcelasIguais && (
            <div className="mb-2 text-[11.5px] text-fg-tertiary">
              A última parcela sai por <strong className="text-fg-secondary">{formatBRL(resumo.valorUltimaParcela)}</strong>{' '}
              para as parcelas somarem exatamente o total, sem sobra de centavos.
            </div>
          )}

          {ultimoVencimento && (
            <div className="mb-3 text-[11.5px] text-fg-tertiary">
              Vencimentos de {formatDateBR(condicoes.firstDueDate + 'T12:00:00')} a{' '}
              {formatDateBR(ultimoVencimento + 'T12:00:00')}. Cada parcela entra no Financeiro como{' '}
              <strong>Previsto</strong> e só vira receita quando você marcar <strong>Recebida</strong>.
            </div>
          )}

          <input
            value={condicoes.installmentNotes}
            onChange={(e) => onChange({ installmentNotes: e.target.value })}
            placeholder="Observações do parcelamento"
            className={`w-full ${inputClass}`}
          />

          {!condicoes.firstDueDate && (
            <div className="mt-2 text-[11.5px] text-warning">
              Informe a data da primeira parcela para gerar o carnê.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] uppercase tracking-[.06em] text-fg-faded">{rotulo}</div>
      <div className={`text-[14px] font-extrabold ${destaque ? 'text-accent' : ''}`}>{valor}</div>
    </div>
  );
}
