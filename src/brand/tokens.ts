import type { CSSProperties } from 'react';

/**
 * Tokens da marca Prog Soluções: Design System v1.0 (out/2026, resumo em
 * docs/DESIGN-SYSTEM-PROG.md) + medidas das telas de carregamento do handoff.
 *
 * ÚNICO lugar com cores, fontes e medidas da marca. Os componentes de
 * src/brand só leem daqui: para trocar de design system, troque os valores
 * deste arquivo e as animações continuam iguais (elas dependem só do tempo).
 *
 * Escopo: nada aqui vira variável global. Os loaders aplicam os valores
 * inline (ou via `marcaCssVars` no próprio nó), então a loja e o resto do
 * admin não mudam.
 */

/** Paleta (tokens/tokens.css do handoff). Ciano, verde e roxo são fora da
 *  marca: só gradiente de texto, status e aura. */
export const COR = {
  ink: '#08080a',
  panel: '#0d0e13',
  surface: '#12141a',
  tileDark: '#0b0c10',
  paper: '#f2f3f5',
  white: '#ffffff',
  text: '#f4f5f7',
  body: '#eceef1',
  muted1: '#d7dae0',
  muted: '#a3a8b2',
  muted2: '#8b919b',
  nav: '#9ba1ab',
  dim: '#6d727c',
  mutedDark: '#5d626b',
  accent: '#81aaf7',
  accentSoft: '#91b7fe',
  accentStrong: '#b1d2ff',
  accentDark: '#3860ac',
  green: '#5fd37f',
  cyan: '#43d5dc',
  purple: '#62488c',
  ativo: 'oklch(72% .1 262 / .14)', // fundo do item ativo
  // Derivadas usadas pelos loaders (mesmos valores das referências).
  line: 'oklch(70% 0 0 / .09)',
  lineStrong: 'oklch(70% 0 0 / .14)',
  card: 'linear-gradient(180deg, oklch(70% 0 0 / .05), oklch(70% 0 0 / .015))',
  grade: 'oklch(70% 0 0 / .11)',
  gradeClara: 'oklch(20% 0 0 / .06)',
  gradeLadrilho: 'oklch(20% 0 0 / .07)',
  esqueleto: 'oklch(70% 0 0 / .07)',
  esqueletoBrilho: 'oklch(70% 0 0 / .11)',
  trilhoBarra: 'oklch(70% 0 0 / .1)',
  trilhoBarraClaro: 'rgba(8,8,10,.08)',
  escurecer: 'rgba(8,8,10,.55)',
  escurecerMobile: 'rgba(8,8,10,.6)',
  alca: 'oklch(70% 0 0 / .22)',
  sombraCard: '0 40px 120px rgba(0,0,0,.55)',
  sombraSheet: '0 -20px 60px rgba(0,0,0,.5)',
  sombraLadrilho: '0 30px 70px rgba(8,8,10,.10)',
  sombraLadrilhoMobile: '0 20px 50px rgba(8,8,10,.10)',
  auraAzul: 'oklch(50% .13 262 / .30)',
  auraAzulMobile: 'oklch(50% .13 262 / .32)',
  auraRoxa: 'oklch(46% .11 300 / .22)',
  auraCard: 'oklch(50% .13 262 / .3)',
  /** Borda do ladrilho claro: o alfa varia com a animação. */
  bordaLadrilho: (alfa: number) => `oklch(50% .13 262 / ${alfa})`,
} as const;

/** Espaçamento base 4: --ps-space-N = N×4 (4, 8, 12, 16, 24, 32, 40, 56, 72, 96). */
export const ESPACO = [1, 2, 3, 4, 6, 8, 10, 14, 18, 24].map((n) => n * 4);
export const espaco = (n: number) => n * 4;

/** Raios do design system. */
export const RAIO = { badge: 6, campo: 14, painel: 20, card: 24, modal: 32, pilula: 999 } as const;

/** Cards: padrão (sem sombra) e elevado (modais, sheets, loaders). */
export const CARD = {
  padrao: { background: COR.card, border: `1px solid ${COR.line}`, borderRadius: RAIO.card },
  elevado: { background: COR.surface, border: `1px solid ${COR.lineStrong}`, boxShadow: COR.sombraCard, borderRadius: RAIO.modal },
  elevadoClaro: { background: COR.white, boxShadow: COR.sombraLadrilho },
} as const;

/** Fontes: as variáveis vêm do next/font (src/brand/fontes.ts para Sora e
 *  DM Sans; a JetBrains Mono já é carregada no layout raiz). */
export const FONTE = {
  display: "var(--font-sora), 'Sora', sans-serif",
  body: "var(--font-dm-sans), 'DM Sans', sans-serif",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
} as const;

/** As três curvas da marca em CSS (as mesmas de motion.ts). */
export const CURVA_CSS = {
  enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
  draw: 'cubic-bezier(0.65, 0, 0.35, 1)',
  pop: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/** Geometria do símbolo "P modular" (grade de 48u; doc 01). */
export const SIMBOLO = {
  arco: 'M24.25 6H26.25A12 12 0 0 1 26.25 30H24.25A4 4 0 0 1 24.25 22H26.25A4 4 0 0 0 26.25 14H24.25A4 4 0 0 1 24.25 6Z',
  /** Linha central do arco: a máscara que revela o arco anda por ela. */
  mascara: 'M20 10H26.25A8 8 0 0 1 26.25 26H20',
  mascaraTraco: 8.8,
  haste: { x: 9.75, base: 42, largura: 8, altura: 36, raio: 4 },
  bojo: { cx: 26.25, cy: 18, r: 12 },
  guiasH: [6, 30, 42],
  guiasV: [9.75, 38.25],
} as const;

/** Tempos de comportamento (doc 04), em segundos. */
export const TEMPO = {
  esperaMinima: 0.3, // só mostra o loader se a espera passar disso
  lockupMinimo: 0.8, // lockup do splash visível pelo menos isso
  cicloSpinner: 1.3, // volta do spinner do P
  fadeReduzido: 0.2, // movimento reduzido: só fade
  suavizacao: 0.12, // constante do progresso suavizado
  velocidadeMax: 1.5, // progresso exibido nunca anda mais que isso por segundo
} as const;

/** Até esta largura vale o layout mobile (lockup vertical, bottom sheet). */
export const BREAKPOINT_MOBILE = 600;

/** Medidas de cada cena (px no palco de referência: 1920×1080 no desktop e
 *  390×844 no mobile). Vêm de prog-loaders.jsx e prog-loaders-mobile.jsx. */
export const MEDIDA = {
  splash: {
    desktop: {
      W: 1920, H: 1080,
      marca: { cx: 960, cy: 540, s0: 500, s1: 480 },
      lockup: { cx: 590, cy: 540, s: 156 },
      palavra: { x: 682.3, cy: 540, size: 100 },
      grade: { passo: 40, posicao: '0 20px', raio: 900 },
      auraAzul: { tam: 1100, x: 960 - 550, y: -560, ax: 80, ay: 40, cor: COR.auraAzul },
      auraRoxa: { tam: 820, x: 1380, y: 260, ax: 60, ay: 50 },
      guia: 1.5,
      cota: { fonte: 22, tique: 8, sobe: 12, ponto: 10, linhaR: 110, rotuloR: 136, rotuloRy: 14, rotulo8: 44, rotulo36x: 22, rotulo36y: 13, rotulo25: 16 },
      hud: { topo: 56, lado: 96, fonte: 22, direita: 'SÍMBOLO · GRADE 48U' },
      progresso: { x: 750, rotuloY: 892, barraY: 934, w: 420, fonte: 20, espaco: '.24em', espacoPct: '.08em' },
      anel: { w: 1.6, dash: 7, gap: 6 },
    },
    mobile: {
      W: 390, H: 844,
      marca: { cx: 195, cy: 400, s0: 250, s1: 240 },
      lockup: { cx: 195, cy: 360, s: 104 },
      palavra: { x: 83.9, cy: 438, size: 32 },
      grade: { passo: 20, posicao: '15px 0', raio: 480 },
      auraAzul: { tam: 560, x: 195 - 280, y: -300, ax: 30, ay: 20, cor: COR.auraAzulMobile },
      auraRoxa: { tam: 420, x: 150, y: 520, ax: 24, ay: 24 },
      guia: 1,
      cota: { fonte: 11, tique: 4, sobe: 6, ponto: 6, linhaR: 34, rotuloR: 46, rotuloRy: 7, rotulo8: 22, rotulo36x: 10, rotulo36y: 7, rotulo25: 8 },
      hud: { topo: 74, lado: 24, fonte: 11, direita: 'GRADE 48U' },
      progresso: { x: 85, rotuloY: 694, barraY: 716, w: 220, fonte: 11, espaco: '.22em', espacoPct: '.06em' },
      anel: { w: 0.7, dash: 3.2, gap: 2.8 },
    },
  },
  pagina: {
    desktop: { s: 128, textoY: 140, fonte: 20, espaco: '.24em', espacoPct: '.08em', anel: { w: 1.6, dash: 7, gap: 6 } },
    mobile: { s: 88, textoY: 66, fonte: 11, espaco: '.22em', espacoPct: '.06em', anel: { w: 0.7, dash: 3.2, gap: 2.8 } },
  },
  painel: {
    desktop: {
      card: { w: 600, h: 430, raio: RAIO.modal },
      aura: { x: 150, y: 40, tam: 300 },
      marca: { cx: 300, cy: 118, s: 128 },
      etapas: { x: 150, y: 222, gap: 18, icone: 20, ponto: 12, borda: 2, fonte: 24, gapTexto: 16, entra: 14 },
      barra: { x: 100, y: 380, w: 400 },
      anel: { w: 1.6, dash: 7, gap: 6 },
      brilho: { ciclo: 1.6, faixa: 600 },
    },
    mobile: {
      card: { w: 390, h: 420, raio: RAIO.modal, topo: 444 },
      alca: { x: 177, y: 10, w: 36, h: 5 },
      aura: { x: 95, y: -14, tam: 200 },
      marca: { cx: 195, cy: 86, s: 84 },
      etapas: { x: 104, y: 154, gap: 13, icone: 14, ponto: 8, borda: 1.5, fonte: 15.5, gapTexto: 11, entra: 8 },
      barra: { x: 75, y: 276, w: 240 },
      anel: { w: 0.7, dash: 3.2, gap: 2.8 },
      brilho: { ciclo: 1.4, faixa: 600 },
    },
  },
  documento: {
    desktop: {
      W: 1920, H: 1080,
      ladrilho: { cx: 960, cy: 470, tam: 264, raio: RAIO.modal, borda: 1.5, grade: 22, guia: 1.5 },
      rotulo: { direita: 18, topo: 11, fonte: 12, espaco: '.16em' },
      fundoGrade: { passo: 40, posicao: '0 30px', raio0: 220, raio1: 700 },
      texto: { y: 668, fonte: 20, espaco: '.24em', espacoPct: '.08em', rotulo: 'GERANDO PROPOSTA COMERCIAL' },
      barra: { x: 750, y: 716, w: 420 },
      papel: { cx: 960, cy: 540, r: 1150 },
      tinta: { r: 1150 },
      anel: { w: 1.6, dash: 7, gap: 6 },
    },
    mobile: {
      W: 390, H: 844,
      ladrilho: { cx: 195, cy: 380, tam: 168, raio: RAIO.card, borda: 1, grade: 14, guia: 1 },
      rotulo: { direita: 11, topo: 6, fonte: 8.5, espaco: '.14em' },
      fundoGrade: { passo: 28, posicao: '13px 16px', raio0: 120, raio1: 360 },
      texto: { y: 496, fonte: 11, espaco: '.22em', espacoPct: '.06em', rotulo: 'GERANDO PROPOSTA' },
      barra: { x: 85, y: 520, w: 220 },
      papel: { cx: 195, cy: 422, r: 480 },
      tinta: { r: 520 },
      anel: { w: 0.7, dash: 3.2, gap: 2.8 },
    },
  },
} as const;

/** Os tokens como variáveis CSS --ps-* (nomes do design system). Aplicadas
 *  só no nó raiz de cada loader, nunca no :root. */
const kebab = (k: string) => k.replace(/[A-Z0-9]+/g, (m) => '-' + m.toLowerCase());
const BASICAS = ['ink', 'panel', 'surface', 'tileDark', 'paper', 'white', 'text', 'body', 'muted1', 'muted', 'muted2', 'nav', 'dim', 'mutedDark',
  'accent', 'accentSoft', 'accentStrong', 'accentDark', 'cyan', 'green', 'purple', 'line', 'lineStrong', 'card'] as const;
export const marcaCssVars = {
  ...Object.fromEntries(BASICAS.map((k) => ['--ps-' + kebab(k), COR[k]])),
  ...Object.fromEntries(ESPACO.map((v) => ['--ps-space-' + v / 4, v + 'px'])),
  ...Object.fromEntries(Object.entries(RAIO).map(([k, v]) => ['--ps-radius-' + k, v + 'px'])),
  '--ps-font-display': FONTE.display,
  '--ps-font-body': FONTE.body,
  '--ps-font-mono': FONTE.mono,
  '--ps-ease-enter': CURVA_CSS.enter,
  '--ps-ease-draw': CURVA_CSS.draw,
  '--ps-ease-pop': CURVA_CSS.pop,
} as CSSProperties;
