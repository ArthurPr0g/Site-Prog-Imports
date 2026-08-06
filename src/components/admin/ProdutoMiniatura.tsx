import Image from 'next/image';
import { ImageOff } from 'lucide-react';

/** Foto do produto ao lado do nome, nas listagens do gerenciamento.
 *
 *  Existe para a tela ser reconhecível de relance: numa lista de notebooks com
 *  nomes de sessenta caracteres, a foto identifica a linha antes da leitura.
 *
 *  Sem foto, o espaço continua ocupado por um quadro neutro. Some-lo faria as
 *  linhas dançarem de altura conforme o cadastro tem ou não imagem — e é o tipo
 *  de irregularidade que faz a lista parecer quebrada.
 *
 *  Canto arredondado igual ao dos cartões do sistema. */
export function ProdutoMiniatura({
  src,
  alt,
  tamanho = 40,
}: {
  src: string | null | undefined;
  alt: string;
  tamanho?: number;
}) {
  const estilo = { width: tamanho, height: tamanho };

  if (!src) {
    return (
      <div
        style={estilo}
        aria-hidden
        className="grid flex-shrink-0 place-items-center rounded-[10px] border border-border bg-input-alt text-fg-faded"
      >
        <ImageOff size={Math.round(tamanho * 0.4)} />
      </div>
    );
  }

  return (
    <div
      style={estilo}
      className="relative flex-shrink-0 overflow-hidden rounded-[10px] border border-border bg-input-alt"
    >
      <Image src={src} alt={alt} fill sizes={`${tamanho}px`} className="object-cover" />
    </div>
  );
}
