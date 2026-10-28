'use client';

// Perguntas difíceis do cliente com resposta simples (fonte: contrato e
// catálogo) e o plano B: frase para ganhar tempo + pergunta direto ao Arthur.

import { useState } from 'react';
import { Search, MessageCircle, ShieldAlert } from 'lucide-react';
import { PERGUNTAS_DIFICEIS, REGRAS_DE_OURO, FRASE_PARA_GANHAR_TEMPO } from '@/lib/perguntas-dificeis';
import { linkWhatsApp } from '@/lib/mensagens-lead';

export function PerguntarAoArthur({
  whatsArthur,
  vendedor,
  cliente,
}: {
  whatsArthur: string;
  vendedor: string;
  cliente?: string;
}) {
  const texto = `Arthur, aqui é o ${vendedor}.${cliente ? ` O cliente ${cliente}` : ' Um cliente'} perguntou: `;
  return (
    <a
      href={linkWhatsApp(whatsArthur, texto)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-extrabold text-page"
    >
      <MessageCircle size={15} /> Perguntar ao Arthur no WhatsApp
    </a>
  );
}

export function PerguntasDificeis({ whatsArthur, vendedor }: { whatsArthur: string; vendedor: string }) {
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const lista = PERGUNTAS_DIFICEIS.filter((p) => !termo || `${p.tema} ${p.pergunta} ${p.resposta}`.toLowerCase().includes(termo));

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-accent/40 bg-accent/[.06] p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[.06em] text-accent">
          <ShieldAlert size={15} /> Não sabe a resposta? Não chute.
        </div>
        <p className="text-[14px] leading-relaxed">“{FRASE_PARA_GANHAR_TEMPO}”</p>
        <p className="mt-2 text-[12.5px] text-fg-tertiary">
          Depois, mande a pergunta para o Arthur e volte ao cliente com a resposta certa.
        </p>
        <div className="mt-3">
          <PerguntarAoArthur whatsArthur={whatsArthur} vendedor={vendedor} />
        </div>
        <ul className="mt-4 space-y-1.5 text-[13px] text-fg-secondary">
          {REGRAS_DE_OURO.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-accent">•</span>
              {r}
            </li>
          ))}
        </ul>
      </section>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faded" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar: domínio, cancelar, prazo, pagamento…"
          className="w-full rounded-control border border-border-strong bg-input py-2.5 pl-10 pr-3.5 text-[14px] outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-2">
        {lista.map((p) => (
          <details key={p.pergunta} className="group rounded-[14px] border border-border bg-card p-3.5 open:border-accent/40">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
              <span>
                <span className="mr-2 rounded-full bg-fg-faded/15 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[.05em] text-fg-tertiary">
                  {p.tema}
                </span>
                <span className="text-[14px] font-bold">{p.pergunta}</span>
              </span>
              <span className="text-fg-faded transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-fg-secondary">{p.resposta}</p>
          </details>
        ))}
        {lista.length === 0 && (
          <div className="rounded-[14px] border border-border bg-card p-4 text-[13px] text-fg-tertiary">
            Nada sobre isso aqui: use a frase acima e pergunte ao Arthur.
          </div>
        )}
      </div>
    </div>
  );
}
