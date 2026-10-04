// Grava a peça animada em vídeo, direto do canvas.
//
// MP4 e não WebM: o Instagram não aceita WebM, e descobrir isso na hora de
// publicar é o pior momento. O Chrome grava avc1 desde a versão 126; quando o
// navegador não souber, a função avisa em vez de entregar um arquivo que não
// sobe.
//
// O canvas é o mesmo que desenha o PNG, no mesmo tamanho final — o vídeo sai em
// 1080×1350 ou 1080×1920 sem reescalar nada.

import { DURACAO } from '@/lib/estudio/animacao';

/** Formatos aceitos, em ordem de preferência. */
const FORMATOS = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4',
] as const;

export function formatoDisponivel(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return FORMATOS.find((f) => MediaRecorder.isTypeSupported(f)) ?? null;
}

export type ResultadoDoVideo =
  | {
      ok: true;
      blob: Blob;
      extensao: string;
      /** Quadros entregues ao gravador. */
      quadros: number;
      /** Quadros por segundo que a gravação realmente alcançou. */
      fps: number;
      /** Tempo médio de um quadro, em ms. Acima de 16 não dá para 60fps. */
      mediaMs: number;
    }
  | { ok: false; motivo: string };

/** Desenha a peça quadro a quadro e grava o resultado.
 *
 *  O gravador recebe um quadro quando há um quadro novo, e não num relógio
 *  próprio. É a diferença entre vídeo fluido e vídeo tremido: com
 *  `captureStream(fps)` o navegador tira uma amostra a cada 1/fps de segundo
 *  independentemente de o desenho ter terminado, e quando não terminou ele
 *  repete a amostra anterior — o vídeo fica com quadros gêmeos e o movimento
 *  engasga em cima deles. Com `captureStream(0)` mais `requestFrame`, nenhum
 *  quadro é repetido e nenhum é perdido.
 *
 *  O relógio continua sendo o real, não um contador de quadros: o vídeo tem a
 *  duração que a peça tem. Adiantar o desenho produziria um arquivo mais curto
 *  que a animação, e atrasar produziria câmera lenta. */
export async function gravarPeca(
  canvas: HTMLCanvasElement,
  desenharQuadro: (t: number) => Promise<void> | void,
  opcoes: { duracao?: number; fps?: number } = {}
): Promise<ResultadoDoVideo> {
  const { duracao = DURACAO, fps = 60 } = opcoes;

  const formato = formatoDisponivel();
  if (!formato || typeof canvas.captureStream !== 'function') {
    return {
      ok: false,
      motivo:
        'Este navegador não grava MP4. O Instagram não aceita WebM — abra o Estúdio no Chrome para exportar o vídeo.',
    };
  }

  // 60 e não 30: o movimento aqui é lento e contínuo, e é justamente nesse
  // tipo de movimento que 30 quadros aparecem como degraus. O arquivo cresce,
  // mas o Instagram reconverte tudo de qualquer jeito — o que não se recupera
  // depois é fluidez que não foi gravada.
  const stream = canvas.captureStream(0);
  const faixa = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const pedirQuadro =
    faixa && typeof faixa.requestFrame === 'function' ? () => faixa.requestFrame() : null;
  if (!pedirQuadro) {
    // Sem `requestFrame` o navegador amostra sozinho; aí o melhor que dá para
    // fazer é não atrapalhar.
    stream.getTracks().forEach((f) => f.stop());
    return gravarPorAmostragem(canvas, desenharQuadro, { duracao, fps, formato });
  }

  const gravador = new MediaRecorder(stream, { mimeType: formato, videoBitsPerSecond: 12_000_000 });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => {
    if (e.data.size > 0) pedacos.push(e.data);
  };
  const terminou = new Promise<void>((resolve) => {
    gravador.onstop = () => resolve();
  });

  // Aquecimento, antes de o gravador existir.
  //
  // Todo custo de primeira vez cai no primeiro quadro que precisa dele, e o
  // vídeo guarda o tombo: a medição mostrava 85ms parados em 0,16s, bem no meio
  // da entrada do produto, e 54ms em 2,10s, exatamente quando a varredura
  // acende pela primeira vez e aloca a camada da máscara. Desenhar uma vez cada
  // trecho do roteiro paga essas contas aqui, onde ninguém está olhando.
  for (const fracao of [0, 0.2, 0.45, 0.6, 1]) {
    await desenharQuadro(duracao * fracao);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
  await desenharQuadro(0);

  gravador.start();
  // Uma folga para o codificador engatar. O canvas já está no primeiro quadro
  // da peça, então o que entra nessa folga é o início dela.
  await new Promise((r) => setTimeout(r, 120));

  // A grade de quadros é a do formato, não a do monitor. Pedir um quadro a
  // cada repintura parece generoso e é o contrário: num monitor de 165Hz saem
  // 820 quadros em 5 segundos, a mesma taxa de bits se divide por todos eles e
  // cada quadro fica pior — num vídeo que o Instagram vai reconverter para 30
  // de qualquer jeito. 60 na grade, e a sobra do monitor vira folga para o
  // desenho terminar.
  const intervalo = 1000 / fps;
  const inicio = performance.now();
  let proximo = 0;
  let quadros = 0;
  let somaMs = 0;
  let agora = 0;
  while (agora < duracao) {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const antes = performance.now();
    agora = antes - inicio;
    if (agora < proximo) continue;
    await desenharQuadro(Math.min(agora, duracao));
    pedirQuadro();
    quadros++;
    somaMs += performance.now() - antes;
    // Avança a grade para depois de agora: se um quadro atrasou muito, repor a
    // grade quadro a quadro faria o desenho correr atrás do prejuízo pelo resto
    // da gravação.
    proximo = Math.max(proximo + intervalo, agora + intervalo * 0.5);
  }

  // Um quadro final no estado de repouso: sem ele o último frame pode pegar a
  // animação a meio caminho e o vídeo termina tremendo. A espera depois dele é
  // o que dá duração a esse quadro — um quadro sem duração não existe no
  // arquivo, e o vídeo volta a terminar no penúltimo.
  await desenharQuadro(duracao);
  pedirQuadro();
  quadros++;
  await new Promise((r) => setTimeout(r, 200));

  gravador.stop();
  stream.getTracks().forEach((f) => f.stop());
  await terminou;

  const segundos = (performance.now() - inicio) / 1000;
  return {
    ok: true,
    blob: new Blob(pedacos, { type: formato }),
    extensao: 'mp4',
    quadros,
    fps: Math.round(quadros / segundos),
    mediaMs: Math.round((somaMs / quadros) * 10) / 10,
  };
}

/** Caminho de reserva, para navegador sem `requestFrame`. */
async function gravarPorAmostragem(
  canvas: HTMLCanvasElement,
  desenharQuadro: (t: number) => Promise<void> | void,
  opcoes: { duracao: number; fps: number; formato: string }
): Promise<ResultadoDoVideo> {
  const { duracao, fps, formato } = opcoes;
  const stream = canvas.captureStream(fps);
  const gravador = new MediaRecorder(stream, { mimeType: formato, videoBitsPerSecond: 12_000_000 });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => {
    if (e.data.size > 0) pedacos.push(e.data);
  };
  const terminou = new Promise<void>((resolve) => {
    gravador.onstop = () => resolve();
  });

  gravador.start();
  const inicio = performance.now();
  let quadros = 0;
  let agora = 0;
  while (agora < duracao) {
    agora = performance.now() - inicio;
    await desenharQuadro(Math.min(agora, duracao));
    quadros++;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
  await desenharQuadro(duracao);
  await new Promise((r) => setTimeout(r, 200));

  gravador.stop();
  stream.getTracks().forEach((f) => f.stop());
  await terminou;

  const segundos = (performance.now() - inicio) / 1000;
  return {
    ok: true,
    blob: new Blob(pedacos, { type: formato }),
    extensao: 'mp4',
    quadros,
    fps: Math.round(quadros / segundos),
    mediaMs: Math.round((segundos * 1000) / quadros),
  };
}

