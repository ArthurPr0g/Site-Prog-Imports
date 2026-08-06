'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import Link from 'next/link';
import { faltaParaEtiqueta, nomeDoArquivo, type Etiqueta } from '@/lib/shipping-label';
import { desenharEtiqueta, carregarLogo, LARGURA, ALTURA } from '@/lib/shipping-label-canvas';

/** Pré-visualização da etiqueta antes de baixar.
 *
 *  Ver antes existe porque etiqueta errada só aparece depois de impressa e
 *  colada: endereço truncado, remetente em branco, CEP incompleto. Aqui o erro
 *  custa um clique de fechar. */
/** Para onde cada pendência manda. O cadastro do cliente só tem endereço certo
 *  quando a venda está vinculada a um; sem vínculo, a lista de clientes é o mais
 *  próximo de útil. */
function destinoDaPendencia(onde: string, clienteId: string | null): { href: string; texto: string } | null {
  if (onde === 'configuracoes') return { href: '/admin/configuracoes', texto: 'Abrir Configurações' };
  if (onde === 'cliente') {
    return clienteId
      ? { href: `/admin/clientes/${clienteId}`, texto: 'Abrir o cadastro do cliente' }
      : { href: '/admin/clientes', texto: 'Abrir Clientes' };
  }
  return null;
}

export function EtiquetaModal({
  etiqueta,
  clienteId,
  onFechar,
}: {
  etiqueta: Etiqueta;
  /** Cliente do ERP vinculado à venda, quando existe. */
  clienteId: string | null;
  onFechar: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pronta, setPronta] = useState(false);
  const problemas = faltaParaEtiqueta(etiqueta);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  useEffect(() => {
    let cancelado = false;

    async function desenhar() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const logo = await carregarLogo('/images/logo.png');
      if (cancelado) return;

      desenharEtiqueta(ctx, etiqueta, logo);
      setPronta(true);
    }

    void desenhar();
    return () => {
      cancelado = true;
    };
  }, [etiqueta]);

  function baixar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = nomeDoArquivo(etiqueta.pedido, etiqueta.destinatario.nome);
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
            <div className="text-[15px] font-extrabold">Etiqueta de transporte</div>
            <div className="text-[12.5px] text-fg-tertiary">
              {etiqueta.pedido} · 10 × 15 cm, o formato que Correios e transportadoras aceitam.
            </div>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent"
          >
            <X size={15} />
          </button>
        </div>

        {problemas.length > 0 && (
          <div className="mb-4 rounded-control border border-warning/40 bg-warning/[0.07] px-4 py-3 text-[12.5px] text-fg-secondary">
            <strong>Falta preencher antes de imprimir:</strong>
            <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-4">
              {problemas.map((p) => {
                const destino = destinoDaPendencia(p.onde, clienteId);
                return (
                  <li key={p.texto}>
                    {p.texto}
                    {destino && (
                      <Link
                        href={destino.href}
                        className="ml-1.5 whitespace-nowrap font-extrabold text-accent hover:underline"
                      >
                        {destino.texto}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-control border border-border bg-input-alt p-4">
          {/* O canvas nasce em 1181×1772 (300 dpi) e é exibido reduzido: o PNG
              baixado precisa ter a resolução da impressora, não a da tela. */}
          <canvas
            ref={canvasRef}
            width={LARGURA}
            height={ALTURA}
            className="mx-auto block h-auto w-full max-w-[300px] rounded-[6px] shadow-[0_8px_28px_rgba(0,0,0,.45)]"
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
