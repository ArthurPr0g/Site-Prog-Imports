'use client';

// Topo da página do vendedor: dinheiro na mesa (de todos os leads em aberto e
// dos leads dele) e a meta do semestre, com o realizado. Relê os números a
// cada 30 s e ao voltar para a aba: o que o time fecha aparece aqui sozinho.

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Coins } from 'lucide-react';
import type { ResumoDaMeta } from '@/lib/meta-captacao';
import type { LeadDoKit } from '@/lib/vendedor';
import { metaDoVendedorAction } from '@/app/actions/vendedor';
import { GraficoDaMeta } from '@/components/captacao/GraficoDaMeta';
import { NumeroAnimado, SUAVE, reais } from '@/components/captacao/NumeroAnimado';

const ATUALIZAR_A_CADA = 30_000;
const ENCERRADOS = ['fechado', 'perdido', 'nao_contatar'];

export function MetaDoVendedor({
  token,
  metaInicial,
  leads,
}: {
  token: string;
  metaInicial: ResumoDaMeta | null;
  leads: LeadDoKit[];
}) {
  const calmo = useReducedMotion();
  const [meta, setMeta] = useState(metaInicial);

  useEffect(() => {
    let vivo = true;
    const atualizar = async () => {
      if (document.visibilityState !== 'visible') return;
      const novo = await metaDoVendedorAction(token).catch(() => null);
      if (vivo && novo) setMeta(novo);
    };
    const id = window.setInterval(atualizar, ATUALIZAR_A_CADA);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      vivo = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [token]);

  if (!meta) return null;

  // Os leads dele, pelo preço que recebeu no link (em reais; dólar à parte).
  const meus = leads.filter((l) => !ENCERRADOS.includes(l.status));
  const soma = (moeda: 'BRL' | 'USD', campo: 'one_time' | 'monthly') =>
    meus.filter((l) => l.currency === moeda).reduce((s, l) => s + Number(l[campo]), 0);
  const meuUnico = soma('BRL', 'one_time');
  const meuMensal = soma('BRL', 'monthly');
  const meuUSD = soma('USD', 'one_time');

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.5fr]">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: calmo ? 0 : 0.5, ease: SUAVE }}
        className="borda-dinheiro relative overflow-hidden rounded-[18px] border bg-card p-4 sm:rounded-[22px] sm:p-5"
      >
        <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#30d158] via-[#66d4cf] to-[#64d2ff]" />
        {!calmo && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-accent/[.08] to-transparent"
            animate={{ x: ['0%', '450%'] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
          />
        )}
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#30d158]">
          <Coins size={14} /> Dinheiro na mesa
        </div>
        <div className="texto-dinheiro mt-2 font-display text-[28px] font-bold tabular-nums tracking-[-.01em] sm:text-[34px]">
          <NumeroAnimado valor={meta.naMesa.unico} formato={reais} />
        </div>
        <div className="text-[14px] font-bold tabular-nums text-fg-secondary">
          + <NumeroAnimado valor={meta.naMesa.mensal} formato={reais} />
          <span className="text-fg-tertiary">/mês em mensalidades</span>
        </div>
        <div className="mt-1 text-[12px] text-fg-tertiary">
          <NumeroAnimado valor={meta.naMesa.leads} /> empresas em aberto. Estimativa pelo pacote provável de cada uma; o valor real sai da conversa.
        </div>

        <div className="mt-4 rounded-[14px] border border-border bg-page/40 p-3.5">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Nos seus leads (estimativa)</div>
          <div className="mt-1 text-[20px] font-bold tabular-nums">
            <NumeroAnimado valor={meuUnico} formato={reais} />
            <span className="text-[13px] text-fg-tertiary">
              {' '}
              + <NumeroAnimado valor={meuMensal} formato={reais} />
              /mês
            </span>
          </div>
          {meuUSD > 0 && (
            <div className="text-[12px] font-bold text-fg-tertiary">+ US$ {Math.round(meuUSD).toLocaleString('pt-BR')}</div>
          )}
          <div className="mt-1 text-[12px] text-fg-tertiary">
            {meus.length} empresa(s) suas ainda em aberto. Cada venda sua sobe a linha azul do gráfico.
          </div>
        </div>
      </motion.section>

      <GraficoDaMeta resumo={meta} rotulo="Meta do time" aoVivo />
    </div>
  );
}
