'use client';

import { useEffect, useRef, useState } from 'react';
import { carregarImagens, desenharPeca } from '@/lib/estudio/desenhistas';
import { DIMENSOES, type Modelo } from '@/lib/estudio/modelos';
import { exemploDe } from '@/lib/estudio/exemplos';
import type { Ctx } from '@/lib/estudio/marca';

/** A miniatura é a peça de verdade, desenhada pequena.
 *
 *  O mesmo desenhista que gera o arquivo final desenha aqui, só que com a
 *  escala aplicada antes do primeiro traço — as medidas do playbook ficam todas
 *  iguais, divididas por quatro. Uma imagem estática de exemplo contaria a
 *  mesma história só até a primeira vez que o modelo mudasse, e aí passaria a
 *  mentir sem avisar.
 *
 *  A escala entra por `setTransform` e não por CSS: um canvas de 1080×1350
 *  encolhido pelo navegador ocupa a memória do tamanho cheio, e são catorze
 *  deles na tela ao mesmo tempo — perto de oitenta megabytes só para mostrar
 *  miniaturas. */
const ESCALA = 0.26;

export function MiniaturaDoModelo({ modelo, capa }: { modelo: Modelo; capa: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pronta, setPronta] = useState(false);
  const { largura, altura } = DIMENSOES[modelo.formato];

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d') as Ctx | null | undefined;
      if (!canvas || !ctx) return;

      canvas.width = Math.round(largura * ESCALA);
      canvas.height = Math.round(altura * ESCALA);

      const imagens = await carregarImagens({ produto: capa ?? undefined, produtoA: capa ?? undefined, produtoB: capa ?? undefined });
      if (cancelado) return;

      ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
      await desenharPeca(ctx, modelo.codigo, exemploDe(modelo.codigo), imagens, 1);
      if (!cancelado) setPronta(true);
    })();
    return () => { cancelado = true; };
  }, [modelo.codigo, largura, altura, capa]);

  return (
    <div
      className="relative overflow-hidden rounded-card bg-card-dark"
      // A proporção vem do formato, então story não fica deitado nem feed em pé.
      style={{ aspectRatio: `${largura} / ${altura}` }}
    >
      <canvas
        ref={ref}
        className="h-full w-full object-cover transition-opacity duration-500"
        style={{ opacity: pronta ? 1 : 0 }}
      />
      {!pronta && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="etiqueta text-[9px] text-fg-muted">desenhando…</span>
        </div>
      )}
    </div>
  );
}
