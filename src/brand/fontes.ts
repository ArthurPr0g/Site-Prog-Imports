import { Sora, DM_Sans } from 'next/font/google';

/**
 * Fontes da marca Prog Soluções, carregadas só no layout do admin (a loja
 * continua só com Archivo + JetBrains Mono). A Mono é a do layout raiz.
 * A Sora é pré-carregada porque o wordmark aparece nos primeiros segundos.
 */
export const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  preload: true,
});

export const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
});

/** Classes que declaram as variáveis --font-sora e --font-dm-sans. */
export const fontesDaMarca = `${sora.variable} ${dmSans.variable}`;
