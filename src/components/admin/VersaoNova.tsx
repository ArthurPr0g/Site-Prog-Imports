'use client';

// Versão nova do sistema com o painel aberto (30/10/2026: o Arthur via a página "recarregar sozinha e voltar
// para o topo" enquanto lia as conversas da Lia). Antes, a primeira ação que falhava por causa do deploy
// recarregava a página na hora. Agora aparece um aviso discreto com "Atualizar"; ao atualizar, a posição da
// tela e a conversa aberta voltam. Com a aba escondida (o Arthur não está olhando), atualiza sozinho.

import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

const EVENTO = 'prog-versao-nova';
const CHAVE = 'prog-posicao-antes-de-atualizar';

/** Uma ação do servidor falhou porque saiu versão nova: avisa (não recarrega). */
export function avisarVersaoNova() {
  if (typeof window === 'undefined') return;
  (window as Window & { __versaoNova?: boolean }).__versaoNova = true;
  window.dispatchEvent(new Event(EVENTO));
}

export const ERRO_DE_VERSAO_NOVA = /Server Action .* was not found|UnrecognizedActionError|Failed to find Server Action|ChunkLoadError|Loading chunk/i;

/** Recarrega guardando onde a pessoa estava (rolagem e endereço com a conversa aberta). */
export function atualizarSemPerderOLugar() {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ url: location.pathname + location.search, y: window.scrollY, em: Date.now() }));
  } catch {}
  window.location.reload();
}

export function AvisoDeVersaoNova() {
  const [nova, setNova] = useState(false);

  // Volta para onde estava depois de atualizar (espera o conteúdo carregar antes de rolar).
  useEffect(() => {
    let salvo: { url: string; y: number; em: number } | null = null;
    try {
      salvo = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null');
      sessionStorage.removeItem(CHAVE);
    } catch {}
    if (!salvo || Date.now() - salvo.em > 60_000 || salvo.url !== location.pathname + location.search) return;
    const y = salvo.y;
    const tentativas = [150, 600, 1500, 3000].map((ms) =>
      window.setTimeout(() => {
        if (Math.abs(window.scrollY - y) > 40 && document.body.scrollHeight > y) window.scrollTo({ top: y });
      }, ms),
    );
    return () => tentativas.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const aoSaber = () => {
      if (document.visibilityState === 'hidden') return atualizarSemPerderOLugar();
      setNova(true);
    };
    if ((window as Window & { __versaoNova?: boolean }).__versaoNova) aoSaber();
    window.addEventListener(EVENTO, aoSaber);
    const aoEsconder = () => {
      if (document.visibilityState === 'hidden' && (window as Window & { __versaoNova?: boolean }).__versaoNova) atualizarSemPerderOLugar();
    };
    document.addEventListener('visibilitychange', aoEsconder);
    return () => {
      window.removeEventListener(EVENTO, aoSaber);
      document.removeEventListener('visibilitychange', aoEsconder);
    };
  }, []);

  if (!nova) return null;
  return (
    <div className="aviso-versao fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4" role="status">
      <div className="flex max-w-full items-center gap-3 rounded-full border border-[rgba(130,148,255,0.3)] bg-[#0c1230]/95 py-2 pl-4 pr-2 text-[13px] text-[#eef1ff] shadow-[0_18px_40px_-12px_rgba(2,6,30,0.9)] backdrop-blur-xl">
        <Sparkles size={15} className="flex-shrink-0 text-[#8fa2ff]" />
        <span className="min-w-0">Saiu uma versão nova do sistema</span>
        <button
          onClick={atualizarSemPerderOLugar}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#6a82ff,#3349f0)] px-3 py-1.5 text-[12.5px] font-extrabold text-white"
        >
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>
    </div>
  );
}

/** Esqueleto de carregamento (barra com brilho passando). */
export function Esqueleto({ className = '' }: { className?: string }) {
  return <div className={`esqueleto rounded-[10px] ${className}`} aria-hidden />;
}
