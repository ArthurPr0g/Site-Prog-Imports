'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Loader2, Newspaper, Search, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { Ilustracao } from '@/lib/estudio/ilustracao';
import type { ImagemDaMateria } from '@/lib/estudio/materia';
import { Dica } from '@/components/ui/Dica';

/** Imagem de fora, para quando a loja não tem a foto.
 *
 *  O catálogo vem primeiro em toda peça que tem máquina. Isto é o degrau
 *  seguinte: notícia de lançamento fala de aparelho que a loja ainda não vende,
 *  e não existe foto nossa de algo anunciado ontem.
 *
 *  Duas origens, com direitos diferentes, e a tela não deixa confundir.
 *
 *  **Da matéria**: as imagens da notícia que a pauta trouxe — fotos de imprensa
 *  do fabricante, no tamanho certo, escolhidas por quem cobriu o lançamento. São
 *  as que melhor contam a notícia, e **não têm licença aberta**: pertencem ao
 *  veículo ou ao fabricante. Aparecem primeiro porque servem melhor, e marcadas
 *  porque o risco é de quem publica.
 *
 *  **Acervo licenciado**: fotos com licença que permite uso comercial. CC BY e CC
 *  BY-SA exigem crédito, e o crédito entra na legenda depois da escolha. */
export function SeletorDeIlustracao({
  termoSugerido,
  valor,
  credito,
  inicial,
  noticiaId,
  fonte,
  onEscolher,
}: {
  /** O que a peça diz, virado em termo de busca. */
  termoSugerido: string;
  /** Resultado de uma busca já feita — a cadeia de geração a dispara quando o
   *  catálogo não tem a máquina. Quem monta este componente troca a key para
   *  ele nascer aberto, em vez de um efeito mandar abrir. */
  inicial?: { termo: string; lista: Ilustracao[]; pedido?: string; materia?: ImagemDaMateria[] };
  /** A notícia da pauta que originou a peça. Sem ela não há "da matéria". */
  noticiaId?: string;
  /** O veículo da notícia — vira o crédito das imagens da matéria. */
  fonte?: string;
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
  // Quando a busca recuou para um termo mais curto, o termo pedido fica aqui
  // para a tela dizer o que está mostrando em vez de fingir que achou o pedido.
  const [pedido, setPedido] = useState<string | null>(inicial?.pedido ?? null);

  const [materia, setMateria] = useState<ImagemDaMateria[] | null>(inicial?.materia ?? null);
  const [carregandoMateria, setCarregandoMateria] = useState(false);
  const [erroMateria, setErroMateria] = useState<string | null>(null);

  async function verMateria() {
    if (!noticiaId || carregandoMateria) return;
    setCarregandoMateria(true);
    setErroMateria(null);
    try {
      const r = await fetch(`/api/estudio/materia?noticia=${encodeURIComponent(noticiaId)}`);
      const d = await r.json();
      if (!r.ok) {
        setErroMateria(d?.erro ?? 'Não consegui abrir a matéria.');
        return;
      }
      setMateria(d.imagens ?? []);
    } catch {
      setErroMateria('Não consegui falar com o servidor.');
    } finally {
      setCarregandoMateria(false);
    }
  }

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
      setPedido(d.termoUsado && d.termoUsado !== q ? q : null);
      if (d.termoUsado) setTermo(d.termoUsado);
    } catch {
      toast({ ok: false, message: 'Não consegui falar com o servidor.' });
    } finally {
      setBuscando(false);
    }
  }

  /** Copia a imagem para o nosso storage e a entrega à peça. */
  async function adotar(id: string, url: string, creditoDaImagem: string, daMateria: boolean) {
    if (adotando) return;
    setAdotando(id);
    try {
      const r = await fetch('/api/estudio/ilustrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, credito: creditoDaImagem, ...(daMateria ? { noticia: noticiaId } : {}) }),
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

  const creditoDaMateria = `Imagem: ${fonte?.trim() || 'matéria original'}`;

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
        <div className="flex flex-wrap gap-2">
          {noticiaId && (
            <Dica texto="Mostra as imagens da própria matéria da notícia — em geral fotos de imprensa do fabricante, as que melhor contam o assunto. Atenção: não têm licença aberta, pertencem ao veículo ou ao fabricante, e o crédito entra na legenda.">
              <button
                onClick={() => {
                  setAberto(true);
                  if (!materia) void verMateria();
                }}
                className="inline-flex items-center gap-2 rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent"
              >
                <Newspaper size={14} />
                Imagens da matéria
              </button>
            </Dica>
          )}
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
        </div>
      ) : (
        <div className="rounded-control border border-border-strong bg-input-alt p-3.5">
          <div className="mb-3 flex justify-end">
            <button
              onClick={() => setAberto(false)}
              className="rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-extrabold text-fg-secondary"
            >
              Fechar
            </button>
          </div>

          {/* ------------------------------------------------ da matéria */}
          {noticiaId && (
            <section className="mb-4 border-b border-divider pb-4">
              <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-bold">
                <Newspaper size={13} /> Da matéria
                {fonte && <span className="etiqueta text-[9px] text-fg-muted">{fonte}</span>}
              </div>

              <div className="mb-2.5 flex items-start gap-2 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-[11.5px] leading-relaxed text-warning">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                <span>
                  Estas imagens pertencem ao veículo ou ao fabricante e <b>não têm licença aberta</b>.
                  O crédito vai na legenda, mas isso não é autorização — publicar num perfil comercial
                  pode gerar notificação de direitos autorais e derrubada do post. O risco é da loja.
                </span>
              </div>

              {materia === null && !erroMateria && (
                <button
                  onClick={() => void verMateria()}
                  disabled={carregandoMateria}
                  className="inline-flex items-center gap-2 rounded-control bg-surface-light px-4 py-2 text-[12.5px] font-extrabold text-ink disabled:opacity-50"
                >
                  {carregandoMateria ? <Loader2 size={14} className="animate-spin" /> : <Newspaper size={14} />}
                  {carregandoMateria ? 'Abrindo a matéria…' : 'Ver as imagens da matéria'}
                </button>
              )}

              {erroMateria && (
                <div className="rounded-control border border-border-strong px-3 py-2.5 text-[12px] leading-relaxed text-fg-tertiary">
                  {erroMateria}{' '}
                  <button onClick={() => void verMateria()} className="font-bold text-accent hover:underline">
                    Tentar de novo
                  </button>
                </div>
              )}

              {materia?.length === 0 && (
                <div className="rounded-control border border-dashed border-border-strong px-3 py-4 text-center text-[12px] text-fg-tertiary">
                  A matéria não tem imagem que sirva a um post. Use o acervo licenciado abaixo.
                </div>
              )}

              {materia && materia.length > 0 && (
                <div className="grid max-h-[360px] grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-3">
                  {materia.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => void adotar(i.id, i.url, creditoDaMateria, true)}
                      disabled={Boolean(adotando)}
                      className="group overflow-hidden rounded-[8px] border border-border text-left transition-colors hover:border-accent disabled:opacity-50"
                    >
                      <div className="relative aspect-[4/3] bg-black">
                        {/* O navegador busca a miniatura direto no servidor do
                            veículo; sem referrer, para não ser barrado por
                            proteção contra uso em outros sites. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={i.url}
                          alt={i.alt}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {adotando === i.id && (
                          <div className="absolute inset-0 grid place-items-center bg-black/60">
                            <Loader2 size={18} className="animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="flex items-center gap-1 text-[10px] text-warning">
                          <AlertTriangle size={10} />
                          {i.origem === 'principal' ? 'Imagem principal da matéria' : 'Do corpo da matéria'}
                        </div>
                        <div className="truncate text-[10px] text-fg-muted">{i.alt || 'sem legenda'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ------------------------------------------ acervo licenciado */}
          <section>
            <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-bold">
              <Search size={13} /> Acervo licenciado
            </div>

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

            {pedido && achadas && achadas.length > 0 && (
              <div className="mb-2.5 rounded-control border border-border-strong px-3 py-2 text-[11.5px] leading-relaxed text-fg-tertiary">
                Nada licenciado para <b className="text-fg-secondary">“{pedido}”</b> — provavelmente é
                um aparelho novo demais. Mostrando <b className="text-fg-secondary">“{termo}”</b>, que é
                a máquina mais próxima: confira se a foto serve à notícia antes de usar.
              </div>
            )}

            {achadas && achadas.length > 0 && (
              <div className="grid max-h-[360px] grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-3">
                {achadas.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => void adotar(i.id, i.url, i.credito, false)}
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
          </section>
        </div>
      )}
    </div>
  );
}
