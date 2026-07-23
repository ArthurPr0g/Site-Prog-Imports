'use client';

import { useRef, useState } from 'react';
import { reorderArray } from '@/lib/reorder';

// Reordenação via pointer events (não HTML5 drag-and-drop nativo): arrastar com
// `draggable` fica impreciso quando a linha contém imagens/links (o navegador
// tenta arrastar a imagem em vez de mover a linha) e quando a lista reordena
// enquanto o ponteiro ainda está em movimento. Aqui calculamos manualmente qual
// linha está sob o cursor a cada movimento, o que é determinístico.
export function useDragReorder<T extends { id: string }>(propItems: T[], onCommit: (orderedIds: string[]) => void) {
  const [items, setItems] = useState(propItems);
  const [prevPropItems, setPrevPropItems] = useState(propItems);

  if (propItems !== prevPropItems) {
    setPrevPropItems(propItems);
    setItems(propItems);
  }

  const dragIndex = useRef<number | null>(null);
  const rowEls = useRef(new Map<number, HTMLElement>());

  function rowRef(index: number) {
    return (el: HTMLElement | null) => {
      if (el) rowEls.current.set(index, el);
      else rowEls.current.delete(index);
    };
  }

  function handlePointerDown(index: number) {
    return (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragIndex.current = index;
      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';

      const onMove = (ev: PointerEvent) => {
        const from = dragIndex.current;
        if (from === null) return;
        for (const [idx, el] of rowEls.current) {
          const rect = el.getBoundingClientRect();
          if (ev.clientY >= rect.top && ev.clientY <= rect.bottom && idx !== from) {
            setItems((cur) => reorderArray(cur, from, idx));
            dragIndex.current = idx;
            break;
          }
        }
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;
        if (dragIndex.current !== null) {
          dragIndex.current = null;
          setItems((cur) => {
            onCommit(cur.map((it) => it.id));
            return cur;
          });
        }
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    };
  }

  return { items, rowRef, handlePointerDown };
}
