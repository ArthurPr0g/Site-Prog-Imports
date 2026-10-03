// Grava a peÃ§a animada em vÃ­deo, direto do canvas.
//
// MP4 e nÃ£o WebM: o Instagram nÃ£o aceita WebM, e descobrir isso na hora de
// publicar Ã© o pior momento. O Chrome grava avc1 desde a versÃ£o 126; quando o
// navegador nÃ£o souber, a funÃ§Ã£o avisa em vez de entregar um arquivo que nÃ£o
// sobe.
//
// O canvas Ã© o mesmo que desenha o PNG, no mesmo tamanho final â€” o vÃ­deo sai em
// 1080Ã—1350 ou 1080Ã—1920 sem reescalar nada.

import { DURACAO } from '@/lib/estudio/animacao';

/** Formatos aceitos, em ordem de preferÃªncia. */
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
      /** Quadros por segundo que a gravaÃ§Ã£o realmente alcanÃ§ou. */
      fps: number;
      /** Tempo mÃ©dio de um quadro, em ms. Acima de 16 nÃ£o dÃ¡ para 60fps. */
      mediaMs: number;
    }
  | { ok: false; motivo: string };

/** Desenha a peÃ§a quadro a quadro e grava o resultado.
 *
 *  O gravador recebe um quadro quando hÃ¡ um quadro novo, e nÃ£o num relÃ³gio
 *  prÃ³prio. Ã‰ a diferenÃ§a entre vÃ­deo fluido e vÃ­deo tremido: com
 *  `captureStream(fps)` o navegador tira uma amostra a cada 1/fps de segundo
 *  independentemente de o desenho ter terminado, e quando nÃ£o terminou ele
 *  repete a amostra anterior â€” o vÃ­deo fica com quadros gÃªmeos e o movimento
 *  engasga em cima deles. Com `captureStream(0)` mais `requestFrame`, nenhum
 *  quadro Ã© repetido e nenhum Ã© perdido.
 *
 *  O relÃ³gio continua sendo o real, nÃ£o um contador de quadros: o vÃ­deo tem a
 *  duraÃ§Ã£o que a peÃ§a tem. Adiantar o desenho produziria um arquivo mais curto
 *  que a animaÃ§Ã£o, e atrasar produziria cÃ¢mera lenta. */
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
        'Este navegador nÃ£o grava MP4. O Instagram nÃ£o aceita WebM â€” abra o EstÃºdio no Chrome para exportar o vÃ­deo.',
    };
  }

  // 60 e nÃ£o 30: o movimento aqui Ã© lento e contÃ­nuo, e Ã© justamente nesse
  // tipo de movimento que 30 quadros aparecem como degraus. O arquivo cresce,
  // mas o Instagram reconverte tudo de qualquer jeito â€” o que nÃ£o se recupera
  // depois Ã© fluidez que nÃ£o foi gravada.
  const stream = canvas.captureStream(0);
  const faixa = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const pedirQuadro =
    faixa && typeof faixa.requestFrame === 'function' ? () => faixa.requestFrame() : null;
  if (!pedirQuadro) {
    // Sem `requestFrame` o navegador amostra sozinho; aÃ­ o melhor que dÃ¡ para
    // fazer Ã© nÃ£o atrapalhar.
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

  gravador.start();

  const inicio = performance.now();
  let quadros = 0;
  let somaMs = 0;
  let agora = 0;
  while (agora < duracao) {
    const antes = performance.now();
    agora = antes - inicio;
    await desenharQuadro(Math.min(agora, duracao));
    pedirQuadro();
    quadros++;
    somaMs += performance.now() - antes;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }

  // Um quadro final no estado de repouso: sem ele o Ãºltimo frame pode pegar a
  // animaÃ§Ã£o a meio caminho e o vÃ­deo termina tremendo. A espera depois dele Ã©
  // o que dÃ¡ duraÃ§Ã£o a esse quadro â€” um quadro sem duraÃ§Ã£o nÃ£o existe no
  // arquivo, e o vÃ­deo volta a terminar no penÃºltimo.
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

