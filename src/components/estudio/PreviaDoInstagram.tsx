'use client';

import { useState } from 'react';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import { INSTAGRAM_HANDLE } from '@/lib/constants';
import type { Formato } from '@/lib/estudio/modelos';

// Como a peça fica publicada, no telefone.
//
// Existe por causa de uma limitação da API: não há prévia da publicação
// montada e não há rascunho. O que a API aceita é "publique isto", e pronto.
// Então a única chance de ver o conjunto — arte, legenda cortada, @ em cima,
// pontinhos do carrossel — é montar esse conjunto aqui.
//
// E o que mais engana no Estúdio não é a arte: é o enquadramento em volta
// dela. A arte aparece grande, num retângulo limpo; no telefone ela divide a
// tela com cabeçalho, barra de ações e uma legenda que o Instagram corta em
// duas linhas. Texto que cabia folgado na prévia grande encosta na borda, e a
// quinta linha da legenda — justamente a com a chamada — some atrás do "mais".
//
// Por isso a régua aqui é o telefone, e não o monitor.

/** O corte que o Instagram faz na legenda do feed antes do "mais".
 *
 *  O app corta por altura de linha, não por contagem de caracteres, então não
 *  existe número exato. 125 é o valor que a comunidade de social media usa há
 *  anos e que bate com o corte observado na maioria dos aparelhos — serve para
 *  o que esta tela precisa, que é avisar quando a chamada ficou abaixo da
 *  dobra. */
const CORTE_DA_LEGENDA = 125;

type Tema = 'claro' | 'escuro';

const CORES: Record<Tema, Record<string, string>> = {
  claro: {
    fundo: '#FFFFFF',
    texto: '#000000',
    secundario: '#737373',
    linha: '#DBDBDB',
    elo: '#00376B',
    barra: '#FFFFFF',
  },
  escuro: {
    fundo: '#000000',
    texto: '#FFFFFF',
    secundario: '#A8A8A8',
    linha: '#262626',
    elo: '#E0F1FF',
    barra: '#000000',
  },
};

/** A pilha de fontes do sistema.
 *
 *  O Instagram usa a fonte do aparelho, não uma fonte própria. Deixar a
 *  Archivo do nosso tema vazar para dentro do telefone faria a legenda parecer
 *  mais estreita e mais curta do que vai ser — exatamente o erro que esta tela
 *  serve para evitar. */
const FONTE_DO_SISTEMA =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function PreviaDoInstagram({
  imagem,
  formato,
  slides,
  slideAtual,
  legenda,
  nomeDoDestaque,
}: {
  /** A arte do slide atual, como data URL vinda do canvas. */
  imagem: string | null;
  formato: Formato;
  slides: number;
  slideAtual: number;
  legenda: string;
  nomeDoDestaque?: string;
}) {
  const [tema, setTema] = useState<Tema>('escuro');
  const [aberta, setAberta] = useState(false);
  const cor = CORES[tema];

  return (
    <div className="mt-5 rounded-[18px] border border-border bg-card p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-[13px] font-bold">Como fica publicado</div>
        <div className="flex overflow-hidden rounded-full border border-border-strong">
          {(['escuro', 'claro'] as Tema[]).map((t) => (
            <button
              key={t}
              onClick={() => setTema(t)}
              className={`px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
                tema === t ? 'bg-surface-light text-ink' : 'text-fg-tertiary hover:text-accent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 text-[12px] leading-relaxed text-fg-tertiary">
        No tamanho do telefone, com a legenda cortada como o aplicativo corta. Os dois temas estão
        aqui porque metade de quem te segue usa o escuro — e arte clara some no claro.
      </div>

      <Telefone>
        {formato === 'destaque' ? (
          <Destaque imagem={imagem} nome={nomeDoDestaque} cor={cor} />
        ) : formato === 'story' ? (
          <Story imagem={imagem} />
        ) : (
          <Feed
            imagem={imagem}
            cor={cor}
            legenda={legenda}
            slides={formato === 'carrossel' ? slides : 1}
            slideAtual={slideAtual}
            aberta={aberta}
            abrir={() => setAberta(true)}
          />
        )}
      </Telefone>
    </div>
  );
}

/* ------------------------------------------------------------- o aparelho */

function Telefone({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-[332px] rounded-[42px] bg-[#0A0A0B] p-[9px] shadow-[0_28px_60px_rgba(0,0,0,.55),0_0_0_1px_rgba(255,255,255,.07)]"
      style={{ fontFamily: FONTE_DO_SISTEMA }}
    >
      <div className="relative overflow-hidden rounded-[34px] bg-black">{children}</div>
    </div>
  );
}

/** A barra do sistema operacional.
 *
 *  9:41 não é capricho: é a hora que a Apple usa em todo material de imprensa
 *  desde 2007, e por isso é a hora que não distrai quem olha a imagem. */
function BarraDoSistema({ cor, sobreImagem = false }: { cor?: Record<string, string>; sobreImagem?: boolean }) {
  const tinta = sobreImagem ? '#FFFFFF' : (cor?.texto ?? '#000');
  return (
    <div
      className="flex h-[38px] items-center justify-between px-6 text-[13px] font-semibold"
      style={{ color: tinta }}
    >
      <span className="tracking-[-.01em]">9:41</span>
      <div className="flex items-center gap-[5px]">
        {/* Sinal, wifi e bateria desenhados à mão: o traço de biblioteca de
            ícones é mais grosso que o do sistema e entrega o desenho. */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill={tinta} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 4.4} y={8 - i * 2.4} width="3" height={3 + i * 2.4} rx="1" opacity={i === 3 ? 0.35 : 1} />
          ))}
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke={tinta} strokeWidth="1.5" aria-hidden>
          <path d="M1 3.6a10.5 10.5 0 0 1 14 0M3.6 6.3a6.8 6.8 0 0 1 8.8 0" strokeLinecap="round" />
          <circle cx="8" cy="9.2" r="1.1" fill={tinta} stroke="none" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden>
          <rect x=".6" y=".6" width="21" height="10.8" rx="3.2" stroke={tinta} strokeOpacity=".4" />
          <rect x="2.2" y="2.2" width="14" height="7.6" rx="2" fill={tinta} />
          <path d="M23.2 4.2v3.6a2 2 0 0 0 0-3.6Z" fill={tinta} fillOpacity=".45" />
        </svg>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- o feed */

function Feed({
  imagem,
  cor,
  legenda,
  slides,
  slideAtual,
  aberta,
  abrir,
}: {
  imagem: string | null;
  cor: Record<string, string>;
  legenda: string;
  slides: number;
  slideAtual: number;
  aberta: boolean;
  abrir: () => void;
}) {
  const texto = legenda.trim();
  const cortada = !aberta && texto.length > CORTE_DA_LEGENDA;
  const visivel = cortada ? texto.slice(0, CORTE_DA_LEGENDA).trimEnd() : texto;

  return (
    <div style={{ background: cor.fundo, color: cor.texto }}>
      <BarraDoSistema cor={cor} />

      <div className="flex items-center gap-2.5 px-3 py-2">
        <Avatar />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight">{INSTAGRAM_HANDLE}</div>
        </div>
        <div className="flex flex-col gap-[3px] pr-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-[3px] w-[3px] rounded-full" style={{ background: cor.texto }} />
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ aspectRatio: '4 / 5', background: '#111' }}>
        {imagem ? (
          // Imagem comum, e não next/image: a fonte é um data URL gerado no
          // navegador a cada tecla digitada — não há o que otimizar no servidor.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagem} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-[12px] text-white/40">desenhando…</div>
        )}

        {slides > 1 && (
          <div className="absolute right-2.5 top-2.5 rounded-full bg-black/55 px-2 py-[3px] text-[11px] font-semibold text-white backdrop-blur-sm">
            {slideAtual}/{slides}
          </div>
        )}
      </div>

      <div className="relative flex items-center px-3 pb-1.5 pt-2.5">
        <div className="flex items-center gap-3.5">
          <Heart size={23} strokeWidth={1.6} />
          <MessageCircle size={23} strokeWidth={1.6} style={{ transform: 'scaleX(-1)' }} />
          <Send size={22} strokeWidth={1.6} style={{ transform: 'rotate(10deg) translateY(-1px)' }} />
        </div>

        {slides > 1 && (
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-[5px]">
            {Array.from({ length: slides }, (_, i) => i + 1).map((n) => (
              <span
                key={n}
                className="block h-[5px] w-[5px] rounded-full transition-colors"
                style={{ background: n === slideAtual ? '#0095F6' : cor.secundario, opacity: n === slideAtual ? 1 : 0.4 }}
              />
            ))}
          </div>
        )}

        <div className="ml-auto">
          <Bookmark size={23} strokeWidth={1.6} />
        </div>
      </div>

      <div className="px-3 pb-3.5">
        {/* Sem número de curtidas inventado: um post que ainda não existe tem
            zero, e é exatamente isto que o aplicativo escreve. */}
        <div className="mb-1 text-[13px]">
          <span className="font-semibold">Seja o primeiro a curtir isto.</span>
        </div>

        <div className="text-[13px] leading-[1.35]">
          <span className="font-semibold">{INSTAGRAM_HANDLE}</span>{' '}
          {visivel ? (
            <Legenda texto={visivel} cor={cor} />
          ) : (
            <span style={{ color: cor.secundario }}>sem legenda</span>
          )}
          {cortada && (
            <>
              …{' '}
              <button onClick={abrir} style={{ color: cor.secundario }} className="text-[13px]">
                mais
              </button>
            </>
          )}
        </div>

        <div className="mt-1.5 text-[11px] uppercase tracking-[.01em]" style={{ color: cor.secundario }}>
          agora
        </div>
      </div>
    </div>
  );
}

/** A legenda com as hashtags e os @ em azul, como o aplicativo pinta. */
function Legenda({ texto, cor }: { texto: string; cor: Record<string, string> }) {
  const pedacos = texto.split(/([#@][\p{L}\p{N}_.]+)/gu);
  return (
    <span className="whitespace-pre-wrap">
      {pedacos.map((p, i) =>
        /^[#@]/.test(p) ? (
          <span key={i} style={{ color: cor.elo }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- o story */

function Story({ imagem }: { imagem: string | null }) {
  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '9 / 16' }}>
      {imagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagem} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-[12px] text-white/40">desenhando…</div>
      )}

      {/* Véu em cima e embaixo: o aplicativo põe esse degradê para a barra e o
          campo de mensagem lerem sobre qualquer imagem. Sem ele, a prévia
          mente a favor da arte. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />

      <div className="absolute inset-x-0 top-0">
        <BarraDoSistema sobreImagem />
        <div className="flex gap-1 px-3 pt-0.5">
          <span className="h-[2.5px] flex-1 rounded-full bg-white" />
        </div>
        <div className="flex items-center gap-2.5 px-3 pt-2.5">
          <Avatar tamanho={28} semAnel />
          <span className="text-[13px] font-semibold text-white">{INSTAGRAM_HANDLE}</span>
          <span className="text-[13px] text-white/70">agora</span>
          <div className="ml-auto flex items-center gap-3 pr-0.5">
            <svg width="15" height="15" viewBox="0 0 15 15" stroke="#fff" strokeWidth="1.6" aria-hidden>
              <path d="M1.5 1.5l12 12M13.5 1.5l-12 12" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 px-3 pb-4">
        <div className="flex-1 rounded-full border border-white/55 px-3.5 py-2 text-[12.5px] text-white/85">
          Enviar mensagem
        </div>
        <Heart size={21} strokeWidth={1.7} className="text-white" />
        <Send size={21} strokeWidth={1.7} className="text-white" style={{ transform: 'rotate(10deg)' }} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- o destaque */

/** Capa de destaque não é publicação — é o disco que fica no alto do perfil.
 *
 *  Mostrar o 1080×1920 inteiro aqui enganaria: do desenho todo, o que o
 *  visitante vê é um círculo de uns 60 pixels. A prévia é esse círculo, no
 *  tamanho em que ele existe. */
function Destaque({
  imagem,
  nome,
  cor,
}: {
  imagem: string | null;
  nome?: string;
  cor: Record<string, string>;
}) {
  const rotulo = (nome || 'Destaque').slice(0, 15);
  const outros = ['Pronta entrega', 'Encomende', 'Garantia'];

  return (
    <div style={{ background: cor.fundo, color: cor.texto }}>
      <BarraDoSistema cor={cor} />
      <div className="px-4 pb-3 pt-1">
        <div className="mb-4 flex items-center gap-2.5">
          <Avatar tamanho={56} semAnel />
          <div className="text-[14px] font-semibold">{INSTAGRAM_HANDLE}</div>
        </div>

        <div className="flex gap-4 overflow-hidden pb-2">
          <div className="flex w-[68px] flex-shrink-0 flex-col items-center gap-1.5">
            <div
              className="h-[64px] w-[64px] rounded-full border-[1.5px] p-[2.5px]"
              style={{ borderColor: cor.linha }}
            >
              <div
                className="h-full w-full rounded-full bg-black bg-center"
                // `100% auto` e não `cover`: a arte é 1080×1920 e o disco mora
                // no quadrado central. Com `cover`, o círculo pegaria uma
                // faixa estreita do meio e mostraria outra coisa.
                style={
                  imagem
                    ? { backgroundImage: `url(${imagem})`, backgroundSize: '100% auto', backgroundPosition: 'center' }
                    : undefined
                }
              />
            </div>
            <div className="w-full truncate text-center text-[11px]">{rotulo}</div>
          </div>

          {outros.map((o) => (
            <div key={o} className="flex w-[68px] flex-shrink-0 flex-col items-center gap-1.5 opacity-30">
              <div className="h-[64px] w-[64px] rounded-full border-[1.5px]" style={{ borderColor: cor.linha }} />
              <div className="w-full truncate text-center text-[11px]">{o}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t pt-3 text-[11.5px] leading-relaxed" style={{ borderColor: cor.linha, color: cor.secundario }}>
          Capa de destaque não vai pela API: ela sobe pelo aplicativo, ao criar o destaque. O que
          importa aqui é o disco caber — no perfil ele tem 64 pixels.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- o avatar */

function Avatar({ tamanho = 32, semAnel = false }: { tamanho?: number; semAnel?: boolean }) {
  const conteudo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/marca/icone.png"
      alt=""
      className="h-full w-full rounded-full bg-black object-cover"
    />
  );

  if (semAnel) {
    return (
      <div style={{ width: tamanho, height: tamanho }} className="flex-shrink-0">
        {conteudo}
      </div>
    );
  }

  return (
    <div
      style={{ width: tamanho, height: tamanho, background: 'linear-gradient(45deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5)' }}
      className="flex-shrink-0 rounded-full p-[2px]"
    >
      <div className="h-full w-full rounded-full bg-black p-[1.5px]">{conteudo}</div>
    </div>
  );
}
