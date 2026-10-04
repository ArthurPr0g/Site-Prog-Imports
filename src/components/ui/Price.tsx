import { formatBRL } from '@/lib/format';
import { PARCELAS_SEM_JUROS, parcelaSemJuros } from '@/lib/parcelamento';

export function InstallmentLabel({ price, className }: { price: number; className?: string }) {
  return (
    <div className={className ?? 'text-xs text-fg-tertiary'}>
      ou {PARCELAS_SEM_JUROS}× de {formatBRL(parcelaSemJuros(price))} sem juros
    </div>
  );
}

/** O preço é o elemento dourado da página.
 *
 *  É o que amarra a loja às peças do Instagram: no feed o preço sai em ouro
 *  escovado, em Archivo expandido, sem centavos. Aqui ele sai igual. Quem vê o
 *  post e abre o site reconhece o mesmo número no mesmo lugar, e esse
 *  reconhecimento é metade do trabalho da identidade.
 *
 *  O preço antigo fica em prata e riscado, como no 3C — nunca em vermelho. */
export function PriceBlock({
  price,
  promoPrice,
  size = 'md',
}: {
  price: number;
  promoPrice?: number | null;
  size?: 'md' | 'lg';
}) {
  const active = promoPrice ?? price;
  const hasPromo = !!promoPrice && promoPrice < price;
  return (
    <div>
      {hasPromo && (
        <span className="mr-2 text-sm text-fg-tertiary line-through">{formatBRL(price)}</span>
      )}
      <span
        className={
          size === 'lg'
            ? 'titulo text-ouro-claro text-[40px]'
            : 'titulo text-ouro-claro text-[23px]'
        }
      >
        {formatBRL(active)}
      </span>
      <InstallmentLabel price={active} className="mt-1.5 text-xs text-fg-tertiary" />
    </div>
  );
}

/** `cor` e `corVazia` existem porque a mesma estrela aparece sobre ônix e sobre
 *  marfim. Ouro sobre marfim fica em 2,2:1 de contraste e lê como amarelo
 *  sujo — na superfície clara quem faz esse papel é o bronze. */
export function StarRating({
  rating = 5,
  size = 14,
  cor = 'text-ouro',
  corVazia = 'text-border-hover',
}: {
  rating?: number;
  size?: number;
  cor?: string;
  corVazia?: string;
}) {
  return (
    <span className={`tracking-[2px] ${cor}`} style={{ fontSize: size }}>
      {'★★★★★'.slice(0, Math.round(rating))}
      <span className={corVazia}>{'★★★★★'.slice(Math.round(rating))}</span>
    </span>
  );
}
