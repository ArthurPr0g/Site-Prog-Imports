'use client';

import { useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { Ilustracao } from '@/lib/estudio/ilustracao';
import { Dica } from '@/components/ui/Dica';

/** Foto de fora, para quando a loja não tem a imagem.
 *
 *  O catálogo vem primeiro em toda peça que tem máquina. Isto é o degrau
 *  seguinte: notícia de lançamento fala de aparelho que a loja ainda não
 *  vende, e não existe foto nossa de algo anunciado ontem.
 *
 *  A licença aparece em cada miniatura, não escondida num rodapé. CC BY e CC
 *  BY-SA — as duas mais comuns no que sobra depois do filtro — **exigem
 *  crédito na publicação**, e crédito que o dono não vê é crédito que não vai
 *  junto. Por isso ele é mostrado antes da escolha e entra na legenda depois
 *  dela. */
export function SeletorDeIlustracao({
  termoSugerido,
  valor,
  credito,
  inicial,
  onEscolher,
}: {
  /** O que a peça diz, virado em termo de busca. */
  termoSugerido: string;
  /** Resultado de uma busca já feita — a cadeia de geração a dispara quando o
   *  catálogo não tem a máquina. Quem monta este componente troca a key para
   *  ele nascer aberto, em vez de um efeito mandar abrir. */
  inicial?: { termo: string; lista: Ilustracao[] };
  valor: string;
  credito: string;
  onEscolher: (url: string, credito: string) => void;
}) {
  const toast = useToast();
  const [aberto, setAberto] = useState(Boolean(inicial));
  const [termo, setTermo] = useState(inicial?.termo ?? '');
  const [buscando, setBuscando] = useState(false);
  const [adotando, setAdotando] = useState<string | null>(null);
  const [achadas, setAchadas] = useState<Ilustracao[] | null>(inicial?.lista ?? null);

  async function buscar() {
    const q = (termo.trim() || termoSugerido).trim();
    if (q.length < 2 || buscando) return;
    setTermo(q);
    setBuscando(true);
    try {
      const r = await fetch(`/api/estudio/ilustrar?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (!r.ok) {
        toast({ ok: false, message: d?.erro ?? 'Não consegui buscar agora.' });
        return;
      }
      setAchadas(d.ilustracoes ?? []);
    } catch {
      toast({ ok: false, message: 'Não consegui falar com o servidor.' });
    } finally {
      setBuscando(false);
    }
  }

  async function adotar(i: Ilustracao) {
    if (adotando) return;
    setAdotando(i.id);
    try {
      const r = await fetch('/api/estudio/ilustrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: i.url, credito: i.credito }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ ok: false, message: d?.erro ?? 'Não consegui usar essa imagem.' });
        return;
      }
      onEscolher(d.url, d.credito);
      setAberto(false);
      toast({ ok: true, message: 'Imagem copiada para o nosso storage, com o crédito.' });
    } catch {
      toast({ ok: false, message: 'Não consegui falar com o servidor.' });
    } finally {
      setAdotando(null);
    }
  }

  return (
    <div>
      {valor && (
        <div className="mb-2.5 flex items-start gap-3 rounded-control border border-border-strong bg-input-alt p-2.5">
          {/* Imagem comum: é uma URL do nosso storage escolhida em tempo de
              edição, e não um asset do build que o otimizador conheça. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valor} alt="" className="h-16 w-24 flex-shrink-0 rounded-[6px] object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-fg-secondary">Imagem escolhida</div>
            <div className="truncate text-[11.5px] text-fg-tertiary">{credito || 'Sem crédito registrado'}</div>
          </div>
          <button
            onClick={() => onEscolher('', '')}
            aria-label="Remover imagem"
            className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border border-border-strong text-fg-muted hover:border-error hover:text-error"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {!aberto ? (
        <Dica texto="Procura fotos em um acervo aberto, só com licença que permite uso comercial e acima de 1080px. A que você escolher é copiada para o nosso storage e o crédito do autor entra na legenda sozinho.">
          <button
            onClick={() => {
              setAberto(true);
              if (!achadas) void buscar();
            }}
            className="inline-flex items-center gap-2 rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <Search size={14} />
            {valor ? 'Trocar a imagem' : 'Buscar imagem licenciada'}
          </button>
        </Dica>
      ) : (
        <div className="rounded-control border border-border-strong bg-input-alt p-3.5">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void buscar();
                }
              }}
              placeholder={termoSugerido || 'gaming laptop'}
              className="w-full rounded-control border border-border-strong bg-input px-3 py-2 text-[13px]"
            />
            <button
              onClick={() => void buscar()}
              disabled={buscando}
              className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-control bg-surface-light px-4 py-2 text-[12.5px] font-extrabold text-ink disabled:opacity-50"
            >
              {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>
            <button
              onClick={() => setAberto(false)}
              className="rounded-control border border-border-strong px-3 py-2 text-[12.5px] font-extrabold text-fg-secondary"
            >
              Fechar
            </button>
          </div>

          <div className="mb-2.5 text-[11.5px] leading-relaxed text-fg-muted">
            Só fotos com licença que permite uso comercial e alteração, e acima de 1080px. A busca
            funciona melhor em inglês — o acervo é catalogado assim.
          </div>

          {buscando && !achadas && (
            <div className="py-8 text-center text-[12.5px] text-fg-tertiary">Procurando…</div>
          )}

          {achadas?.length === 0 && (
            <div className="py-6 text-center text-[12.5px] leading-relaxed text-fg-tertiary">
              Nada licenciado para uso comercial nesse termo, nesse tamanho. Tente em inglês, ou mais
              genérico — &quot;gaming laptop&quot; acha o que &quot;Legion 9i 2026&quot; não acha.
            </div>
          )}

          {achadas && achadas.length > 0 && (
            <div className="grid max-h-[420px] grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-3">
              {achadas.map((i) => (
                <button
                  key={i.id}
                  onClick={() => void adotar(i)}
                  disabled={Boolean(adotando)}
                  className="group overflow-hidden rounded-[8px] border border-border text-left transition-colors hover:border-accent disabled:opacity-50"
                >
                  <div className="relative aspect-[4/3] bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.miniatura} alt="" className="h-full w-full object-cover" loading="lazy" />
                    {adotando === i.id && (
                      <div className="absolute inset-0 grid place-items-center bg-black/60">
                        <Loader2 size={18} className="animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="truncate text-[11px] font-bold text-fg-secondary">{i.titulo}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-ouro">
                      <Check size={10} /> {i.licenca}
                    </div>
                    <div className="truncate text-[10px] text-fg-muted">
                      {i.autor || 'autor não identificado'} · {i.largura}×{i.altura}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
