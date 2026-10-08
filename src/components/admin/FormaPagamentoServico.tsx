'use client';

import { formatBRL, formatDateBR } from '@/lib/format';
import { ParcelamentoFields, type CondicoesForm } from '@/components/admin/ParcelamentoFields';
import {
  METODO_50_50,
  METODO_CARTAO_1X,
  METODO_CARTAO_2X,
  PARCELAS_CARTAO_TAXA,
  carneDaCondicao,
  cartaoComTaxaRepassada,
  condicaoDoMetodo,
  metodoCartaoComTaxa,
  parcelasDoCartaoComTaxa,
  rotuloDaParcela,
} from '@/lib/pagamento-servico';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

type Opcao = '50-50' | 'cartao-sem-juros' | 'cartao-com-taxa' | 'outras';

const OPCOES: { id: Opcao; titulo: string; detalhe: string }[] = [
  { id: '50-50', titulo: 'Pix ou boleto', detalhe: '50% no fechamento e 50% na entrega' },
  { id: 'cartao-sem-juros', titulo: 'Cartão em 1x ou 2x', detalhe: 'sem juros, a Prog absorve a taxa' },
  { id: 'cartao-com-taxa', titulo: 'Cartão de 3x a 12x', detalhe: 'taxa do Asaas repassada ao cliente' },
  { id: 'outras', titulo: 'Outra forma', detalhe: 'PIX à vista, PIX parcelado, débito, transferência' },
];

/** Forma de pagamento de uma prestação, com as condições da tabela da Prog
 *  Soluções (as mesmas da página de planos) e a prévia de cada recebimento
 *  como vai entrar no Financeiro.
 *
 *  As formas fora da tabela continuam pelo seletor de sempre
 *  (`ParcelamentoFields`), que inclui o PIX Parcelado com carnê próprio. */
export function FormaPagamentoServico({
  condicoes,
  trabalho,
  inicio,
  entrega,
  onChange,
}: {
  condicoes: CondicoesForm;
  /** Valor do trabalho já com desconto. A mensalidade do plano não entra. */
  trabalho: number;
  inicio: string;
  entrega: string | null;
  onChange: (patch: Partial<CondicoesForm>) => void;
}) {
  const metodo = condicoes.paymentMethod;
  const condicao = condicaoDoMetodo(metodo);
  // Sem método escolhido ainda, nenhuma opção fica marcada: a escolha é do dono.
  const opcao: Opcao | null = condicao ?? (metodo ? 'outras' : null);
  const carne = carneDaCondicao(metodo, trabalho, inicio, entrega) ?? [];
  const nTaxa = parcelasDoCartaoComTaxa(metodo);
  const cliente = nTaxa ? cartaoComTaxaRepassada(trabalho, nTaxa) : null;

  function escolher(o: Opcao) {
    if (o === '50-50') onChange({ paymentMethod: METODO_50_50 });
    else if (o === 'cartao-sem-juros') onChange({ paymentMethod: METODO_CARTAO_2X });
    else if (o === 'cartao-com-taxa') onChange({ paymentMethod: metodoCartaoComTaxa(nTaxa ?? 12) });
    // Ao trocar para "outra forma", começa vazio para obrigar a escolha.
    else onChange({ paymentMethod: condicao ? '' : metodo });
  }

  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[11px] text-fg-faded">Forma de pagamento combinada com o cliente</div>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Forma de pagamento">
        {OPCOES.map((o) => {
          const ativa = opcao === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={ativa}
              onClick={() => escolher(o.id)}
              className={
                'rounded-control border px-3.5 py-2.5 text-left transition-colors ' +
                (ativa
                  ? 'border-accent bg-[rgb(var(--brand-accent-rgb)/.08)]'
                  : 'border-border-strong hover:border-accent/60')
              }
            >
              <div className={'text-[13px] font-extrabold ' + (ativa ? 'text-accent' : '')}>{o.titulo}</div>
              <div className="text-[11.5px] text-fg-tertiary">{o.detalhe}</div>
            </button>
          );
        })}
      </div>

      {opcao === 'cartao-sem-juros' && (
        <div className="mb-3 flex gap-2">
          {[
            [METODO_CARTAO_1X, 'À vista (1x)'],
            [METODO_CARTAO_2X, '2x sem juros'],
          ].map(([m, rotulo]) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ paymentMethod: m })}
              className={
                'rounded-control border px-3.5 py-2 text-[12.5px] font-bold ' +
                (metodo === m ? 'border-accent text-accent' : 'border-border-strong text-fg-secondary')
              }
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}

      {opcao === 'cartao-com-taxa' && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] text-fg-faded">Parcelas no cartão</div>
            <select
              value={nTaxa ?? 12}
              onChange={(e) => onChange({ paymentMethod: metodoCartaoComTaxa(Number(e.target.value)) })}
              className={`w-full ${inputClass}`}
            >
              {PARCELAS_CARTAO_TAXA.map((n) => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </select>
          </div>
          {cliente && (
            <div className="rounded-control border border-border bg-card-dark px-3.5 py-2.5 text-[12px] text-fg-tertiary">
              Cliente paga <strong>{nTaxa}x de {formatBRL(cliente.parcela)}</strong>
              <br />
              total {formatBRL(cliente.total)} · a Prog recebe {formatBRL(trabalho)}
            </div>
          )}
        </div>
      )}

      {opcao === 'outras' && (
        <ParcelamentoFields condicoes={condicoes} total={trabalho} onChange={onChange} />
      )}

      {condicao && carne.length > 0 && (
        <div className="rounded-control border border-accent/40 bg-[rgb(var(--brand-accent-rgb)/.05)] p-4">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">
            Recebimentos previstos no Financeiro
          </div>
          {carne.map((p) => (
            <div key={p.number} className="flex justify-between border-t border-divider py-1.5 text-[12.5px] first:border-t-0">
              <span className="text-fg-secondary">
                {rotuloDaParcela(metodo, p.number)} · {formatDateBR(p.dueDate + 'T12:00:00')}
              </span>
              <strong>{formatBRL(p.amount)}</strong>
            </div>
          ))}
          <div className="mt-2 text-[11px] text-fg-faded">
            {condicao === '50-50' && 'A segunda metade vence na data de entrega prevista e acompanha mudanças de prazo.'}
            {condicao === 'cartao-sem-juros' &&
              'O Asaas repassa cada parcela cerca de 30 dias depois da cobrança. A taxa do cartão fica com a Prog.'}
            {condicao === 'cartao-com-taxa' &&
              'Valor da tabela recebido de uma vez, com a antecipação do Asaas. Juros e taxa ficam com o cliente.'}{' '}
            Dê baixa em cada recebimento quando o dinheiro entrar.
          </div>
        </div>
      )}
    </div>
  );
}
