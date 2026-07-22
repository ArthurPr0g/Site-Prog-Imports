import type { ReactNode } from 'react';

export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex items-center justify-between">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-[-.02em]">{title}</h1>
        <div className="mt-1 text-[13px] text-fg-tertiary">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3">
        {action}
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.75 pl-2 pr-4">
          <div className="grid h-7.5 w-7.5 place-items-center rounded-full border border-accent/40 bg-accent/15 text-xs font-extrabold text-accent">
            P
          </div>
          <div className="text-[13px] font-bold">Prog Admin</div>
        </div>
      </div>
    </div>
  );
}
