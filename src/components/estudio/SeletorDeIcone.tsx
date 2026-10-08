'use client';

import { useEffect, useRef } from 'react';
import { carregarImagens, desenharPeca } from '@/lib/estudio/desenhistas';
import { ORDEM_DOS_DESTAQUES, ICONES } from '@/lib/estudio/icones';
import { DIMENSOES } from '@/lib/estudio/modelos';
import type { Ctx } from '@/lib/estudio/marca';

/** O jogo de capas de destaque, desenhado.
 *
 *  Antes isto era um campo de texto com a lista dos nomes na linha de ajuda:
 *  para ver a capa de "message-square-quote" era preciso digitar o nome certo e
 *  olhar a prévia, um de cada vez. As sete capas do playbook formam um conjunto
 *  — elas vão juntas na barra do perfil e precisam ser escolhidas vendo as
 *  outras, não uma por vez.
 *
 *  Cada opção é a peça de verdade desenhada pequena, na direção que está
 *  escolhida (ônix, medalha ou índice): trocar de direção troca as sete. */
const LADO = 92;

export function SeletorDeIcone({
  modelo,
  valor,
  onChange,
}: {
  modelo: string;
  valor: string;
  onChange: (icone: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {ORDEM_DOS_DESTAQUES.map((nome) => (
        <button
          key={nome}
          type="button"
          onClick={() => onChange(nome)}
          title={ICONES[nome]?.rotulo ?? 'Globo da marca'}
          className={`flex flex-col items-center gap-1.5 rounded-card border p-2 transition-all ${
            valor === nome
              ? 'border-ouro bg-card-hover'
              : 'border-border-strong hover:border-border-hover hover:bg-card-hover'
          }`}
        >
          <CapaDesenhada modelo={modelo} icone={nome} />
          <span className="etiqueta max-w-[88px] truncate text-[8.5px] text-fg-tertiary">
            {ICONES[nome]?.rotulo ?? 'Globo'}
          </span>
        </button>
      ))}
    </div>
  );
}

function CapaDesenhada({ modelo, icone }: { modelo: string; icone: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { largura, altura } = DIMENSOES.destaque;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d') as Ctx | null | undefined;
      if (!canvas || !ctx) return;
      // O quadro do destaque é 1080×1920, mas o disco vive no quadrado central.
      // Desenhar a peça inteira e mostrar só a faixa do meio é o que faz a
      // miniatura ser redonda como no perfil, e não uma tira alta com o disco
      // perdido no meio.
      const escala = LADO / largura;
      canvas.width = LADO;
      canvas.height = LADO;
      ctx.setTransform(escala, 0, 0, escala, 0, -((altura - largura) / 2) * escala);
      const imagens = await carregarImagens({});
      if (cancelado) return;
      await desenharPeca(ctx, modelo, { icone }, imagens, 1);
    })();
    return () => { cancelado = true; };
  }, [modelo, icone, largura, altura]);

  return <canvas ref={ref} className="rounded-full" style={{ width: LADO, height: LADO }} />;
}
