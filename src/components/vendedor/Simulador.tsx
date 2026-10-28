'use client';

// Simulador de preços na página do vendedor: igual ao do portfólio (produto,
// nível, gestão em combo, marca, mensalidade única e pagamento). Brasil pelo
// catálogo retratado no link; EUA pela tabela em dólar do portfólio.

import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { tabelaBRL, formatMoeda, type Moeda } from '@/lib/precos-captacao';
import { simular, parcela, tabelaDaMoeda, NOMES, type Escolha, type Produto } from '@/lib/simulador';
import type { ItemDoCatalogo } from '@/lib/vendedor';

const NIVEIS: Record<Moeda, Record<Produto, string[]>> = {
  BRL: {
    site: ['Essencial', 'Profissional', 'Premium'],
    loja: ['Essencial', 'Profissional', 'Premium'],
    erp: ['Básico', 'Intermediário', 'Avançado'],
  },
  USD: {
    site: ['Starter', 'Business', 'Premium'],
    loja: ['Starter', 'Growth', 'Enterprise'],
    erp: ['Essential', 'Professional', 'Custom'],
  },
};

function Seg<T extends string | number>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: [T, string][];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map(([v, rotulo]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
            v === valor ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary hover:border-accent'
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export function Simulador({
  catalogo,
  inicial,
  moedaInicial = 'BRL',
}: {
  catalogo: ItemDoCatalogo[];
  inicial?: Partial<Escolha>;
  moedaInicial?: Moeda;
}) {
  const tabBRL = useMemo(() => tabelaBRL(new Map(catalogo.map((c) => [c.nome, c.preco]))), [catalogo]);
  const porNome = useMemo(() => new Map(catalogo.map((c) => [c.nome, c])), [catalogo]);
  const [moeda, setMoeda] = useState<Moeda>(moedaInicial);
  const [e, setE] = useState<Escolha>({ produto: 'site', nivel: 0, comGestao: false, nivelGestao: 0, marca: 0, ...inicial });
  const [n, setN] = useState(12);
  const [copiado, setCopiado] = useState(false);

  const t = tabelaDaMoeda(moeda, tabBRL);
  const s = simular(e, t);
  const nomesBR = NOMES.BRL;
  // Prazo e "o que inclui" vêm do catálogo do Brasil (mesmos serviços, em reais).
  const itensBR = [
    nomesBR[e.produto][e.nivel],
    ...(e.comGestao && e.produto !== 'erp' ? [nomesBR.erp[e.nivelGestao]] : []),
    ...(e.marca ? [nomesBR.marca[e.marca - 1]] : []),
  ]
    .map((nome) => porNome.get(nome))
    .filter((x): x is ItemDoCatalogo => !!x);
  const prazo = itensBR.reduce((soma, i) => soma + (i.prazoDias || 0), 0);
  const set = <K extends keyof Escolha>(k: K, v: Escolha[K]) => setE((x) => ({ ...x, [k]: v }));
  const m = (v: number) => formatMoeda(v, moeda);

  const resumo =
    `${s.linhas.map((l) => l.nome).join(' + ')}\n` +
    `Total${s.aPartirDe ? ' (a partir de)' : ''}: ${m(s.total)}${s.desconto ? ` (já com ${m(s.desconto)} de desconto do combo)` : ''}\n` +
    `Depois: ${m(s.mensal)}/mês (hospedagem, segurança, backups e suporte)` +
    (moeda === 'BRL'
      ? `\nPagamento: 50% no fechamento e 50% na entrega, ou 2x de ${m(s.total / 2)} sem juros no cartão, ou ${n}x de ${m(parcela(s.total, n))}.`
      : `\nPayment: 50% to start (${m(s.total / 2)}) and 50% on delivery.`);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o texto continua na tela */
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4 rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div>
          <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[.06em] text-fg-faded">Cliente do</div>
          <Seg<Moeda>
            opcoes={[
              ['BRL', 'Brasil (R$)'],
              ['USD', 'EUA (US$)'],
            ]}
            valor={moeda}
            onChange={setMoeda}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
            O que o cliente precisa
          </div>
          <Seg<Produto>
            opcoes={[
              ['site', 'Site'],
              ['loja', 'Loja virtual'],
              ['erp', 'Só sistema de gestão'],
            ]}
            valor={e.produto}
            onChange={(p) => setE((x) => ({ ...x, produto: p, comGestao: p === 'erp' ? false : x.comGestao }))}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[.06em] text-fg-faded">Nível</div>
          <Seg<0 | 1 | 2>
            opcoes={NIVEIS[moeda][e.produto].map((r, i) => [i as 0 | 1 | 2, r])}
            valor={e.nivel}
            onChange={(v) => set('nivel', v)}
          />
        </div>
        {e.produto !== 'erp' && (
          <div>
            <label className="flex items-center gap-2 text-[13.5px] font-bold">
              <input
                type="checkbox"
                checked={e.comGestao}
                onChange={(ev) => set('comGestao', ev.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              Junto com sistema de gestão (combo com desconto)
            </label>
            {e.comGestao && (
              <div className="mt-2">
                <Seg<0 | 1 | 2>
                  opcoes={NIVEIS[moeda].erp.map((r, i) => [i as 0 | 1 | 2, r])}
                  valor={e.nivelGestao}
                  onChange={(v) => set('nivelGestao', v)}
                />
              </div>
            )}
          </div>
        )}
        <div>
          <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[.06em] text-fg-faded">Marca</div>
          <Seg<0 | 1 | 2 | 3>
            opcoes={[
              [0, 'Já tem'],
              [1, moeda === 'BRL' ? 'Logo Essencial' : 'Logo Design'],
              [2, moeda === 'BRL' ? 'Identidade a partir do logo' : 'Brand kit'],
              [3, moeda === 'BRL' ? 'Identidade completa' : 'Full identity'],
            ]}
            valor={e.marca}
            onChange={(v) => set('marca', v)}
          />
        </div>
      </div>

      <div className="rounded-[18px] border border-accent/40 bg-card p-4 sm:p-5">
        <div className="mb-2 text-[12px] font-extrabold uppercase tracking-[.06em] text-accent">Resumo para o cliente</div>
        {s.linhas.map((l) => (
          <div key={l.nome} className="flex justify-between gap-3 border-b border-divider py-1.5 text-[13.5px]">
            <span>{l.nome}</span>
            <span className="tabular-nums">{m(l.valor)}</span>
          </div>
        ))}
        {s.desconto > 0 && (
          <div className="flex justify-between gap-3 border-b border-divider py-1.5 text-[13.5px] text-success">
            <span>Desconto do combo</span>
            <span className="tabular-nums">− {m(s.desconto)}</span>
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-bold">Total{s.aPartirDe ? ' (a partir de)' : ''}</span>
          <span className="font-display text-[28px] font-bold tabular-nums">{m(s.total)}</span>
        </div>
        <div className="text-[13px] text-fg-tertiary">
          Depois, <b className="text-fg">{m(s.mensal)}/mês</b>
          {s.mensalSeparadas && <s className="ml-1">{m(s.mensalSeparadas)}</s>} · domínio grátis no 1º ano
          {prazo > 0 && moeda === 'BRL' && <> · prazo de até {prazo} dias</>}
        </div>

        {moeda === 'BRL' ? (
          <div className="mt-3 space-y-2 text-[13px]">
            <div className="rounded-[12px] border border-border bg-page/40 p-2.5">
              <b>Pix ou boleto:</b> {m(s.total / 2)} no fechamento + {m(s.total / 2)} na entrega
            </div>
            <div className="rounded-[12px] border border-border bg-page/40 p-2.5">
              <b>Cartão 2x sem juros:</b> 2x de {m(s.total / 2)}
            </div>
            <div className="rounded-[12px] border border-border bg-page/40 p-2.5">
              <div className="mb-1">
                <b>Cartão em {n}x</b> (taxa da operadora): {n}x de {m(parcela(s.total, n))}{' '}
                <span className="text-fg-faded">· total {m(parcela(s.total, n) * n)}</span>
              </div>
              <input
                type="range"
                min={3}
                max={12}
                value={n}
                onChange={(ev) => setN(Number(ev.target.value))}
                className="w-full accent-[var(--color-accent)]"
                aria-label="Número de parcelas"
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-[12px] border border-border bg-page/40 p-2.5 text-[13px]">
            <b>50% to start</b> ({m(s.total / 2)}) and <b>50% on delivery</b> ({m(s.total / 2)}), by card. The second half is only
            paid after approval.
          </div>
        )}

        <button
          onClick={copiar}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-extrabold text-page"
        >
          {copiado ? <Check size={15} /> : <Copy size={15} />}{' '}
          {copiado ? 'Copiado: cole no WhatsApp' : 'Copiar resumo para o cliente'}
        </button>

        {itensBR.length > 0 && (
          <details className="mt-3 text-[12.5px]">
            <summary className="cursor-pointer font-bold text-fg-secondary">O que está incluído</summary>
            <div className="mt-2 space-y-2">
              {itensBR.map((i) => (
                <div key={i.nome}>
                  <div className="font-bold">{i.nome}</div>
                  <div className="leading-relaxed text-fg-tertiary">{i.descricao}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
