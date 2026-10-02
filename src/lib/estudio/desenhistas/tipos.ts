// Contrato entre o editor e os desenhistas.
//
// O editor não sabe desenhar e o desenhista não sabe de formulário: os dois se
// encontram aqui. Quem acrescenta modelo escreve uma função com esta assinatura
// e registra o código — nada mais muda.

import type { Ctx } from '@/lib/estudio/marca';

/** Os campos preenchidos no editor, na chave que `modelos.ts` declarou. */
export type Conteudo = Record<string, string>;

/** Imagens já carregadas. Vêm prontas porque o canvas não espera: desenhar com
 *  `img` ainda baixando produz peça sem produto, e o erro é silencioso. */
export type Imagens = {
  produto?: HTMLImageElement | null;
  produtoA?: HTMLImageElement | null;
  produtoB?: HTMLImageElement | null;
  fundo?: HTMLImageElement | null;
  icone?: HTMLImageElement | null;
  logo?: HTMLImageElement | null;
};

export type Cena = {
  ctx: Ctx;
  largura: number;
  altura: number;
  conteudo: Conteudo;
  imagens: Imagens;
  /** 1-based. Só carrossel usa mais de um. */
  slide: number;
};

export type Desenhista = (cena: Cena) => void;

/** Lê um campo com padrão, já sem espaço sobrando. */
export function campo(conteudo: Conteudo, chave: string, padrao = ''): string {
  const v = conteudo[chave];
  return typeof v === 'string' && v.trim() ? v.trim() : padrao;
}
