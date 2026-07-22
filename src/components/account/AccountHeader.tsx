import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export function AccountHeader({ name }: { name: string }) {
  const initial = name.trim()[0]?.toUpperCase() || '?';
  return (
    <header className="sticky top-0 z-90 border-b border-divider-strong bg-page/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo height={52} />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-bold text-fg-secondary hover:text-accent">
            ← Voltar para a loja
          </Link>
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4">
            <div className="grid h-7.5 w-7.5 place-items-center rounded-full border border-accent/40 bg-accent/15 text-xs font-extrabold text-accent">
              {initial}
            </div>
            <div className="text-[13px] font-bold">{name}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
