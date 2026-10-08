'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { atualizarAssuntosAction, mudarStatusDoAssuntoAction } from '@/app/actions/assuntos';

export type AssuntoNaPauta = {
  id: string;
  titulo: string;
  resumo: string;
  fonte: string;
  url: string;
  publicado_em: string | null;
  relevancia: number;
  marcas: string[];
};

/** Os modelos que mais servem a uma notícia.
 *
 *  Não são todos de propósito: a lista inteira transformaria cada linha da
 *  pauta num formulário. Notícia vira capa de Reels, carrossel de explicação,
 *  story ou post de oferta — os outros modelos existem para outras ocasiões. */
const MODELOS = [
  { codigo: '4a', rotulo: 'Carrossel' },
  { codigo: '3e', rotulo: 'Capa de Reels' },
  { codigo: '5a', rotulo: 'Story' },
  { codigo: '3c', rotulo: 'Oferta' },
];

function quando(iso: string | null): string {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `${dias} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function PautaDeAssuntos({ assuntos }: { assuntos: AssuntoNaPauta[] }) {
  const toast = useToast();
  const [buscando, setBuscando] = useState(false);
  const [modelo, setModelo] = useState<Record<string, string>>({});
  const [saindo, setSaindo] = useState<Record<string, boolean>>({});

  async function atualizar() {
    setBuscando(true);
    toast(await atualizarAssuntosAction());
    setBuscando(false);
  }

  async function descartar(id: string) {
    setSaindo((s) => ({ ...s, [id]: true }));
    const r = await mudarStatusDoAssuntoAction(id, 'descartado');
    if (!r.ok) {
      setSaindo((s) => ({ ...s, [id]: false }));
      toast(r);
    }
  }

  return (
    <div className="mb-7 rounded-card-lg border border-border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-[17px] font-extrabold">Pauta</div>
          <div className="text-[13px] text-fg-tertiary">
            Lançamentos e notícias das publicações do setor, filtrados pelo que a loja vende. Você lê
            e manda produzir o que interessar.
          </div>
        </div>
        <button
          onClick={() => void atualizar()}
          disabled={buscando}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-control bg-surface-light px-4 py-2.5 text-[13px] font-extrabold text-ink transition-all hover:bg-surface-light-alt disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buscando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Atualizar assuntos
        </button>
      </div>

      {assuntos.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center text-[13px] text-fg-tertiary">
          A pauta está vazia. Clique em atualizar para buscar o que saiu hoje.
        </div>
      ) : (
        <div className="flex flex-col">
          {assuntos.map((a) => (
            <div
              key={a.id}
              className={`flex flex-col gap-2.5 border-b border-divider py-4 transition-opacity last:border-0 ${
                saindo[a.id] ? 'pointer-events-none opacity-30' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[14px] font-extrabold leading-snug hover:text-ouro"
                  >
                    {a.titulo}
                  </a>
                  <div className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-fg-tertiary">
                    {a.resumo}
                  </div>
                  <div className="etiqueta mt-2 flex flex-wrap items-center gap-2 text-[9px] text-fg-muted">
                    <span className="text-fg-tertiary">{a.fonte}</span>
                    {a.publicado_em && <span>{quando(a.publicado_em)}</span>}
                    {a.marcas.slice(0, 4).map((m) => (
                      <span key={m} className="rounded-full border border-border-strong px-1.5 py-0.5">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => void descartar(a.id)}
                  aria-label="Descartar assunto"
                  title="Descartar"
                  className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-border-strong text-fg-muted transition-colors hover:border-error hover:text-error"
                >
                  <X size={14} />
                </button>
              </div>

              {/* O assunto viaja na URL para o editor, onde o botão de escrever
                  já encontra o campo preenchido. É o caminho inteiro: li a
                  notícia, escolhi o formato, a peça chega escrita. */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={modelo[a.id] ?? MODELOS[0].codigo}
                  onChange={(e) => setModelo((m) => ({ ...m, [a.id]: e.target.value }))}
                  className="rounded-control border border-border-strong bg-input px-2.5 py-1.5 text-[12px]"
                >
                  {MODELOS.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.rotulo}
                    </option>
                  ))}
                </select>
                <Link
                  href={`/admin/estudio/nova?modelo=${modelo[a.id] ?? MODELOS[0].codigo}&assunto=${encodeURIComponent(a.titulo)}`}
                  onClick={() => void mudarStatusDoAssuntoAction(a.id, 'produzido')}
                  className="rounded-control border border-ouro/40 px-3.5 py-1.5 text-[12px] font-extrabold text-ouro transition-colors hover:bg-ouro hover:text-ink"
                >
                  Produzir
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
