'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, RotateCcw } from 'lucide-react';
import { mensagemPadrao } from '@/lib/estudio/direct';
import { Dica } from '@/components/ui/Dica';
import type { ProdutoDoEstudio } from '@/lib/estudio/produto';

/** A resposta de quem comentou a palavra-chave.
 *
 *  A peça promete "Comente QUERO" e alguém precisa cumprir. A API faria isso
 *  sozinha, mas depende de App Review — até lá o envio é manual, e manual
 *  falha por cansaço: na décima pessoa, a mensagem já saiu diferente, sem o
 *  link, ou não saiu.
 *
 *  Então a mensagem fica escrita aqui, uma só, com o link certo e o preço do
 *  cadastro. Copiar e colar não é elegante, mas é o que faz as dez chegarem
 *  iguais — e quando o private reply for liberado, o texto já está pronto
 *  para virar automático, porque foi escrito com a regra dele: cabe em uma
 *  mensagem, com o link dentro. */
export function RespostaDoDirect({
  palavraDetectada,
  produto,
  valor,
  onChange,
}: {
  /** A palavra que a arte ou a legenda mandou comentar, quando dá para achar. */
  palavraDetectada: string;
  produto: ProdutoDoEstudio | null;
  valor: string;
  onChange: (v: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  function gerar() {
    onChange(mensagemPadrao({ palavra: palavraDetectada, produto }));
  }

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] font-bold">
          Resposta no direct
          {palavraDetectada && (
            <span className="ml-2 rounded-full border border-ouro/40 px-2 py-0.5 font-mono text-[10px] text-ouro">
              {palavraDetectada}
            </span>
          )}
        </div>
        <Dica
          texto={
            valor.trim()
              ? 'Monta a mensagem de novo, com o link e o preço do produto desta peça. Substitui o texto que está aí — inclusive o que você editou.'
              : 'Monta a mensagem para mandar no direct de quem responder, com o link e o preço do produto desta peça. Não envia nada: só prepara o texto.'
          }
          className="flex-shrink-0"
        >
          <button
            onClick={gerar}
            className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <RotateCcw size={13} />
            {valor.trim() ? 'Refazer' : 'Gerar mensagem'}
          </button>
        </Dica>
      </div>

      <div className="mb-2.5 text-[12px] leading-relaxed text-fg-tertiary">
        {palavraDetectada ? (
          <>
            A peça pede <b className="text-fg-secondary">{palavraDetectada}</b>. Esta é a mensagem
            que você manda para quem responder.
          </>
        ) : (
          <>
            Para quando a peça pedir uma palavra-chave. Escreva{' '}
            <b className="text-fg-secondary">Comente &quot;QUERO&quot;</b> ou{' '}
            <b className="text-fg-secondary">Responda &quot;QUERO&quot;</b> na arte ou na legenda e a
            palavra aparece aqui sozinha.
          </>
        )}{' '}
        Cabe em uma mensagem só, com o link dentro — é a regra da API de resposta automática, e vale
        já para não reescrever depois.
      </div>

      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="Clique em gerar para montar a mensagem com o link do produto."
        className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] leading-relaxed"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Dica
          texto={
            valor.trim()
              ? 'Copia a mensagem para colar no direct de cada pessoa que respondeu. Todo mundo recebe o mesmo texto, com o link certo.'
              : 'Gere a mensagem primeiro — não há nada para copiar ainda.'
          }
        >
          <button
            onClick={() => void copiar()}
            disabled={!valor.trim()}
            className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-[13px] font-extrabold text-page disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copiado ? <Check size={14} /> : <Copy size={14} />}
            {copiado ? 'Copiado' : 'Copiar mensagem'}
          </button>
        </Dica>
        <Dica texto="Abre a caixa de mensagens do Instagram em outra aba, para você colar a resposta. Não envia nada sozinho.">
          <a
            href="https://www.instagram.com/direct/inbox/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <ExternalLink size={13} />
            Abrir o direct
          </a>
        </Dica>
        {!produto && valor.trim() && (
          <span className="text-[11.5px] text-fg-muted">
            Sem produto escolhido, a mensagem não tem link.
          </span>
        )}
      </div>
    </div>
  );
}
