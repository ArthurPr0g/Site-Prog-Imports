'use client';

import { useId } from 'react';
import { HERO_COLORS as C } from './scene-engine';

/** A encomenda que atravessa o banner "Da compra à entrega".
 *
 *  Era um quadrado arredondado com duas barras douradas cruzadas no meio. A
 *  silhueta disso não é de caixa: quadrado com cruz centralizada é kit de
 *  primeiros socorros, e num ícone de 50px o cliente lê a silhueta antes de
 *  qualquer outra coisa — a leitura errada acontece antes de ele ter chance de
 *  interpretar o resto.
 *
 *  O que faz ler como encomenda são três coisas, nesta ordem de importância:
 *
 *  1. **Volume.** Três faces em valores diferentes dão profundidade sem
 *     precisar de nenhum detalhe. É o que separa "caixa" de "quadrado".
 *  2. **A fita atravessa a quina.** Numa caixa real a fita sela a emenda das
 *     abas e desce pela frente; ela não para na borda da face de cima. Fita que
 *     morre na quina denuncia desenho plano.
 *  3. **Sombra de contato.** Sem ela a caixa flutua, e o banner inteiro é sobre
 *     uma encomenda viajando — ela precisa ter peso quando pousa.
 *
 *  A fita é o único ouro da peça, o que mantém a regra do playbook de pouco
 *  ouro por composição, e sai dos mesmos tokens da marca: trocar a cor da
 *  identidade troca a fita junto. */
export function Pacote({ lado }: { lado: number }) {
  // Os `id` do SVG são globais ao documento. O banner de desktop e o de celular
  // ficam os dois montados, e sem isto o segundo usaria os recortes do
  // primeiro — que por acaso são iguais hoje, e deixariam de ser no dia em que
  // um dos dois mudasse.
  const uid = useId().replace(/:/g, '');
  const topo = `topo-${uid}`;
  const frente = `frente-${uid}`;

  return (
    <svg
      width={lado}
      height={lado}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* As três faces em valores distintos. A de cima pega a luz, a da
            esquerda fica em meia-luz e a da direita é a sombra própria. */}
        <linearGradient id={`fTopo-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A3B42" />
          <stop offset="1" stopColor="#25262B" />
        </linearGradient>
        <linearGradient id={`fEsq-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#212229" />
          <stop offset="1" stopColor="#15161A" />
        </linearGradient>
        <linearGradient id={`fDir-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141519" />
          <stop offset="1" stopColor="#0D0E11" />
        </linearGradient>

        <linearGradient id={`fita-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--prog-ouro)" />
          <stop offset="0.45" stopColor="var(--prog-ouro-claro)" />
          <stop offset="1" stopColor="var(--prog-ouro)" />
        </linearGradient>

        <radialGradient id={`chao-${uid}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        <clipPath id={topo}>
          <path d="M32 5 L58 19 L32 33 L6 19 Z" />
        </clipPath>
        <clipPath id={frente}>
          <path d="M6 19 L32 33 L32 58 L6 44 Z" />
        </clipPath>
      </defs>

      <ellipse cx="32" cy="59" rx="23" ry="4.5" fill={`url(#chao-${uid})`} />

      <path d="M6 19 L32 33 L32 58 L6 44 Z" fill={`url(#fEsq-${uid})`} />
      <path d="M58 19 L32 33 L32 58 L58 44 Z" fill={`url(#fDir-${uid})`} />
      <path d="M32 5 L58 19 L32 33 L6 19 Z" fill={`url(#fTopo-${uid})`} />

      {/* A fita desce da face de cima para a da frente passando pela quina, e
          os dois trechos nascem do mesmo ponto da aresta: é o alinhamento que
          faz parecer uma fita só, dobrada, em vez de duas listras. */}
      <g clipPath={`url(#${topo})`}>
        <polygon points="20.9,29.5 46.9,15.5 43.1,8.5 17.1,22.5" fill={`url(#fita-${uid})`} />
      </g>
      <g clipPath={`url(#${frente})`}>
        <rect x="15.2" y="18" width="7.6" height="44" fill={`url(#fita-${uid})`} opacity="0.62" />
      </g>

      {/* Arestas superiores em luz raspante: um fio claro é o que impede as
          faces de empastarem umas nas outras no tamanho pequeno. */}
      <path d="M6 19 L32 5 L58 19" stroke="rgba(255,255,255,.16)" strokeWidth="1" />
      <path d="M6 19 L32 33 L58 19" stroke="rgba(255,255,255,.07)" strokeWidth="1" />
      <path d="M32 33 L32 58" stroke="rgba(255,255,255,.05)" strokeWidth="1" />

      {/* Etiqueta: dois traços de ficha técnica na face em sombra. Em 50px não
          se lê, e não é para ler — é a mancha que diz "isto foi despachado". */}
      <g opacity="0.5">
        <rect x="38" y="36" width="14" height="2" rx="1" fill={C.faded} />
        <rect x="38" y="41" width="9" height="2" rx="1" fill={C.faded} />
      </g>
    </svg>
  );
}
