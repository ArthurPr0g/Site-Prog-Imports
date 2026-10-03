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
  | { ok: true; blob: Blob; extensao: string }
  | { ok: false; motivo: string };

/** Desenha a peça quadro a quadro e grava o resultado.
 *
 *  30 quadros por segundo: é o que o Instagram entrega no feed, e o dobro
 *  dobraria o arquivo sem mudar o que se vê. A gravação acompanha o relógio
 *  real porque `captureStream` grava o que aparece na tela — adiantar o
 *  desenho produziria um vídeo mais curto que a animação. */
export async function gravarPeca(
  canvas: HTMLCanvasElement,
  desenharQuadro: (t: number) => Promise<void> | void,
  opcoes: { duracao?: number; fps?: number } = {}
): Promise<ResultadoDoVideo> {
  const { duracao = DURACAO, fps = 30 } = opcoes;

  const formato = formatoDisponivel();
  if (!formato) {
    return {
      ok: false,
      motivo:
        'Este navegador não grava MP4. O Instagram não aceita WebM — abra o Estúdio no Chrome para exportar o vídeo.',
    };
  }

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
  let agora = 0;
  while (agora < duracao) {
    agora = performance.now() - inicio;
    await desenharQuadro(Math.min(agora, duracao));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }

  // Um quadro final no estado de repouso: sem ele o último frame pode pegar a
  // animação a meio caminho e o vídeo termina tremendo.
  await desenharQuadro(duracao);
  await new Promise((r) => setTimeout(r, 120));

  gravador.stop();
  stream.getTracks().forEach((t) => t.stop());
  await terminou;

  return { ok: true, blob: new Blob(pedacos, { type: formato }), extensao: 'mp4' };
}
