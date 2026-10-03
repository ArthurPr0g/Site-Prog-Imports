// Motion das peças, seção 07 do playbook.
//
// A sensação que o playbook persegue tem nome: peso de máquina cara. Tudo entra
// rápido e assenta devagar. Bounce, elastic e glitch estão fora do sistema —
// eles comunicam leveza e brincadeira, que é o oposto do que a marca vende.
//
// Uma curva só em toda a peça, e não uma por elemento: curva diferente por
// elemento é o que faz uma animação parecer montada por três pessoas.
//
// Três coisas separam isto de um PNG com introdução, e as três estão aqui:
// a câmera, que nunca para; o rastro, que faz o deslocamento parecer
// deslocamento; e a máscara da varredura, que põe a luz no metal do preço em
// vez de acender um retângulo em volta dele.

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

/** Os tempos do playbook, em milissegundos.
 *
 *  Mais longos que a primeira versão de propósito. 240ms para um elemento que
 *  percorre 60px dá 250px por segundo de velocidade média e um corte seco no
 *  fim: o elemento não entra, ele aparece. O playbook pede entrada rápida com
 *  assentamento lento, e assentamento precisa de tempo para existir. */
export const TEMPO = {
  micro: 380,
  titulo: 560,
  produto: 1100,
  regua: 520,
  stagger: 90,
  /** Silêncio antes do preço. É o efeito: o drop sozinho não cria expectativa. */
  respiro: 200,
  brilho: 1100,
} as const;

/** Roteiro padrão de uma peça animada. Cada marca é o instante em que o
 *  elemento começa a entrar.
 *
 *  O ritmo importa mais que os números: nenhuma marca coincide com outra e
 *  nenhum vão passa de 300ms. Antes havia três elementos entrando entre 300 e
 *  420ms e depois meio segundo de nada — a peça chegava em blocos, com buracos
 *  no meio, que é o que faz a animação parecer um slideshow apressado. */
export const ROTEIRO = {
  produto: 0,
  lockup: 260,
  etiqueta: 340,
  sobretitulo: 420,
  titulo: 500,
  regua: 760,
  specs: 880,
  precoDe: 1180,
  preco: 1280,
  parcela: 1400,
  brilho: 1900,
  cta: 1560,
} as const;

/** Duração total. Fica acima do fim do roteiro de propósito: a peça precisa
 *  parar e respirar antes de reiniciar, senão o loop parece afobado. */
export const DURACAO = 5000;

/** A câmera: um empurrão lento que atravessa a peça inteira.
 *
 *  É o que separa um vídeo de um PNG com introdução. O roteiro termina por
 *  volta de 2,1s; sem a câmera os outros 2,9s são um quadro congelado, e
 *  quadro congelado é exatamente o que o olho reconhece como amador.
 *
 *  Vai na curva da peça, e não linear, por um motivo que só aparece no fim: na
 *  curva o empurrão desacelera até parar no último quadro. Movimento cortado
 *  no meio do caminho faz o clipe parecer inacabado; movimento que para antes
 *  do corte faz o clipe parecer terminado.
 *
 *  Só as camadas de imagem recebem a câmera. Tipografia que anda sozinha
 *  parece defeito de layout, e a margem de 72px do playbook é lei — ela não
 *  pode virar 68 no meio do vídeo. O produto empurrando enquanto a marca
 *  d'água atrás dele fica parada também dá o paralaxe de graça: fundo mais
 *  lento que frente é profundidade. */
const CAMERA = { escala: 0.035, subida: 14 } as const;

/** Respiração do halo: período longo, amplitude pequena.
 *
 *  3,4s para um ciclo e 9% de variação. Mais rápido que isso vira pulsação de
 *  notificação, mais forte vira luz de balada — os dois tiram o peso que o
 *  halo existe para dar. */
const RESPIRO = { periodo: 3400, amplitude: 0.09, entrada: 700 } as const;

/** Progresso de uma fase, já com a curva aplicada. */
export function fase(t: number, inicio: number, duracao: number): number {
  return progOut((t - inicio) / duracao);
}

export type Caixa = { x: number; y: number; largura: number; altura: number };

export type OpcoesDeEntrada = {
  subida?: number;
  duracao?: number;
  linha?: number;
  /** Escala inicial, para o elemento assentar em vez de só deslizar. Precisa
   *  de `ancora`: sem ela não há ponto fixo e o elemento escorrega. */
  escala?: number;
  ancora?: { x: number; y: number };
};

export type Animador = {
  /** `true` quando a peça está parada — aí tudo desenha no estado final. */
  estatica: boolean;
  /** Entrada padrão: sobe, aparece e assenta. */
  entrada(ctx: Ctx, inicio: number, desenhar: () => void, opcoes?: OpcoesDeEntrada): void;
  /** Entrada do produto, com a câmera por cima: 1.08 → 1 e depois o empurrão
   *  lento da câmera, numa curva só. Duas curvas em sequência no mesmo
   *  elemento seriam dois gestos; isto é um. */
  zoom(ctx: Ctx, inicio: number, cx: number, cy: number, desenhar: () => void): void;
  /** Crescimento horizontal a partir da esquerda — régua e barra. */
  estica(ctx: Ctx, inicio: number, x: number, desenhar: () => void): void;
  /** Opacidade do halo, já com a entrada e a respiração. */
  luz(opacidade: number): number;
  /** Varredura de luz sobre um elemento dourado. Uma por peça.
   *
   *  `pintar` recebe o contexto onde desenhar: a função é chamada numa camada
   *  à parte para a luz existir só onde há tinta. */
  varredura(ctx: Ctx, caixa: Caixa, pintar: (c: Ctx) => void): void;
};

/** Camada reaproveitada entre quadros. Criar canvas a 60 quadros por segundo
 *  dá trabalho ao coletor de lixo e o travamento aparece no vídeo. */
let camada: HTMLCanvasElement | null = null;

function camadaDe(largura: number, altura: number): Ctx | null {
  if (typeof document === 'undefined') return null;
  const l = Math.max(1, Math.ceil(largura));
  const a = Math.max(1, Math.ceil(altura));
  if (!camada) camada = document.createElement('canvas');
  if (camada.width !== l || camada.height !== a) {
    camada.width = l;
    camada.height = a;
  }
  const c = camada.getContext('2d') as CanvasRenderingContext2D | null;
  if (!c) return null;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.clearRect(0, 0, l, a);
  return c as unknown as Ctx;
}

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
      luz: (opacidade) => opacidade,
      varredura: () => {},
    };
  }

  /** Progresso da câmera. Uma vez por quadro, para todas as camadas. */
  const pCamera = progOut(t / DURACAO);

  return {
    estatica: false,

    entrada(ctx, inicio, desenhar, opcoes = {}) {
      const { subida = 60, duracao = TEMPO.titulo, linha = 0, escala = 1, ancora } = opcoes;
      const comeco = inicio + linha * TEMPO.stagger;
      const p = fase(t, comeco, duracao);
      if (p <= 0) return;

      const deslocamento = subida * (1 - p);
      const opacidade = Math.min(1, p * 1.4);

      // Rastro. O quadro anterior diz quantos pixels o elemento percorreu no
      // último quadro; quando são muitos, duas cópias fracas atrás dele fazem
      // o deslocamento parecer deslocamento. Sem isso o elemento se teletransporta
      // de posição em posição e o olho lê cada quadro como um salto — é o mesmo
      // motivo pelo qual uma câmera de verdade tem obturador.
      const smear = subida * (1 - fase(t - 16, comeco, duracao)) - deslocamento;
      if (Math.abs(smear) > 5) {
        for (const [fracao, forca] of [[0.66, 0.1], [0.33, 0.18]] as const) {
          ctx.save();
          ctx.globalAlpha = opacidade * forca;
          ctx.translate(0, deslocamento + smear * fracao);
          desenhar();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.globalAlpha = opacidade;
      ctx.translate(0, deslocamento);
      if (escala !== 1 && ancora) {
        const e = escala + (1 - escala) * p;
        ctx.translate(ancora.x, ancora.y);
        ctx.scale(e, e);
        ctx.translate(-ancora.x, -ancora.y);
      }
      desenhar();
      ctx.restore();
    },

    zoom(ctx, inicio, cx, cy, desenhar) {
      const p = fase(t, inicio, TEMPO.produto);
      if (p <= 0) return;
      // 1.08 e não 1.14: com 14% o produto chega grande o bastante para o olho
      // ler duas coisas, a entrada e um recuo. Com 8% ele lê uma.
      const escala = (1.08 - 0.08 * p) * (1 + CAMERA.escala * pCamera);
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 1.8);
      ctx.translate(cx, cy - CAMERA.subida * pCamera);
      ctx.scale(escala, escala);
      ctx.translate(-cx, -cy);
      desenhar();
      ctx.restore();
    },

    estica(ctx, inicio, x, desenhar) {
      const p = fase(t, inicio, TEMPO.regua);
      if (p <= 0.002) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 3);
      ctx.translate(x, 0);
      ctx.scale(p, 1);
      ctx.translate(-x, 0);
      desenhar();
      ctx.restore();
    },

    luz(opacidade) {
      const entrada = progOut(t / RESPIRO.entrada);
      const ciclo = Math.sin((2 * Math.PI * (t - 400)) / RESPIRO.periodo);
      return opacidade * entrada * (1 + RESPIRO.amplitude * ciclo);
    },

    varredura(ctx, caixa, pintar) {
      const bruto = (t - ROTEIRO.brilho) / TEMPO.brilho;
      if (bruto <= 0 || bruto >= 1) return;
      const c = camadaDe(caixa.largura, caixa.altura);
      if (!c) return;

      // A luz existe só onde há tinta. Antes a varredura pintava o retângulo
      // inteiro em `lighter`: sobre fundo escuro isso é um retângulo claro
      // atravessando a peça, e não um reflexo correndo pelo metal do preço.
      // Pintar o elemento numa camada e recortar o degradê com `source-in`
      // resolve — o que acende é o algarismo.
      c.save();
      c.translate(-caixa.x, -caixa.y);
      pintar(c);
      c.restore();

      // Quase linear, desacelerando no fim: reflexo em superfície plana não
      // tem aceleração, mas parar de repente delata o truque.
      const p = bruto * 0.7 + progOut(bruto) * 0.3;
      const faixa = Math.max(90, caixa.largura * 0.3);
      const centro = -faixa + (caixa.largura + faixa * 2) * p;
      // Diagonal, e não vertical: luz batendo de cima faz o metal ter plano.
      const g = c.createLinearGradient(centro - faixa, 0, centro + faixa, caixa.altura);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.42, 'rgba(255,250,235,.30)');
      g.addColorStop(0.5, 'rgba(255,255,255,.92)');
      g.addColorStop(0.58, 'rgba(255,250,235,.30)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = g;
      c.fillRect(0, 0, caixa.largura, caixa.altura);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Entra e sai de cena: aparecer e desaparecer no meio do caminho é o que
      // o reflexo faz quando a fonte de luz passa, e some o corte nas bordas.
      ctx.globalAlpha = Math.sin(Math.PI * bruto);
      ctx.drawImage(camada as HTMLCanvasElement, caixa.x, caixa.y);
      ctx.restore();
    },
  };
}
