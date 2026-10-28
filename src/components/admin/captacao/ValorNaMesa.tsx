'use client';

// Card "Dinheiro na mesa" (total + por país, com bandeira) e os indicadores do topo.
// Números correm até o valor e os cartões entram em sequência (framer-motion).

import { motion, useReducedMotion } from 'framer-motion';
import type { Pais } from '@/lib/captacao';
import { formatMoeda, type Moeda } from '@/lib/precos-captacao';
import { PLAN_MONTHS_DEFAULT } from '@/lib/services';
import { semCentavos } from './comum';
import { NumeroAnimado, SUAVE } from '@/components/captacao/NumeroAnimado';

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
  const calmo = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: calmo ? 0 : 0.5, ease: SUAVE }}
      className="borda-dinheiro relative overflow-hidden rounded-[18px] border bg-card p-3.5 sm:rounded-[22px] sm:p-5"
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#30d158] via-[#66d4cf] to-[#64d2ff]" />
      {/* Brilho dourado que passa pelo card de tempos em tempos */}
      {!calmo && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-accent/[.07] to-transparent"
          animate={{ x: ['0%', '450%'] }}
          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
        />
      )}
      <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#30d158]">Dinheiro na mesa</div>
      <div className="mt-1.5 flex flex-col gap-4 sm:mt-2 lg:gap-8">
        <div className="grid grid-cols-2 gap-3 lg:gap-8">
          <div className="min-w-0">
            <div className="text-[11px] text-fg-faded">Implementação (total, uma vez)</div>
            <div className="texto-dinheiro truncate font-display text-[22px] font-bold tabular-nums tracking-[-.01em] sm:text-[34px]">
              <NumeroAnimado valor={implementacao} formato={semCentavos} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-fg-faded">Mensalidades (total, todo mês)</div>
            <div className="texto-dinheiro truncate font-display text-[22px] font-bold tabular-nums tracking-[-.01em] sm:text-[34px]">
              <NumeroAnimado valor={mensal} formato={semCentavos} />
              <span className="text-[13px] font-bold text-fg-tertiary">/mês</span>
            </div>
            {/* Duração padrão do contrato nas propostas do ERP. */}
            <div className="text-[11.5px] tabular-nums text-fg-tertiary">
              = {semCentavos(mensal * PLAN_MONTHS_DEFAULT)} em {PLAN_MONTHS_DEFAULT} meses de contrato
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-divider pt-4">
        {PAISES_DO_CARD.map((codigo, i) => {
          const p = porPais.find((x) => x.pais === codigo);
          return (
            <motion.div
              key={codigo}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: p ? 1 : 0.6, y: 0 }}
              whileHover={calmo ? undefined : { y: -2 }}
              transition={{ duration: calmo ? 0 : 0.45, delay: calmo ? 0 : 0.25 + i * 0.07, ease: SUAVE }}
              className="flex flex-col items-start gap-2 rounded-[14px] border border-border bg-page/40 p-3 transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:gap-3.5 sm:px-4 sm:py-4"
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
                    {/* Moeda estrangeira: a conversão em reais vem logo ao lado de cada valor. */}
                    <div className="mt-0.5 text-[16px] font-bold tabular-nums leading-tight sm:text-[18px]">
                      <NumeroAnimado valor={p.unico} formato={(v) => formatMoeda(v, p.moeda)} />
                      {p.moeda !== 'BRL' && p.unicoBRL !== null && (
                        <span className="ml-1.5 text-[12.5px] font-bold text-fg-tertiary sm:text-[13px]">
                          ≈ <NumeroAnimado valor={p.unicoBRL} formato={semCentavos} />
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] font-bold tabular-nums text-fg-tertiary">
                      + {formatMoeda(p.mensal, p.moeda)}/mês
                      {p.moeda !== 'BRL' && p.mensalBRL !== null && (
                        <span className="ml-1.5 font-semibold">≈ {semCentavos(p.mensalBRL)}/mês</span>
                      )}
                    </div>
                    {p.moeda !== 'BRL' && p.unicoBRL === null && (
                      <div className="text-[12px] text-fg-tertiary">sem cotação hoje para converter</div>
                    )}
                  </>
                ) : (
                  <div className="mt-0.5 text-[13px] font-bold text-fg-tertiary">
                    {PAISES.includes(codigo as Pais) ? 'Sem leads em aberto' : 'Em breve'}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-2 line-clamp-2 text-[11px] leading-snug text-fg-tertiary sm:text-[12.5px]">{rodape}</div>
    </motion.div>
  );
}

/** Indicador do topo. Número: corre até o valor; texto: aparece como está. */
export function Indicador({
  rotulo,
  valor,
  rodape,
  i = 0,
  cor = 'var(--color-accent)',
}: {
  rotulo: string;
  valor: number | string;
  rodape: string;
  /** Ordem na entrada em sequência. */
  i?: number;
  /** Cor do indicador (barra, rótulo e brilho). */
  cor?: string;
}) {
  const calmo = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={calmo ? undefined : { y: -3 }}
      transition={{ duration: calmo ? 0 : 0.45, delay: calmo ? 0 : 0.15 + i * 0.07, ease: SUAVE }}
      className="relative overflow-hidden rounded-[18px] border border-border bg-card p-3.5 sm:rounded-[22px] sm:p-5"
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: cor }} />
      {/* Brilho da cor do indicador no canto */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl"
        style={{ background: cor }}
      />
      <div className="relative text-[11px] font-extrabold uppercase tracking-[.08em]" style={{ color: cor }}>
        {rotulo}
      </div>
      <div className="mt-1.5 font-display text-[21px] font-bold tabular-nums tracking-[-.01em] sm:mt-2 sm:text-[28px]">
        {typeof valor === 'number' ? <NumeroAnimado valor={valor} /> : valor}
      </div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-tertiary sm:text-[12.5px]">{rodape}</div>
    </motion.div>
  );
}
