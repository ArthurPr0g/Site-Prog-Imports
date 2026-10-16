'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, RefreshCw } from 'lucide-react';

const LIMIAR = 72; // px puxados (já amortecidos) para soltar e atualizar
const MAXIMO = 110;

/** "Puxar para atualizar" do app Prog Admin.
 *
 *  iPhone e Android DESLIGAM o gesto nativo quando o site abre como app
 *  instalado (PWA em modo standalone) — por isso ele precisa existir aqui. No
 *  navegador comum o gesto nativo já funciona e os dois brigariam: este só liga
 *  em standalone.
 *
 *  Atualizar = `router.refresh()`: busca de novo os dados da tela no servidor
 *  (vendas, caixa, atividades) sem recarregar o app nem perder estado. Não
 *  dispara com o toque começando dentro de janela aberta (modal, menu lateral):
 *  lá o dedo está rolando outra coisa. */
export function PuxarParaAtualizar() {
  const router = useRouter();
  const [ativo, setAtivo] = useState(false);
  const [puxado, setPuxado] = useState(0);
  const [pending, startTransition] = useTransition();
  const inicio = useRef<number | null>(null);
  const puxadoRef = useRef(0);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setAtivo(standalone);
  }, []);

  useEffect(() => {
    if (!ativo) return;

    const aoTocar = (e: TouchEvent) => {
      const alvo = e.target as Element | null;
      if (window.scrollY > 0 || e.touches.length !== 1 || alvo?.closest('[role="dialog"], [aria-modal="true"], .fixed')) {
        inicio.current = null;
        return;
      }
      inicio.current = e.touches[0].clientY;
    };
    const aoMover = (e: TouchEvent) => {
      if (inicio.current === null) return;
      const dy = e.touches[0].clientY - inicio.current;
      if (dy <= 0 || window.scrollY > 0) {
        puxadoRef.current = 0;
        setPuxado(0);
        return;
      }
      // Amortecido: quanto mais puxa, mais "pesa", como o gesto nativo
      const valor = Math.min(MAXIMO, dy * 0.5);
      puxadoRef.current = valor;
      setPuxado(valor);
      if (e.cancelable && valor > 4) e.preventDefault(); // segura o "quique" da página enquanto puxa
    };
    const aoSoltar = () => {
      if (inicio.current === null) return;
      inicio.current = null;
      const valor = puxadoRef.current;
      puxadoRef.current = 0;
      setPuxado(0);
      if (valor >= LIMIAR) startTransition(() => router.refresh());
    };

    window.addEventListener('touchstart', aoTocar, { passive: true });
    window.addEventListener('touchmove', aoMover, { passive: false });
    window.addEventListener('touchend', aoSoltar);
    window.addEventListener('touchcancel', aoSoltar);
    return () => {
      window.removeEventListener('touchstart', aoTocar);
      window.removeEventListener('touchmove', aoMover);
      window.removeEventListener('touchend', aoSoltar);
      window.removeEventListener('touchcancel', aoSoltar);
    };
  }, [ativo, router]);

  if (!ativo || (puxado === 0 && !pending)) return null;

  const pronto = puxado >= LIMIAR;
  const y = pending ? 56 : Math.max(0, puxado - 16);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{ transform: `translateY(${y}px)`, transition: puxado === 0 ? 'transform .25s ease' : 'none' }}
    >
      <div className="flex items-center gap-2 rounded-full border border-border-strong bg-card-dark px-3.5 py-2 text-[12px] font-extrabold text-fg shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)]">
        {pending ? (
          <RefreshCw size={15} className="animate-spin text-accent" />
        ) : (
          <ArrowDown
            size={15}
            className="text-accent transition-transform duration-200"
            style={{ transform: `rotate(${pronto ? 180 : 0}deg)` }}
          />
        )}
        {pending ? 'Atualizando…' : pronto ? 'Solte para atualizar' : 'Puxe para atualizar'}
      </div>
    </div>
  );
}
