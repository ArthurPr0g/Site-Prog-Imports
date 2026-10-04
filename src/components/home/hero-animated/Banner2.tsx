/* eslint-disable @next/next/no-img-element -- absolutely-positioned composited canvas, ported 1:1 from the design handoff */
'use client';

import { Easing, HERO_ASSET, HERO_COLORS as C, HERO_FONTS as F, segment as sg, clamp, type SceneSpec } from './scene-engine';

export const BANNER2_SCENES: SceneSpec[] = [
  { name: 'Mapa', dur: 2 },
  { name: 'Rotas', dur: 3.4 },
  { name: 'Chegada', dur: 2.1 },
  { name: 'Mensagem', dur: 4.5 },
];

const US = { x: 575, y: 209 };
const BR = { x: 758, y: 478 };
const CTRLS = [
  { x: 820, y: 250 },
  { x: 880, y: 290 },
  { x: 760, y: 330 },
];
const bez = (c: { x: number; y: number }, t: number) => ({
  x: (1 - t) * (1 - t) * US.x + 2 * (1 - t) * t * c.x + t * t * BR.x,
  y: (1 - t) * (1 - t) * US.y + 2 * (1 - t) * t * c.y + t * t * BR.y,
});
const CHIPS = [HERO_ASSET('iphone.png'), HERO_ASSET('macbook-lid.png'), HERO_ASSET('ipad.png')];
const ARRIVALS = [
  { src: HERO_ASSET('iphone.png'), w: 120 },
  { src: HERO_ASSET('ipad.png'), w: 150 },
  { src: HERO_ASSET('macbook-lid.png'), w: 215 },
  { src: HERO_ASSET('mouse-white.png'), w: 72 },
];

// Houve aqui uma máscara que dissolvia os 5% externos de cada foto, para
// esconder a borda da placa. Foi removida: ela apagava o produto junto. O iPad
// e o MacBook encostam na borda da própria placa, então o que desaparecia não
// era só o fundo — era a lateral do aparelho, com um esfumado que parecia
// desfoque de lente. A suposição de que todas as quatro fotos tinham margem
// saiu de olhar um print pequeno em vez de medir.
//
// O fundo sai agora no próprio arquivo, por recorte. Ver `recortarProduto` em
// `lib/image-cutout.ts` e a seção de fotos com placa na skill
// `tratamento-de-imagem`.

/** A câmera do banner.
 *
 *  O enquadramento aberto mostra o mundo inteiro, e a viagem EUA → Brasil
 *  acontece num pedaço pequeno dele: a rota é o assunto da peça e ficava do
 *  tamanho de um polegar. Fechar nos dois pontos durante a viagem e abrir
 *  quando a encomenda chega dá à peça a estrutura que ela já tinha no roteiro
 *  mas não tinha na imagem — aproxima para contar, afasta para concluir.
 *
 *  O ponto focal é o meio do caminho entre os dois países. O alvo é à esquerda
 *  do centro porque a metade direita da tela é onde o texto final entra: fechar
 *  com a rota no meio faria o zoom-out parecer um salto lateral. */
const FOCO = { x: (US.x + BR.x) / 2, y: (US.y + BR.y) / 2 };
const ALVO = { x: 700, y: 400 };

/** Até onde a câmera fecha.
 *
 *  O teto é a resolução do mapa, não o gosto: `map-world.png` tem 1920×800 e é
 *  desenhado em 1920×800 pontos de CSS. Numa tela de alta densidade ele já
 *  precisa do dobro de pixels que tem antes de qualquer zoom — fechar 1,9×
 *  pedia quase quatro vezes, e o que aparecia era o pixel do arquivo.
 *
 *  1,55 é o quanto dá para fechar antes de a ampliação virar o assunto. Para
 *  fechar mais seria preciso um mapa vetorial ou em 2×; enquanto isso, a
 *  profundidade de campo abaixo faz o trabalho que a resolução não faz. */
const ZOOM_MAXIMO = 1.55;

/** Desfoque do mapa conforme a câmera fecha, em pixels.
 *
 *  Resolver o que não tem solução assumindo o problema: a ampliação amolece o
 *  mapa de qualquer jeito, então o mapa **vai** para o fora de foco de
 *  propósito, enquanto rota, pulsos e rótulos continuam nítidos porque são
 *  vetor. Olho que vê fundo macio com frente nítida lê profundidade de campo,
 *  que é o que uma câmera de verdade faz ao aproximar — e não lê falta de
 *  resolução, que é o que ele lia antes. */
const DESFOQUE_MAXIMO = 1.6;

function camera(c: number) {
  const k = 1 + (ZOOM_MAXIMO - 1) * c;
  // O ponto focal caminha da posição que ele já ocupa até o alvo, então em
  // c = 0 a transformação é a identidade e o quadro aberto fica exatamente como
  // era — sem isso, abrir a câmera deixaria o mapa deslocado no fim.
  const alvoX = FOCO.x + (ALVO.x - FOCO.x) * c;
  const alvoY = FOCO.y + (ALVO.y - FOCO.y) * c;
  return { k, tx: alvoX - FOCO.x * k, ty: alvoY - FOCO.y * k };
}

function Set2({
  t,
  mapP,
  routeP,
  arriveP,
  produtosP,
  msgP,
  cam,
}: {
  t: number;
  mapP: number;
  routeP: number;
  arriveP: number;
  produtosP: number;
  msgP: number;
  cam: number;
}) {
  const { k, tx, ty } = camera(cam);
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden', fontFamily: F.body }}>
      {/* O mundo — mapa, rotas, encomendas e rótulos — mora dentro da câmera.
          O texto final e a vitrine ficam de fora: eles pertencem ao quadro
          aberto, e seguir o zoom os faria entrar tortos. */}
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${tx}px, ${ty}px) scale(${k})`, transformOrigin: '0 0' }}>
        <img
          src={HERO_ASSET('map-world.png')}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: 1920,
            height: 800,
            opacity: 0.9 * mapP,
            transform: `scale(${1.05 - 0.05 * mapP})`,
            // O desfoque é dividido pela escala porque ele é aplicado antes da
            // câmera ampliar: sem isso, 1,6px viram 2,5px na tela e o mapa some.
            filter: cam > 0.01 ? `blur(${((DESFOQUE_MAXIMO * cam) / k).toFixed(2)}px)` : undefined,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: US.x - 110,
            top: US.y - 80,
            width: 280,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgb(var(--brand-accent-rgb) / 0.16) 0%, rgb(var(--brand-accent-rgb) / 0) 60%)',
            opacity: mapP,
          }}
        />

      <svg width="1920" height="800" viewBox="0 0 1920 800" style={{ position: 'absolute', inset: 0 }}>
        {CTRLS.map((c, i) => {
          const d = sg(routeP, i * 0.1, 0.55 + i * 0.1, Easing.easeInOutCubic);
          return (
            <path
              key={i}
              d={`M ${US.x} ${US.y} Q ${c.x} ${c.y} ${BR.x} ${BR.y}`}
              fill="none"
              stroke={C.ouro}
              // Dividido pela escala da câmera: traço que engorda junto com o
              // zoom vira cabo em vez de rota, e denuncia que a imagem foi
              // ampliada em vez de aproximada.
              strokeWidth={(i === 0 ? 2 : 1) / k}
              opacity={(i === 0 ? 0.85 : 0.35) * Math.min(1, mapP)}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - d}
            />
          );
        })}
        <circle cx={US.x} cy={US.y} r={5 / k} fill={C.ouro} opacity={mapP} />
        <circle cx={US.x} cy={US.y} r={(9 + 5 * Math.sin(t * 2.4)) / k} fill="none" stroke={C.ouro} strokeWidth={1 / k} opacity={0.5 * mapP} />
        <circle cx={BR.x} cy={BR.y} r={5 / k} fill={C.ouro} opacity={Math.min(1, routeP * 2)} />
        {arriveP > 0 &&
          [0, 1, 2].map((i) => {
            const rp = (t * 0.55 + i / 3) % 1;
            return <circle key={i} cx={BR.x} cy={BR.y} r={(8 + rp * 46) / k} fill="none" stroke={C.ouro} strokeWidth={1.2 / k} opacity={(1 - rp) * 0.6 * arriveP} />;
          })}
      </svg>

      {CHIPS.map((src, i) => {
        const tt = clamp(routeP * 1.45 - i * 0.16, 0, 1);
        const pos = bez(CTRLS[0], tt);
        const vis = tt > 0 && tt < 1 ? Math.min(1, Math.sin(Math.PI * tt) * 2.2) : 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              // Contra-escala: a encomenda viaja pelo mapa ampliado mas mantém
              // o tamanho que tem na tela. Sem isto ela cresce junto com o
              // zoom e chega ao Brasil do tamanho do país.
              transform: `translate(-50%,-50%) scale(${1 / k})`,
              opacity: vis,
              width: 52,
              height: 52,
              borderRadius: 10,
              background: 'rgba(20,21,25,0.9)',
              border: '1px solid rgb(var(--brand-accent-rgb) / 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 22px rgb(var(--brand-accent-rgb) / 0.35)',
            }}
          >
            <img src={src} alt="" style={{ maxWidth: 38, maxHeight: 38 }} />
          </div>
        );
      })}

        {/* Os rótulos acompanham os pontos no mapa ampliado, mas não crescem
            com ele: tipografia que escala com o zoom deixa de ser rótulo e vira
            título. */}
        <div
          style={{
            position: 'absolute',
            left: US.x - 24,
            top: US.y - 42,
            transformOrigin: 'left center',
            transform: `scale(${1 / k})`,
            fontFamily: F.mono,
            fontSize: 13,
            letterSpacing: '0.22em',
            color: C.white,
            opacity: 0.85 * mapP,
          }}
        >
          EUA
        </div>
        <div
          style={{
            position: 'absolute',
            left: BR.x + 18,
            top: BR.y - 6,
            transformOrigin: 'left center',
            transform: `scale(${1 / k})`,
            fontFamily: F.mono,
            fontSize: 13,
            letterSpacing: '0.22em',
            color: C.white,
            opacity: 0.85 * Math.min(1, routeP * 2),
          }}
        >
          BRASIL
        </div>
      </div>

      {/* Fora da câmera daqui para baixo. O escurecimento da direita entra
          junto com o texto porque ele existe só para o texto ter fundo: com a
          câmera fechada ele apagaria metade do mapa sem motivo. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(8,8,10,0) 45%, rgba(8,8,10,0.55) 62%, rgba(8,8,10,0.92) 82%)',
          opacity: msgP,
        }}
      />

      <div style={{ position: 'absolute', left: 150, bottom: 64, display: 'flex', alignItems: 'flex-end', gap: 38 }}>
        {ARRIVALS.map((p, i) => {
          const a = sg(produtosP, i * 0.14, i * 0.14 + 0.36, Easing.easeOutCubic);
          if (a <= 0) return null;
          return (
            <img
              key={i}
              src={p.src}
              alt=""
              style={{
                display: 'block',
                width: p.w,
                opacity: a,
                transform: `translateY(${(1 - a) * 36}px) scale(${0.8 + 0.2 * a})`,
                filter: 'drop-shadow(0 22px 26px rgba(0,0,0,0.6))',
              }}
            />
          );
        })}
      </div>

      <div style={{ position: 'absolute', right: 120, top: 0, bottom: 0, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 26 }}>
        <img src="/images/logo.png" alt="Prog Imports" style={{ width: 200, opacity: msgP, transform: `translateY(${(1 - msgP) * -16}px)` }} />
        <div style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: '0.34em', color: C.ouro, opacity: msgP }}>DIRETO DOS ESTADOS UNIDOS 🇺🇸</div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 58,
              lineHeight: 1.08,
              color: C.white,
              letterSpacing: '-0.02em',
              transform: `translateY(${(1 - msgP) * 110}%)`,
            }}
          >
            Produtos exclusivos, importados dos EUA<span style={{ color: C.ouro }}>.</span>
          </h1>
        </div>
        <div style={{ fontSize: 22, lineHeight: 1.5, color: C.gray, maxWidth: 480, opacity: msgP, transform: `translateY(${(1 - msgP) * 18}px)` }}>
          Do lançamento nos Estados Unidos até a sua casa, sem intermediários.
        </div>
        <a
          href="/produtos"
          style={{
            display: 'inline-block',
            background: C.ouro,
            color: '#0A0A0C',
            textDecoration: 'none',
            fontFamily: F.display,
            fontWeight: 600,
            fontSize: 17,
            letterSpacing: '0.06em',
            padding: '16px 34px',
            borderRadius: 3,
            opacity: msgP,
            transform: `translateY(${(1 - msgP) * 18}px)`,
          }}
        >
          VER PRODUTOS
        </a>
      </div>
    </div>
  );
}

export function Banner2({ index, progress, t }: { index: number; progress: number; t: number }) {
  let mapP = 0;
  let routeP = 0;
  let arriveP = 0;
  let produtosP = 0;
  let msgP = 0;
  let cam = 0;

  if (index === 0) {
    // Mapa: abre no mundo inteiro e fecha entre os dois países. O zoom começa
    // depois do mapa aparecer — aproximar enquanto a imagem ainda está entrando
    // é movimento em cima de movimento, e o olho não acompanha os dois.
    mapP = sg(progress, 0.05, 0.75);
    cam = sg(progress, 0.42, 1, Easing.easeInOutCubic);
  } else if (index === 1) {
    // Rotas: fechado o tempo todo. É a cena da viagem, e é para isso que
    // fechamos.
    mapP = 1;
    cam = 1;
    routeP = sg(progress, 0.02, 0.98, Easing.linear);
  } else if (index === 2) {
    // Chegada: as ondas no Brasil acontecem ainda fechado, e só depois a
    // câmera abre. Abrir junto com a chegada tiraria o close justamente do
    // quadro que a cena existe para mostrar.
    mapP = 1;
    routeP = 1;
    arriveP = sg(progress, 0.05, 0.55, Easing.linear);
    cam = 1 - sg(progress, 0.5, 1, Easing.easeInOutCubic);
    // A vitrine entra montada na abertura, acompanhando o afastamento.
    produtosP = sg(progress, 0.62, 1, Easing.easeOutCubic);
  } else {
    mapP = 1;
    routeP = 1;
    arriveP = 1;
    produtosP = 1;
    msgP = sg(progress, 0.05, 0.32);
  }

  return <Set2 t={t} mapP={mapP} routeP={routeP} arriveP={arriveP} produtosP={produtosP} msgP={msgP} cam={cam} />;
}
