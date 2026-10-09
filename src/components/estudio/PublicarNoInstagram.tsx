'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Sem ícone de marca: o lucide tirou os logotipos de terceiros na versão 1.
import { Loader2, Send, Settings2, Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import {
  estadoDoInstagramAction,
  publicarPecaAction,
  type EstadoDoInstagram,
  type TipoDePublicacao,
} from '@/app/actions/instagram';
import type { Formato } from '@/lib/estudio/modelos';
import { Dica } from '@/components/ui/Dica';

/** Publicar direto do Estúdio.
 *
 *  Toda a tela existe por causa de um detalhe da API: não dá para
 *  pré-visualizar a publicação montada antes de enviar. O Instagram publica
 *  como foi configurado, e não existe rascunho. Então a confirmação aqui é a
 *  última chance de ver o que vai sair — por isso ela mostra a legenda inteira
 *  e diz, em letras, que depois do envio não há volta pelo sistema. */
export function PublicarNoInstagram({
  pecaId,
  formato,
  slides,
  legenda,
  exportar,
  impedimento,
}: {
  pecaId?: string;
  formato: Formato;
  slides: number;
  legenda: string;
  /** Devolve o slide pedido como JPEG. O Instagram não aceita PNG. */
  exportar: (slide: number) => Promise<Blob | null>;
  /** Por que não dá para publicar agora. Vazio quando dá. */
  impedimento?: string;
}) {
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoDoInstagram | null>(null);
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoDePublicacao>(formato === 'story' ? 'story' : formato === 'carrossel' ? 'carrossel' : 'feed');
  const [enviando, setEnviando] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    void estadoDoInstagramAction().then(setEstado);
  }, []);

  // Capa de destaque não é publicação: é a imagem que fica no círculo do
  // perfil, e sobe pelo aplicativo ao criar o destaque.
  if (formato === 'destaque') return null;

  const tipos: { valor: TipoDePublicacao; rotulo: string }[] =
    formato === 'carrossel'
      ? [
          { valor: 'carrossel', rotulo: `Carrossel (${slides} slides)` },
          { valor: 'feed', rotulo: 'Só o slide 1, no feed' },
          { valor: 'story', rotulo: 'Só o slide 1, no story' },
        ]
      : formato === 'story'
        ? [{ valor: 'story', rotulo: 'Story' }]
        : [
            { valor: 'feed', rotulo: 'Feed' },
            { valor: 'story', rotulo: 'Story' },
          ];

  async function publicar() {
    if (!pecaId || enviando) return;
    setEnviando(true);
    setLink(null);

    try {
      const quantos = tipo === 'carrossel' ? slides : 1;
      const dados = new FormData();
      dados.set('pecaId', pecaId);
      dados.set('tipo', tipo);
      dados.set('legenda', tipo === 'story' ? '' : legenda);

      for (let n = 1; n <= quantos; n++) {
        const blob = await exportar(n);
        if (!blob) {
          toast({ ok: false, message: `Não consegui exportar o slide ${n}.` });
          return;
        }
        dados.append('arquivo', new File([blob], `slide-${n}.jpg`, { type: 'image/jpeg' }));
      }

      const r = await publicarPecaAction(dados);
      toast(r);
      if (r.ok) {
        setAberto(false);
        setLink(r.permalink ?? null);
        setEstado(await estadoDoInstagramAction());
      }
    } finally {
      setEnviando(false);
    }
  }

  if (estado && !estado.configurado) {
    return (
      <div className="mt-3 rounded-control border border-dashed border-border-strong px-4 py-3 text-[12px] leading-relaxed text-fg-tertiary">
        Para publicar daqui, a conta do Instagram precisa estar ligada.{' '}
        <Link href="/admin/estudio/instagram" className="font-bold text-accent hover:underline">
          Ligar a conta
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="mt-3">
      {!aberto ? (
        <>
          <Dica
            texto={
              impedimento
                ? `Ainda não dá para publicar. ${impedimento}`
                : !pecaId
                  ? 'Salve a peça primeiro — é a peça salva que vai para o Instagram.'
                  : 'Abre a confirmação para publicar direto no perfil da loja. Antes de enviar você vê a legenda e escolhe feed, story ou carrossel. Nada sai até você confirmar.'
            }
            className="w-full"
          >
            <button
              onClick={() => setAberto(true)}
              disabled={!pecaId || Boolean(impedimento)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Share2 size={15} />
              Publicar no Instagram
            </button>
          </Dica>
          {/* O motivo fica escrito, e não só no title: botão apagado sem
              explicação faz a pessoa clicar três vezes e desistir. */}
          {impedimento && (
            <div className="mt-1.5 text-center text-[11.5px] text-warning">{impedimento}</div>
          )}
          {!impedimento && !pecaId && (
            <div className="mt-1.5 text-center text-[11.5px] text-fg-muted">
              Salve a peça antes de publicar.
            </div>
          )}
        </>
      ) : (
        <div className="rounded-control border border-border-strong bg-input-alt p-4">
          <div className="mb-3 text-[13px] font-extrabold">Confirmar publicação</div>

          <div className="mb-3">
            <div className="mb-1.5 text-[12px] font-bold text-fg-secondary">Onde</div>
            <div className="flex flex-col gap-1.5">
              {tipos.map((t) => (
                <label key={t.valor} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    checked={tipo === t.valor}
                    onChange={() => setTipo(t.valor)}
                    className="accent-[var(--prog-ouro)]"
                  />
                  {t.rotulo}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 text-[12px] font-bold text-fg-secondary">
              {tipo === 'story' ? 'Legenda' : 'Legenda que vai junto'}
            </div>
            <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-[6px] border border-border bg-input px-3 py-2 text-[12.5px] leading-relaxed text-fg-tertiary">
              {tipo === 'story'
                ? 'Story não leva legenda — o Instagram não aceita texto nesse endpoint.'
                : legenda.trim() || 'Sem legenda. O post vai sair só com a arte.'}
            </div>
          </div>

          <div className="mb-3.5 text-[12px] leading-relaxed text-fg-tertiary">
            A publicação sai na hora e <b className="text-fg-secondary">não dá para desfazer pelo sistema</b> —
            apagar, só pelo aplicativo.
            {estado?.cota !== null && estado?.cota !== undefined && (
              <> Ainda cabem {estado.cota} publicações nas próximas 24 horas.</>
            )}
          </div>

          <div className="flex gap-2">
            <Dica
              texto="Envia agora para o Instagram da loja. Não há como desfazer pelo sistema — para apagar, só pelo aplicativo."
              className="flex-1"
            >
              <button
                onClick={() => void publicar()}
                disabled={enviando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
              >
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {enviando ? 'Publicando…' : 'Publicar agora'}
              </button>
            </Dica>
            <Dica texto="Fecha a confirmação sem publicar nada.">
              <button
                onClick={() => setAberto(false)}
                disabled={enviando}
                className="rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent disabled:opacity-60"
              >
                Cancelar
              </button>
            </Dica>
          </div>
        </div>
      )}

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-[12px] font-bold text-accent hover:underline"
        >
          Ver a publicação no Instagram
        </a>
      )}

      {estado?.configurado && (
        <Link
          href="/admin/estudio/instagram"
          className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-fg-muted hover:text-accent"
        >
          <Settings2 size={12} /> Conta ligada
        </Link>
      )}
    </div>
  );
}
