'use client';

import { cloneElement, isValidElement, useId, useRef, useState } from 'react';

/** Tooltip que explica o que um botão faz.
 *
 *  Existe no lugar do atributo `title` por três motivos. O do navegador demora
 *  quase um segundo para aparecer e some sozinho; não existe em tela de toque; e
 *  não dá para escrever nele mais de uma frase sem ficar ilegível. Aqui o texto
 *  pode dizer o que acontece **e o que não acontece**, que é o que de fato
 *  evita o clique errado.
 *
 *  Posicionado em `fixed`, calculado na hora em que abre. CSS puro com
 *  `absolute` seria mais simples, mas a coluna da prévia rola por dentro
 *  (`overflow-y: auto`) e qualquer tooltip absoluto dentro dela é cortado na
 *  borda — justamente nos botões do topo e da base, que são os que mais
 *  precisam de explicação.
 *
 *  Abre ao passar o mouse (com 300ms de espera, para não piscar ao atravessar a
 *  tela) e ao receber foco do teclado. Fecha ao sair, ao perder o foco e ao
 *  apertar Esc. */
export function Dica({
  texto,
  children,
  className = '',
}: {
  texto: string;
  /** Um único elemento — o botão. Ele recebe `aria-describedby`. */
  children: React.ReactElement<{ 'aria-describedby'?: string }>;
  className?: string;
}) {
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number; abaixo: boolean } | null>(null);
  const raiz = useRef<HTMLSpanElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LARGURA = 260;
  const MARGEM = 10;

  function abrir() {
    const el = raiz.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Abaixo quando falta espaço em cima: o primeiro botão da página não tem
    // para onde subir.
    const abaixo = r.top < 96;
    const centro = r.left + r.width / 2;
    const x = Math.min(Math.max(centro, LARGURA / 2 + MARGEM), window.innerWidth - LARGURA / 2 - MARGEM);
    setPos({ x, y: abaixo ? r.bottom + 8 : r.top - 8, abaixo });
  }

  function aoEntrar() {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(abrir, 300);
  }

  function fechar() {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
    setPos(null);
  }

  return (
    <span
      ref={raiz}
      className={`inline-flex ${className}`}
      onMouseEnter={aoEntrar}
      onMouseLeave={fechar}
      // Foco abre sem espera: quem navega por teclado não "passa por cima".
      onFocus={abrir}
      onBlur={fechar}
      onKeyDown={(e) => {
        if (e.key === 'Escape') fechar();
      }}
    >
      {isValidElement(children)
        ? cloneElement(children, { 'aria-describedby': pos ? id : undefined })
        : children}

      {pos && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            width: LARGURA,
            transform: pos.abaixo ? 'translateX(-50%)' : 'translate(-50%, -100%)',
          }}
          className="pointer-events-none z-[200] rounded-[10px] border border-border-strong bg-card px-3 py-2.5 text-left text-[12px] font-medium leading-snug text-fg-secondary shadow-[0_14px_36px_rgba(0,0,0,.55)]"
        >
          {texto}
        </span>
      )}
    </span>
  );
}
