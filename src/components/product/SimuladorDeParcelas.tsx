import { formatBRL } from '@/lib/format';
import { PARCELAS_SEM_JUROS, simularParcelamento } from '@/lib/parcelamento';

/** A tabela de parcelas, aberta pelo cliente quando ele quiser.
 *
 *  Fechada por padrão: quem decide por preço já viu o número grande, e abrir
 *  doze linhas de tabela embaixo dele empurra o botão de comprar para fora da
 *  tela no celular. Quem precisa da conta é quem vai parcelar em oito, e essa
 *  pessoa procura.
 *
 *  É `<details>` e não um estado de React porque funciona sem JavaScript e
 *  porque o conteúdo já vem no HTML — o Google lê a tabela, e "iPhone em 10x"
 *  é busca de gente comprando.
 *
 *  Os valores acima de 3× embutem a taxa da operadora. Não é a loja cobrando
 *  juros: é o custo do parcelamento aparecendo onde o cliente pode vê-lo antes
 *  de clicar, em vez de no susto da tela de pagamento. */
export function SimuladorDeParcelas({ preco }: { preco: number }) {
  const linhas = simularParcelamento(preco);

  return (
    <details className="group mt-3 rounded-card border border-divider-strong bg-card-dark">
      <summary className="etiqueta flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-[10.5px] text-fg-tertiary transition-colors hover:text-fg">
        Simular parcelamento
        <span className="text-ouro transition-transform group-open:rotate-180">⌄</span>
      </summary>

      <div className="border-t border-divider-strong px-5 pb-4 pt-3">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="etiqueta text-[9.5px] text-fg-muted">
              <th className="pb-2 text-left font-medium">Parcelas</th>
              <th className="pb-2 text-right font-medium">Valor</th>
              <th className="pb-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.parcelas}
                className={l.semJuros ? 'text-fg' : 'text-fg-secondary'}
              >
                <td className="py-[5px] whitespace-nowrap">
                  <span className="font-bold">{l.parcelas}×</span>
                  {l.parcelas === PARCELAS_SEM_JUROS && (
                    <span className="etiqueta ml-2 text-[8.5px] text-ouro">sem juros</span>
                  )}
                </td>
                <td className="py-[5px] text-right tabular-nums">
                  {formatBRL(l.valorDaParcela)}
                </td>
                <td className="py-[5px] text-right tabular-nums text-fg-tertiary">
                  {formatBRL(l.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 border-t border-divider pt-3 text-[11px] leading-relaxed text-fg-muted">
          Até {PARCELAS_SEM_JUROS}× a loja absorve a taxa e você paga o preço de tabela. Acima
          disso, o valor inclui a taxa da operadora do cartão. O total exato é confirmado no
          link de pagamento antes de você finalizar.
        </p>
      </div>
    </details>
  );
}
