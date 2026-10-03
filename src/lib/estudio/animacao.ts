// Motion das peças, seção 07 do playbook.
//
// A sensação que o playbook persegue tem nome: peso de máquina cara. Tudo entra
// rápido e assenta devagar. Bounce, elastic e glitch estão fora do sistema —
// eles comunicam leveza e brincadeira, que é o oposto do que a marca vende.
//
// Uma curva só em toda a peça, e não uma por elemento: curva diferente por
// elemento é o que faz uma animação parecer montada por três pessoas.

import type { Ctx } from '@/lib/estudio/marca';

/** cubic-bezier(.2, .7, .1, 1) — a curva "Prog Out".
 *
 *  No After Effects: ease out 85%, influência de entrada 15%. */
const P1X = 0.2;
const P1Y = 0.7;
const P2X = 0.1;
const P2Y = 1;

function bezier(t: number, a: number, b: number): number {
  const c = 3 * a;
  const d = 3 * (b - a) - c;
  const e = 1 - c - d;
  return ((e * t + d) * t + c) * t;
}

function derivada(t: number, a: number, b: number): number {
  const c = 3 * a;
  const d = 3 * (b - a) - c;
  const e = 1 - c - d;
  return (3 * e * t + 2 * d) * t + c;
}

/** Resolve a curva por Newton-Raphson. Oito passos bastam para 1080px: o erro
 *  residual é menor que um pixel, e não há motivo para gastar mais por quadro. */
export function progOut(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const erro = bezier(t, P1X, P2X) - x;
    if (Math.abs(erro) < 1e-5) break;
    const inclinacao = derivada(t, P1X, P2X);
    if (Math.abs(inclinacao) < 1e-6) break;
    t -= erro / inclinacao;
  }
  return bezier(t, P1Y, P2Y);
}

/** Os tempos do playbook, em milissegundos. */
export const TEMPO = {
  micro: 240,
  titulo: 420,
  produto: 900,
  stagger: 80,
  /** Silêncio antes do preço. É o efeito: o drop sozinho não cria expectativa. */
  respiro: 200,
  brilho: 900,
} as const;

/** Roteiro padrão de uma peça animada. Cada marca é o instante em que o
 *  elemento começa a entrar. */
export const ROTEIRO = {
  produto: 120,
  etiqueta: 300,
  sobretitulo: 360,
  titulo: 420,
  specs: 900,
  regua: 1300,
  preco: 1700,
  brilho: 2100,
  cta: 2300,
} as const;

/** Duração total. Fica acima do fim do roteiro de propósito: a peça precisa
 *  parar e respirar antes de reiniciar, senão o loop parece afobado. */
export const DURACAO = 5000;

/** Progresso de uma fase, já com a curva aplicada. */
export function fase(t: number, inicio: number, duracao: number): number {
  return progOut((t - inicio) / duracao);
}

export type Animador = {
  /** `true` quando a peça está parada — aí tudo desenha no estado final. */
  estatica: boolean;
  /** Entrada padrão: sobe e aparece. */
  entrada(ctx: Ctx, inicio: number, desenhar: () => void, opcoes?: { subida?: number; duracao?: number; linha?: number }): void;
  /** Zoom de produto: 1.14 → 1, com fade. */
  zoom(ctx: Ctx, inicio: number, cx: number, cy: number, desenhar: () => void): void;
  /** Crescimento horizontal a partir da esquerda — régua e barra. */
  estica(ctx: Ctx, inicio: number, x: number, desenhar: () => void): void;
  /** Varredura de luz sobre um elemento dourado. Uma por peça. */
  varredura(ctx: Ctx, x: number, y: number, largura: number, altura: number): void;
};

/** Monta o animador para um instante. Sem `t`, devolve um animador que desenha
 *  tudo no estado final — é assim que o mesmo desenhista serve para a arte
 *  parada e para o vídeo, sem duas versões do layout para manter em sincronia. */
export function animador(t: number | undefined): Animador {
  if (t === undefined) {
    return {
      estatica: true,
      entrada: (_ctx, _i, desenhar) => desenhar(),
      zoom: (_ctx, _i, _cx, _cy, desenhar) => desenhar(),
      estica: (_ctx, _i, _x, desenhar) => desenhar(),
      varredura: () => {},
    };
  }

  return {
    estatica: false,

    entrada(ctx, inicio, desenhar, opcoes = {}) {
      const { subida = 60, duracao = TEMPO.titulo, linha = 0 } = opcoes;
      const p = fase(t, inicio + linha * TEMPO.stagger, duracao);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 1.4);
      ctx.translate(0, subida * (1 - p));
      desenhar();
      ctx.restore();
    },

    zoom(ctx, inicio, cx, cy, desenhar) {
      const p = fase(t, inicio, TEMPO.produto);
      if (p <= 0) return;
      const escala = 1.14 - 0.14 * p;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 2);
      ctx.translate(cx, cy);
      ctx.scale(escala, escala);
      ctx.translate(-cx, -cy);
      desenhar();
      ctx.restore();
    },

    estica(ctx, inicio, x, desenhar) {
      const p = fase(t, inicio, TEMPO.micro);
      if (p <= 0) return;
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(p, 1);
      ctx.translate(-x, 0);
      desenhar();
      ctx.restore();
    },

    varredura(ctx, x, y, largura, altura) {
      const p = (t - ROTEIRO.brilho) / TEMPO.brilho;
      if (p <= 0 || p >= 1) return;
      // A luz atravessa da esquerda para a direita, começando e terminando
      // fora do elemento para não haver corte visível na borda.
      const centro = x - largura * 0.6 + largura * 2.2 * p;
      const faixa = largura * 0.45;
      const g = ctx.createLinearGradient(centro - faixa, 0, centro + faixa, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,245,215,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(x, y, largura, altura);
      ctx.restore();
    },
  };
}
