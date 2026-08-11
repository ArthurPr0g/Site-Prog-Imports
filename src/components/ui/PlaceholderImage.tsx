import Image from 'next/image';
import clsx from 'clsx';

/** Foto de produto num quadro de tamanho fixo.
 *
 *  `object-contain` e não `cover`: o padrão da loja é subir a foto em 2560 ×
 *  2560, e o dono precisa ver publicado exatamente o que enviou. Com `cover` a
 *  caixa era preenchida cortando as bordas — num quadro deitado, o produto
 *  perdia topo e base sem ninguém perceber, e o enquadramento escolhido na
 *  hora da foto virava outro.
 *
 *  Quem usa este componente mostra produto; capa de categoria e banner têm
 *  caminho próprio. */
export function PlaceholderImage({
  label,
  src,
  className,
  textClassName,
  sizes,
}: {
  label: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
  sizes?: string;
}) {
  if (src) {
    return (
      <div className={clsx('relative overflow-hidden', className)}>
        <Image
          src={src}
          alt={label}
          fill
          sizes={sizes ?? '(min-width: 640px) 320px, 50vw'}
          className="object-contain"
        />
      </div>
    );
  }
  return (
    <div className={clsx('stripe-placeholder grid place-items-center', className)}>
      <span className={clsx('font-mono text-fg-faded text-center px-4', textClassName ?? 'text-xs')}>
        [ foto: {label} ]
      </span>
    </div>
  );
}
