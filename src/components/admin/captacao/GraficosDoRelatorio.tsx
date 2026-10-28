'use client';

// Gráficos da aba Relatório: funil, ritmo semanal (contatos × respostas),
// taxa de resposta e dinheiro na mesa por ramo/cidade, e os motivos da nota.
// Mesmos números da tabela da aba (a tabela continua: é a versão sem gráfico).
//
// Cores validadas (validate_palette.js do guia de dataviz, fundo #161618 do
// cartão escuro): série 1 azul #3987e5 e série 2 laranja #d95926 passam todos
// os testes de daltonismo; o funil é uma escada de um azul só (ordinal),
// do mais escuro (leads) ao mais claro (fechados). Texto nunca usa a cor da série.
// Animações: barras crescem com mola e linhas se desenham; "reduzir movimento"
// desliga tudo.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SUAVE } from '@/components/captacao/NumeroAnimado';
import { NumeroAnimado } from '@/components/captacao/NumeroAnimado';

const AZUL = '#3987e5';
const LARANJA = '#d95926';
const ESCADA = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'];
const GRADE = 'rgba(255,255,255,0.07)';
const MOLA = { type: 'spring', stiffness: 90, damping: 20, mass: 0.9 } as const;

/** Porcentagem; abaixo de 1% mostra uma casa (0,3%), para não virar um "0%" enganoso. */
const pctTexto = (a: number, b: number) => {
  if (!b) return '–';
  const p = (a / b) * 100;
  return p > 0 && p < 1 ? `${p.toFixed(1).replace('.', ',')}%` : `${Math.round(p)}%`;
};
const inteiro = (v: number) => Math.round(v).toLocaleString('pt-BR');

/* ------------------------------------------------------------ peças comuns */

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

export function Cartao({ titulo, subtitulo, children, acoes }: { titulo: string; subtitulo?: string; children: React.ReactNode; acoes?: React.ReactNode }) {
  const calmo = useReducedMotion();
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: calmo ? 0 : 0.5, ease: SUAVE }}
      className="rounded-[18px] border border-border bg-card p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{titulo}</div>
          {subtitulo && <div className="mt-0.5 text-[12px] text-fg-tertiary">{subtitulo}</div>}
        </div>
        {acoes}
      </div>
      {children}
    </motion.section>
  );
}

/** Dica flutuante: o valor em destaque, o nome em segundo plano. */
function Dica({ x, y, linhas, largura }: { x: number; y: number; largura: number; linhas: { cor?: string; valor: string; nome: string }[] }) {
  const esquerda = Math.min(Math.max(x + 12, 4), Math.max(4, largura - 190));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[150px] rounded-[10px] border border-border-strong bg-page/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur"
      style={{ left: esquerda, top: Math.max(0, y - 10) }}
    >
      {linhas.map((l, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          {l.cor && <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ background: l.cor }} />}
          <b className="tabular-nums text-fg">{l.valor}</b>
          <span className="text-fg-tertiary">{l.nome}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ barras horizontais */

export type Barra = { chave: string; nome: string; valor: number; rotulo: string; detalhe: string; cor?: string };

/**
 * Barras horizontais (≤ 22 px, ponta arredondada de 4 px, base reta), crescem
 * com mola e acompanham a mudança dos dados. Valor na ponta; detalhe na dica.
 */
export function BarrasHorizontais({ barras, maximo, vazio }: { barras: Barra[]; maximo?: number; vazio: string }) {
  const calmo = useReducedMotion();
  const [caixa, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<{ i: number; x: number; y: number } | null>(null);
  const max = maximo ?? Math.max(1, ...barras.map((b) => b.valor));
  if (barras.length === 0) return <p className="text-[13px] leading-relaxed text-fg-tertiary">{vazio}</p>;

  return (
    <div ref={caixa} className="relative" onPointerLeave={() => setFoco(null)}>
      <ul className="space-y-[6px]">
        {barras.map((b, i) => (
          <li
            key={b.chave}
            tabIndex={0}
            aria-label={`${b.nome}: ${b.rotulo}. ${b.detalhe}`}
            onPointerMove={(e) => {
              const r = caixa.current!.getBoundingClientRect();
              setFoco({ i, x: e.clientX - r.left, y: e.clientY - r.top });
            }}
            onFocus={(e) => {
              const r = caixa.current!.getBoundingClientRect();
              const alvo = e.currentTarget.getBoundingClientRect();
              setFoco({ i, x: alvo.left - r.left + 40, y: alvo.bottom - r.top });
            }}
            onBlur={() => setFoco(null)}
            className={`grid cursor-default grid-cols-[minmax(0,38%)_1fr] items-center gap-3 rounded-[8px] px-1 py-[3px] outline-none transition-colors focus-visible:bg-fg-faded/10 sm:grid-cols-[minmax(0,32%)_1fr] ${foco?.i === i ? 'bg-fg-faded/[.08]' : ''}`}
          >
            <span className="truncate text-[12.5px] font-bold text-fg-secondary" title={b.nome}>
              {b.nome}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="relative h-[18px] min-w-0 flex-1">
                <motion.span
                  className="absolute inset-y-0 left-0 block rounded-r-[4px]"
                  style={{ background: b.cor ?? AZUL, opacity: foco && foco.i !== i ? 0.55 : 1 }}
                  initial={{ width: calmo ? `${(b.valor / max) * 100}%` : '0%' }}
                  animate={{ width: `${Math.max(b.valor > 0 ? 1.5 : 0, (b.valor / max) * 100)}%` }}
                  transition={calmo ? { duration: 0 } : { ...MOLA, delay: i * 0.05 }}
                />
              </span>
              <span className="min-w-[44px] shrink-0 whitespace-nowrap text-right text-[12px] font-extrabold tabular-nums text-fg">
                {b.rotulo}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {foco && barras[foco.i] && (
        <Dica
          x={foco.x}
          y={foco.y + 14}
          largura={largura}
          linhas={[
            { cor: barras[foco.i].cor ?? AZUL, valor: barras[foco.i].rotulo, nome: barras[foco.i].nome },
            { valor: '', nome: barras[foco.i].detalhe },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ funil */

export type Etapa = { nome: string; valor: number };

/**
 * Funil em barras de um azul só (escuro → claro), com a passagem de cada etapa.
 * Começa em quem foi contatado: a base inteira (mais de mil leads) esmagaria as
 * outras barras.
 */
export function Funil({ etapas }: { etapas: Etapa[] }) {
  const calmo = useReducedMotion();
  const max = Math.max(1, etapas[0]?.valor ?? 1);
  const ultima = etapas.at(-1);
  return (
    <div className="space-y-2.5">
      {(etapas[0]?.valor ?? 0) === 0 && (
        <p className="text-[13px] text-fg-tertiary">Ninguém contatado ainda: o funil começa no primeiro contato.</p>
      )}
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        return (
          <div key={e.nome} className="grid grid-cols-[96px_1fr] items-center gap-3 sm:grid-cols-[120px_1fr]">
            <div className="text-[12.5px] font-bold text-fg-secondary">{e.nome}</div>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative h-[22px] min-w-0 flex-1">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-r-[4px]"
                  style={{ background: ESCADA[Math.min(i + ESCADA.length - etapas.length, ESCADA.length - 1)] }}
                  initial={{ width: calmo ? `${(e.valor / max) * 100}%` : '0%' }}
                  animate={{ width: `${Math.max(e.valor > 0 ? 1.2 : 0, (e.valor / max) * 100)}%` }}
                  transition={calmo ? { duration: 0 } : { ...MOLA, delay: 0.1 + i * 0.12 }}
                />
              </div>
              <div className="w-[118px] shrink-0 text-right text-[12px] tabular-nums">
                <b className="text-[13.5px] text-fg">
                  <NumeroAnimado valor={e.valor} formato={inteiro} />
                </b>
                {anterior !== null && <span className="ml-1.5 text-fg-tertiary">{pctTexto(e.valor, anterior)} da etapa</span>}
              </div>
            </div>
          </div>
        );
      })}
      {ultima && etapas.length > 1 && (etapas[0]?.valor ?? 0) > 0 && (
        <div className="mt-4 flex items-baseline gap-2 border-t border-divider pt-3">
          <span className="font-display text-[28px] font-bold leading-none">{pctTexto(ultima.valor, etapas[0].valor)}</span>
          <span className="text-[12.5px] text-fg-tertiary">
            dos contatados viraram {ultima.nome.toLowerCase()} ({ultima.valor} de {etapas[0].valor})
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ ritmo semanal */

export type Semana = { inicio: number; rotulo: string; contatos: number; respostas: number };

/**
 * Duas linhas na mesma escala (contatos e respostas por semana), com a área
 * de contatos em véu de 10%, mira que acompanha o ponteiro e dica com as duas
 * séries. As linhas se desenham ao aparecer.
 */
export function RitmoSemanal({ semanas }: { semanas: Semana[] }) {
  const calmo = useReducedMotion();
  const [caixa, W] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const H = W < 480 ? 190 : 220;
  const pad = { l: 34, r: 14, t: 14, b: 26 };
  const n = semanas.length;

  const g = useMemo(() => {
    const larg = Math.max(1, W - pad.l - pad.r);
    const alt = H - pad.t - pad.b;
    const topo = Math.max(4, ...semanas.map((s) => Math.max(s.contatos, s.respostas)));
    const passo = topo <= 8 ? 2 : topo <= 20 ? 5 : topo <= 50 ? 10 : topo <= 100 ? 25 : 50;
    const yMax = Math.ceil(topo / passo) * passo;
    const x = (i: number) => pad.l + (n <= 1 ? larg / 2 : (i / (n - 1)) * larg);
    const y = (v: number) => pad.t + (1 - v / yMax) * alt;
    const linha = (k: 'contatos' | 'respostas') => semanas.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join(' ');
    const base = y(0);
    const contatos = linha('contatos');
    return {
      x,
      y,
      base,
      ticks: Array.from({ length: yMax / passo + 1 }, (_, i) => i * passo),
      contatos,
      respostas: linha('respostas'),
      area: n ? `${contatos} L${x(n - 1).toFixed(1)},${base.toFixed(1)} L${x(0).toFixed(1)},${base.toFixed(1)} Z` : '',
      passoX: n > 1 ? larg / (n - 1) : larg,
    };
    // pad é constante: fora das dependências de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, semanas, n]);

  const total = semanas.reduce((s, x) => s + x.contatos, 0);
  const s = foco !== null ? semanas[foco] : null;
  const desenhar = (atraso: number) =>
    calmo ? { duration: 0 } : { pathLength: { duration: 1.1, ease: SUAVE, delay: atraso }, opacity: { duration: 0.2, delay: atraso } };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-[12px] text-fg-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded-full" style={{ background: AZUL }} /> Contatos feitos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded-full" style={{ background: LARANJA }} /> Responderam
        </span>
      </div>
      <div ref={caixa} className="relative" style={{ height: H }}>
        {W > 0 && total === 0 && (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-fg-tertiary">
            Nenhum contato nas últimas {n} semanas.
          </div>
        )}
        {W > 0 && total > 0 && (
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`Contatos e respostas por semana, últimas ${n} semanas`}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.round((e.clientX - r.left - pad.l) / g.passoX);
              setFoco(Math.min(n - 1, Math.max(0, i)));
            }}
            onPointerLeave={() => setFoco(null)}
            className="overflow-visible"
          >
            {g.ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={g.y(t)} y2={g.y(t)} stroke={GRADE} strokeWidth={1} />
                <text x={pad.l - 8} y={g.y(t) + 4} textAnchor="end" className="fill-fg-faded text-[10.5px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {semanas.map((sem, i) =>
              i % (W < 480 ? 3 : 2) === (n - 1) % (W < 480 ? 3 : 2) ? (
                <text key={sem.inicio} x={g.x(i)} y={H - 6} textAnchor="middle" className="fill-fg-faded text-[10.5px]">
                  {sem.rotulo}
                </text>
              ) : null
            )}
            <motion.path
              d={g.area}
              fill={AZUL}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.1, d: g.area }}
              transition={calmo ? { duration: 0 } : { duration: 0.8, delay: 0.5 }}
            />
            <motion.path
              d={g.contatos}
              fill="none"
              stroke={AZUL}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: calmo ? 1 : 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1, d: g.contatos }}
              transition={desenhar(0.1)}
            />
            <motion.path
              d={g.respostas}
              fill="none"
              stroke={LARANJA}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: calmo ? 1 : 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1, d: g.respostas }}
              transition={desenhar(0.35)}
            />
            {/* Pontos finais (com anel da cor do fundo) */}
            {n > 0 &&
              (['contatos', 'respostas'] as const).map((k) => (
                <motion.circle
                  key={k}
                  r={4}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                  fill={k === 'contatos' ? AZUL : LARANJA}
                  initial={{ opacity: 0, cx: g.x(n - 1), cy: g.y(semanas[n - 1][k]) }}
                  animate={{ opacity: 1, cx: g.x(n - 1), cy: g.y(semanas[n - 1][k]) }}
                  transition={calmo ? { duration: 0 } : { delay: 1.2, duration: 0.3 }}
                />
              ))}
            {foco !== null && s && (
              <g pointerEvents="none">
                <line x1={g.x(foco)} x2={g.x(foco)} y1={pad.t} y2={g.base} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                <circle cx={g.x(foco)} cy={g.y(s.contatos)} r={4} fill={AZUL} stroke="var(--color-card)" strokeWidth={2} />
                <circle cx={g.x(foco)} cy={g.y(s.respostas)} r={4} fill={LARANJA} stroke="var(--color-card)" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}
        {foco !== null && s && (
          <Dica
            x={g.x(foco)}
            y={pad.t}
            largura={W}
            linhas={[
              { valor: `Semana de ${s.rotulo}`, nome: '' },
              { cor: AZUL, valor: String(s.contatos), nome: 'contatos' },
              { cor: LARANJA, valor: String(s.respostas), nome: `responderam (${pctTexto(s.respostas, s.contatos)})` },
            ]}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ medidor A/B */

/** Medidor da taxa de resposta de uma variante (trilho em tom mais fraco do mesmo azul). */
export function Medidor({ valor }: { valor: number }) {
  const calmo = useReducedMotion();
  return (
    <div className="mt-2 h-[6px] overflow-hidden rounded-full" style={{ background: 'rgba(57,135,229,0.18)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: AZUL }}
        initial={{ width: calmo ? `${valor * 100}%` : '0%' }}
        animate={{ width: `${valor * 100}%` }}
        transition={calmo ? { duration: 0 } : { ...MOLA, delay: 0.2 }}
      />
    </div>
  );
}
