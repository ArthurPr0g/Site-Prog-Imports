'use client';

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { marcarAtividadeAction } from '@/app/actions/atividades';
import { dataCurta, quandoDaAtividade, situacao, somarDias as somarDiasAtv } from '@/lib/atividades';
import type { AtividadeDoPainel } from '@/lib/data/atividades';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ListChecks,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  Clock,
  FileText,
  HandCoins,
  ImageOff,
  Package,
  PackagePlus,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { formatBRL } from '@/lib/format';
import type { AtividadePainel, LancamentoPainel, PainelDados } from '@/lib/data/painel';

/* ------------------------------------------------------------ períodos */

type Periodo = '7d' | '30d' | '90d' | '12m';
const PERIODOS: { id: Periodo; rotulo: string; dias: number; desc: string }[] = [
  { id: '7d', rotulo: '7 dias', dias: 7, desc: 'últimos 7 dias' },
  { id: '30d', rotulo: '30 dias', dias: 30, desc: 'últimos 30 dias' },
  { id: '90d', rotulo: '90 dias', dias: 91, desc: 'últimas 13 semanas' },
  { id: '12m', rotulo: '12 meses', dias: 365, desc: 'últimos 12 meses' },
];

// Datas como texto AAAA-MM-DD, contadas em UTC: sem fuso no meio, o dia não pula
const somarDias = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86_400_000);
const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const diaDaSemana = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay();

type Balde = { chave: string; rotulo: string; dica: string; de: string; ate: string; atual: boolean };

/** As barras do gráfico: dia a dia até 30 dias, semana a semana em 90 e mês a mês em 12 meses. */
function baldes(periodo: Periodo, hoje: string): Balde[] {
  if (periodo === '12m') {
    const [a, m] = hoje.split('-').map(Number);
    return Array.from({ length: 12 }, (_, i) => {
      const idx = a * 12 + (m - 1) - (11 - i);
      const ano = Math.floor(idx / 12);
      const mes = idx % 12;
      const de = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
      const ate = somarDias(`${mes === 11 ? ano + 1 : ano}-${String(((mes + 1) % 12) + 1).padStart(2, '0')}-01`, -1);
      return { chave: de.slice(0, 7), rotulo: MESES[mes], dica: `${MESES[mes]} de ${ano}`, de, ate, atual: i === 11 };
    });
  }
  if (periodo === '90d') {
    return Array.from({ length: 13 }, (_, i) => {
      const ate = somarDias(hoje, -(12 - i) * 7);
      const de = somarDias(ate, -6);
      const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
      return { chave: de, rotulo: dm(de), dica: `${dm(de)} a ${dm(ate)}`, de, ate, atual: i === 12 };
    });
  }
  const n = periodo === '7d' ? 7 : 30;
  return Array.from({ length: n }, (_, i) => {
    const d = somarDias(hoje, -(n - 1 - i));
    const dm = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const atual = i === n - 1;
    return {
      chave: d,
      rotulo: atual ? 'HOJE' : n === 7 ? SEMANA[diaDaSemana(d)] : d.slice(8, 10),
      dica: `${SEMANA[diaDaSemana(d)].toLowerCase()}, ${dm}`,
      de: d,
      ate: d,
      atual,
    };
  });
}

const ORIGENS: Record<string, { rotulo: string; cor: string }> = {
  venda: { rotulo: 'Vendas', cor: '#C9A15A' },
  servico: { rotulo: 'Serviços', cor: '#60a5fa' },
  mensalidade: { rotulo: 'Mensalidades', cor: '#a78bfa' },
  troca: { rotulo: 'Trocas', cor: '#4ade80' },
  manual: { rotulo: 'Lançamentos manuais', cor: '#9ca3af' },
};
const origem = (o: string) =>
  ORIGENS[o] ?? { rotulo: o.charAt(0).toUpperCase() + o.slice(1), cor: '#9ca3af' };

const brlCurto = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: a >= 10000 ? 0 : 1 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

/* ------------------------------------------------------------ peças */

/** Número que sobe do zero até o valor quando aparece ou quando o período muda. */
function Contador({ valor, formato = formatBRL }: { valor: number; formato?: (v: number) => string }) {
  const calmo = useReducedMotion();
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    if (calmo) {
      setMostrado(valor);
      return;
    }
    const c = animate(0, valor, {
      duration: 0.9,
      ease: SUAVE,
      onUpdate: setMostrado,
      // Animação pulada ou interrompida não pode deixar o número no meio do caminho
      onComplete: () => setMostrado(valor),
    });
    return () => {
      c.stop();
      setMostrado(valor);
    };
  }, [valor, calmo]);
  return <>{formato(mostrado)}</>;
}

/** Balãozinho de ajuda: aparece ao passar o mouse ou focar com o teclado. */
function Dica({ texto, children, className = '' }: { texto: ReactNode; children: ReactNode; className?: string }) {
  const [aberta, setAberta] = useState(false);
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setAberta(true)}
      onMouseLeave={() => setAberta(false)}
      onFocus={() => setAberta(true)}
      onBlur={() => setAberta(false)}
    >
      {children}
      <AnimatePresence>
        {aberta && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-max max-w-[240px] -translate-x-1/2 rounded-xl border border-border-strong bg-card-dark px-3 py-2 text-left text-[12px] font-semibold leading-snug text-fg shadow-[0_12px_32px_-12px_rgba(0,0,0,.7)]"
          >
            {texto}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  if (!atual && !anterior) return null;
  if (!anterior) {
    return <span className="rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-extrabold text-success">novo</span>;
  }
  const pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
  const sobe = pct >= 0;
  const Icone = sobe ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
        sobe ? 'bg-success/12 text-success' : 'bg-error/12 text-error'
      }`}
    >
      <Icone size={12} strokeWidth={2.6} />
      {sobe ? '+' : ''}
      {pct}%
    </span>
  );
}

/** Minibarras do cartão. Crescem uma a uma, como no gráfico grande; vazio vira um traço. */
function Minibarras({ valores, cor }: { valores: number[]; cor: string }) {
  const max = Math.max(...valores, 1);
  return (
    <div className="flex h-9 items-end gap-[3px]" aria-hidden>
      {valores.map((v, i) => (
        <motion.span
          key={i}
          className="flex-1 rounded-[3px]"
          style={{ background: v ? cor : 'var(--color-divider-strong)', opacity: v && i !== valores.length - 1 ? 0.55 : 1 }}
          initial={{ height: 0 }}
          animate={{ height: `${v ? Math.max((v / max) * 100, 10) : 8}%` }}
          transition={{ delay: 0.15 + i * 0.025, duration: 0.5, ease: SUAVE }}
        />
      ))}
    </div>
  );
}

// A mesma curva em tudo: sai rápido e assenta devagar
const SUAVE = [0.22, 1, 0.36, 1] as const;

const entrada = {
  oculto: { opacity: 0, y: 14 },
  visivel: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.45, ease: SUAVE } }),
};

function Cartao({ i, className = '', children }: { i: number; className?: string; children: ReactNode }) {
  return (
    <motion.section
      custom={i}
      variants={entrada}
      initial="oculto"
      animate="visivel"
      className={`rounded-[18px] border border-border bg-card p-5 sm:p-6 ${className}`}
    >
      {children}
    </motion.section>
  );
}

const Rotulo = ({ children }: { children: ReactNode }) => (
  <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-fg-tertiary">{children}</div>
);

/* ------------------------------------------------------------ painel */

export function PainelDinamico({ dados }: { dados: PainelDados }) {
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const { hoje } = dados;
  const cfg = PERIODOS.find((p) => p.id === periodo)!;

  const calc = useMemo(() => {
    const bs = baldes(periodo, hoje);
    const ini = bs[0].de;
    const iniAnt = somarDias(ini, -cfg.dias);
    const fimAnt = somarDias(ini, -1);
    const dentro = (d: string, de: string, ate: string) => d >= de && d <= ate;

    const pagos = dados.lancamentos.filter((l) => l.pago);
    const recebido = (de: string, ate: string) =>
      pagos.filter((l) => l.tipo === 'receita' && dentro(l.data, de, ate)).reduce((a, l) => a + l.valor, 0);
    const pago = (de: string, ate: string) =>
      pagos.filter((l) => l.tipo === 'despesa' && dentro(l.data, de, ate)).reduce((a, l) => a + l.valor, 0);
    const vendasEm = (de: string, ate: string) => dados.vendas.filter((v) => dentro(v.data, de, ate));

    const vendasPeriodo = vendasEm(ini, hoje);
    const vendasAnt = vendasEm(iniAnt, fimAnt);

    const fluxo = bs.map((b) => ({ ...b, entrou: recebido(b.de, b.ate), saiu: pago(b.de, b.ate) }));

    // De onde veio o dinheiro que entrou no período
    const porOrigem = new Map<string, { valor: number; n: number }>();
    for (const l of pagos) {
      if (l.tipo !== 'receita' || !dentro(l.data, ini, hoje)) continue;
      const o = porOrigem.get(l.origem) ?? { valor: 0, n: 0 };
      porOrigem.set(l.origem, { valor: o.valor + l.valor, n: o.n + 1 });
    }
    const totalOrigem = [...porOrigem.values()].reduce((a, o) => a + o.valor, 0);
    const origens = [...porOrigem.entries()]
      .map(([k, o]) => ({ ...origem(k), chave: k, ...o, pct: totalOrigem ? (o.valor / totalOrigem) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);

    return {
      fluxo,
      recebido: recebido(ini, hoje),
      recebidoAnt: recebido(iniAnt, fimAnt),
      saiu: pago(ini, hoje),
      vendasN: vendasPeriodo.length,
      vendasNAnt: vendasAnt.length,
      vendido: vendasPeriodo.reduce((a, v) => a + v.total, 0),
      vendasBaldes: bs.map((b) => vendasEm(b.de, b.ate).reduce((a, v) => a + v.total, 0)),
      origens,
      totalOrigem,
    };
  }, [periodo, hoje, cfg.dias, dados.lancamentos, dados.vendas]);

  // A receber não depende do período: é tudo o que ainda não entrou
  const aReceber = useMemo(() => {
    const abertas = dados.lancamentos
      .filter((l) => l.tipo === 'receita' && !l.pago)
      .sort((a, b) => a.data.localeCompare(b.data));
    const atrasadas = abertas.filter((l) => l.data < hoje);
    const em30 = abertas.filter((l) => l.data >= hoje && l.data <= somarDias(hoje, 30));
    return {
      lista: abertas,
      total: abertas.reduce((a, l) => a + l.valor, 0),
      atrasadas,
      atrasado: atrasadas.reduce((a, l) => a + l.valor, 0),
      em30: em30.reduce((a, l) => a + l.valor, 0),
    };
  }, [dados.lancamentos, hoje]);

  const ticket = calc.vendasN ? calc.vendido / calc.vendasN : 0;

  return (
    <div className="space-y-4">
      {/* Saudação + período */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="text-[13.5px] text-fg-secondary">
          {/* Hora do servidor e do navegador podem divergir na virada da saudação */}
          <span suppressHydrationWarning className="font-bold text-fg">{saudacao()}</span> · {dataPorExtenso(hoje)}
        </div>
        <div role="tablist" aria-label="Período" className="relative flex w-full rounded-full border border-border bg-card p-1 sm:w-auto">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={periodo === p.id}
              onClick={() => setPeriodo(p.id)}
              className={`relative z-10 flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[12.5px] font-extrabold transition-colors sm:flex-none sm:px-3.5 ${
                periodo === p.id ? 'text-black' : 'text-fg-tertiary hover:text-fg'
              }`}
            >
              {periodo === p.id && (
                <motion.span
                  layoutId="periodo-pilula"
                  className="absolute inset-0 -z-10 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              {p.rotulo}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          i={0}
          cor="var(--color-accent)"
          rotulo="Entrou no caixa"
          dica={`Receitas pagas nos ${cfg.desc}: vendas, parcelas, serviços e mensalidades. Comparado com o período anterior do mesmo tamanho.`}
          valor={<Contador valor={calc.recebido} />}
          selo={<Variacao atual={calc.recebido} anterior={calc.recebidoAnt} />}
          rodape={`Saiu ${formatBRL(calc.saiu)} no mesmo período`}
          barras={calc.fluxo.map((f) => f.entrou)}
        />
        <Kpi
          i={1}
          cor="var(--color-success)"
          rotulo="Vendas"
          dica="Vendas fechadas no período, pela data da venda. Canceladas não contam."
          valor={<Contador valor={calc.vendasN} formato={(v) => String(Math.round(v))} />}
          selo={<Variacao atual={calc.vendasN} anterior={calc.vendasNAnt} />}
          rodape={calc.vendasN ? `${formatBRL(calc.vendido)} vendidos · ticket ${formatBRL(ticket)}` : 'Nenhuma venda no período'}
          barras={calc.vendasBaldes}
        />
        <Kpi
          i={2}
          cor="var(--color-info)"
          rotulo="A receber"
          dica="Tudo o que ainda vai entrar: parcelas do PIX parcelado, mensalidades e vendas aguardando pagamento."
          valor={<Contador valor={aReceber.total} />}
          selo={
            aReceber.atrasadas.length ? (
              <span className="rounded-full bg-error/12 px-2 py-0.5 text-[11px] font-extrabold text-error">
                {aReceber.atrasadas.length} atrasada{aReceber.atrasadas.length > 1 ? 's' : ''}
              </span>
            ) : null
          }
          rodape={`${formatBRL(aReceber.em30)} vencem nos próximos 30 dias`}
        />
        <Kpi
          i={3}
          cor="var(--color-warning)"
          rotulo="Em estoque"
          dica="Unidades disponíveis em mãos e quanto foi pago por elas. Unidade parada há mais de 60 dias aparece em Precisa de atenção."
          valor={<Contador valor={dados.estoque.disponiveis} formato={(v) => String(Math.round(v))} />}
          selo={
            dados.estoque.parados.length ? (
              <span className="rounded-full bg-warning/12 px-2 py-0.5 text-[11px] font-extrabold text-warning">
                {dados.estoque.parados.length} parado{dados.estoque.parados.length > 1 ? 's' : ''}
              </span>
            ) : null
          }
          rodape={dados.estoque.disponiveis ? `${formatBRL(dados.estoque.investido)} investidos` : 'Nenhuma unidade em mãos'}
        />
      </div>

      {/* Fluxo de caixa + origem e atalhos */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.65fr_1fr]">
        <Cartao i={4}>
          <GraficoFluxo fluxo={calc.fluxo} desc={cfg.desc} recebido={calc.recebido} saiu={calc.saiu} />
        </Cartao>

        <Cartao i={5} className="flex flex-col">
          <Rotulo>De onde veio o dinheiro</Rotulo>
          {calc.origens.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border-strong p-4 text-[13px] text-fg-tertiary">
              Nada entrou no caixa nos {cfg.desc}.
            </div>
          ) : (
            <>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-divider">
                {calc.origens.map((o, i) => (
                  <motion.div
                    key={o.chave + periodo}
                    className="h-full"
                    style={{ background: o.cor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${o.pct}%` }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: SUAVE }}
                  />
                ))}
              </div>
              <div className="mt-3.5 space-y-2">
                {calc.origens.map((o) => (
                  <Dica key={o.chave} className="w-full" texto={`${formatBRL(o.valor)} em ${o.n} lançamento${o.n > 1 ? 's' : ''}`}>
                    <div className="flex w-full items-center gap-2.5 rounded-lg px-1 py-0.5 text-[13.5px] transition-colors hover:bg-card-hover">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: o.cor }} />
                      <span className="flex-1 font-semibold">{o.rotulo}</span>
                      <span className="text-[12px] text-fg-tertiary">{formatBRL(o.valor)}</span>
                      <span className="w-10 text-right font-display font-bold">{Math.round(o.pct)}%</span>
                    </div>
                  </Dica>
                ))}
              </div>
            </>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {ATALHOS.map((a, i) => (
              <Atalho key={a.href} {...a} i={i} />
            ))}
          </div>
        </Cartao>
      </div>

      {/* Atividades das prestações: o que fazer */}
      <Cartao i={6}>
        <MinhasAtividades tarefas={dados.tarefas} hoje={hoje} />
      </Cartao>

      {/* Atividade, recebimentos e alertas */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <Cartao i={6}>
          <div className="mb-3 flex items-center justify-between">
            <Rotulo>Atividade recente</Rotulo>
            <Link href="/admin/vendas" className="rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-fg-secondary transition-colors hover:border-accent/50 hover:text-accent">
              Ver vendas
            </Link>
          </div>
          {dados.atividade.length === 0 && <Vazio>Nada registrado ainda.</Vazio>}
          <div className="-mx-2">
            {dados.atividade.map((a, i) => (
              <ItemAtividade key={a.tipo + a.quando + i} a={a} i={i} />
            ))}
          </div>
        </Cartao>

        <Cartao i={7}>
          <div className="mb-3 flex items-center justify-between">
            <Rotulo>Próximos recebimentos</Rotulo>
            <Link href="/admin/financeiro" className="rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-fg-secondary transition-colors hover:border-accent/50 hover:text-accent">
              Financeiro
            </Link>
          </div>
          {aReceber.lista.length === 0 && <Vazio>Nada a receber. Tudo em dia.</Vazio>}
          <div className="space-y-1.5">
            {aReceber.lista.slice(0, 6).map((l, i) => (
              <Recebimento key={l.data + l.descricao + i} l={l} hoje={hoje} i={i} />
            ))}
          </div>
          {aReceber.lista.length > 6 && (
            <div className="mt-3 text-[12px] text-fg-tertiary">
              e mais {aReceber.lista.length - 6} lançamento{aReceber.lista.length - 6 > 1 ? 's' : ''} previsto
              {aReceber.lista.length - 6 > 1 ? 's' : ''}
            </div>
          )}
        </Cartao>

        <Cartao i={8}>
          <Rotulo>Precisa de atenção</Rotulo>
          <Alertas dados={dados} atrasadas={aReceber.atrasadas.length} atrasado={aReceber.atrasado} />
        </Cartao>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ atividades */

type Aba = 'atrasadas' | 'hoje' | 'semana' | 'todas';

function MinhasAtividades({ tarefas, hoje }: { tarefas: AtividadeDoPainel[]; hoje: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  // Some na hora ao concluir, sem esperar a página recarregar
  const [feitas, setFeitas] = useState<Set<string>>(new Set());

  const vivas = tarefas.filter((t) => !feitas.has(t.id));
  const fimSemana = somarDiasAtv(hoje, 7);
  const grupos: Record<Aba, AtividadeDoPainel[]> = {
    atrasadas: vivas.filter((t) => situacao(t, hoje) === 'atrasada'),
    hoje: vivas.filter((t) => situacao(t, hoje) === 'hoje'),
    semana: vivas.filter((t) => t.data > hoje && t.data <= fimSemana),
    todas: vivas,
  };
  const padrao: Aba = grupos.atrasadas.length ? 'atrasadas' : grupos.hoje.length ? 'hoje' : grupos.semana.length ? 'semana' : 'todas';
  const [aba, setAba] = useState<Aba | null>(null);
  const atual = aba ?? padrao;
  const lista = grupos[atual];

  const ABAS: { id: Aba; rotulo: string; cor: string }[] = [
    { id: 'atrasadas', rotulo: 'Atrasadas', cor: 'text-error' },
    { id: 'hoje', rotulo: 'Hoje', cor: 'text-warning' },
    { id: 'semana', rotulo: 'Próximos 7 dias', cor: 'text-info' },
    { id: 'todas', rotulo: 'Todas', cor: 'text-fg-secondary' },
  ];

  function concluir(t: AtividadeDoPainel) {
    setFeitas((s) => new Set(s).add(t.id));
    startTransition(async () => {
      const r = await marcarAtividadeAction(t.id, true);
      if (!r.ok) {
        setFeitas((s) => {
          const n = new Set(s);
          n.delete(t.id);
          return n;
        });
        return toast(r);
      }
      // Era a última da prestação: leva até ela para perguntar se pode finalizar
      if (r.todasFeitas) router.push(`/admin/prestacao-servico?atividades=${t.prestacaoId}&finalizar=1`);
      else toast(r);
    });
  }

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-accent" />
          <Rotulo>Minhas atividades</Rotulo>
        </div>
        <div role="tablist" aria-label="Filtrar atividades" className="flex flex-wrap gap-1.5">
          {ABAS.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={atual === a.id}
              onClick={() => setAba(a.id)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-extrabold transition-colors ${
                atual === a.id ? 'border-accent bg-accent/12 text-fg' : 'border-border text-fg-tertiary hover:text-fg'
              }`}
            >
              {a.rotulo}
              <span className={`ml-1.5 ${grupos[a.id].length ? a.cor : 'text-fg-faded'}`}>{grupos[a.id].length}</span>
            </button>
          ))}
        </div>
      </div>

      {tarefas.length === 0 ? (
        <Vazio>
          Nenhuma atividade cadastrada. Em{' '}
          <Link href="/admin/prestacao-servico" className="font-bold text-accent hover:underline">
            Prestação de Serviço
          </Link>
          , abra uma prestação em &quot;Atividades&quot; ou use um modelo de trabalho.
        </Vazio>
      ) : lista.length === 0 ? (
        <Vazio>{atual === 'atrasadas' ? 'Nada atrasado. ' : 'Nada aqui. '}Tudo em dia nesta lista.</Vazio>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {lista.slice(0, 10).map((t, i) => {
              const s = situacao(t, hoje);
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                  exit={{ opacity: 0, x: 16, transition: { duration: 0.2 } }}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    s === 'atrasada' ? 'border-error/30 bg-error/[.05]' : 'border-transparent bg-card-dark'
                  }`}
                >
                  <Dica texto="Marcar como feita">
                    <button
                      onClick={() => concluir(t)}
                      disabled={pending}
                      aria-label={`Marcar ${t.titulo} como feita`}
                      className="group grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border-2 border-fg-faded transition-colors hover:border-success hover:bg-success/15"
                    >
                      <Check size={12} strokeWidth={3} className="text-success opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </Dica>
                  <Link href={`/admin/prestacao-servico?atividades=${t.prestacaoId}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold hover:text-accent">{t.titulo}</span>
                    <span className="block truncate text-[12px] text-fg-tertiary">
                      {t.cliente && <span className="text-accent">{t.cliente} · </span>}
                      {t.prestacao}
                    </span>
                  </Link>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                      s === 'atrasada' ? 'bg-error/12 text-error' : s === 'hoje' ? 'bg-warning/12 text-warning' : 'bg-info/12 text-info'
                    }`}
                  >
                    {dataCurta(t.data)} · {quandoDaAtividade(t, hoje)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      {lista.length > 10 && (
        <div className="mt-3 text-[12px] text-fg-tertiary">
          e mais {lista.length - 10}. Veja todas em{' '}
          <Link href="/admin/prestacao-servico" className="font-bold text-accent hover:underline">
            Prestação de Serviço
          </Link>
          .
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ indicadores */

function Kpi({
  i,
  cor,
  rotulo,
  dica,
  valor,
  selo,
  rodape,
  barras,
}: {
  i: number;
  cor: string;
  rotulo: string;
  dica: string;
  valor: ReactNode;
  selo?: ReactNode;
  rodape: string;
  barras?: number[];
}) {
  return (
    <motion.div
      custom={i}
      variants={entrada}
      initial="oculto"
      animate="visivel"
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-[18px] border border-border bg-card p-5 transition-colors hover:border-border-hover"
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: cor }} />
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25"
        style={{ background: cor }}
      />
      <div className="flex items-center justify-between gap-2">
        <Dica texto={dica}>
          <span tabIndex={0} className="cursor-help border-b border-dashed border-fg-faded/60 outline-none">
            <Rotulo>{rotulo}</Rotulo>
          </span>
        </Dica>
        {selo}
      </div>
      <div className="mt-2 font-display text-[28px] font-bold tabular-nums tracking-[-.01em] sm:text-[30px]">{valor}</div>
      <div className="mt-3">{barras ? <Minibarras valores={barras} cor={cor} /> : <div className="h-9" />}</div>
      <div className="mt-2.5 truncate text-[12.5px] text-fg-tertiary">{rodape}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------ gráfico */

function GraficoFluxo({
  fluxo,
  desc,
  recebido,
  saiu,
}: {
  fluxo: (Balde & { entrou: number; saiu: number })[];
  desc: string;
  recebido: number;
  saiu: number;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(...fluxo.map((f) => Math.max(f.entrou, f.saiu)), 1);
  const saldo = recebido - saiu;
  const muitos = fluxo.length > 14;
  const passoRotulo = fluxo.length > 14 ? 5 : 1;
  const f = foco == null ? null : fluxo[foco];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Rotulo>Fluxo de caixa · {desc}</Rotulo>
          <div className={`mt-1 font-display text-[30px] font-bold tabular-nums ${saldo < 0 ? 'text-error' : 'text-accent'}`}>
            <Contador valor={saldo} />
          </div>
          <div className="text-[12.5px] text-fg-tertiary">
            saldo · entrou {formatBRL(recebido)} · saiu {formatBRL(saiu)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[12px] font-semibold text-fg-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" /> Entrou
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-error/70" /> Saiu
          </span>
        </div>
      </div>

      <div className="relative mt-6" onMouseLeave={() => setFoco(null)}>
        {/* linhas de guia */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[190px]">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="absolute inset-x-0 border-t border-dashed border-divider" style={{ top: `${(k / 3) * 100}%` }} />
          ))}
        </div>

        <div className={`relative flex h-[190px] items-end ${muitos ? 'gap-[3px]' : 'gap-2 sm:gap-3'}`}>
          {fluxo.map((b, i) => (
            <button
              key={b.chave}
              type="button"
              aria-label={`${b.dica}: entrou ${formatBRL(b.entrou)}, saiu ${formatBRL(b.saiu)}`}
              onMouseEnter={() => setFoco(i)}
              onFocus={() => setFoco(i)}
              onBlur={() => setFoco(null)}
              onClick={() => setFoco(foco === i ? null : i)}
              className="group relative flex h-full flex-1 items-end justify-center gap-[2px] outline-none"
            >
              <span
                className={`absolute inset-x-[-2px] bottom-0 top-0 rounded-lg transition-colors ${foco === i ? 'bg-fg/[.04]' : ''}`}
              />
              {!muitos && b.entrou > 0 && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.03 }}
                  className="absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[10.5px] font-bold text-fg-tertiary sm:block"
                  style={{ bottom: `calc(${(Math.max(b.entrou, b.saiu) / max) * 100}% + 4px)` }}
                >
                  {brlCurto(b.entrou)}
                </motion.span>
              )}
              <Barra valor={b.entrou} max={max} i={i} cor="var(--color-accent)" destaque={foco === i || b.atual} />
              <Barra valor={b.saiu} max={max} i={i} cor="color-mix(in srgb, var(--color-error) 70%, transparent)" destaque={foco === i} />
            </button>
          ))}
        </div>

        <div className={`mt-2 flex ${muitos ? 'gap-[3px]' : 'gap-2 sm:gap-3'}`}>
          {fluxo.map((b, i) => (
            <div
              key={b.chave}
              className={`flex-1 text-center text-[10.5px] font-extrabold tracking-[.06em] ${
                b.atual ? 'text-accent' : foco === i ? 'text-fg' : 'text-fg-faded'
              }`}
            >
              {b.atual || i % passoRotulo === 0 || foco === i ? b.rotulo : ''}
            </div>
          ))}
        </div>

        {/* Dica da barra em foco */}
        <AnimatePresence>
          {f && foco != null && (
            <motion.div
              key="dica-fluxo"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, left: `${((foco + 0.5) / fluxo.length) * 100}%` }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className="pointer-events-none absolute top-0 z-20 w-[180px] -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-xl border border-border-strong bg-card-dark p-3 text-[12px] shadow-[0_16px_40px_-14px_rgba(0,0,0,.8)]"
              style={{ marginLeft: foco < 2 ? 60 : foco > fluxo.length - 3 ? -60 : 0 }}
            >
              <div className="mb-1.5 font-extrabold text-fg">{f.dica.charAt(0).toUpperCase() + f.dica.slice(1)}</div>
              <Linha cor="var(--color-accent)" rotulo="Entrou" valor={f.entrou} />
              <Linha cor="var(--color-error)" rotulo="Saiu" valor={f.saiu} />
              <div className="mt-1.5 flex justify-between border-t border-divider pt-1.5 font-extrabold">
                <span>Saldo</span>
                <span className={f.entrou - f.saiu < 0 ? 'text-error' : 'text-success'}>{formatBRL(f.entrou - f.saiu)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 text-right text-[11.5px] text-fg-faded">Passe o mouse ou toque nas barras</div>
    </div>
  );
}

function Barra({ valor, max, i, cor, destaque }: { valor: number; max: number; i: number; cor: string; destaque: boolean }) {
  const h = valor ? Math.max((valor / max) * 100, 2.5) : 0;
  return (
    <motion.span
      className="relative w-full max-w-[34px] rounded-t-[6px]"
      style={{ background: cor, opacity: destaque ? 1 : 0.72, transformOrigin: 'bottom' }}
      initial={{ height: 0 }}
      animate={{ height: `${h}%` }}
      transition={{ delay: 0.1 + i * 0.03, duration: 0.6, ease: SUAVE }}
    />
  );
}

const Linha = ({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: number }) => (
  <div className="flex items-center justify-between gap-3 py-0.5 text-fg-secondary">
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-[2px]" style={{ background: cor }} />
      {rotulo}
    </span>
    <span className="font-bold tabular-nums text-fg">{formatBRL(valor)}</span>
  </div>
);

/* ------------------------------------------------------------ atalhos */

const ATALHOS: { href: string; rotulo: string; dica: string; Icone: LucideIcon }[] = [
  { href: '/admin/vendas?novo=1', rotulo: 'Nova venda', dica: 'Abre o formulário de venda já pronto para preencher.', Icone: ShoppingCart },
  { href: '/admin/estoque?novo=1', rotulo: 'Chegou mercadoria', dica: 'Cadastra a unidade que chegou e lança a compra no caixa.', Icone: PackagePlus },
  { href: '/admin/orcamentos-loja?novo=1', rotulo: 'Novo orçamento', dica: 'Orçamento de produto importado, com a cotação do dólar salva.', Icone: FileText },
  { href: '/admin/clientes?novo=1', rotulo: 'Novo cliente', dica: 'Só o nome é obrigatório.', Icone: UserPlus },
  { href: '/admin/financeiro?novo=receita', rotulo: 'Lançar entrada', dica: 'Receita avulsa no Financeiro.', Icone: ArrowDownLeft },
  { href: '/admin/financeiro?novo=despesa', rotulo: 'Lançar saída', dica: 'Despesa avulsa no Financeiro.', Icone: ArrowUpRight },
];

function Atalho({ href, rotulo, dica, Icone, i }: (typeof ATALHOS)[number] & { i: number }) {
  return (
    <Dica texto={dica} className="w-full">
      <motion.div
        className="w-full"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35 + i * 0.05, duration: 0.3 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
      >
        <Link
          href={href}
          className="group flex w-full flex-col gap-2.5 rounded-[14px] border border-border bg-card-dark p-3.5 transition-colors hover:border-accent/50 hover:bg-card-hover"
        >
          <Icone size={18} className="text-accent transition-transform duration-300 group-hover:scale-110" />
          <span className="text-[13px] font-extrabold leading-tight">{rotulo}</span>
        </Link>
      </motion.div>
    </Dica>
  );
}

/* ------------------------------------------------------------ listas */

const ICONE_ATIVIDADE: Record<AtividadePainel['tipo'], { Icone: LucideIcon; cor: string }> = {
  venda: { Icone: ShoppingCart, cor: 'var(--color-accent)' },
  estoque: { Icone: Package, cor: 'var(--color-warning)' },
  prestacao: { Icone: Wrench, cor: 'var(--color-info)' },
  orcamento: { Icone: Receipt, cor: '#a78bfa' },
  cliente: { Icone: UserPlus, cor: 'var(--color-success)' },
};

function ItemAtividade({ a, i }: { a: AtividadePainel; i: number }) {
  const { Icone, cor } = ICONE_ATIVIDADE[a.tipo];
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
      <Link href={a.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-card-hover">
        <span
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px]"
          style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor }}
        >
          <Icone size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold">{a.titulo}</span>
          <span className="block truncate text-[12px] text-fg-tertiary">{a.detalhe}</span>
        </span>
        <span className="flex-shrink-0 text-right">
          {a.valor != null && <span className="block text-[13px] font-extrabold tabular-nums">{formatBRL(a.valor)}</span>}
          <span suppressHydrationWarning className="block text-[11px] text-fg-faded">{quando(a.quando)}</span>
        </span>
      </Link>
    </motion.div>
  );
}

function Recebimento({ l, hoje, i }: { l: LancamentoPainel; hoje: string; i: number }) {
  const dias = diasEntre(hoje, l.data);
  const atrasada = dias < 0;
  const quandoTxt = atrasada ? `atrasada ${-dias} dia${dias < -1 ? 's' : ''}` : dias === 0 ? 'vence hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.45 + i * 0.05 }}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        atrasada ? 'border-error/30 bg-error/[.06]' : 'border-transparent bg-card-dark'
      }`}
    >
      <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${atrasada ? 'bg-error/15 text-error' : 'bg-info/12 text-info'}`}>
        {atrasada ? <TriangleAlert size={15} /> : <CalendarClock size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">
          {/* Empresa na frente: é por ela que se reconhece a cobrança */}
          {l.cliente && <span className="text-accent">{l.cliente} · </span>}
          {l.descricao || origem(l.origem).rotulo}
        </span>
        <span className={`block text-[11.5px] font-semibold ${atrasada ? 'text-error' : 'text-fg-tertiary'}`}>
          {`${l.data.slice(8, 10)}/${l.data.slice(5, 7)}`} · {quandoTxt}
        </span>
      </span>
      <span className="flex-shrink-0 text-[13px] font-extrabold tabular-nums">{formatBRL(l.valor)}</span>
    </motion.div>
  );
}

function Alertas({ dados, atrasadas, atrasado }: { dados: PainelDados; atrasadas: number; atrasado: number }) {
  const semCusto = dados.vendas.filter((v) => v.semCusto).length;
  const parado = dados.estoque.parados[0];
  const itens: { Icone: LucideIcon; cor: string; titulo: string; detalhe: string; href: string }[] = [];

  if (atrasadas)
    itens.push({
      Icone: HandCoins,
      cor: 'var(--color-error)',
      titulo: `${atrasadas} recebimento${atrasadas > 1 ? 's' : ''} atrasado${atrasadas > 1 ? 's' : ''}`,
      detalhe: `${formatBRL(atrasado)} para cobrar`,
      href: '/admin/financeiro',
    });
  const tarefasAtrasadas = dados.tarefas.filter((t) => t.data < dados.hoje);
  if (tarefasAtrasadas.length)
    itens.push({
      Icone: ListChecks,
      cor: 'var(--color-error)',
      titulo: `${tarefasAtrasadas.length} atividade${tarefasAtrasadas.length > 1 ? 's' : ''} atrasada${tarefasAtrasadas.length > 1 ? 's' : ''}`,
      detalhe: `${tarefasAtrasadas[0].titulo}${tarefasAtrasadas[0].cliente ? ` · ${tarefasAtrasadas[0].cliente}` : ''}`,
      href: `/admin/prestacao-servico?atividades=${tarefasAtrasadas[0].prestacaoId}`,
    });
  if (semCusto)
    itens.push({
      Icone: Wallet,
      cor: 'var(--color-warning)',
      titulo: `${semCusto} venda${semCusto > 1 ? 's' : ''} sem custo`,
      detalhe: semCusto > 1 ? 'O lucro dessas vendas aparece maior do que é' : 'O lucro dela aparece maior do que é',
      href: '/admin/vendas',
    });
  if (parado)
    itens.push({
      Icone: Clock,
      cor: 'var(--color-warning)',
      titulo: `${dados.estoque.parados.length} unidade${dados.estoque.parados.length > 1 ? 's' : ''} parada${dados.estoque.parados.length > 1 ? 's' : ''}`,
      detalhe: `${parado.nome} está há ${parado.dias} dias no estoque`,
      href: '/admin/estoque',
    });
  if (dados.produtosSemFoto)
    itens.push({
      Icone: ImageOff,
      cor: 'var(--color-info)',
      titulo: `${dados.produtosSemFoto} produto${dados.produtosSemFoto > 1 ? 's' : ''} sem foto`,
      detalhe: 'Aparecem sem imagem na loja',
      href: '/admin/produtos',
    });
  if (dados.prestacoesAbertas)
    itens.push({
      Icone: Wrench,
      cor: 'var(--color-info)',
      titulo: `${dados.prestacoesAbertas} prestação${dados.prestacoesAbertas > 1 ? 'ões' : ''} em andamento`,
      detalhe: 'Serviços ainda não concluídos',
      href: '/admin/prestacao-servico',
    });

  if (!itens.length) {
    return (
      <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.4 }}>
          <CircleCheck size={34} className="text-success" />
        </motion.span>
        <div className="text-[14px] font-extrabold">Tudo em dia</div>
        <div className="text-[12.5px] text-fg-tertiary">Nenhuma pendência agora.</div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      {itens.map((it, i) => (
        <motion.div key={it.titulo} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}>
          <Link href={it.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-card-hover">
            <span
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px]"
              style={{ background: `color-mix(in srgb, ${it.cor} 14%, transparent)`, color: it.cor }}
            >
              <it.Icone size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold">{it.titulo}</span>
              <span className="block truncate text-[12px] text-fg-tertiary">{it.detalhe}</span>
            </span>
            <ChevronRight size={16} className="text-fg-faded transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

const Vazio = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-border-strong p-4 text-[13px] text-fg-tertiary">{children}</div>
);

/* ------------------------------------------------------------ textos */

function saudacao() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function dataPorExtenso(d: string) {
  const dt = new Date(d + 'T12:00:00Z');
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(dt);
}

function quando(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}
