'use client';

import Link from 'next/link';
import { faltaParaEtiqueta, nomeDoArquivo, type Etiqueta } from '@/lib/shipping-label';
import { desenharEtiqueta, LARGURA, ALTURA } from '@/lib/shipping-label-canvas';
import { PngPreviewModal, carregarImagem } from '@/components/admin/PngPreviewModal';

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
  const problemas = faltaParaEtiqueta(etiqueta);

  return (
    <PngPreviewModal
      titulo="Etiqueta de transporte"
      subtitulo={`${etiqueta.pedido} · 10 × 15 cm, o formato que Correios e transportadoras aceitam.`}
      largura={LARGURA}
      altura={ALTURA}
      nomeDoArquivo={nomeDoArquivo(etiqueta.pedido, etiqueta.destinatario.nome)}
      desenhar={async (ctx) => {
        const logo = await carregarImagem('/images/logo.png');
        desenharEtiqueta(ctx, etiqueta, logo);
      }}
      onFechar={onFechar}
      aviso={
        problemas.length > 0 ? (
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
        ) : undefined
      }
    />
  );
}
