'use client';

// Gráfico da meta da Captação (R$ 100 mil de nov a abr): barras de meta e de
// realizado por mês, linhas acumuladas da meta e do realizado, projeção até o
// fim e o marcador de "hoje". Usado no painel e na página do vendedor.
// Conta e decisões em src/lib/meta-captacao.ts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Target, TrendingUp, Wallet } from 'lucide-react';
import { META, type ResumoDaMeta } from '@/lib/meta-captacao';
import { NumeroAnimado, SUAVE, reais } from './NumeroAnimado';

const COR_REALIZADO = 'var(--color-accent)';
const COR_META = 'var(--color-fg-tertiary)';
const COR_BOA = 'var(--color-success)';
const COR_ALERTA = '#ff8a5c';

const eixo = (v: number) => (v === 0 ? '0' : `${Math.round(v / 1000)} mil`);
const pct = (v: number) => `${Math.round(v)}%`;

/** Largura real da caixa: o SVG é desenhado em pixels, com texto sempre legível. */
function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

export function GraficoDaMeta({
  resumo,
  rotulo = 'Meta do semestre',
  aoVivo = false,
  className = '',
}: {
  resumo: ResumoDaMeta;
  rotulo?: string;
  /** Mostra o selo "ao vivo" (a tela se atualiza sozinha). */
  aoVivo?: boolean;
  className?: string;
}) {
  const calmo = useReducedMotion();
  const [caixa, W] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const { meses, atual, valor, realizado, projecao, contratado } = resumo;
  const n = meses.length;
  const H = W < 480 ? 196 : 228;
  const pad = { l: 46, r: 16, t: 22, b: 28 };
  const tHoje =
    atual < 0 ? 0 : atual >= n ? n : atual + (resumo.agora - meses[atual].inicio) / (meses[atual].fim - meses[atual].inicio);
  const bateMeta = projecao >= valor;
  const corProjecao = bateMeta ? COR_BOA : COR_ALERTA;
  const progresso = (realizado / valor) * 100;

  const g = useMemo(() => {
    const larg = Math.max(1, W - pad.l - pad.r);
    const alt = H - pad.t - pad.b;
    const topo = Math.max(valor, projecao, realizado) * 1.08;
    const passo = topo <= 125_000 ? 25_000 : topo <= 250_000 ? 50_000 : 100_000;
    const yMax = Math.ceil(topo / passo) * passo;
    const x = (t: number) => pad.l + (t / n) * larg;
    const y = (v: number) => pad.t + (1 - v / yMax) * alt;
    const linha = (pts: [number, number][]) => 'M' + pts.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' L');

    const metaPts: [number, number][] = [[0, 0]];
    for (let i = 0; i < n; i++) metaPts.push([i + 1, metaPts[i][1] + meses[i].meta]);
    // Sempre 7 pontos (a linha pode "crescer" a cada atualização): os que ainda
    // não chegaram ficam em "hoje".
    let somaReal = 0;
    const realPts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      realPts.push(i <= atual ? [i, somaReal] : [tHoje, realizado]);
      if (i < n) somaReal += meses[i].realizado;
    }
    const base = y(0);
    const real = linha(realPts);
    return {
      x,
      y,
      base,
      colW: larg / n,
      ticks: Array.from({ length: Math.round(yMax / passo) + 1 }, (_, i) => i * passo),
      meta: linha(metaPts),
      real,
      area: `${real} L${x(realPts[n][0]).toFixed(1)},${base.toFixed(1)} L${x(0).toFixed(1)},${base.toFixed(1)} Z`,
    };
    // pad é constante: fora das dependências de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, meses, valor, projecao, realizado, tHoje, n, atual]);

  const barra = Math.max(4, Math.min(16, g.colW * 0.28));
  const mesAtual = atual >= 0 && atual < n ? meses[atual] : null;
  const tooltip = foco !== null ? meses[foco] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: calmo ? 0 : 0.5, ease: SUAVE }}
      className={`relative overflow-hidden rounded-[16px] border border-accent/40 bg-card p-3.5 sm:rounded-[18px] sm:p-5 ${className}`}
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">
          <Target size={14} /> {rotulo}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-fg-tertiary">
          {aoVivo && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              ao vivo
            </span>
          )}
          <span className="rounded-full border border-border-strong px-2 py-0.5">
            {meses[0].rotulo}/{String(META.ano).slice(2)} → {meses[n - 1].rotulo}/{String(META.ano + 1).slice(2)}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
        <div className="font-display text-[26px] font-bold tabular-nums tracking-[-.01em] sm:text-[34px]">
          <NumeroAnimado valor={realizado} formato={reais} />
        </div>
        <div className="pb-1 text-[13px] font-bold text-fg-tertiary">de {reais(valor)}</div>
        <motion.span
          key={Math.round(progresso)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-1 rounded-full bg-accent/15 px-2 py-0.5 text-[12px] font-extrabold tabular-nums text-accent"
        >
          <NumeroAnimado valor={progresso} formato={pct} />
        </motion.span>
      </div>

      {/* Barra do total, com o brilho correndo e a marca da projeção */}
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-fg-faded/15">
        <motion.div
          className="relative h-full overflow-hidden rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(progresso, progresso > 0 ? 1.5 : 0))}%` }}
          transition={{ duration: calmo ? 0 : 1.2, ease: SUAVE }}
        >
          {!calmo && (
            <motion.span
              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
              animate={{ x: ['-120%', '260%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
            />
          )}
        </motion.div>
        {projecao > realizado && projecao < valor && (
          <motion.span
            className="absolute inset-y-0 w-[3px] rounded-full"
            style={{ background: corProjecao, left: `${(projecao / valor) * 100}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: calmo ? 0 : 1.2 }}
          />
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Numero
          rotulo={mesAtual ? `Meta de ${mesAtual.rotulo}` : atual < 0 ? 'Começa em 1º/11' : 'Período encerrado'}
          valor={mesAtual ? mesAtual.meta : atual < 0 ? meses[0].meta : realizado}
          rodape={
            mesAtual
              ? `${reais(mesAtual.realizado)} feitos${mesAtual.meta !== mesAtual.metaBase ? ' · ajustada' : ''}`
              : atual < 0
                ? `meta de ${meses[0].rotulo} (25%)`
                : 'total realizado'
          }
        />
        <Numero
          rotulo="Projeção até abr"
          valor={projecao}
          cor={corProjecao}
          icone={<TrendingUp size={12} />}
          rodape={`${Math.round((projecao / valor) * 100)}% da meta`}
        />
        <Numero
          rotulo="A receber"
          valor={contratado}
          icone={<Wallet size={12} />}
          rodape="mensalidades já fechadas"
        />
      </div>

      {/* Gráfico */}
      <div ref={caixa} className="relative mt-3" style={{ height: H }}>
        {W > 0 && (
          <svg width={W} height={H} className="block overflow-visible" role="img" aria-label={`Meta de ${reais(valor)}: ${reais(realizado)} realizados, projeção de ${reais(projecao)}`}>
            <defs>
              <linearGradient id="meta-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR_REALIZADO} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COR_REALIZADO} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Grade e eixo */}
            {g.ticks.map((v) => (
              <g key={v}>
                <line x1={g.x(0)} x2={g.x(n)} y1={g.y(v)} y2={g.y(v)} stroke="var(--color-border)" strokeWidth={1} />
                <text x={g.x(0) - 8} y={g.y(v) + 4} textAnchor="end" className="fill-fg-faded text-[10.5px] tabular-nums">
                  {eixo(v)}
                </text>
              </g>
            ))}

            {/* Linha da meta final */}
            <line
              x1={g.x(0)}
              x2={g.x(n)}
              y1={g.y(valor)}
              y2={g.y(valor)}
              stroke={COR_REALIZADO}
              strokeOpacity={0.45}
              strokeDasharray="2 4"
            />
            <text x={g.x(n)} y={g.y(valor) - 6} textAnchor="end" className="fill-accent text-[10.5px] font-bold">
              meta {eixo(valor)}
            </text>

            {/* Barras: meta do mês (vazada) e realizado (cheia) */}
            {meses.map((m, i) => {
              const cx = g.x(i + 0.5);
              const hMeta = g.base - g.y(m.meta);
              const hReal = g.base - g.y(m.realizado);
              const destaque = i === atual || i === foco;
              return (
                <g key={m.rotulo}>
                  <motion.rect
                    x={cx - barra - 1}
                    width={barra}
                    rx={3}
                    fill={COR_REALIZADO}
                    fillOpacity={destaque ? 0.22 : 0.1}
                    stroke={COR_REALIZADO}
                    strokeOpacity={destaque ? 0.8 : 0.35}
                    initial={{ y: g.base, height: 0 }}
                    animate={{ y: g.base - hMeta, height: hMeta }}
                    transition={{ duration: calmo ? 0 : 0.8, delay: calmo ? 0 : 0.2 + i * 0.08, ease: SUAVE }}
                  />
                  <motion.rect
                    x={cx + 1}
                    width={barra}
                    rx={3}
                    fill={COR_REALIZADO}
                    initial={{ y: g.base, height: 0 }}
                    animate={{ y: g.base - hReal, height: hReal }}
                    transition={{ duration: calmo ? 0 : 0.9, delay: calmo ? 0 : 0.45 + i * 0.08, ease: SUAVE }}
                  />
                  <text
                    x={cx}
                    y={H - 8}
                    textAnchor="middle"
                    className={`text-[11px] font-bold ${i === atual ? 'fill-accent' : 'fill-fg-tertiary'}`}
                  >
                    {m.rotulo}
                  </text>
                </g>
              );
            })}

            {/* Acumulados: meta (tracejada), realizado (com área) e projeção */}
            <motion.path
              d={g.meta}
              fill="none"
              stroke={COR_META}
              strokeWidth={1.6}
              strokeDasharray="5 5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: calmo ? 0 : 1.4, ease: SUAVE }}
            />
            <motion.path
              fill="url(#meta-area)"
              initial={{ d: g.area, opacity: 0 }}
              animate={{ d: g.area, opacity: 1 }}
              transition={{ duration: calmo ? 0 : 0.9, delay: calmo ? 0 : 0.6 }}
            />
            <motion.path
              fill="none"
              stroke={COR_REALIZADO}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ d: g.real, pathLength: 0 }}
              animate={{ d: g.real, pathLength: 1 }}
              transition={{ duration: calmo ? 0 : 1.3, delay: calmo ? 0 : 0.3, ease: SUAVE }}
            />
            {atual < n && (
              <motion.line
                x1={g.x(tHoje)}
                y1={g.y(realizado)}
                x2={g.x(n)}
                y2={g.y(projecao)}
                stroke={corProjecao}
                strokeWidth={2}
                strokeDasharray="6 5"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={calmo ? { opacity: 1 } : { opacity: 1, strokeDashoffset: [0, -22] }}
                transition={{
                  opacity: { duration: 0.6, delay: calmo ? 0 : 1.2 },
                  strokeDashoffset: { duration: 1.1, repeat: Infinity, ease: 'linear' },
                }}
              />
            )}
            {atual < n && (
              <motion.circle
                cx={g.x(n)}
                cy={g.y(projecao)}
                r={4}
                fill={corProjecao}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: calmo ? 0 : 1.5, type: 'spring', stiffness: 260, damping: 14 }}
              />
            )}

            {/* Hoje */}
            <line x1={g.x(tHoje)} x2={g.x(tHoje)} y1={pad.t - 6} y2={g.base} stroke="var(--color-fg-faded)" strokeDasharray="2 3" />
            <text x={g.x(tHoje)} y={pad.t - 9} textAnchor="middle" className="fill-fg-tertiary text-[10px] font-bold uppercase">
              hoje
            </text>
            {!calmo && (
              <motion.circle
                cx={g.x(tHoje)}
                cy={g.y(realizado)}
                fill={COR_REALIZADO}
                initial={{ r: 4, opacity: 0.6 }}
                animate={{ r: [4, 14], opacity: [0.55, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <circle cx={g.x(tHoje)} cy={g.y(realizado)} r={4.5} fill={COR_REALIZADO} stroke="var(--color-card)" strokeWidth={2} />

            {/* Áreas de toque/mouse por mês */}
            {meses.map((m, i) => (
              <rect
                key={`alvo-${m.rotulo}`}
                x={g.x(i)}
                y={0}
                width={g.colW}
                height={H}
                fill="transparent"
                onMouseEnter={() => setFoco(i)}
                onMouseLeave={() => setFoco(null)}
                onClick={() => setFoco(foco === i ? null : i)}
              />
            ))}
          </svg>
        )}

        {tooltip && foco !== null && W > 0 && (
          <motion.div
            key={foco}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute top-0 z-10 w-[168px] rounded-[10px] border border-border-strong bg-page/95 p-2.5 text-[11.5px] shadow-lg backdrop-blur"
            style={{ left: Math.min(Math.max(0, g.x(foco + 0.5) - 84), W - 168) }}
          >
            <div className="mb-1 font-extrabold uppercase tracking-[.08em] text-accent">{tooltip.rotulo}</div>
            <div className="flex justify-between gap-2">
              <span className="text-fg-tertiary">Meta</span>
              <b className="tabular-nums">{reais(tooltip.meta)}</b>
            </div>
            {tooltip.meta !== tooltip.metaBase && (
              <div className="flex justify-between gap-2 text-fg-faded">
                <span>pela rampa</span>
                <span className="tabular-nums">{reais(tooltip.metaBase)}</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-fg-tertiary">Realizado</span>
              <b className="tabular-nums text-accent">{reais(tooltip.realizado)}</b>
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-fg-tertiary">
        <Legenda cor={COR_REALIZADO}>Realizado</Legenda>
        <Legenda cor={COR_META} tracejada>
          Meta acumulada
        </Legenda>
        <Legenda cor={corProjecao} tracejada>
          Projeção
        </Legenda>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-fg-faded">
        Meta com rampa 25/50/75/100% (cota cheia a partir de fev); o que faltar num mês é redistribuído nos seguintes.
        Projeção = realizado + mensalidades já fechadas + funil × chance de cada etapa (proposta{' '}
        {pct(resumo.chances.proposta * 100)}, reunião {pct(resumo.chances.reuniao * 100)}, respondeu{' '}
        {pct(resumo.chances.respondeu * 100)}, contatado {pct(resumo.chances.contatado * 100)}).
      </p>
    </motion.div>
  );
}

function Numero({
  rotulo,
  valor,
  rodape,
  cor,
  icone,
}: {
  rotulo: string;
  valor: number;
  rodape: string;
  cor?: string;
  icone?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[12px] border border-border bg-page/40 p-2.5 sm:p-3">
      <div className="flex items-center gap-1 truncate text-[10px] font-extrabold uppercase tracking-[.06em] text-fg-faded sm:text-[10.5px]">
        {icone}
        {rotulo}
      </div>
      <div className="mt-0.5 truncate text-[14px] font-bold tabular-nums sm:text-[17px]" style={cor ? { color: cor } : undefined}>
        <NumeroAnimado valor={valor} formato={reais} />
      </div>
      <div className="truncate text-[10.5px] text-fg-tertiary sm:text-[11.5px]">{rodape}</div>
    </div>
  );
}

function Legenda({ cor, tracejada, children }: { cor: string; tracejada?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={18} height={6} aria-hidden>
        <line x1={0} x2={18} y1={3} y2={3} stroke={cor} strokeWidth={2.5} strokeDasharray={tracejada ? '4 3' : undefined} />
      </svg>
      {children}
    </span>
  );
}
