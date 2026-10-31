'use client';

// Coluna do Copiloto na sala do Arthur (Fase 2, 31/10/2026): balões que a IA tira da conversa, só ele vê.
// O resumo do cliente fica fixo no topo; os outros somem sozinhos quando ficam velhos ou com o "x".

import { useEffect, useState } from 'react';
import { BookOpen, CircleHelp, ExternalLink, MessageSquareQuote, Package, Sparkles, UserRound, X } from 'lucide-react';
import { baloesVivos, type Balao, type TipoDeBalao } from '@/lib/reunioes/comum';

const ICONE: Record<TipoDeBalao, typeof Package> = { pacote: Package, objecao: MessageSquareQuote, case: BookOpen, pergunta: CircleHelp, resumo: UserRound };
const ROTULO: Record<TipoDeBalao, string> = { pacote: 'Pacote', objecao: 'Objeção', case: 'Case', pergunta: 'Falta perguntar', resumo: 'Resumo do cliente' };

export function Copiloto({
  baloes,
  pensando,
  erro,
  ativo,
  dispensar,
  aoUsarPacote,
  aoMandarCase,
}: {
  baloes: Balao[];
  pensando: boolean;
  erro: string | null;
  ativo: boolean;
  dispensar: (id: string) => void;
  aoUsarPacote: (ref: Record<string, unknown>) => void;
  aoMandarCase: (slug: string) => void;
}) {
  // Relógio para os balões velhos sumirem sem esperar o próximo trecho.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  const vivos = baloesVivos(baloes, agora);
  const resumo = vivos.find((b) => b.tipo === 'resumo');
  const outros = vivos.filter((b) => b.tipo !== 'resumo').sort((a, b) => b.em.localeCompare(a.em));

  return (
    <section className="rounded-[20px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015))] p-4">
      {/* Entrada do balão: 600 ms, curva enter do design system, subindo 10 px; sem movimento se a pessoa pediu. */}
      <style>{`@keyframes balaoEntra{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.balao-entra{animation:balaoEntra .6s cubic-bezier(.16,1,.3,1) both}@media (prefers-reduced-motion:reduce){.balao-entra{animation:balaoEntra .2s linear both;transform:none}}`}</style>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[.24em] text-[#81AAF7]">Copiloto</h2>
        {pensando && (
          <span className="flex items-center gap-1.5 text-[11.5px] text-[#9BA1AB]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#81AAF7]" /> lendo a conversa
          </span>
        )}
      </div>
      {erro && <p className="mb-2 text-[12px] text-[#F2A7A7]">{erro}</p>}
      {!vivos.length ? (
        <div className="grid place-items-center gap-2 py-6 text-center">
          <Sparkles size={20} className="text-[#9BA1AB]" />
          <p className="text-[13px] leading-relaxed text-[#A3A8B2]">
            {ativo ? 'Os balões aparecem conforme a conversa: pacote citado, objeção, case parecido, o que falta perguntar.' : 'Comece a gravação: o copiloto lê a transcrição ao vivo.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {resumo && <CartaoDoBalao b={resumo} />}
          {outros.map((b) => (
            <CartaoDoBalao
              key={b.id}
              b={b}
              dispensar={() => dispensar(b.id)}
              acao={
                b.tipo === 'pacote' && b.ref
                  ? { rotulo: 'Enviar proposta deste', fazer: () => aoUsarPacote(b.ref!) }
                  : b.tipo === 'case' && typeof b.ref?.slug === 'string'
                    ? { rotulo: 'Mandar o case', fazer: () => aoMandarCase(String(b.ref!.slug)) }
                    : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CartaoDoBalao({ b, dispensar, acao }: { b: Balao; dispensar?: () => void; acao?: { rotulo: string; fazer: () => void } }) {
  const Icone = ICONE[b.tipo];
  return (
    <article
      className={`balao-entra relative rounded-[16px] border p-3 pr-10 ${b.tipo === 'resumo' ? 'border-[#81AAF7]/30 bg-[#81AAF7]/[0.06]' : 'border-white/[0.09] bg-[#12141A]'}`}
    >
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[.16em] text-[#9BA1AB]">
        <Icone size={13} /> {ROTULO[b.tipo]}
      </div>
      <b className="block text-[13.5px] leading-snug text-[#F4F5F7]">{b.titulo}</b>
      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[#D7DAE0]">{b.texto}</p>
      {(b.link || acao) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {b.link && (
            <a href={b.link} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-1.5 rounded-full border border-white/[0.14] px-3 text-[12.5px] text-[#D7DAE0]">
              <ExternalLink size={13} /> Abrir
            </a>
          )}
          {acao && (
            <button onClick={acao.fazer} className="flex h-10 items-center rounded-full border border-[#81AAF7]/40 px-3 text-[12.5px] text-[#B1D2FF]">
              {acao.rotulo}
            </button>
          )}
        </div>
      )}
      {dispensar && (
        <button onClick={dispensar} aria-label="Dispensar" className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-full text-[#8B919B] hover:text-[#F4F5F7]">
          <X size={15} />
        </button>
      )}
    </article>
  );
}
