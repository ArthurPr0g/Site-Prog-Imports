'use client';

// Os gráficos do painel, desenhados em SVG à mão.
//
// Sem biblioteca: são quatro formas (colunas, colunas empilhadas, barras e
// linha), e cada uma cabe em poucas dezenas de linhas. Uma biblioteca de
// gráficos traria o próprio jeito de pintar, de arredondar e de pôr legenda —
// e o painel precisa do jeito da marca.
//
// As cores seguem uma regra só: cinza para o conjunto, ouro para o que merece o
// olho (o melhor post, o que está pendente). O par foi conferido no validador
// de paleta contra o fundo do cartão (#141417): distância 22 na visão normal e
// 20 nas simulações de daltonismo, contraste acima de 3:1 nos dois.
//
// O desenho é feito na largura real do contêiner, medida com ResizeObserver, e
// não esticado por viewBox: esticar deforma o texto dos eixos.

import { useEffect, useRef, useState, type ReactNode } from 'react';

export const COR_BASE = '#6f6a62';
export const COR_DESTAQUE = '#C9A15A';

const numero = new Intl.NumberFormat('pt-BR');
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatarNumero(n: number, casas = 0): string {
  return casas
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: 0 }).format(n)
    : numero.format(Math.round(n));
}

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura] as const;
}

/** Um teto "redondo" para o eixo: 0, metade e o teto, sem 1.137 no topo. */
function tetoRedondo(max: number): number {
  if (max <= 0) return 1;
  const ordem = 10 ** Math.floor(Math.log10(max));
  for (const passo of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (passo * ordem >= max) return passo * ordem;
  }
  return 10 * ordem;
}

/** Coluna com só as pontas de cima arredondadas — a base fica presa no eixo. */
function colunaPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Barra deitada, arredondada só na ponta direita. */
function barraPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (w <= 0) return '';
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

function Dica({ x, y, largura, children }: { x: number; y: number; largura: number; children: ReactNode }) {
  // Presa dentro do gráfico: perto da borda, a caixa encosta em vez de vazar.
  const meia = 110;
  const left = Math.min(Math.max(x, meia), Math.max(meia, largura - meia));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-xl border border-border-strong bg-card-dark px-3 py-2 text-[12px] leading-snug shadow-[0_12px_30px_rgba(0,0,0,.5)]"
      style={{ left, top: y - 8 }}
    >
      {children}
    </div>
  );
}

function EixoY({ teto, alturaUtil, topo, largura, esquerda }: { teto: number; alturaUtil: number; topo: number; largura: number; esquerda: number }) {
  const marcas = [0, teto / 2, teto];
  return (
    <g>
      {marcas.map((m) => {
        const y = topo + alturaUtil - (m / teto) * alturaUtil;
        return (
          <g key={m}>
            <line x1={esquerda} x2={largura} y1={y} y2={y} stroke="var(--color-divider)" strokeWidth={1} />
            <text x={esquerda - 8} y={y + 4} textAnchor="end" className="fill-fg-faded text-[10.5px] tabular-nums">
              {compacto.format(m)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* --------------------------------------------------------------- colunas */

export type Coluna = {
  chave: string;
  valor: number;
  rotulo: string;
  destaque?: boolean;
  dica: ReactNode;
};

export function Colunas({ colunas, altura = 220, vazio }: { colunas: Coluna[]; altura?: number; vazio?: string }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativa, setAtiva] = useState<number | null>(null);

  const esquerda = 40;
  const topo = 12;
  const base = 26;
  const alturaUtil = altura - topo - base;
  const teto = tetoRedondo(Math.max(0, ...colunas.map((c) => c.valor)));
  const n = colunas.length;
  const faixa = n ? (largura - esquerda) / n : 0;
  const gap = Math.max(2, Math.min(14, faixa * 0.28));
  const w = Math.max(2, Math.min(56, faixa - gap));
  // Rótulo do eixo X só onde cabe: com 60 posts, um a cada tantos.
  const passo = Math.max(1, Math.ceil(56 / Math.max(faixa, 1)));

  return (
    <div ref={ref} className="relative w-full" style={{ height: altura }} onMouseLeave={() => setAtiva(null)}>
      {n === 0 ? (
        <div className="grid h-full place-items-center text-[13px] text-fg-tertiary">{vazio ?? 'Sem dados no período.'}</div>
      ) : largura > 0 ? (
        <svg width={largura} height={altura} role="img" aria-label="Gráfico de colunas">
          <EixoY teto={teto} alturaUtil={alturaUtil} topo={topo} largura={largura} esquerda={esquerda} />
          {colunas.map((c, i) => {
            const x = esquerda + i * faixa + (faixa - w) / 2;
            const h = (c.valor / teto) * alturaUtil;
            const y = topo + alturaUtil - h;
            const acesa = ativa === i;
            return (
              <g key={c.chave}>
                <path
                  d={colunaPath(x, y, w, h)}
                  fill={c.destaque ? COR_DESTAQUE : COR_BASE}
                  opacity={ativa === null || acesa ? 1 : 0.55}
                />
                {i % passo === 0 && (
                  <text x={x + w / 2} y={altura - 8} textAnchor="middle" className="fill-fg-faded text-[10.5px]">
                    {c.rotulo}
                  </text>
                )}
                {/* Alvo do mouse na faixa inteira, não só na coluna: coluna
                    baixa de 3px não se acerta com o cursor. */}
                <rect
                  x={esquerda + i * faixa}
                  y={topo}
                  width={faixa}
                  height={alturaUtil}
                  fill="transparent"
                  onMouseEnter={() => setAtiva(i)}
                  onFocus={() => setAtiva(i)}
                  onBlur={() => setAtiva(null)}
                  tabIndex={0}
                  aria-label={`${c.rotulo}: ${formatarNumero(c.valor, 1)}`}
                />
              </g>
            );
          })}
        </svg>
      ) : null}
      {ativa !== null && colunas[ativa] && largura > 0 && (
        <Dica
          x={esquerda + ativa * faixa + faixa / 2}
          y={topo + alturaUtil - (colunas[ativa].valor / teto) * alturaUtil}
          largura={largura}
        >
          {colunas[ativa].dica}
        </Dica>
      )}
    </div>
  );
}

/* ---------------------------------------------------- colunas empilhadas */

export type ColunaEmpilhada = {
  chave: string;
  rotulo: string;
  /** Embaixo, em cinza. */
  base: number;
  /** Em cima, em ouro. */
  topo: number;
  dica: ReactNode;
};

export function ColunasEmpilhadas({ colunas, altura = 200 }: { colunas: ColunaEmpilhada[]; altura?: number }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativa, setAtiva] = useState<number | null>(null);

  const esquerda = 40;
  const margemTopo = 12;
  const rodape = 26;
  const alturaUtil = altura - margemTopo - rodape;
  const teto = tetoRedondo(Math.max(0, ...colunas.map((c) => c.base + c.topo)));
  const n = colunas.length;
  const faixa = n ? (largura - esquerda) / n : 0;
  const gap = Math.max(2, Math.min(14, faixa * 0.28));
  const w = Math.max(2, Math.min(48, faixa - gap));
  const passo = Math.max(1, Math.ceil(56 / Math.max(faixa, 1)));

  return (
    <div ref={ref} className="relative w-full" style={{ height: altura }} onMouseLeave={() => setAtiva(null)}>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Gráfico de colunas empilhadas">
          <EixoY teto={teto} alturaUtil={alturaUtil} topo={margemTopo} largura={largura} esquerda={esquerda} />
          {colunas.map((c, i) => {
            const x = esquerda + i * faixa + (faixa - w) / 2;
            const hBase = (c.base / teto) * alturaUtil;
            const hTopo = (c.topo / teto) * alturaUtil;
            const yBase = margemTopo + alturaUtil - hBase;
            // 2px de fundo entre os dois segmentos, para não virarem um bloco.
            const separa = hBase > 0 && hTopo > 0 ? 2 : 0;
            const yTopo = yBase - separa - hTopo;
            const apagada = ativa !== null && ativa !== i ? 0.55 : 1;
            return (
              <g key={c.chave} opacity={apagada}>
                {hBase > 0 &&
                  (hTopo > 0 ? (
                    <rect x={x} y={yBase} width={w} height={hBase} fill={COR_BASE} />
                  ) : (
                    <path d={colunaPath(x, yBase, w, hBase)} fill={COR_BASE} />
                  ))}
                {hTopo > 0 && <path d={colunaPath(x, yTopo, w, hTopo)} fill={COR_DESTAQUE} />}
                {i % passo === 0 && (
                  <text x={x + w / 2} y={altura - 8} textAnchor="middle" className="fill-fg-faded text-[10.5px]">
                    {c.rotulo}
                  </text>
                )}
                <rect
                  x={esquerda + i * faixa}
                  y={margemTopo}
                  width={faixa}
                  height={alturaUtil}
                  fill="transparent"
                  onMouseEnter={() => setAtiva(i)}
                  onFocus={() => setAtiva(i)}
                  onBlur={() => setAtiva(null)}
                  tabIndex={0}
                  aria-label={`${c.rotulo}: ${c.base + c.topo}`}
                />
              </g>
            );
          })}
        </svg>
      )}
      {ativa !== null && colunas[ativa] && largura > 0 && (
        <Dica
          x={esquerda + ativa * faixa + faixa / 2}
          y={margemTopo + alturaUtil - ((colunas[ativa].base + colunas[ativa].topo) / teto) * alturaUtil}
          largura={largura}
        >
          {colunas[ativa].dica}
        </Dica>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- barras */

export type Barra = { chave: string; rotulo: string; valor: number; nota?: string; destaque?: boolean; dica: ReactNode };

export function Barras({ barras, formatar = (v: number) => formatarNumero(v, 1) }: { barras: Barra[]; formatar?: (v: number) => string }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativa, setAtiva] = useState<number | null>(null);

  const linha = 34;
  const espessura = 16;
  const esquerda = 92;
  // Espaço para "584,7 · 3 posts" depois da barra mais longa.
  const direita = 130;
  const altura = Math.max(linha, barras.length * linha);
  const teto = Math.max(1, ...barras.map((b) => b.valor));
  const util = Math.max(0, largura - esquerda - direita);

  return (
    <div ref={ref} className="relative w-full" style={{ height: altura }} onMouseLeave={() => setAtiva(null)}>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Gráfico de barras">
          {barras.map((b, i) => {
            const y = i * linha + (linha - espessura) / 2;
            const w = (b.valor / teto) * util;
            return (
              <g key={b.chave} opacity={ativa === null || ativa === i ? 1 : 0.55}>
                <text x={esquerda - 10} y={y + espessura / 2 + 4} textAnchor="end" className="fill-fg-secondary text-[12px] font-bold">
                  {b.rotulo}
                </text>
                <line x1={esquerda} x2={esquerda} y1={y - 4} y2={y + espessura + 4} stroke="var(--color-divider-strong)" />
                <path d={barraPath(esquerda, y, w, espessura)} fill={b.destaque ? COR_DESTAQUE : COR_BASE} />
                {/* O valor fica escrito ao lado: com três ou quatro barras, ler o
                    número é mais rápido que estimar o comprimento. */}
                <text x={esquerda + w + 8} y={y + espessura / 2 + 4} className="fill-fg text-[12px] font-bold tabular-nums">
                  {formatar(b.valor)}
                  {b.nota && <tspan className="fill-fg-faded font-normal"> {b.nota}</tspan>}
                </text>
                <rect
                  x={0}
                  y={i * linha}
                  width={largura}
                  height={linha}
                  fill="transparent"
                  onMouseEnter={() => setAtiva(i)}
                  onFocus={() => setAtiva(i)}
                  onBlur={() => setAtiva(null)}
                  tabIndex={0}
                  aria-label={`${b.rotulo}: ${formatar(b.valor)}`}
                />
              </g>
            );
          })}
        </svg>
      )}
      {ativa !== null && barras[ativa] && largura > 0 && (
        <Dica x={esquerda + (barras[ativa].valor / teto) * util / 2 + 40} y={ativa * linha + 4} largura={largura}>
          {barras[ativa].dica}
        </Dica>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- linha */

export type Ponto = { chave: string; rotulo: string; valor: number; dica: ReactNode };

export function Linha({ pontos, altura = 200 }: { pontos: Ponto[]; altura?: number }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);

  const esquerda = 48;
  const topo = 14;
  const rodape = 26;
  const alturaUtil = altura - topo - rodape;
  const valores = pontos.map((p) => p.valor);
  // A linha de seguidores mexe pouco perto do total: um eixo a partir do zero
  // a deixaria reta. O eixo abraça a faixa dos dados, com folga.
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const folga = Math.max(5, (max - min) * 0.25);
  const piso = Math.max(0, Math.floor(min - folga));
  const teto = Math.ceil(max + folga);
  const util = Math.max(0, largura - esquerda - 12);
  const xDe = (i: number) => esquerda + (pontos.length === 1 ? util / 2 : (i / (pontos.length - 1)) * util);
  const yDe = (v: number) => topo + alturaUtil - ((v - piso) / Math.max(1, teto - piso)) * alturaUtil;
  const passo = Math.max(1, Math.ceil(64 / Math.max(1, util / Math.max(1, pontos.length - 1))));

  function aoMover(e: React.MouseEvent<SVGRectElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - caixa.left;
    const i = pontos.length === 1 ? 0 : Math.round((x / caixa.width) * (pontos.length - 1));
    setAtivo(Math.min(pontos.length - 1, Math.max(0, i)));
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height: altura }} onMouseLeave={() => setAtivo(null)}>
      {largura > 0 && pontos.length > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Gráfico de linha">
          {[piso, (piso + teto) / 2, teto].map((m) => (
            <g key={m}>
              <line x1={esquerda} x2={largura} y1={yDe(m)} y2={yDe(m)} stroke="var(--color-divider)" />
              <text x={esquerda - 8} y={yDe(m) + 4} textAnchor="end" className="fill-fg-faded text-[10.5px] tabular-nums">
                {compacto.format(m)}
              </text>
            </g>
          ))}
          <polyline
            points={pontos.map((p, i) => `${xDe(i)},${yDe(p.valor)}`).join(' ')}
            fill="none"
            stroke={COR_DESTAQUE}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {pontos.map((p, i) =>
            i % passo === 0 || i === pontos.length - 1 ? (
              <text key={p.chave} x={xDe(i)} y={altura - 8} textAnchor="middle" className="fill-fg-faded text-[10.5px]">
                {p.rotulo}
              </text>
            ) : null
          )}
          {ativo !== null && (
            <g>
              <line x1={xDe(ativo)} x2={xDe(ativo)} y1={topo} y2={topo + alturaUtil} stroke="var(--color-border-strong)" />
              {/* Anel do fundo em volta do ponto, para ele não se fundir à linha. */}
              <circle cx={xDe(ativo)} cy={yDe(pontos[ativo].valor)} r={5} fill={COR_DESTAQUE} stroke="var(--color-card)" strokeWidth={2} />
            </g>
          )}
          {pontos.length === 1 && ativo === null && (
            <circle cx={xDe(0)} cy={yDe(pontos[0].valor)} r={5} fill={COR_DESTAQUE} stroke="var(--color-card)" strokeWidth={2} />
          )}
          <rect x={esquerda} y={topo} width={util} height={alturaUtil} fill="transparent" onMouseMove={aoMover} />
        </svg>
      )}
      {ativo !== null && pontos[ativo] && largura > 0 && (
        <Dica x={xDe(ativo)} y={yDe(pontos[ativo].valor)} largura={largura}>
          {pontos[ativo].dica}
        </Dica>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- cartão */

/** Cartão de gráfico com a alternância Gráfico/Tabela.
 *
 *  A tabela não é enfeite: é como se lê o número exato, e é o que um leitor de
 *  tela consegue usar. */
export function CartaoDeGrafico({
  titulo,
  subtitulo,
  legenda,
  tabela,
  rodape,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  legenda?: ReactNode;
  tabela?: { colunas: string[]; linhas: (string | number)[][] };
  rodape?: ReactNode;
  children: ReactNode;
}) {
  const [verTabela, setVerTabela] = useState(false);
  return (
    <section className="flex min-w-0 flex-col rounded-[18px] border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-extrabold">{titulo}</h2>
          {subtitulo && <div className="mt-0.5 text-[12px] text-fg-tertiary">{subtitulo}</div>}
        </div>
        {tabela && (
          <div className="flex flex-shrink-0 rounded-full border border-border p-0.5 text-[11px] font-bold">
            {(['Gráfico', 'Tabela'] as const).map((rotulo) => {
              const ativo = (rotulo === 'Tabela') === verTabela;
              return (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => setVerTabela(rotulo === 'Tabela')}
                  aria-pressed={ativo}
                  className={`rounded-full px-2.5 py-1 ${ativo ? 'bg-fg text-page' : 'text-fg-tertiary hover:text-fg'}`}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {legenda && !verTabela && <div className="mb-2 flex flex-wrap gap-4 text-[11.5px] text-fg-secondary">{legenda}</div>}
      {verTabela && tabela ? (
        <div className="max-h-[260px] overflow-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-[10.5px] uppercase tracking-[.08em] text-fg-faded">
                {tabela.colunas.map((c, i) => (
                  <th key={c} className={`py-2 font-extrabold ${i > 0 ? 'text-right' : ''}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((l, i) => (
                <tr key={i} className="border-b border-divider">
                  {l.map((v, j) => (
                    <td key={j} className={`py-1.5 ${j > 0 ? 'text-right tabular-nums' : 'text-fg-secondary'}`}>
                      {typeof v === 'number' ? formatarNumero(v, 1) : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
      {rodape && <div className="mt-3 text-[11.5px] leading-snug text-fg-faded">{rodape}</div>}
    </section>
  );
}

export function ItemDaLegenda({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: cor }} />
      {children}
    </span>
  );
}
