'use client';

// Resumo da conversa no topo do atendimento (pedido do dono em 28/10/2026): o
// texto da Lia, o próximo passo em destaque e a descoberta em campos com nome,
// em vez de um parágrafo corrido. A descoberta vem do lead; na conversa
// arquivada de um reinício, do retrato guardado no resumo.

import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { CHECKLIST, type RespostasDoChecklist } from '@/lib/checklist-descoberta';

const MARCA_DO_REINICIO = 'Descoberta antes do reinício:';

// Nomes curtos para caber no cartão; os 4 primeiros são os que decidem a venda.
const ROTULO: Record<string, string> = {
  dores: 'Dores',
  custoDoGap: 'Custo de ficar como está',
  decisor: 'Quem decide',
  investimento: 'Investimento',
  estadoAtual: 'Como está hoje',
  estadoDesejado: 'Aonde quer chegar',
  origemClientes: 'Clientes chegam por',
  usaHoje: 'Usa hoje',
  interesse: 'Interesse',
  urgencia: 'Urgência',
  tentativas: 'Já tentou',
  melhorContato: 'Melhor contato',
  observacoes: 'Observações',
};
const ORDEM = Object.keys(ROTULO);
const PRINCIPAIS = 4;

function separar(resumo: string | null): { texto: string; proximo: string | null; retrato: RespostasDoChecklist | null } {
  let texto = resumo ?? '';
  let retrato: RespostasDoChecklist | null = null;
  const i = texto.indexOf(MARCA_DO_REINICIO);
  if (i >= 0) {
    try {
      retrato = JSON.parse(texto.slice(i + MARCA_DO_REINICIO.length).trim());
    } catch {
      retrato = null;
    }
    texto = texto.slice(0, i).trim();
  }
  const p = texto.search(/pr[oó]ximo passo\s*:/i);
  if (p < 0) return { texto, proximo: null, retrato };
  return {
    texto: texto.slice(0, p).trim(),
    proximo: texto.slice(p).replace(/^pr[oó]ximo passo\s*:\s*/i, '').trim(),
    retrato,
  };
}

export function ResumoDaConversa({ resumo, descoberta }: { resumo: string | null; descoberta: RespostasDoChecklist }) {
  const [tudo, setTudo] = useState(false);
  const { texto, proximo, retrato } = separar(resumo);
  const doLead = Object.keys(descoberta).length > 0;
  const respostas = doLead ? descoberta : (retrato ?? {});
  const campos = ORDEM.map((k) => [k, respostas[k]] as const).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v?.trim()));
  if (!texto && !proximo && campos.length === 0) return null;
  const visiveis = tudo ? campos : campos.slice(0, PRINCIPAIS);

  return (
    <div className="mx-3 mt-2 space-y-2.5 rounded-[14px] bg-card p-3.5">
      {texto && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <Sparkles size={12} className="text-accent" /> Resumo da Lia
          </div>
          <p className="text-[13px] leading-relaxed text-fg-secondary">{texto}</p>
        </div>
      )}

      {proximo && (
        <div className="flex items-start gap-2 rounded-[10px] border border-accent/40 bg-accent/[.07] px-3 py-2">
          <ArrowRight size={14} className="mt-0.5 shrink-0 text-accent" />
          <div className="text-[13px] leading-snug">
            <b className="text-accent">Próximo passo:</b> {proximo}
          </div>
        </div>
      )}

      {campos.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              {doLead ? 'Descoberta' : 'Descoberta antes do reinício'}{' '}
              <span className="text-fg-tertiary">
                · {campos.length} de {CHECKLIST.length}
              </span>
            </span>
            {campos.length > PRINCIPAIS && (
              <button onClick={() => setTudo((x) => !x)} className="flex items-center gap-0.5 text-[12px] font-bold text-accent">
                {tudo ? (
                  <>
                    menos <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    ver tudo <ChevronDown size={13} />
                  </>
                )}
              </button>
            )}
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            {visiveis.map(([k, v]) => (
              <div key={k} className="rounded-[10px] bg-page/50 px-3 py-2">
                <dt className="text-[11px] font-bold text-fg-tertiary">{ROTULO[k]}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-snug">
                  {Array.isArray(v) ? (
                    <span className="flex flex-wrap gap-1">
                      {v.map((x) => (
                        <span key={x} className="rounded-full bg-accent/12 px-2 py-0.5 text-[11.5px] font-bold text-accent">
                          {x}
                        </span>
                      ))}
                    </span>
                  ) : (
                    v
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
