import type { Metadata } from 'next';

/** Mesmo caso do login: página de utilidade, fora do índice. */
export const metadata: Metadata = {
  title: 'Criar conta',
  robots: { index: false, follow: true },
};

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
