import type { Metadata } from 'next';

/** Página de login: útil para quem já é cliente, sem valor nenhum na busca.
 *
 *  Fica fora do índice para não competir com as páginas de produto pelo nome da
 *  loja — e porque um resultado "Entrar" no Google não leva ninguém a comprar.
 *  `follow` continua ligado: os links do rodapé daqui seguem valendo. */
export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: true },
};

export default function EntrarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
