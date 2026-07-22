import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page px-6 text-center">
      <Logo height={48} />
      <div>
        <h1 className="mb-2 font-display text-2xl font-bold tracking-[-.02em]">Página não encontrada</h1>
        <p className="max-w-md text-sm text-fg-tertiary">
          O endereço que você tentou acessar não existe ou foi movido.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-control bg-accent px-6 py-3 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
      >
        Voltar para a home
      </Link>
    </div>
  );
}
