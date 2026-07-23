'use client';

import { Logo } from '@/components/ui/Logo';
import { INSTAGRAM_HANDLE, WHATSAPP_NUMBER } from '@/lib/constants';

function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  el.style.setProperty('--spot-opacity', '1');
}

function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.setProperty('--spot-opacity', '0');
}

export function Footer() {
  const waDisplay = '(62) 98213-3188';
  return (
    <footer className="border-t border-divider-strong bg-[#0c0c0f]">
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
      >
        <span aria-hidden className="footer-spotlight" />
        <div>
          <Logo height={64} className="mb-4" />
          <p className="max-w-70 text-[13.5px] leading-relaxed text-fg-tertiary">
            Importação de tecnologia premium direto dos Estados Unidos. Confiança, exclusividade e
            atendimento personalizado.
          </p>
        </div>
        <div>
          <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.1em]">Institucional</div>
          <div className="flex flex-col gap-2.5 text-sm text-fg-secondary">
            <a href="#" className="footer-link">Sobre nós</a>
            <a href="#" className="footer-link">Como funciona a importação</a>
            <a href="#" className="footer-link">Garantia</a>
            <a href="#" className="footer-link">Trocas e devoluções</a>
            <a href="#" className="footer-link">Política de privacidade</a>
          </div>
        </div>
        <div>
          <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.1em]">Contato</div>
          <div className="flex flex-col gap-2.5 text-sm text-fg-secondary">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="footer-link">
              WhatsApp {waDisplay}
            </a>
            <a href={`https://instagram.com/${INSTAGRAM_HANDLE}`} target="_blank" rel="noreferrer" className="footer-link">
              Instagram @{INSTAGRAM_HANDLE}
            </a>
            <span className="text-fg-tertiary">Atendimento seg–sáb, 9h às 19h</span>
          </div>
        </div>
        <div>
          <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.1em]">Pagamento</div>
          <div className="flex flex-wrap gap-2">
            {['Pix', 'Visa', 'Mastercard', 'Boleto', '12x sem juros'].map((chip) => (
              <span
                key={chip}
                className="rounded-lg border border-border-strong bg-input-alt px-3 py-1.5 text-xs font-bold text-fg-secondary"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-divider-strong px-6 py-5 text-center text-[12.5px] text-fg-faded">
        © 2026 Prog Imports — Tecnologia importada com confiança.
      </div>
    </footer>
  );
}
