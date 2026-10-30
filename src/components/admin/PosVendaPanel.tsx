'use client';

// Painel do pós-venda (P1–P9 do docs/CAPTACAO-BACKLOG.md): indicadores do dia a dia,
// registrar venda, lista de projetos e, no projeto aberto, serviços com o contador de
// rodadas, rodadas (abrir, entregar, aceite), reuniões com ata, orçamento/contrato do
// ERP e a linha do tempo. Regras do contrato: aceite em 5 dias úteis, rodada além do
// incluído vira orçamento.

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { CalendarDays, CheckCircle2, Circle, ClipboardList, Copy, FileText, History, Palette, Plus, Repeat } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import {
  painelDoPosVendaAction,
  buscarLeadsParaVendaAction,
  registrarVendaAction,
  atualizarProjetoAction,
  novaRodadaAction,
  marcarRodadaAction,
  marcarReuniaoDoProjetoAction,
  salvarAtaAction,
  excluirProjetoAction,
  marcarDescobertaConfirmadaAction,
  type ProjetoDoPainel,
} from '@/app/actions/pos-venda';
import { NOMES, type Escolha } from '@/lib/simulador';
import { inputClass } from '@/components/admin/captacao/comum';

type Painel = NonNullable<Awaited<ReturnType<typeof painelDoPosVendaAction>>>;

const STATUS: Record<ProjetoDoPainel['status'], string> = {
  em_andamento: 'Em andamento',
  entregue: 'Entregue',
  em_suporte: 'Em suporte',
  encerrado: 'Encerrado',
};
const dataBR = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR') : '–');
const horaBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const dinheiro = (v: number | null, m: 'BRL' | 'USD') =>
  v === null ? '–' : m === 'USD' ? `$${Math.round(v).toLocaleString('en-US')}` : `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

/** Dias úteis entre duas datas (seg a sex). */
function diasUteisDesde(iso: string, agora: number): number {
  const d = new Date(iso);
  let n = 0;
  while (d.getTime() < agora) {
    d.setDate(d.getDate() + 1);
    if (d.getTime() > agora) break;
    const s = d.getDay();
    if (s !== 0 && s !== 6) n++;
  }
  return n;
}

export function PosVendaPanel() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [agora] = useState(() => Date.now());

  const reler = useCallback(async () => {
    const p = await painelDoPosVendaAction().catch(() => null);
    if (p) setPainel(p);
  }, []);
  useEffect(() => {
    let vivo = true;
    painelDoPosVendaAction()
      .then((p) => vivo && p && setPainel(p))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const ind = useMemo(() => {
    const ps = painel?.projetos ?? [];
    const ativos = ps.filter((p) => p.status === 'em_andamento');
    const hoje = hojeISO();
    const semana = agora + 7 * 24 * 3600_000;
    return {
      andamento: ativos.length,
      rodadasAbertas: ps.flatMap((p) => p.rodadas).filter((r) => r.status === 'aberta').length,
      atrasadas: ativos.filter((p) => p.entregaPrevista && p.entregaPrevista < hoje).length,
      reunioes: ps.flatMap((p) => p.reunioes).filter((r) => Date.parse(r.inicio) >= agora && Date.parse(r.inicio) <= semana).length,
      aceitePendente: ps.flatMap((p) => p.rodadas).filter((r) => r.status === 'entregue').length,
    };
  }, [painel, agora]);

  const projeto = painel?.projetos.find((p) => p.id === aberto) ?? null;

  return (
    // tema-apple + design "Noite azul" (globals.css), como a Captação.
    <div className="tema-apple space-y-4 [color-scheme:dark]">
      <div className="aurora" aria-hidden />
      <section className="grid gap-3 sm:grid-cols-5">
        <Indicador rotulo="Em andamento" valor={ind.andamento} />
        <Indicador rotulo="Rodadas abertas" valor={ind.rodadasAbertas} />
        <Indicador rotulo="Aceite pendente" valor={ind.aceitePendente} />
        <Indicador rotulo="Entregas atrasadas" valor={ind.atrasadas} alerta={ind.atrasadas > 0} />
        <Indicador rotulo="Reuniões em 7 dias" valor={ind.reunioes} />
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => setNova((x) => !x)}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-extrabold text-page"
        >
          <Plus size={15} /> Registrar venda
        </button>
      </div>
      {nova && (
        <NovaVenda
          aoTerminar={() => {
            setNova(false);
            void reler();
          }}
        />
      )}

      {!painel ? (
        <div className="text-[13px] text-fg-tertiary">Carregando…</div>
      ) : painel.projetos.length === 0 ? (
        <section className="rounded-[18px] border border-border bg-card p-5 text-[13.5px] text-fg-tertiary">
          Nenhuma venda ainda. Quando a Lia fechar, quando o Felipe marcar &quot;venda feita&quot; ou quando você registrar aqui, o projeto
          aparece com os serviços, o prazo e o contador de rodadas.
        </section>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
          <ul className={`space-y-2 ${aberto ? 'hidden lg:block' : ''}`}>
            {painel.projetos.map((p) => (
              <li key={p.id}>
                <ItemDoProjeto p={p} ativo={p.id === aberto} aoAbrir={() => setAberto(p.id)} />
              </li>
            ))}
          </ul>
          {projeto ? (
            <DetalheDoProjeto key={projeto.id} p={projeto} orcamentos={painel.orcamentos} agora={agora} aoVoltar={() => setAberto(null)} aoMudar={reler} />
          ) : (
            <div className="hidden place-items-center rounded-[18px] border border-dashed border-border p-6 text-[13px] text-fg-tertiary lg:grid">
              Escolha um projeto.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-3.5 py-2.5">
      <div className="text-[11px] font-bold text-fg-tertiary">{rotulo}</div>
      <div className={`text-[22px] font-extrabold tabular-nums ${alerta ? 'text-error' : ''}`}>{valor}</div>
    </div>
  );
}

function ItemDoProjeto({ p, ativo, aoAbrir }: { p: ProjetoDoPainel; ativo: boolean; aoAbrir: () => void }) {
  const abertas = p.rodadas.filter((r) => r.status === 'aberta').length;
  const atrasado = p.status === 'em_andamento' && !!p.entregaPrevista && p.entregaPrevista < hojeISO();
  return (
    <button
      onClick={aoAbrir}
      className={`w-full rounded-[14px] border p-3 text-left transition-colors ${ativo ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-accent/50'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[14px] font-extrabold">{p.cliente}</span>
        <span className="shrink-0 rounded-full bg-fg-faded/12 px-2 py-0.5 text-[10.5px] font-bold">{STATUS[p.status]}</span>
      </div>
      <div className="mt-0.5 truncate text-[12px] text-fg-tertiary">{p.servicos.map((s) => s.nome).join(' + ') || 'Sem serviços'}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-fg-faded">
        <span>vendido por {p.vendidoPor}</span>
        <span className={atrasado ? 'font-bold text-error' : ''}>entrega {dataBR(p.entregaPrevista)}</span>
        {abertas > 0 && <span className="font-bold text-accent">{abertas} rodada(s) aberta(s)</span>}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------ registrar venda */

const NIVEIS = ['Essencial / Básico', 'Profissional / Intermediário', 'Premium / Avançado'];

function NovaVenda({ aoTerminar }: { aoTerminar: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<Awaited<ReturnType<typeof buscarLeadsParaVendaAction>>>([]);
  const [lead, setLead] = useState<{ id: string; nome: string } | null>(null);
  const [cliente, setCliente] = useState('');
  const [e, setE] = useState<Escolha>({ produto: 'site', nivel: 0, comGestao: false, nivelGestao: 0, marca: 0 });
  const [moeda, setMoeda] = useState<'BRL' | 'USD'>('BRL');
  const [valor, setValor] = useState('');
  const [vendidoPor, setVendidoPor] = useState('Arthur');

  useEffect(() => {
    if (lead || busca.trim().length < 2) return;
    const t = setTimeout(() => void buscarLeadsParaVendaAction(busca).then(setAchados).catch(() => setAchados([])), 300);
    return () => clearTimeout(t);
  }, [busca, lead]);

  const salvar = () =>
    start(async () => {
      const r = await registrarVendaAction({
        leadId: lead?.id ?? null,
        cliente: lead ? '' : cliente,
        escolha: e,
        vendidoPor,
        moeda,
        valor: valor ? Number(valor.replace(/\./g, '').replace(',', '.')) : null,
      }).catch(() => ({ ok: false, message: 'Falha de conexão.' }));
      toast(r);
      if (r.ok) aoTerminar();
    });

  const n = NOMES.BRL;
  return (
    <section className="space-y-3 rounded-[18px] border border-accent/40 bg-card p-4 sm:p-5">
      <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Registrar venda</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[12px] font-bold text-fg-tertiary">
          Lead da Captação (opcional)
          {lead ? (
            <div className="mt-1 flex items-center justify-between rounded-[10px] border border-border px-3 py-2 text-[13px] font-bold text-fg">
              {lead.nome}
              <button onClick={() => setLead(null)} className="text-[12px] text-accent">
                trocar
              </button>
            </div>
          ) : (
            <>
              <input value={busca} onChange={(x) => setBusca(x.target.value)} placeholder="busque pelo nome" className={`mt-1 w-full ${inputClass}`} />
              {achados.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {achados.map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => {
                          setLead({ id: a.id, nome: a.nome });
                          if (a.pacote) setE(a.pacote);
                        }}
                        className="w-full rounded-[10px] border border-border px-3 py-1.5 text-left text-[12.5px] font-normal text-fg hover:border-accent/60"
                      >
                        <b>{a.nome}</b> <span className="text-fg-faded">· {a.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </label>
        {!lead && (
          <label className="text-[12px] font-bold text-fg-tertiary">
            Ou o nome do cliente
            <input value={cliente} onChange={(x) => setCliente(x.target.value)} className={`mt-1 w-full ${inputClass}`} />
          </label>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <Seletor rotulo="Produto" valor={e.produto} onChange={(v) => setE({ ...e, produto: v as Escolha['produto'] })} opcoes={[['site', 'Site'], ['loja', 'Loja'], ['erp', 'Sistema de gestão']]} />
        <Seletor rotulo="Nível" valor={String(e.nivel)} onChange={(v) => setE({ ...e, nivel: Number(v) as 0 | 1 | 2 })} opcoes={NIVEIS.map((t, i) => [String(i), t])} />
        <Seletor
          rotulo="Sistema junto"
          valor={e.comGestao ? String(e.nivelGestao) : 'nao'}
          onChange={(v) => setE({ ...e, comGestao: v !== 'nao', nivelGestao: v === 'nao' ? 0 : (Number(v) as 0 | 1 | 2) })}
          opcoes={[['nao', 'Não'], ...n.erp.map((t, i) => [String(i), t] as [string, string])]}
        />
        <Seletor rotulo="Marca" valor={String(e.marca)} onChange={(v) => setE({ ...e, marca: Number(v) as Escolha['marca'] })} opcoes={[['0', 'Já tem'], ...n.marca.map((t, i) => [String(i + 1), t] as [string, string])]} />
        <Seletor rotulo="Moeda" valor={moeda} onChange={(v) => setMoeda(v as 'BRL' | 'USD')} opcoes={[['BRL', 'Real'], ['USD', 'Dólar']]} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[12px] font-bold text-fg-tertiary">
          Valor fechado (vazio = tabela)
          <input value={valor} onChange={(x) => setValor(x.target.value)} inputMode="decimal" className={`mt-1 w-full ${inputClass}`} />
        </label>
        <label className="text-[12px] font-bold text-fg-tertiary">
          Vendido por
          <input value={vendidoPor} onChange={(x) => setVendidoPor(x.target.value)} className={`mt-1 w-full ${inputClass}`} />
        </label>
        <div className="flex items-end">
          <button onClick={salvar} disabled={pending} className="w-full rounded-control bg-accent px-4 py-2.5 text-[13px] font-extrabold text-page disabled:opacity-50">
            {pending ? 'Salvando…' : 'Registrar e criar projeto'}
          </button>
        </div>
      </div>
    </section>
  );
}

function Seletor({ rotulo, valor, onChange, opcoes }: { rotulo: string; valor: string; onChange: (v: string) => void; opcoes: [string, string][] }) {
  return (
    <label className="text-[12px] font-bold text-fg-tertiary">
      {rotulo}
      <select value={valor} onChange={(x) => onChange(x.target.value)} className={`mt-1 w-full ${inputClass}`}>
        {opcoes.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------ projeto aberto */

function DetalheDoProjeto({
  p,
  orcamentos,
  agora,
  aoVoltar,
  aoMudar,
}: {
  p: ProjetoDoPainel;
  orcamentos: { id: string; titulo: string }[];
  agora: number;
  aoVoltar: () => void;
  aoMudar: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const acao = (f: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await f().catch(() => ({ ok: false, message: 'Falha de conexão.' }));
      toast(r);
      if (r.ok) aoMudar();
    });

  const [servicoDaRodada, setServicoDaRodada] = useState(p.servicos[0]?.id ?? '');
  const [pedido, setPedido] = useState('');
  const [atendido, setAtendido] = useState('Arthur');
  const [quando, setQuando] = useState('');
  const [link, setLink] = useState('');
  const [assunto, setAssunto] = useState('');
  const [rodadaDaReuniao, setRodadaDaReuniao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const linha = useMemo(() => {
    const ev: { quando: string; texto: string }[] = [{ quando: p.vendidoEm, texto: `Venda fechada por ${p.vendidoPor} (${dinheiro(p.valor, p.moeda)})` }];
    if (p.sinal?.pagoEm) ev.push({ quando: p.sinal.pagoEm, texto: `Sinal pago (${dinheiro(p.sinal.valor, p.moeda)})` });
    for (const r of p.rodadas) {
      const s = p.servicos.find((x) => x.id === r.servicoId)?.nome ?? 'serviço';
      ev.push({ quando: r.pedidoEm, texto: `Rodada ${r.numero}${r.extra ? ' (extra)' : ''} pedida em ${s}` });
      if (r.entregueEm) ev.push({ quando: r.entregueEm, texto: `Rodada ${r.numero} entregue (${s})` });
      if (r.aceiteEm) ev.push({ quando: r.aceiteEm, texto: `Rodada ${r.numero} aceita (${s})` });
    }
    for (const m of p.reunioes) ev.push({ quando: m.inicio, texto: `Reunião: ${m.titulo.replace(/^Prog Soluções × [^:]+: /, '')}` });
    if (p.entregueEm) ev.push({ quando: p.entregueEm, texto: 'Projeto entregue' });
    return ev.sort((a, b) => b.quando.localeCompare(a.quando));
  }, [p]);

  return (
    <section className="space-y-4 rounded-[18px] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <button onClick={aoVoltar} className="mb-1 text-[12.5px] font-bold text-accent lg:hidden">
            ← Projetos
          </button>
          <div className="text-[18px] font-extrabold">{p.cliente}</div>
          <div className="text-[12.5px] text-fg-tertiary">
            Vendido por {p.vendidoPor} em {dataBR(p.vendidoEm)} · {dinheiro(p.valor, p.moeda)}
            {p.mensal ? ` + ${dinheiro(p.mensal, p.moeda)}/mês` : ''}
            {p.contato.telefone ? ` · ${p.contato.telefone}` : ''}
          </div>
          {p.sinal && (
            <div className={`text-[12px] font-bold ${p.sinal.pagoEm ? 'text-success' : 'text-fg-tertiary'}`}>
              Sinal {p.sinal.pagoEm ? `pago em ${dataBR(p.sinal.pagoEm)}` : 'aguardando pagamento'}
            </div>
          )}
        </div>
        <select
          value={p.status}
          disabled={pending}
          onChange={(x) => acao(() => atualizarProjetoAction(p.id, { status: x.target.value as ProjetoDoPainel['status'] }))}
          className={inputClass}
        >
          {Object.entries(STATUS).map(([k, t]) => (
            <option key={k} value={k}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[12px] font-bold text-fg-tertiary">
          Entrega prevista ({p.prazoDias} dias úteis)
          <input
            type="date"
            defaultValue={p.entregaPrevista ?? ''}
            onBlur={(x) => x.target.value !== (p.entregaPrevista ?? '') && acao(() => atualizarProjetoAction(p.id, { entregaPrevista: x.target.value }))}
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
        <label className="text-[12px] font-bold text-fg-tertiary">
          Entregue em
          <input
            type="date"
            defaultValue={p.entregueEm ?? ''}
            onBlur={(x) => x.target.value !== (p.entregueEm ?? '') && acao(() => atualizarProjetoAction(p.id, { entregueEm: x.target.value }))}
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
        <label className="text-[12px] font-bold text-fg-tertiary">
          Orçamento / contrato (ERP)
          <select
            value={p.orcamento?.id ?? ''}
            onChange={(x) => acao(() => atualizarProjetoAction(p.id, { orcamentoId: x.target.value || null }))}
            className={`mt-1 w-full ${inputClass}`}
          >
            <option value="">Sem vínculo</option>
            {orcamentos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.titulo}
              </option>
            ))}
          </select>
          {p.orcamento && (
            <a href={`/api/orcamentos-servicos/${p.orcamento.id}/pdf`} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent">
              <FileText size={12} /> Abrir proposta/contrato
            </a>
          )}
        </label>
      </div>

      {/* Serviços e o contador de rodadas (P2) */}
      <div>
        <Titulo icone={<Repeat size={13} />} texto="Serviços e rodadas de ajuste" />
        <div className="grid gap-2 sm:grid-cols-2">
          {p.servicos.map((s) => {
            const usadas = p.rodadas.filter((r) => r.servicoId === s.id).length;
            const fimSuporte = p.entregueEm && s.suporteDias ? new Date(Date.parse(`${p.entregueEm}T12:00:00`) + s.suporteDias * 864e5) : null;
            return (
              <div key={s.id} className="rounded-[12px] bg-page/50 p-3 text-[12.5px]">
                <div className="font-extrabold">{s.nome}</div>
                <div className={`mt-0.5 font-bold ${usadas >= s.rodadasIncluidas ? 'text-error' : 'text-fg-secondary'}`}>
                  {usadas} de {s.rodadasIncluidas} rodadas usadas
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg-faded/12">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (usadas / Math.max(1, s.rodadasIncluidas)) * 100)}%` }} />
                </div>
                <div className="mt-1 text-[11.5px] text-fg-faded">
                  {s.suporteDias ? (fimSuporte ? `Suporte até ${fimSuporte.toLocaleDateString('pt-BR')}` : `${s.suporteDias} dias de suporte após a entrega`) : 'Sem suporte no pacote'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rodadas (P3/P4) */}
      <div>
        <Titulo icone={<ClipboardList size={13} />} texto="Rodadas" />
        {p.rodadas.length === 0 && <div className="text-[12.5px] text-fg-tertiary">Nenhuma rodada pedida ainda.</div>}
        <ul className="space-y-2">
          {p.rodadas.map((r) => {
            const s = p.servicos.find((x) => x.id === r.servicoId);
            const diasDoAceite = r.status === 'entregue' && r.entregueEm ? diasUteisDesde(r.entregueEm, agora) : 0;
            return (
              <li key={r.id} className="rounded-[12px] border border-border p-3 text-[12.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>
                    {s?.nome ?? 'Serviço'} · rodada {r.numero}
                    {r.extra && <span className="ml-1.5 rounded-full bg-error/12 px-2 py-0.5 text-[10.5px] text-error">extra: orçar antes</span>}
                  </b>
                  <span className="text-[11.5px] text-fg-faded">
                    pedida {dataBR(r.pedidoEm)}
                    {r.atendidoPor ? ` · ${r.atendidoPor}` : ''}
                  </span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-fg-secondary">{r.pedido}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {r.status === 'aberta' && (
                    <button disabled={pending} onClick={() => acao(() => marcarRodadaAction(r.id, 'entregue'))} className="rounded-full bg-accent px-3 py-1 text-[12px] font-extrabold text-page">
                      Marcar entregue
                    </button>
                  )}
                  {r.status === 'entregue' && (
                    <>
                      <span className={`text-[12px] font-bold ${diasDoAceite >= 5 ? 'text-error' : 'text-fg-tertiary'}`}>
                        Entregue {dataBR(r.entregueEm)} · aceite: {diasDoAceite} de 5 dias úteis
                        {diasDoAceite >= 5 ? ' (pelo contrato, já conta como aceita)' : ''}
                      </span>
                      <button disabled={pending} onClick={() => acao(() => marcarRodadaAction(r.id, 'aceita'))} className="rounded-full border border-success/60 px-3 py-1 text-[12px] font-bold text-success">
                        Registrar aceite
                      </button>
                    </>
                  )}
                  {r.status === 'aceita' && (
                    <span className="flex items-center gap-1 text-[12px] font-bold text-success">
                      <CheckCircle2 size={13} /> Aceita em {dataBR(r.aceiteEm)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {p.servicos.length > 0 && (
          <div className="mt-2 space-y-2 rounded-[12px] bg-page/50 p-3">
            <div className="text-[12px] font-extrabold">Nova rodada</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
              <select value={servicoDaRodada} onChange={(x) => setServicoDaRodada(x.target.value)} className={inputClass}>
                {p.servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({p.rodadas.filter((r) => r.servicoId === s.id).length} de {s.rodadasIncluidas})
                  </option>
                ))}
              </select>
              <input value={atendido} onChange={(x) => setAtendido(x.target.value)} placeholder="quem atende" className={inputClass} />
            </div>
            <textarea value={pedido} onChange={(x) => setPedido(x.target.value)} rows={3} placeholder="O que o cliente pediu nesta rodada" className={`w-full resize-none ${inputClass}`} />
            <button
              disabled={pending || !pedido.trim()}
              onClick={() =>
                acao(async () => {
                  const r = await novaRodadaAction(p.id, servicoDaRodada, pedido, atendido);
                  if (r.ok) setPedido('');
                  return r;
                })
              }
              className="rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-extrabold text-page disabled:opacity-50"
            >
              Abrir rodada
            </button>
          </div>
        )}
      </div>

      {/* Reuniões (P5) */}
      <div>
        <Titulo icone={<CalendarDays size={13} />} texto="Reuniões" />
        <ul className="space-y-2">
          {p.reunioes.map((m) => (
            <Reuniao key={m.id} m={m} rodada={p.rodadas.find((r) => r.id === m.rodadaId)?.numero ?? null} aoMudar={aoMudar} />
          ))}
        </ul>
        <div className="mt-2 grid gap-2 rounded-[12px] bg-page/50 p-3 sm:grid-cols-2">
          <input type="datetime-local" value={quando} onChange={(x) => setQuando(x.target.value)} className={inputClass} />
          <input value={assunto} onChange={(x) => setAssunto(x.target.value)} placeholder="assunto (ex.: apresentar a rodada 1)" className={inputClass} />
          <input value={link} onChange={(x) => setLink(x.target.value)} placeholder="link da chamada (opcional)" className={inputClass} />
          <select value={rodadaDaReuniao} onChange={(x) => setRodadaDaReuniao(x.target.value)} className={inputClass}>
            <option value="">Do projeto (sem rodada)</option>
            {p.rodadas.map((r) => (
              <option key={r.id} value={r.id}>
                Rodada {r.numero} · {p.servicos.find((s) => s.id === r.servicoId)?.nome}
              </option>
            ))}
          </select>
          <button
            disabled={pending || !quando}
            onClick={() =>
              acao(() =>
                marcarReuniaoDoProjetoAction({
                  projetoId: p.id,
                  rodadaId: rodadaDaReuniao || null,
                  // datetime-local é hora de Brasília (UTC−3).
                  inicio: `${quando}:00-03:00`,
                  duracaoMin: 30,
                  link,
                  assunto,
                })
              )
            }
            className="rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-extrabold text-page disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
          >
            Marcar reunião
          </button>
        </div>
      </div>

      <ClaudeDesign p={p} aoMudar={aoMudar} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] font-bold text-fg-tertiary">
          Pasta do código (no PC)
          <input
            defaultValue={p.pasta ?? ''}
            placeholder="C:\\Apps\\1 - Dev\\Prog Soluções\\1 - Clientes\\..."
            onBlur={(x) => x.target.value !== (p.pasta ?? '') && acao(() => atualizarProjetoAction(p.id, { pasta: x.target.value }))}
            className={`mt-1 w-full ${inputClass}`}
          />
          <span className="mt-1 block font-normal text-fg-faded">Com a pasta preenchida, a Lia faz sozinha os ajustes simples que o cliente pedir, só aqui dentro.</span>
        </label>
        <label className="block text-[12px] font-bold text-fg-tertiary">
          Site publicado
          <input
            defaultValue={p.siteUrl ?? ''}
            placeholder="https://..."
            onBlur={(x) => x.target.value !== (p.siteUrl ?? '') && acao(() => atualizarProjetoAction(p.id, { siteUrl: x.target.value }))}
            className={`mt-1 w-full ${inputClass}`}
          />
          <span className="mt-1 block font-normal text-fg-faded">O link que a Lia manda para o cliente conferir o ajuste.</span>
        </label>
      </div>

      <label className="block text-[12px] font-bold text-fg-tertiary">
        Observações
        <textarea
          defaultValue={p.observacoes ?? ''}
          onBlur={(x) => x.target.value !== (p.observacoes ?? '') && acao(() => atualizarProjetoAction(p.id, { observacoes: x.target.value }))}
          rows={2}
          className={`mt-1 w-full resize-none ${inputClass}`}
        />
      </label>

      <div className="flex justify-end">
        <button
          disabled={pending}
          onClick={() => {
            if (!excluindo) return setExcluindo(true);
            acao(async () => {
              const r = await excluirProjetoAction(p.id);
              if (r.ok) aoVoltar();
              return r;
            });
          }}
          onBlur={() => setExcluindo(false)}
          className={`rounded-full px-3 py-1 text-[12px] font-bold ${excluindo ? 'bg-error text-page' : 'border border-error/50 text-error'}`}
        >
          {excluindo ? 'Confirmar: excluir este projeto?' : 'Excluir projeto'}
        </button>
      </div>

      {/* Linha do tempo (P8) */}
      <div>
        <Titulo icone={<History size={13} />} texto="Linha do tempo" />
        <ol className="space-y-1.5 border-l border-border pl-3">
          {linha.map((ev, i) => (
            <li key={i} className="text-[12.5px]">
              <span className="text-fg-faded">{horaBR(ev.quando)}</span> · {ev.texto}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Pedidos do Claude Design (pedido do Arthur em 30/10/2026): só ficam para copiar depois das etapas
 * anteriores (projeto aberto, financeiro resolvido, descoberta confirmada pelo cliente). A Bia gera a
 * versão final quando as três estão ok.
 */
function ClaudeDesign({ p, aoMudar }: { p: ProjetoDoPainel; aoMudar: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const d = p.design;
  const etapas: [boolean, string, string][] = [
    [d.aberto, 'Projeto aberto', 'A Bia cria a pasta e o briefing quando o projeto abre.'],
    [d.financeiro, 'Financeiro resolvido', 'Sinal ou total pago, ou projeto de graça.'],
    [d.descoberta, 'Descoberta confirmada pelo cliente', 'A Lia manda o resumo e o cliente confirma.'],
  ];
  const copiar = (texto: string, quem: string) =>
    navigator.clipboard?.writeText(texto).then(
      () => toast({ ok: true, message: `Pedido da ${quem} copiado. Cole no Claude Design.` }),
      () => toast({ ok: false, message: 'Não consegui copiar. Tente de novo.' }),
    );
  return (
    <div className="rounded-[14px] border border-border p-3">
      <Titulo icone={<Palette size={13} />} texto="Claude Design (Duda e Nina)" />
      <ol className="mb-3 grid gap-1.5 sm:grid-cols-3">
        {etapas.map(([ok, nome, dica]) => (
          <li key={nome} className="flex gap-2 text-[12.5px]">
            {ok ? <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-success" /> : <Circle size={15} className="mt-0.5 flex-shrink-0 text-fg-faded" />}
            <span>
              <b className={ok ? '' : 'text-fg-tertiary'}>{nome}</b>
              {!ok && <span className="block text-[11.5px] text-fg-faded">{dica}</span>}
            </span>
          </li>
        ))}
      </ol>
      {d.prontos ? (
        <div className="flex flex-wrap gap-2">
          {d.duda && (
            <button onClick={() => copiar(d.duda!, 'Duda')} className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-extrabold text-page">
              <Copy size={13} /> Copiar pedido da Duda (identidade)
            </button>
          )}
          {d.nina && (
            <button onClick={() => copiar(d.nina!, 'Nina')} className="flex items-center gap-1.5 rounded-full border border-accent/60 px-3 py-1.5 text-[12.5px] font-extrabold text-accent">
              <Copy size={13} /> Copiar pedido da Nina (telas)
            </button>
          )}
          <span className="self-center text-[11.5px] text-fg-faded">Primeiro a Duda; quando ela terminar, a Nina.</span>
        </div>
      ) : d.liberado ? (
        <p className="text-[12.5px] text-fg-tertiary">⏳ Tudo certo: a Bia está preparando a versão final dos pedidos{d.pedidoEm ? '' : ' (entra na fila em até 1 minuto)'}. Te aviso no WhatsApp quando estiverem prontos.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-tertiary">
          <span>Os pedidos aparecem aqui quando as três etapas estiverem ok.</span>
          {!d.descoberta && (
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await marcarDescobertaConfirmadaAction(p.id).catch(() => ({ ok: false, message: 'Falha de conexão.' }));
                  toast(r);
                  if (r.ok) aoMudar();
                })
              }
              className="rounded-full border border-border px-3 py-1 text-[12px] font-bold text-fg-secondary"
            >
              Marcar descoberta como confirmada
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Reuniao({ m, rodada, aoMudar }: { m: ProjetoDoPainel['reunioes'][number]; rodada: number | null; aoMudar: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [ata, setAta] = useState(m.ata ?? '');
  return (
    <li className="rounded-[12px] border border-border p-3 text-[12.5px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>
          {horaBR(m.inicio)} · {m.titulo.replace(/^Prog Soluções × [^:]+: /, '')}
          {rodada ? ` · rodada ${rodada}` : ''}
        </b>
        {m.link && (
          <a href={m.link} target="_blank" rel="noopener" className="text-accent">
            entrar
          </a>
        )}
      </div>
      <textarea value={ata} onChange={(x) => setAta(x.target.value)} rows={2} placeholder="Ata: o que ficou decidido" className={`mt-2 w-full resize-none ${inputClass}`} />
      {ata !== (m.ata ?? '') && (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await salvarAtaAction(m.id, ata).catch(() => ({ ok: false, message: 'Falha de conexão.' }));
              toast(r);
              if (r.ok) aoMudar();
            })
          }
          className="mt-1 rounded-full bg-accent px-3 py-1 text-[12px] font-extrabold text-page"
        >
          Salvar ata
        </button>
      )}
    </li>
  );
}

function Titulo({ icone, texto }: { icone: React.ReactNode; texto: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
      {icone} {texto}
    </div>
  );
}

