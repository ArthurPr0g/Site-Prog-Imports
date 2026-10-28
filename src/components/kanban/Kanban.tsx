'use client';

// Kanban com arrastar e soltar de verdade no computador e no celular
// (dnd-kit): no mouse arrasta direto; no dedo, segura um instante e arrasta
// (toque rápido continua rolando a tela). O cartão muda de coluna na hora
// (otimista) e volta se o servidor recusar. Usado no Quadro do painel e na
// página do vendedor.

import { useId, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

export type ColunaDoKanban<K extends string> = { chave: K; titulo: string; cor?: string; rodape?: string };

type Props<T, K extends string> = {
  colunas: ColunaDoKanban<K>[];
  itens: T[];
  idDe: (item: T) => string;
  colunaDe: (item: T) => K;
  /** Resolve true quando o servidor aceitou; false desfaz a mudança. */
  aoMover: (item: T, para: K) => Promise<boolean>;
  cartao: (item: T, arrastando: boolean) => ReactNode;
  /** Cartões por coluna antes do "mostrar mais". */
  limite?: number;
  aoAbrir?: (item: T) => void;
};

export function Kanban<T, K extends string>({
  colunas,
  itens,
  idDe,
  colunaDe,
  aoMover,
  cartao,
  limite = 40,
  aoAbrir,
}: Props<T, K>) {
  // Mudança otimista: vale só enquanto o servidor ainda mostra a coluna de antes
  // (de); quando o dado novo chega, ou se outra tela mudou a etapa, vale o servidor.
  const [movidos, setMovidos] = useState<Record<string, { de: K; para: K }>>({});
  const [ativo, setAtivo] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Record<string, number>>({});
  const idDoQuadro = useId();

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const colunaAtual = (item: T) => {
    const m = movidos[idDe(item)];
    return m && colunaDe(item) === m.de ? m.para : colunaDe(item);
  };
  const itemAtivo = ativo ? itens.find((i) => idDe(i) === ativo) : undefined;

  function inicio(e: DragStartEvent) {
    setAtivo(String(e.active.id));
  }

  async function fim(e: DragEndEvent) {
    setAtivo(null);
    const id = String(e.active.id);
    const para = e.over?.id as K | undefined;
    const item = itens.find((i) => idDe(i) === id);
    if (!item || !para || colunaAtual(item) === para) return;
    setMovidos((m) => ({ ...m, [id]: { de: colunaDe(item), para } }));
    const ok = await aoMover(item, para);
    // Com sucesso, mantém a coluna nova até os dados do servidor chegarem; sem, desfaz.
    if (!ok) {
      setMovidos((m) => {
        const resto = { ...m };
        delete resto[id];
        return resto;
      });
    }
  }

  return (
    <DndContext
      // id estável: sem ele o dnd-kit numera os atributos de acessibilidade
      // diferente no servidor e no navegador (erro de hidratação).
      id={idDoQuadro}
      sensors={sensores}
      collisionDetection={closestCorners}
      // Rolagem automática só bem perto da borda e devagar: no celular, segurar
      // perto da beirada não pode correr o quadro inteiro até a última coluna.
      autoScroll={{ threshold: { x: 0.08, y: 0.12 }, acceleration: 3 }}
      onDragStart={inicio}
      onDragEnd={fim}
      onDragCancel={() => setAtivo(null)}
    >
      <div className="-mx-1 snap-x snap-mandatory overflow-x-auto pb-3 [scrollbar-width:thin] lg:snap-none">
        <div className="flex min-w-max gap-3 px-1">
          {colunas.map((col) => {
            const daColuna = itens.filter((i) => colunaAtual(i) === col.chave);
            const ate = abertas[col.chave] ?? limite;
            return (
              <Coluna key={col.chave} coluna={col} total={daColuna.length}>
                {daColuna.slice(0, ate).map((item) => (
                  <Cartao key={idDe(item)} id={idDe(item)} aoAbrir={aoAbrir ? () => aoAbrir(item) : undefined}>
                    {cartao(item, ativo === idDe(item))}
                  </Cartao>
                ))}
                {daColuna.length > ate && (
                  <button
                    onClick={() => setAbertas((a) => ({ ...a, [col.chave]: ate + limite }))}
                    className="w-full rounded-[10px] py-2 text-[12px] font-bold text-fg-tertiary hover:text-accent"
                  >
                    + {daColuna.length - ate} (mostrar mais)
                  </button>
                )}
                {daColuna.length === 0 && (
                  <div className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-[11.5px] text-fg-faded">
                    Arraste um cartão para cá
                  </div>
                )}
              </Coluna>
            );
          })}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {itemAtivo ? (
          <div className="rotate-[1.5deg] scale-[1.03] cursor-grabbing shadow-[0_18px_40px_rgba(0,0,0,.55)]">
            {cartao(itemAtivo, false)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Coluna<K extends string>({
  coluna,
  total,
  children,
}: {
  coluna: ColunaDoKanban<K>;
  total: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.chave });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-[82vw] max-w-[300px] flex-shrink-0 snap-start flex-col rounded-[16px] border p-2.5 transition-colors sm:w-[270px] ${
        isOver ? 'border-accent bg-accent/[.07]' : 'border-border bg-card'
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
          {coluna.cor && <span className="h-2 w-2 rounded-full" style={{ background: coluna.cor }} />}
          {coluna.titulo}
        </div>
        <div className="rounded-full bg-fg-faded/12 px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-fg-tertiary">
          {total}
        </div>
      </div>
      {coluna.rodape && <div className="mb-2 px-1 text-[11px] text-fg-faded">{coluna.rodape}</div>}
      <div className="flex min-h-[80px] flex-col gap-2">{children}</div>
    </div>
  );
}

function Cartao({ id, children, aoAbrir }: { id: string; children: ReactNode; aoAbrir?: () => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={aoAbrir}
      className={`touch-manipulation select-none rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isDragging ? 'opacity-30' : 'cursor-grab'
      }`}
    >
      {children}
    </div>
  );
}
