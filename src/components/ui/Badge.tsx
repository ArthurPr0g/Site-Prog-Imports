import type { CSSProperties, ReactNode } from 'react';

export function Badge({
  children,
  bg,
  border,
  color,
  className,
}: {
  children: ReactNode;
  bg: string;
  border: string;
  color: string;
  className?: string;
}) {
  const style: CSSProperties = {
    background: bg,
    borderColor: border,
    color,
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11.5px] font-extrabold ${className ?? ''}`}
      style={style}
    >
      {children}
    </span>
  );
}
