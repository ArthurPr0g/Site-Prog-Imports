'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, RefreshCw, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { atualizarAssuntosAction, mudarStatusDoAssuntoAction } from '@/app/actions/assuntos';

export type AssuntoNaPauta = {
  id: string;
  titulo: string;
  resumo: string;
  /** A tradução, quando já foi feita. Nula enquanto não — e aí a tela cai no
   *  original em vez de mostrar linha vazia. */
  titulo_pt: string | null;
  resumo_pt: string | null;
  fonte: string;
  url: string;
  publicado_em: string | null;
  relevancia: number;
  marcas: string[];
};

/** Onde fica a escolha de deixar a pauta recolhida.
 *
 *  Conveniência de quem está olhando, então vive no navegador dele e não no
 *  banco: é preferência de tela, não dado da loja. */
const CHAVE_DA_DOBRA = 'prog.estudio.pauta.aberta';

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
  const router = useRouter();
  const [buscando, setBuscando] = useState(false);
  const [traduzindo, setTraduzindo] = useState(false);
  const [modelo, setModelo] = useState<Record<string, string>>({});
  const [saindo, setSaindo] = useState<Record<string, boolean>>({});

  // Fechada por padrão: a pauta é consulta eventual, e vinte notícias abertas
  // empurram as peças e os modelos para fora da tela em toda visita.
  const [aberta, setAberta] = useState(false);

  // Lida depois da primeira pintura, e não no estado inicial: o servidor não
  // tem localStorage, e ler ali faria o HTML do servidor e o do navegador
  // discordarem.
  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE_DA_DOBRA) === '1') setAberta(true);
    } catch {
      // Janela anônima ou armazenamento bloqueado: fica fechada, que é o padrão.
    }
  }, []);

  /** Abre e fecha, e lembra.
   *
   *  O valor novo é calculado fora do `setAberta`. Dentro, não: o React pode
   *  chamar o atualizador mais de uma vez para a mesma interação, e com a
   *  gravação lá dentro era isso que acontecia — dois cliques pelo preço de
   *  um, a seção abria e fechava no mesmo instante e o navegador guardava
   *  "fechada". Atualizador existe para calcular estado, não para ter
   *  efeito. */
  function dobrar() {
    const proxima = !aberta;
    setAberta(proxima);
    try {
      localStorage.setItem(CHAVE_DA_DOBRA, proxima ? '1' : '0');
    } catch {
      // Não poder lembrar não impede abrir agora.
    }
  }

  /** Traduz em lotes, até a janela visível estar em português.
   *
   *  O laço tem teto: a rota devolve quantos faltam, mas confiar só nisso
   *  deixaria a tela girando para sempre se algum lote falhasse em silêncio
   *  e o número não baixasse. */
  async function traduzir() {
    for (let volta = 0; volta < 4; volta++) {
      setTraduzindo(true);
      try {
        const r = await fetch('/api/estudio/traduzir', { method: 'POST' });
        const d = await r.json();
        if (!r.ok) {
          toast({ ok: false, message: d?.erro ?? 'Não consegui traduzir a pauta.' });
          return;
        }
        router.refresh();
        if (!d.restantes) return;
      } catch {
        toast({ ok: false, message: 'Não consegui falar com o servidor para traduzir.' });
        return;
      } finally {
        setTraduzindo(false);
      }
    }
  }

  async function atualizar() {
    setBuscando(true);
    const r = await atualizarAssuntosAction();
    toast(r);
    setBuscando(false);
    // Buscar e não poder ver o que chegou seria estranho.
    if (r.ok && !aberta) dobrar();
    if (r.ok) await traduzir();
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
      <div className={`flex flex-wrap items-start justify-between gap-3 ${aberta ? 'mb-4' : ''}`}>
        <button
          onClick={dobrar}
          aria-expanded={aberta}
          className="group flex min-w-0 items-start gap-2.5 text-left"
        >
          <ChevronDown
            size={18}
            className={`mt-0.5 flex-shrink-0 text-fg-tertiary transition-transform group-hover:text-accent ${
              aberta ? '' : '-rotate-90'
            }`}
          />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-[17px] font-extrabold group-hover:text-accent">Pauta</span>
              {assuntos.length > 0 && (
                <span className="etiqueta rounded-full border border-border-strong px-2 py-0.5 text-[9px] text-fg-tertiary">
                  {assuntos.length} {assuntos.length === 1 ? 'assunto' : 'assuntos'}
                </span>
              )}
            </div>
            <div className="text-[13px] text-fg-tertiary">
              {aberta
                ? 'Lançamentos e notícias das publicações do setor, filtrados pelo que a loja vende. Você lê e manda produzir o que interessar.'
                : 'Lançamentos e notícias do setor. Clique para abrir.'}
            </div>
          </div>
        </button>
        <button
          onClick={() => void atualizar()}
          disabled={buscando || traduzindo}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-control bg-surface-light px-4 py-2.5 text-[13px] font-extrabold text-ink transition-all hover:bg-surface-light-alt disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buscando || traduzindo ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          {traduzindo ? 'Traduzindo…' : 'Atualizar assuntos'}
        </button>
      </div>

      {!aberta ? null : assuntos.length === 0 ? (
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
                    // O original no título do link: a matéria que abre está em
                    // inglês, e saber que manchete esperar evita o susto.
                    title={a.titulo_pt ? a.titulo : undefined}
                  >
                    {a.titulo_pt || a.titulo}
                  </a>
                  <div className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-fg-tertiary">
                    {a.resumo_pt || a.resumo}
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
                  // O título em português vai para o editor: a peça é escrita
                  // em português, e mandar a manchete em inglês faria o
                  // redator traduzir de novo, com outra escolha de palavras.
                  href={`/admin/estudio/nova?modelo=${modelo[a.id] ?? MODELOS[0].codigo}&assunto=${encodeURIComponent(a.titulo_pt || a.titulo)}`}
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
