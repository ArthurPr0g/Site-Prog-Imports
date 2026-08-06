'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, X } from 'lucide-react';

/** Carrega uma imagem para desenhar no canvas.
 *
 *  `crossOrigin` é obrigatório para as fotos vindas do storage: sem ele o
 *  navegador marca o canvas como contaminado e `toDataURL` passa a lançar
 *  SecurityError — o desenho aparece na tela e o download morre.
 *
 *  Falha devolve `null` em vez de propagar: uma proposta sem foto ainda é
 *  enviável, e uma etiqueta sem logo entrega a encomenda do mesmo jeito. */
export function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Pré-visualização de uma imagem gerada em canvas, com download em PNG.
 *
 *  Ver antes existe porque erro em imagem gerada só aparece depois de enviada
 *  ao cliente ou colada na caixa. Aqui o erro custa um clique de fechar.
 *
 *  O canvas nasce no tamanho final e é exibido reduzido: o arquivo baixado
 *  precisa ter a resolução do uso (impressão ou WhatsApp), não a da tela. */
export function PngPreviewModal({
  titulo,
  subtitulo,
  aviso,
  largura,
  altura,
  larguraExibida = 300,
  nomeDoArquivo,
  desenhar,
  onFechar,
}: {
  titulo: string;
  subtitulo: string;
  /** Bloco de pendências, quando faltar dado. */
  aviso?: ReactNode;
  largura: number;
  altura: number;
  larguraExibida?: number;
  nomeDoArquivo: string;
  /** Desenha no contexto. Recebe o canvas já dimensionado e limpo. */
  desenhar: (ctx: CanvasRenderingContext2D) => Promise<void> | void;
  onFechar: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  useEffect(() => {
    let cancelado = false;

    async function render() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      await desenhar(ctx);
      if (!cancelado) setPronta(true);
    }

    void render();
    return () => {
      cancelado = true;
    };
    // `desenhar` vem de quem abre o modal e já carrega os dados dentro dela;
    // recriar a cada render dispararia o desenho em laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function baixar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = nomeDoArquivo;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onFechar}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col rounded-[20px] border border-border-strong bg-card p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[15px] font-extrabold">{titulo}</div>
            <div className="text-[12.5px] text-fg-tertiary">{subtitulo}</div>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent"
          >
            <X size={15} />
          </button>
        </div>

        {aviso}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-control border border-border bg-input-alt p-4">
          <canvas
            ref={canvasRef}
            width={largura}
            height={altura}
            style={{ maxWidth: `${larguraExibida}px` }}
            className="mx-auto block h-auto w-full rounded-[6px] shadow-[0_8px_28px_rgba(0,0,0,.45)]"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
          <button
            onClick={onFechar}
            className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary"
          >
            Fechar
          </button>
          <button
            onClick={baixar}
            disabled={!pronta}
            className="inline-flex items-center gap-2 rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
          >
            <Download size={15} /> Baixar PNG
          </button>
        </div>
      </div>
    </div>
  );
}
