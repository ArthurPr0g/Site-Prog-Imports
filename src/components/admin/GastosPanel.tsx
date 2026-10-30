'use client';

// Página de Gastos (30/10/2026): números reais com animação (contadores, barras e colunas que crescem,
// período com pílula deslizante) no design "Noite azul". Um único azul nos gráficos: todos medem
// magnitude. Cada gráfico tem dica ao passar o mouse e a tabela dos números logo abaixo.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Bot, CalendarDays, CreditCard, Users, Coins, Gauge, MessageCircle, Mic, Plus, Receipt, Save, Settings2, Target, Trash2, TrendingUp, TriangleAlert, CircleCheck } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { gastosAction, salvarCustosAction, type ConfigDeCustos, type CustoFixo, type Gastos, type Periodo, type RecargaDeCredito } from '@/app/actions/gastos';

const PERIODOS: [Periodo, string][] = [
  ['mes', 'Este mês'],
  ['7d', '7 dias'],
  ['30d', '30 dias'],
  ['tudo', 'Tudo'],
];

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const usd = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: v < 1 ? 3 : 2, maximumFractionDigits: v < 1 ? 3 : 2 })}`;
const mil = (v: number) => v.toLocaleString('pt-BR');

/** Contador que sobe até o valor (desliga com movimento reduzido). */
function useContador(alvo: number, ms = 900) {
  const [v, setV] = useState(0);
  const de = useRef(0);
  useEffect(() => {
    const reduzido = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inicio = de.current;
    if (reduzido) {
      de.current = alvo;
      const id = requestAnimationFrame(() => setV(alvo));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let id = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(inicio + (alvo - inicio) * e);
      if (p < 1) id = requestAnimationFrame(passo);
      else de.current = alvo;
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [alvo, ms]);
  return v;
}

function Numero({ valor, formato }: { valor: number; formato: (v: number) => string }) {
  return <span className="tabular-nums">{formato(useContador(valor))}</span>;
}

function Cartao({ children, className = '', atraso = 0 }: { children: React.ReactNode; className?: string; atraso?: number }) {
  return (
    <div className={`g-entrar g-cartao rounded-[18px] border border-border bg-card p-4 ${className}`} style={{ animationDelay: `${atraso}ms` }}>
      {children}
    </div>
  );
}

function Titulo({ Icon, children, dica }: { Icon: typeof Coins; children: React.ReactNode; dica?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-accent">
        <Icon size={14} />
      </span>
      <b className="text-[14px]">{children}</b>
      {dica && <span className="text-[11.5px] text-fg-tertiary">{dica}</span>}
    </div>
  );
}

/** Barras horizontais (magnitude, um azul só) com o valor ao lado. */
function Barras({ itens, formato }: { itens: { nome: string; valor: number; detalhe?: string }[]; formato: (v: number) => string }) {
  const max = Math.max(...itens.map((i) => i.valor), 1e-9);
  if (!itens.length) return <p className="text-[12.5px] text-fg-faded">Nada no período.</p>;
  return (
    <div className="grid gap-2.5">
      {itens.map((i, k) => (
        <div key={i.nome} className="group grid gap-1" title={`${i.nome}: ${formato(i.valor)}${i.detalhe ? ` · ${i.detalhe}` : ''}`}>
          <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
            <span className="truncate text-fg-secondary group-hover:text-fg">{i.nome}</span>
            <span className="tabular-nums text-fg">{formato(i.valor)}</span>
          </div>
          <div className="h-[8px] overflow-hidden rounded-full bg-white/5">
            <div
              className="g-barra h-full rounded-full"
              style={{ width: `${Math.max(1.5, (i.valor / max) * 100)}%`, background: 'linear-gradient(90deg, #4c63f5, #7b8fff)', animationDelay: `${150 + k * 70}ms` }}
            />
          </div>
          {i.detalhe && <span className="text-[11px] text-fg-faded">{i.detalhe}</span>}
        </div>
      ))}
    </div>
  );
}

/** Colunas por dia, com dica ao passar o mouse e tabela abaixo. */
function PorDia({ dados, dolar }: { dados: Gastos['porDia']; dolar: number }) {
  const [foco, setFoco] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);
  if (!dados.length) return <p className="text-[12.5px] text-fg-faded">Sem gastos no período.</p>;
  const total = dados.map((d) => d.ia + d.meta);
  const max = Math.max(...total, 1e-9);
  const f = foco !== null ? dados[foco] : null;
  return (
    <div>
      <div className="relative">
        <div className="flex h-[150px] items-end gap-[3px] border-b border-border/60 pb-px" onMouseLeave={() => setFoco(null)}>
          {dados.map((d, i) => (
            <button
              key={d.dia}
              aria-label={`${d.dia.split('-').reverse().join('/')}: ${usd(total[i])}`}
              onMouseEnter={() => setFoco(i)}
              onFocus={() => setFoco(i)}
              onClick={() => setFoco(i)}
              className="flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className="g-coluna block w-full rounded-t-[4px]"
                style={{
                  height: `${Math.max(2, (total[i] / max) * 100)}%`,
                  background: foco === i ? '#9aa9ff' : 'linear-gradient(180deg, #7b8fff, #4c63f5)',
                  animationDelay: `${i * 25}ms`,
                }}
              />
            </button>
          ))}
        </div>
        {f && (
          <div className="g-dica pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-[10px] border border-border-strong bg-[#0d1330] px-3 py-1.5 text-[12px] shadow-lg">
            <b>{f.dia.split('-').reverse().join('/')}</b> · {usd(f.ia + f.meta)} ({brl((f.ia + f.meta) * dolar)})
            <span className="block text-fg-tertiary">
              IA {usd(f.ia)} · Meta {usd(f.meta)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-fg-faded">
        <span>{dados[0].dia.split('-').reverse().slice(0, 2).join('/')}</span>
        <button onClick={() => setTabela((t) => !t)} className="text-accent">
          {tabela ? 'esconder tabela' : 'ver tabela'}
        </button>
        <span>{dados[dados.length - 1].dia.split('-').reverse().slice(0, 2).join('/')}</span>
      </div>
      {tabela && (
        <table className="g-entrar mt-2 w-full text-[12px]">
          <thead className="text-fg-tertiary">
            <tr>
              <th className="text-left font-normal">Dia</th>
              <th className="text-right font-normal">IA</th>
              <th className="text-right font-normal">Meta</th>
              <th className="text-right font-normal">Total (R$)</th>
            </tr>
          </thead>
          <tbody>
            {[...dados].reverse().map((d) => (
              <tr key={d.dia} className="border-t border-border/40">
                <td>{d.dia.split('-').reverse().join('/')}</td>
                <td className="text-right tabular-nums">{usd(d.ia)}</td>
                <td className="text-right tabular-nums">{usd(d.meta)}</td>
                <td className="text-right tabular-nums">{brl((d.ia + d.meta) * dolar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Campo({ rotulo, dica, valor, onChange, passo = 0.01, vazio }: { rotulo: string; dica?: string; valor: number | null; onChange: (v: number | null) => void; passo?: number; vazio?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-[12px] font-bold text-fg-secondary">{rotulo}</span>
      <input
        type="number"
        step={passo}
        value={valor ?? ''}
        placeholder={vazio}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13.5px] tabular-nums outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_rgba(91,116,255,0.25)]"
      />
      {dica && <span className="text-[11px] text-fg-faded">{dica}</span>}
    </label>
  );
}

export function GastosPanel() {
  const toast = useToast();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [d, setD] = useState<Gastos | null>(null);
  const [cfg, setCfg] = useState<ConfigDeCustos | null>(null);
  const [teto, setTeto] = useState(30);
  const [mudou, setMudou] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const abas = useRef<(HTMLButtonElement | null)[]>([]);
  const [pilula, setPilula] = useState({ x: 0, w: 0 });

  const carregar = useCallback((p: Periodo) => {
    let vivo = true;
    gastosAction(p).then((r) => {
      if (!vivo || !r) return;
      setD(r);
      setCfg(r.config);
      setTeto(r.tetoUsd);
      setMudou(false);
    });
    return () => {
      vivo = false;
    };
  }, []);
  useEffect(() => carregar(periodo), [periodo, carregar]);
  useEffect(() => {
    const el = abas.current[PERIODOS.findIndex(([p]) => p === periodo)];
    if (!el) return;
    const id = requestAnimationFrame(() => setPilula({ x: el.offsetLeft, w: el.offsetWidth }));
    return () => cancelAnimationFrame(id);
  }, [periodo, d]);

  const alterar = (parcial: Partial<ConfigDeCustos>) => {
    if (!cfg) return;
    setCfg({ ...cfg, ...parcial });
    setMudou(true);
  };
  const fixo = (i: number, parcial: Partial<CustoFixo>) => alterar({ fixos: cfg!.fixos.map((f, k) => (k === i ? { ...f, ...parcial } : f)) });
  const recarga = (i: number, parcial: Partial<RecargaDeCredito>) =>
    alterar({ recargas: (cfg!.recargas ?? []).map((r, k) => (k === i ? { ...r, ...parcial } : r)) });
  const salvar = () =>
    startSalvar(async () => {
      if (!cfg) return;
      const r = await salvarCustosAction(cfg, teto);
      toast(r);
      if (r.ok) carregar(periodo);
    });

  if (!d || !cfg) {
    return (
      <div className="tema-apple gastos grid gap-4 [color-scheme:dark] sm:grid-cols-4">
        <div className="aurora" aria-hidden />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[110px] animate-pulse rounded-[18px] border border-border bg-card" />
        ))}
      </div>
    );
  }

  const usoTeto = d.tetoUsd ? d.iaMesUsd / d.tetoUsd : 0;
  const status = usoTeto >= 1 ? { cor: 'text-error', Icon: TriangleAlert, nome: 'Teto atingido: a Lia parou de responder' } : usoTeto >= 0.8 ? { cor: 'text-warning', Icon: TriangleAlert, nome: 'Perto do teto' } : { cor: 'text-success', Icon: CircleCheck, nome: 'Dentro do teto' };
  const nomePeriodo = PERIODOS.find(([p]) => p === periodo)![1].toLowerCase();

  return (
    <div className="tema-apple gastos space-y-4 [color-scheme:dark]">
      <div className="aurora" aria-hidden />

      {/* Período */}
      <div className="g-entrar flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex rounded-full border border-border bg-card p-1">
          <span className="g-pilula absolute top-1 h-[calc(100%-8px)] rounded-full bg-accent" style={{ transform: `translateX(${pilula.x - 4}px)`, width: pilula.w }} aria-hidden />
          {PERIODOS.map(([p, nome], i) => (
            <button
              key={p}
              ref={(el) => {
                abas.current[i] = el;
              }}
              onClick={() => setPeriodo(p)}
              className={`relative z-10 rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${p === periodo ? 'text-white' : 'text-fg-tertiary hover:text-fg'}`}
            >
              {nome}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-fg-tertiary">
          Dólar: {brl(d.dolar)} {d.dolarDoDia ? '(cotação do dia)' : '(definido por você)'}
        </span>
      </div>

      {/* Números principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao className="borda-degrade g-brilho" atraso={0}>
          <span className="text-[12px] text-fg-tertiary">Total gasto · {nomePeriodo}</span>
          <div className="texto-degrade mt-1 text-[30px] font-extrabold leading-none">
            <Numero valor={d.totalBrl} formato={brl} />
          </div>
          <span className="mt-1 block text-[11.5px] text-fg-faded">IA, Meta, transcrição e fixos</span>
        </Cartao>
        <Cartao atraso={70}>
          <span className="flex items-center gap-1.5 text-[12px] text-fg-tertiary">
            <Bot size={13} /> Inteligência artificial
          </span>
          <div className="mt-1 text-[24px] font-extrabold leading-none">
            <Numero valor={d.ia.usd} formato={usd} />
          </div>
          <span className="mt-1 block text-[11.5px] text-fg-faded">
            {brl(d.ia.usd * d.dolar)} · {mil(d.ia.chamadas)} chamadas
          </span>
        </Cartao>
        <Cartao atraso={140}>
          <span className="flex items-center gap-1.5 text-[12px] text-fg-tertiary">
            <Target size={13} /> Custo por venda
          </span>
          <div className="mt-1 text-[24px] font-extrabold leading-none">
            {d.vendas.custoPorVendaBrl !== null ? <Numero valor={d.vendas.custoPorVendaBrl} formato={brl} /> : '—'}
          </div>
          <span className="mt-1 block text-[11.5px] text-fg-faded">
            {d.vendas.fechadas ? `${d.vendas.fechadas} venda(s) · gasto ÷ vendas` : 'Ainda sem venda fechada'}
          </span>
        </Cartao>
        <Cartao atraso={210}>
          <span className="flex items-center gap-1.5 text-[12px] text-fg-tertiary">
            <TrendingUp size={13} /> Estimativa por projeto
          </span>
          <div className="mt-1 text-[24px] font-extrabold leading-none">
            <Numero valor={d.estimativa.usd * d.dolar} formato={brl} />
          </div>
          <span className="mt-1 block text-[11.5px] text-fg-faded">{usd(d.estimativa.usd)} · estimativa, ajustável abaixo</span>
        </Cartao>
      </div>

      {/* Teto da IA */}
      <Cartao atraso={260}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Titulo Icon={Gauge}>Teto mensal da IA</Titulo>
          <span className={`flex items-center gap-1.5 text-[12.5px] font-bold ${status.cor}`}>
            <status.Icon size={14} /> {status.nome}
          </span>
        </div>
        <div className="h-[12px] overflow-hidden rounded-full bg-white/5">
          <div className="barra-cor g-barra h-full rounded-full" style={{ width: `${Math.min(100, Math.max(1, usoTeto * 100))}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[12px] text-fg-tertiary">
          <span>
            {usd(d.iaMesUsd)} de {usd(d.tetoUsd)} neste mês ({Math.round(usoTeto * 100)}%)
          </span>
          <span>Ao atingir, a Lia para de responder e te avisa</span>
        </div>
      </Cartao>

      {/* Créditos da API da Anthropic (recargas lançadas) */}
      <Cartao atraso={270}>
        <Titulo Icon={CreditCard} dica="A Anthropic não informa o saldo por API: as recargas são lançadas aqui, em Parâmetros">
          Créditos da API (Anthropic)
        </Titulo>
        {d.creditos.recargas.length === 0 ? (
          <p className="text-[13px] text-fg-tertiary">Nenhuma recarga lançada. Lance em Parâmetros, lá embaixo, em “Recargas de crédito da API”.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-fg-faded">Recarregado</span>
                <span className="block text-[22px] font-extrabold tabular-nums text-fg">{usd(d.creditos.totalUsd)}</span>
                <span className="block text-[12px] text-fg-tertiary">{brl(d.creditos.totalBrl)}</span>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-fg-faded">Gasto da Lia desde então</span>
                <span className="block text-[22px] font-extrabold tabular-nums text-fg">{usd(d.creditos.gastoUsd)}</span>
                <span className="block text-[12px] text-fg-tertiary">{brl(d.creditos.gastoUsd * d.dolar)}</span>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-fg-faded">Saldo estimado</span>
                <span className={`block text-[22px] font-extrabold tabular-nums ${d.creditos.saldoUsd < 3 ? 'text-error' : 'text-success'}`}>{usd(Math.max(0, d.creditos.saldoUsd))}</span>
                <span className="block text-[12px] text-fg-tertiary">{brl(Math.max(0, d.creditos.saldoUsd) * d.dolar)}</span>
              </div>
            </div>
            <table className="mt-3 w-full text-[12.5px]">
              <tbody>
                {d.creditos.recargas.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-1.5">{r.data.split('-').reverse().join('/')}</td>
                    <td className="py-1.5 text-right tabular-nums">{usd(r.usd)}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-fg">{brl(r.brl)}</td>
                    <td className="py-1.5 text-right text-fg-tertiary">{r.brl_pago ? 'valor da fatura' : r.dolar ? `dólar a ${brl(r.dolar)}` : 'dólar de hoje'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-fg-tertiary">
              Saldo estimado = recargas menos o gasto da Lia medido pelo sistema. O saldo exato fica em{' '}
              <a href="https://platform.claude.com/settings/billing" target="_blank" rel="noreferrer" className="text-accent underline">
                Billing da Anthropic
              </a>
              {' '}(outros usos da mesma chave não entram aqui).
            </p>
          </>
        )}
      </Cartao>

      {/* Gasto por agente (0110) */}
      <Cartao atraso={280}>
        <Titulo Icon={Users} dica={`${nomePeriodo} · dólar a ${brl(d.dolar)}`}>
          Gasto por agente
        </Titulo>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-[.06em] text-fg-faded">
                <th className="pb-2">Agente</th>
                <th className="pb-2 text-right">Execuções</th>
                <th className="pb-2 text-right">Dólar</th>
                <th className="pb-2 text-right">Real</th>
                <th className="pb-2 text-right">Por execução</th>
              </tr>
            </thead>
            <tbody>
              {d.agentes.map((a) => {
                const medidas = a.execucoes - a.semMedicao;
                return (
                  <tr key={a.chave} className="border-t border-white/5">
                    <td className="py-2 pr-2">
                      <span className="font-bold text-fg">{a.nome}</span>{' '}
                      <span
                        className={`ml-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${a.cobranca === 'api' ? 'bg-accent/15 text-accent' : 'bg-white/8 text-fg-tertiary'}`}
                        title={a.cobranca === 'api' ? 'Cobrado na API da Anthropic' : 'Roda pela assinatura do Claude: valor equivalente em preço de API, não cobrado à parte'}
                      >
                        {a.cobranca === 'api' ? 'API' : 'assinatura'}
                      </span>
                      <span className="block text-[11.5px] text-fg-tertiary">
                        {a.papel}
                        {a.semMedicao ? ` · ${a.semMedicao} sem medição` : ''}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{mil(a.execucoes)}</td>
                    <td className="py-2 text-right tabular-nums">{usd(a.usd)}</td>
                    <td className="py-2 text-right font-bold tabular-nums text-fg">{brl(a.usd * d.dolar)}</td>
                    <td className="py-2 text-right tabular-nums text-fg-tertiary">{medidas > 0 ? usd(a.usd / medidas) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-fg-tertiary">
          <b className="text-fg">Lia</b>: gasto real na API (execuções = chamadas à IA). <b className="text-fg">Agentes do Claude Code</b>: rodam pela sua assinatura do Claude; o valor é o equivalente em preço de API que cada execução informa, para comparar quem pesa mais. Medição desde 30/10/2026, só das execuções no PC.
        </p>
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao atraso={300}>
          <Titulo Icon={Receipt} dica={nomePeriodo}>
            Composição do gasto
          </Titulo>
          <Barras itens={d.partes.map((p) => ({ nome: p.nome, valor: p.brl, detalhe: p.detalhe }))} formato={brl} />
        </Cartao>
        <Cartao atraso={340}>
          <Titulo Icon={CalendarDays} dica="IA + mensagens modelo, em dólar">
            Gasto por dia
          </Titulo>
          <PorDia dados={d.porDia} dolar={d.dolar} />
        </Cartao>
        <Cartao atraso={380}>
          <Titulo Icon={Bot} dica="onde a IA trabalha">
            IA por finalidade
          </Titulo>
          <Barras itens={d.ia.porFinalidade.map((f) => ({ nome: f.nome, valor: f.usd }))} formato={usd} />
          <div className="mt-4">
            <Titulo Icon={Coins}>IA por modelo</Titulo>
            <Barras itens={d.ia.porModelo.map((f) => ({ nome: f.nome, valor: f.usd }))} formato={usd} />
          </div>
          <p className="mt-3 text-[11.5px] text-fg-faded">
            Tokens: {mil(d.ia.tokens.entrada)} de entrada · {mil(d.ia.tokens.saida)} de saída · {mil(d.ia.tokens.cache)} em cache
          </p>
        </Cartao>
        <Cartao atraso={420}>
          <Titulo Icon={MessageCircle} dica="cobrado por mensagem entregue">
            Mensagens da Meta
          </Titulo>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Modelos', d.meta.modelos, `${usd(cfg.meta_utilidade_usd)} cada`],
              ['Serviço', d.meta.servico, 'texto livre em 24 h'],
              ['Grátis restantes', d.meta.servicoGratisRestante, 'de serviço no mês'],
            ].map(([nome, n, sub]) => (
              <div key={nome as string} className="rounded-[14px] border border-border bg-white/[0.03] p-3">
                <div className="text-[22px] font-extrabold">
                  <Numero valor={n as number} formato={(v) => mil(Math.round(v))} />
                </div>
                <div className="text-[12px] text-fg-secondary">{nome as string}</div>
                <div className="text-[10.5px] text-fg-faded">{sub as string}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-fg-tertiary">
            Custo no período: <b className="text-fg">{usd(d.meta.usd)}</b> ({brl(d.meta.usd * d.dolar)}). Botões não mudam o preço: o que conta é a categoria do modelo.
          </p>
          <div className="mt-4">
            <Titulo Icon={Mic}>Transcrição de áudio</Titulo>
            <p className="text-[12.5px] text-fg-secondary">
              {mil(d.transcricao.audios)} áudio(s) · {usd(d.transcricao.usd)}
              {!cfg.transcricao_usd_hora ? ' · preencha o preço por hora nas configurações' : ''}
            </p>
          </div>
        </Cartao>
        <Cartao atraso={460}>
          <Titulo Icon={Target} dica="IA no período, sem o simulador">
            Leads que mais gastaram
          </Titulo>
          <Barras itens={d.leads.map((l) => ({ nome: `${l.nome}`, valor: l.usd, detalhe: l.status }))} formato={usd} />
        </Cartao>
        <Cartao atraso={500}>
          <Titulo Icon={TrendingUp} dica="estimativa, não é gasto real">
            Projeção de um projeto indicado
          </Titulo>
          <Barras itens={d.estimativa.partes.map((p) => ({ nome: p.nome, valor: p.usd }))} formato={usd} />
          <p className="mt-3 text-[11.5px] text-fg-faded">
            Base: {usd(d.estimativa.base.porResposta)} por resposta da Lia ({d.estimativa.base.medidoPorResposta ? 'medido' : 'referência inicial'}) e{' '}
            {usd(d.estimativa.base.porPesquisa)} por pesquisa ({d.estimativa.base.medidoPorPesquisa ? 'medido' : 'referência inicial'}). Conforme os projetos
            acontecem, a base passa a ser o custo medido.
          </p>
        </Cartao>
      </div>

      {/* Configurações editáveis */}
      <Cartao atraso={540}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Titulo Icon={Settings2} dica="mexa à vontade: os números acima usam estes valores">
            Configurações dos gastos
          </Titulo>
          <button
            onClick={salvar}
            disabled={!mudou || salvando}
            className={`flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-[13px] font-extrabold disabled:opacity-50 ${mudou ? 'g-pulso' : ''}`}
          >
            <Save size={14} /> {salvando ? 'Salvando…' : mudou ? 'Salvar' : 'Salvo'}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Teto mensal da IA (US$)" valor={teto} passo={1} onChange={(v) => { setTeto(v ?? 0); setMudou(true); }} dica="A Lia para ao atingir" />
          <Campo rotulo="Dólar (R$)" valor={cfg.dolar} vazio={`cotação do dia: ${d.dolar.toFixed(2)}`} onChange={(v) => alterar({ dolar: v })} dica="Vazio = cotação do dia" />
          <Campo rotulo="Meta: modelo utilidade (US$)" valor={cfg.meta_utilidade_usd} passo={0.0001} onChange={(v) => alterar({ meta_utilidade_usd: v ?? 0 })} dica="Brasil: US$ 0,0068 (Meta, out/2026)" />
          <Campo rotulo="Meta: modelo marketing (US$)" valor={cfg.meta_marketing_usd} passo={0.0001} onChange={(v) => alterar({ meta_marketing_usd: v ?? 0 })} dica="Se a Meta reclassificar um modelo" />
          <Campo rotulo="Meta: serviço grátis por mês" valor={cfg.meta_servico_gratis_mes} passo={1} onChange={(v) => alterar({ meta_servico_gratis_mes: v ?? 0 })} />
          <Campo rotulo="Meta: serviço acima disso (US$)" valor={cfg.meta_servico_usd} passo={0.0001} onChange={(v) => alterar({ meta_servico_usd: v ?? 0 })} />
          <Campo rotulo="Transcrição (US$ por hora)" valor={cfg.transcricao_usd_hora} passo={0.001} onChange={(v) => alterar({ transcricao_usd_hora: v ?? 0 })} dica="Preço do seu plano no provedor" />
          <Campo rotulo="Minutos por áudio (média)" valor={cfg.minutos_por_audio} passo={0.1} onChange={(v) => alterar({ minutos_por_audio: v ?? 1 })} />
          <Campo rotulo="Respostas da Lia por projeto" valor={cfg.respostas_por_projeto} passo={1} onChange={(v) => alterar({ respostas_por_projeto: v ?? 40 })} dica="Premissa da projeção" />
          <Campo rotulo="Pesquisas do lead por projeto" valor={cfg.pesquisas_por_projeto} passo={1} onChange={(v) => alterar({ pesquisas_por_projeto: v ?? 2 })} />
          <Campo rotulo="Mensagens modelo por projeto" valor={cfg.modelos_por_projeto} passo={1} onChange={(v) => alterar({ modelos_por_projeto: v ?? 5 })} />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-[13px]">Custos fixos</b>
            <button
              onClick={() => alterar({ fixos: [...cfg.fixos, { id: crypto.randomUUID(), nome: '', valor_brl: 0, periodo: 'mensal', categoria: 'Ferramentas' }] })}
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-accent"
            >
              <Plus size={13} /> adicionar
            </button>
          </div>
          {cfg.fixos.length === 0 && <p className="text-[12.5px] text-fg-faded">Ex.: Vercel, Supabase, domínio, plano do Claude, número do WhatsApp.</p>}
          <div className="grid gap-2">
            {cfg.fixos.map((f, i) => (
              <div key={f.id} className="g-entrar flex flex-wrap items-center gap-2">
                <input
                  value={f.nome}
                  placeholder="Nome (ex.: Vercel Pro)"
                  onChange={(e) => fixo(i, { nome: e.target.value })}
                  className="min-w-[160px] flex-1 rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13px] outline-none focus:border-accent"
                />
                <input
                  value={f.categoria}
                  placeholder="Categoria"
                  onChange={(e) => fixo(i, { categoria: e.target.value })}
                  className="w-[130px] rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13px] outline-none focus:border-accent"
                />
                <input
                  type="number"
                  step={0.01}
                  value={f.valor_brl}
                  onChange={(e) => fixo(i, { valor_brl: Number(e.target.value) })}
                  className="w-[120px] rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13px] tabular-nums outline-none focus:border-accent"
                  aria-label="Valor em reais"
                />
                <select
                  value={f.periodo}
                  onChange={(e) => fixo(i, { periodo: e.target.value as CustoFixo['periodo'] })}
                  className="rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13px] outline-none focus:border-accent"
                >
                  <option value="mensal">por mês</option>
                  <option value="anual">por ano</option>
                </select>
                <button onClick={() => alterar({ fixos: cfg.fixos.filter((_, k) => k !== i) })} className="p-2 text-fg-faded hover:text-error" title="Tirar">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-[13px]">Recargas de crédito da API (Anthropic)</b>
            <button
              onClick={() =>
                alterar({ recargas: [...(cfg.recargas ?? []), { id: crypto.randomUUID(), data: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), usd: 0, dolar: null, brl_pago: null, desde: new Date().toISOString() }] })
              }
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-accent"
            >
              <Plus size={13} /> lançar recarga
            </button>
          </div>
          <p className="mb-2 text-[12px] text-fg-faded">Valor em dólar que você colocou. A cotação vazia usa o dólar do dia ao salvar; “pago em R$” é o valor da fatura do cartão, se quiser o exato.</p>
          <div className="grid gap-2">
            {(cfg.recargas ?? []).map((r, i) => (
              <div key={r.id} className="g-entrar flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={r.data}
                  onChange={(e) => recarga(i, { data: e.target.value })}
                  className="rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13px] outline-none focus:border-accent"
                  aria-label="Data da recarga"
                />
                <label className="flex items-center gap-1 text-[12px] text-fg-tertiary">
                  US$
                  <input
                    type="number"
                    step={0.01}
                    value={r.usd || ''}
                    onChange={(e) => recarga(i, { usd: Number(e.target.value) })}
                    className="w-[100px] rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13px] tabular-nums text-fg outline-none focus:border-accent"
                  />
                </label>
                <label className="flex items-center gap-1 text-[12px] text-fg-tertiary">
                  dólar R$
                  <input
                    type="number"
                    step={0.0001}
                    value={r.dolar ?? ''}
                    placeholder="do dia"
                    onChange={(e) => recarga(i, { dolar: e.target.value ? Number(e.target.value) : null })}
                    className="w-[100px] rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13px] tabular-nums text-fg outline-none focus:border-accent"
                  />
                </label>
                <label className="flex items-center gap-1 text-[12px] text-fg-tertiary">
                  pago em R$
                  <input
                    type="number"
                    step={0.01}
                    value={r.brl_pago ?? ''}
                    placeholder="opcional"
                    onChange={(e) => recarga(i, { brl_pago: e.target.value ? Number(e.target.value) : null })}
                    className="w-[110px] rounded-[12px] border border-border-strong bg-input px-3 py-2 text-[13px] tabular-nums text-fg outline-none focus:border-accent"
                  />
                </label>
                <button onClick={() => alterar({ recargas: (cfg.recargas ?? []).filter((_, k) => k !== i) })} className="p-2 text-fg-faded hover:text-error" title="Tirar">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Cartao>
    </div>
  );
}
