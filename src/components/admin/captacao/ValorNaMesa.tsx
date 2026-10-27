'use client';

// Card "Valor na mesa" (total + por país, com bandeira) e os indicadores do topo.

import type { Pais } from '@/lib/captacao';
import { formatMoeda, type Moeda } from '@/lib/precos-captacao';
import { PLAN_MONTHS_DEFAULT } from '@/lib/services';
import { semCentavos } from './comum';

export const PAISES: Pais[] = ['BR', 'US'];
// Portugal e Espanha: espaço reservado (pedido de 27/10). Entram em PAISES
// quando houver preço em euro e mensagens para eles.
type PaisDoCard = Pais | 'PT' | 'ES';
const PAISES_DO_CARD: PaisDoCard[] = ['BR', 'US', 'PT', 'ES'];
const NOME_PAIS: Record<PaisDoCard, string> = { BR: 'Brasil', US: 'EUA', PT: 'Portugal', ES: 'Espanha' };
const ALT_BANDEIRA: Record<PaisDoCard, string> = {
  BR: 'Bandeira do Brasil',
  US: 'Bandeira dos EUA',
  PT: 'Bandeira de Portugal',
  ES: 'Bandeira da Espanha',
};
// SVG (vetor): nítida em qualquer tela. Origem e licença em public/bandeiras/LEIA-ME.txt.
const bandeira = (p: PaisDoCard) => `/bandeiras/${p.toLowerCase()}.svg`;

export type ValorDoPais = {
  pais: Pais;
  moeda: Moeda;
  unico: number;
  mensal: number;
  unicoBRL: number | null;
  mensalBRL: number | null;
};

/** Total em reais primeiro; ao lado, cada país na moeda dele (e em reais, se não for o Brasil). */
export function ValorNaMesa({
  implementacao,
  mensal,
  porPais,
  rodape,
}: {
  implementacao: number;
  mensal: number;
  porPais: ValorDoPais[];
  rodape: string;
}) {
  return (
    <div className="relative col-span-2 overflow-hidden rounded-[16px] border border-accent/40 bg-card p-3.5 sm:rounded-[18px] sm:p-5 lg:col-span-4">
      <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
      <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">Valor na mesa</div>
      <div className="mt-1.5 flex flex-col gap-4 sm:mt-2 lg:gap-8">
        <div className="grid grid-cols-2 gap-3 lg:gap-8">
          <div className="min-w-0">
            <div className="text-[11px] text-fg-faded">Implementação (total, uma vez)</div>
            <div className="truncate font-display text-[22px] font-bold tabular-nums tracking-[-.01em] sm:text-[34px]">
              {semCentavos(implementacao)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-fg-faded">Mensalidades (total, todo mês)</div>
            <div className="truncate font-display text-[22px] font-bold tabular-nums tracking-[-.01em] sm:text-[34px]">
              {semCentavos(mensal)}
              <span className="text-[13px] font-bold text-fg-tertiary">/mês</span>
            </div>
            {/* Duração padrão do contrato nas propostas do ERP. */}
            <div className="text-[11.5px] tabular-nums text-fg-tertiary">
              = {semCentavos(mensal * PLAN_MONTHS_DEFAULT)} em {PLAN_MONTHS_DEFAULT} meses de contrato
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-divider pt-4 lg:grid-cols-4">
        {PAISES_DO_CARD.map((codigo) => {
          const p = porPais.find((x) => x.pais === codigo);
          return (
            <div
              key={codigo}
              className={`flex flex-col items-start gap-2 rounded-[14px] border border-border bg-page/40 p-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-4 sm:py-4 ${p ? '' : 'opacity-60'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bandeira(codigo)}
                alt={ALT_BANDEIRA[codigo]}
                width={48}
                height={36}
                className="h-[36px] w-[48px] flex-shrink-0 rounded-[6px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,.12)]"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{NOME_PAIS[codigo]}</div>
                {p ? (
                  <>
                    <div className="mt-0.5 text-[16px] font-bold tabular-nums leading-tight sm:text-[18px]">
                      {formatMoeda(p.unico, p.moeda)}
                    </div>
                    <div className="text-[12.5px] font-bold tabular-nums text-fg-tertiary">
                      + {formatMoeda(p.mensal, p.moeda)}/mês
                    </div>
                    {p.moeda !== 'BRL' && (
                      <div className="text-[12px] tabular-nums text-fg-tertiary">
                        {p.unicoBRL === null
                          ? 'sem cotação hoje'
                          : `≈ ${semCentavos(p.unicoBRL)} + ${semCentavos(p.mensalBRL ?? 0)}/mês`}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-0.5 text-[13px] font-bold text-fg-tertiary">
                    {PAISES.includes(codigo as Pais) ? 'Sem leads em aberto' : 'Em breve'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 line-clamp-2 text-[11px] leading-snug text-fg-tertiary sm:text-[12.5px]">{rodape}</div>
    </div>
  );
}

export function Indicador({ rotulo, valor, rodape }: { rotulo: string; valor: string; rodape: string }) {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-border bg-card p-3.5 sm:rounded-[18px] sm:p-5">
      <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
      <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{rotulo}</div>
      <div className="mt-1.5 font-display text-[21px] font-bold tabular-nums tracking-[-.01em] sm:mt-2 sm:text-[28px]">
        {valor}
      </div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-tertiary sm:text-[12.5px]">{rodape}</div>
    </div>
  );
}
