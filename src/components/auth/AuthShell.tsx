'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { GlobeOpportunities } from '@/components/home/GlobeOpportunities';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page px-6 py-16 lg:justify-end lg:pr-[7vw]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-1/2 top-[-14%] h-[560px] w-[560px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(242,135,5,.22), transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-18%] right-[-12%] h-[440px] w-[440px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(242,135,5,.14), transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.65, 0.35] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </div>

      <div className="pointer-events-none absolute left-[-12%] top-1/2 hidden w-[58vw] max-w-[780px] -translate-y-1/2 lg:block">
        <div className="pointer-events-auto">
          <GlobeOpportunities />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[440px]"
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-7 flex justify-center"
        >
          <Link href="/">
            <Logo height={64} />
          </Link>
        </motion.div>

        <div className="rounded-[26px] border border-border-strong bg-card/90 p-8 shadow-[0_30px_80px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-9">
          <div className="mb-7 text-center">
            <h1 className="mb-1.5 font-display text-2xl font-bold tracking-[-.02em]">{title}</h1>
            <p className="text-sm text-fg-tertiary">{subtitle}</p>
          </div>
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-[13px] text-fg-tertiary">{footer}</div>}
      </motion.div>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-divider-strong" />
      <span className="text-[11px] font-bold uppercase tracking-[.1em] text-fg-faded">ou</span>
      <div className="h-px flex-1 bg-divider-strong" />
    </div>
  );
}
