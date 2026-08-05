import { corDaAdimplencia, type Adimplencia } from '@/lib/customer-history';

/** Selo de situação financeira do cliente. Aparece no cadastro, na venda e no
 *  orçamento — nos três momentos em que vale saber se o cliente está devendo
 *  antes de fechar mais alguma coisa com ele. */
export function SeloAdimplencia({
  situacao,
  compacto,
  atrasadas,
}: {
  situacao: Adimplencia;
  /** Só a bolinha e um rótulo curto, para caber em linha de tabela. */
  compacto?: boolean;
  /** Quantidade de parcelas atrasadas, mostrada quando há. */
  atrasadas?: number;
}) {
  const cor = corDaAdimplencia(situacao);

  const rotulo = compacto
    ? situacao === 'Possui parcelas pendentes'
      ? 'Pendentes'
      : situacao
    : situacao;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold"
      style={{ background: `${cor}1f`, color: cor }}
      title={
        situacao === 'Inadimplente'
          ? `Cliente com ${atrasadas ?? 0} parcela(s) vencida(s) e não paga(s)`
          : situacao === 'Possui parcelas pendentes'
            ? 'Cliente com parcelas a vencer, todas em dia'
            : 'Cliente sem nada em aberto'
      }
    >
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: cor }} />
      {rotulo}
      {situacao === 'Inadimplente' && !!atrasadas && ` (${atrasadas})`}
    </span>
  );
}
