'use client';

// Pré-venda da Prog Soluções (pedido do Arthur, 31/10/2026): todos os leads sendo contatados ou em
// negociação, com o "projeto antes de ser projeto" (briefing, identidade, protótipo, proposta e o que
// falta do cliente). Quadro por etapa no computador e lista no celular. Só fatos nos números: contagem,
// datas e preço cheio do catálogo, sem chance de fechar. Quando o sinal é pago, tudo vai para o Pós-venda.

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlarmClock,
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  CircleDot,
  ExternalLink,
  FileText,
  FolderOpen,
  LayoutGrid,
  List,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Video,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { AppLoader } from '@/brand/loaders/AppLoader';
import {
  fecharVendaDaPreVendaAction,
  painelDaPreVendaAction,
  salvarPreVendaAction,
  type AlteracaoDaPreVenda,
  type LeadDaPreVenda,
  type PainelDaPreVenda,
} from '@/app/actions/pre-venda';
import { updateLeadAction } from '@/app/actions/leads';
import { LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/captacao';
import { formatMoeda } from '@/lib/precos-captacao';
import { NOMES } from '@/lib/simulador';
import {
  alertasDoLead,
  descontoSobre,
  escolhaDosItens,
  ETAPAS_DA_PRE_VENDA,
  precoCheioDosItens,
  RESPONSAVEIS,
  type Alerta,
  type EstadoPasso,
  type EtapaDaPreVenda,
  type ItemDoPacote,
  type PassoCalculado,
  type Pendencia,
} from '@/lib/pre-venda';
import { haQuanto, hojeISO, inputClass, usePreferencia } from '@/components/admin/captacao/comum';

const NOME_DA_COLUNA: Record<EtapaDaPreVenda, string> = {
  novo: 'Chegou (conversa)',
  contatado: 'Contatado',
  respondeu: 'Respondeu',
  reuniao: 'Reunião',
  proposta: 'Proposta',
};

const ORIGEM: Record<string, string> = {
  whatsapp_direto: 'WhatsApp direto',
  portfolio: 'Portfólio',
  google_maps: 'Google Maps',
  indicacao: 'Indicação',
};
const nomeDaOrigem = (o: string | null) => (o ? (ORIGEM[o] ?? o.replace(/_/g, ' ')) : 'Sem origem');

const dataBR = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null);
const horaBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const QUEM: Record<'cliente' | 'lia' | 'arthur', string> = { cliente: 'Cliente', lia: 'Lia', arthur: 'Arthur' };

export function PreVendaPanel() {
  const [painel, setPainel] = useState<PainelDaPreVenda | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'alerta' | 'janela'>('todos');
  // Padrão: quadro no computador e lista no celular (CSS decide); o Arthur pode fixar um dos dois.
  const [vista, setVista] = usePreferencia('prevenda-vista', 'auto');
  const [diasParadoTxt, setDiasParado] = usePreferencia('prevenda-dias-parado', '3');
  const diasParado = Math.max(1, Number(diasParadoTxt) || 3);
  const [agora, setAgora] = useState(() => Date.now());

  const reler = useCallback(async () => {
    const p = await painelDaPreVendaAction().catch(() => null);
    if (p) setPainel(p);
    else setErro(true);
    setAgora(Date.now());
  }, []);
  useEffect(() => {
    let vivo = true;
    painelDaPreVendaAction()
      .then((p) => {
        if (!vivo) return;
        if (p) setPainel(p);
        else setErro(true);
      })
      .catch(() => vivo && setErro(true));
    // Volta para a aba: relê (a Lia pode ter conversado enquanto isso).
    const aoVoltar = () => document.visibilityState === 'visible' && void reler();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [reler]);

  const alertasDe = useCallback(
    (l: LeadDaPreVenda) => alertasDoLead(l.proximo, l.ultimoMovimento, diasParado, agora),
    [diasParado, agora]
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (painel?.leads ?? [])
      .filter((l) => !q || [l.nome, l.empresa, l.cidade, l.telefone].some((x) => x?.toLowerCase().includes(q)))
      .filter((l) => (filtro === 'alerta' ? alertasDe(l).length > 0 : filtro === 'janela' ? !!l.conversa?.janelaAberta : true))
      .sort((a, b) => (b.ultimoMovimento ?? '').localeCompare(a.ultimoMovimento ?? ''));
  }, [painel, busca, filtro, alertasDe]);

  const topo = useMemo(() => {
    const ls = painel?.leads ?? [];
    const porEtapa = Object.fromEntries(ETAPAS_DA_PRE_VENDA.map((e) => [e, ls.filter((l) => l.etapa === e).length])) as Record<EtapaDaPreVenda, number>;
    // Valor das propostas enviadas: preço cheio do catálogo do pacote, por moeda (sem converter).
    const enviadas = ls.filter((l) => l.passos.find((p) => p.chave === 'proposta')?.estado === 'feito');
    const somar = (m: 'BRL' | 'USD') => enviadas.filter((l) => l.pacote?.moeda === m).reduce((s, l) => s + (l.pacote?.total ?? 0), 0);
    const reunioes = ls
      .flatMap((l) => l.reunioes.filter((r) => r.status === 'marcada' && Date.parse(r.inicio) >= agora).map((r) => ({ ...r, lead: l.nome, leadId: l.id })))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    return {
      porEtapa,
      comAlerta: ls.filter((l) => alertasDe(l).length > 0).length,
      enviadas: enviadas.length,
      semPacote: enviadas.filter((l) => !l.pacote).length,
      brl: somar('BRL'),
      usd: somar('USD'),
      reunioes,
    };
  }, [painel, agora, alertasDe]);

  const lead = painel?.leads.find((l) => l.id === aberto) ?? null;

  if (!painel) {
    return (
      <div className="tema-apple [color-scheme:dark]">
        {erro ? (
          <p className="rounded-[18px] border border-border bg-card p-4 text-[13.5px] text-fg-secondary">Não foi possível ler a pré-venda. Recarregue a página.</p>
        ) : (
          <AppLoader rotulo="Juntando leads, conversas e reuniões" />
        )}
      </div>
    );
  }

  return (
    <div className="tema-apple space-y-4 [color-scheme:dark]">
      <div className="aurora" aria-hidden />

      {!painel.tabelaPronta && (
        <p className="rounded-[14px] border border-[#ff9f43]/40 bg-[#ff9f43]/10 px-4 py-3 text-[13px] text-[#ffc58a]">
          A tabela da pré-venda (migration 0114) ainda não está no banco: a tela mostra só o que os dados dizem sozinhos e não salva o que for marcado à mão.
        </p>
      )}
      {painel.etapaDesatualizada.length > 0 && <EtapaDesatualizada itens={painel.etapaDesatualizada} aoCorrigir={reler} />}

      {/* Topo: só fatos. */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {ETAPAS_DA_PRE_VENDA.map((e) => (
          <Numero key={e} rotulo={NOME_DA_COLUNA[e]} valor={String(topo.porEtapa[e])} />
        ))}
        <Numero rotulo="Com alerta" valor={String(topo.comAlerta)} alerta={topo.comAlerta > 0} />
      </section>
      <section className="grid gap-2.5 md:grid-cols-2">
        <div className="rounded-[18px] border border-border bg-card p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-fg-faded">Propostas enviadas (preço cheio do catálogo)</div>
          <div className="mt-1 text-[22px] font-semibold tabular-nums text-fg">
            {topo.brl > 0 || topo.usd === 0 ? formatMoeda(topo.brl, 'BRL') : null}
            {topo.usd > 0 && <span className={topo.brl > 0 ? 'ml-2 text-[16px] text-fg-secondary' : ''}>{formatMoeda(topo.usd, 'USD')}</span>}
          </div>
          <div className="text-[12px] text-fg-tertiary">
            {topo.enviadas} proposta(s){topo.semPacote > 0 ? ` · ${topo.semPacote} sem pacote definido (fora da soma)` : ''}
          </div>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-fg-faded">Próximas reuniões</div>
          {topo.reunioes.length === 0 ? (
            <p className="mt-1 text-[13px] text-fg-tertiary">Nenhuma marcada.</p>
          ) : (
            <ul className="mt-1 grid gap-1">
              {topo.reunioes.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <button onClick={() => setAberto(r.leadId)} className="flex min-h-10 w-full items-center gap-2 text-left text-[13px]">
                    <CalendarDays size={15} className="shrink-0 text-fg-tertiary" />
                    <b className="tabular-nums text-fg">{horaBR(r.inicio)}</b>
                    <span className="truncate text-fg-secondary">{r.lead}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Busca, filtros e vista. */}
      <section className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 basis-[220px] items-center gap-2 rounded-full border border-border-strong bg-input px-4">
          <Search size={16} className="shrink-0 text-fg-tertiary" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, empresa ou telefone" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
        </label>
        <div className="flex gap-1.5">
          {(
            [
              ['todos', 'Todos'],
              ['alerta', 'Com alerta'],
              ['janela', 'Janela aberta'],
            ] as const
          ).map(([k, r]) => (
            <button
              key={k}
              onClick={() => setFiltro(k)}
              className={`h-10 rounded-full px-3.5 text-[13px] font-semibold ${filtro === k ? 'bg-[oklch(72%_.1_262/.18)] text-[#B1D2FF]' : 'border border-border-strong text-fg-secondary'}`}
            >
              {r}
            </button>
          ))}
        </div>
        <label className="flex h-10 items-center gap-1.5 rounded-full border border-border-strong px-3 text-[12.5px] text-fg-secondary" title="Alerta de lead parado: dias sem nenhum movimento">
          Parado após
          <input
            type="number"
            min={1}
            max={60}
            value={diasParadoTxt}
            onChange={(e) => setDiasParado(e.target.value)}
            className="w-10 bg-transparent text-center font-semibold text-fg outline-none"
          />
          dias
        </label>
        <div className="flex gap-1">
          <BotaoIcone ativo={vista === 'quadro'} titulo="Quadro" onClick={() => setVista(vista === 'quadro' ? 'auto' : 'quadro')}>
            <LayoutGrid size={17} />
          </BotaoIcone>
          <BotaoIcone ativo={vista === 'lista'} titulo="Lista" onClick={() => setVista(vista === 'lista' ? 'auto' : 'lista')}>
            <List size={17} />
          </BotaoIcone>
        </div>
      </section>

      {visiveis.length === 0 && (
        <p className="rounded-[18px] border border-border bg-card p-5 text-center text-[13.5px] text-fg-tertiary">Nenhum lead em pré-venda com esse filtro.</p>
      )}

      {/* Quadro por etapa (desktop) */}
      <section
        className={`gap-3 ${vista === 'quadro' ? 'grid overflow-x-auto lg:grid-cols-5' : vista === 'lista' ? 'hidden' : 'hidden lg:grid lg:grid-cols-5'}`}
      >
        {ETAPAS_DA_PRE_VENDA.map((e) => {
          const da = visiveis.filter((l) => l.etapa === e);
          return (
            <div key={e} className="min-w-0 rounded-[20px] border border-border bg-white/[0.015] p-2.5">
              <div className="mb-2 flex items-center justify-between px-1.5 text-[12px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                {NOME_DA_COLUNA[e]} <span className="tabular-nums">{da.length}</span>
              </div>
              <div className="grid gap-2">
                {da.map((l) => (
                  <Card key={l.id} l={l} alertas={alertasDe(l)} agora={agora} onAbrir={() => setAberto(l.id)} compacto />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Lista (celular) */}
      <section className={`gap-2 ${vista === 'lista' ? 'grid' : vista === 'quadro' ? 'hidden' : 'grid lg:hidden'}`}>
        {visiveis.map((l) => (
          <Card key={l.id} l={l} alertas={alertasDe(l)} agora={agora} onAbrir={() => setAberto(l.id)} />
        ))}
      </section>

      {lead && (
        <Detalhe
          key={lead.id}
          l={lead}
          alertas={alertasDe(lead)}
          agora={agora}
          tabelaPronta={painel.tabelaPronta}
          catalogo={painel.catalogo[lead.pais === 'US' ? 'USD' : 'BRL']}
          portfolio={painel.portfolio}
          onFechar={() => setAberto(null)}
          onMudou={reler}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ peças */

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`rounded-[18px] border p-3.5 ${alerta ? 'border-error/40 bg-error/[.06]' : 'border-border bg-card'}`}>
      <div className="truncate text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{rotulo}</div>
      <div className={`mt-0.5 text-[24px] font-semibold tabular-nums ${alerta ? 'text-error' : 'text-fg'}`}>{valor}</div>
    </div>
  );
}

function BotaoIcone({ ativo, titulo, onClick, children }: { ativo: boolean; titulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      className={`grid h-10 w-10 place-items-center rounded-full ${ativo ? 'bg-[oklch(72%_.1_262/.18)] text-[#B1D2FF]' : 'border border-border-strong text-fg-secondary'}`}
    >
      {children}
    </button>
  );
}

function SeloAlerta({ a }: { a: Alerta }) {
  const forte = a.tipo === 'vencido';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${forte ? 'bg-error/15 text-error' : 'bg-[#ff9f43]/15 text-[#ffb36b]'}`}>
      {a.tipo === 'parado' ? <AlarmClock size={11} /> : <TriangleAlert size={11} />}
      {a.texto}
    </span>
  );
}

function Janela({ aberta }: { aberta: boolean }) {
  return (
    <span
      title={aberta ? 'O cliente falou nas últimas 24 h: dá para mandar texto livre no WhatsApp.' : 'Mais de 24 h sem mensagem do cliente: só modelo aprovado da Meta.'}
      className={`inline-flex items-center gap-1 text-[11.5px] font-semibold ${aberta ? 'text-success' : 'text-fg-faded'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${aberta ? 'bg-success shadow-[0_0_6px_currentColor]' : 'bg-fg-faded'}`} />
      Janela 24 h {aberta ? 'aberta' : 'fechada'}
    </span>
  );
}

function Card({ l, alertas, agora, onAbrir, compacto }: { l: LeadDaPreVenda; alertas: Alerta[]; agora: number; onAbrir: () => void; compacto?: boolean }) {
  const feitos = l.passos.filter((p) => p.estado === 'feito').length;
  return (
    <button
      onClick={onAbrir}
      className={`w-full min-w-0 rounded-[18px] border bg-card p-3.5 text-left transition-colors hover:border-[oklch(74%_.12_262/.4)] ${alertas.some((a) => a.tipo === 'vencido') ? 'border-error/40' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <b className="block truncate text-[14.5px] text-fg">{l.nome}</b>
          <span className="block truncate text-[12px] text-fg-tertiary">
            {[l.empresa, l.cidade].filter(Boolean).join(' · ') || nomeDaOrigem(l.origem)}
          </span>
        </div>
        {!compacto && (
          <span className="shrink-0 rounded-full bg-[oklch(72%_.1_262/.18)] px-2 py-0.5 text-[11px] font-bold text-[#B1D2FF]">{NOME_DA_COLUNA[l.etapa]}</span>
        )}
      </div>
      <div className="mt-1.5 text-[11.5px] text-fg-tertiary">
        {nomeDaOrigem(l.origem)} · na etapa {haQuanto(l.naEtapaDesde, agora)} · {feitos}/{l.passos.length} passos
      </div>
      {l.conversa && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-secondary">
          <MessageCircle size={12} className="text-fg-tertiary" />
          {l.conversa.ultimaEm ? (
            <span>
              {l.conversa.ultimoDe ? QUEM[l.conversa.ultimoDe] : 'Última'} {haQuanto(l.conversa.ultimaEm, agora)}
            </span>
          ) : (
            <span>Sem mensagens</span>
          )}
          <Janela aberta={l.conversa.janelaAberta} />
        </div>
      )}
      <div className="mt-1.5 text-[12px]">
        {l.pacote ? (
          <span className="text-fg-secondary">
            <span className="text-fg-tertiary">{l.pacote.itens.join(' + ')}: </span>
            <b className="text-fg">{formatMoeda(l.pacote.total, l.pacote.moeda)}</b>
            {l.pacote.mensal > 0 && <> + {formatMoeda(l.pacote.mensal, l.pacote.moeda)}/mês</>}
          </span>
        ) : (
          <span className="text-fg-faded">Pacote não definido</span>
        )}
      </div>
      {l.proximo && (
        <div className="mt-2 rounded-[12px] bg-white/[0.03] px-2.5 py-1.5 text-[12px]">
          <span className="text-fg-faded">Próximo: </span>
          <span className="text-fg-secondary">{l.proximo.oQue}</span>
          {(l.proximo.quem || l.proximo.prazo) && (
            <span className="text-fg-tertiary">
              {' '}
              · {[l.proximo.quem, l.proximo.prazo && `até ${dataBR(l.proximo.prazo)}`].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}
      {alertas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {alertas.map((a) => (
            <SeloAlerta key={a.tipo} a={a} />
          ))}
        </div>
      )}
    </button>
  );
}

function EtapaDesatualizada({ itens, aoCorrigir }: { itens: PainelDaPreVenda['etapaDesatualizada']; aoCorrigir: () => void }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="rounded-[14px] border border-border-strong bg-white/[0.02] px-4 py-3 text-[13px]">
      <div className="text-fg-secondary">
        {itens.length === 1 ? '1 lead com projeto aberto no Pós-venda e etapa desatualizada' : `${itens.length} leads com projeto aberto no Pós-venda e etapa desatualizada`}{' '}
        (fora desta lista):
      </div>
      <ul className="mt-1.5 grid gap-1.5">
        {itens.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2">
            <b className="text-fg">{l.nome}</b>
            <span className="text-fg-tertiary">está em {LEAD_STATUS_LABEL[l.etapa as LeadStatus] ?? l.etapa}</span>
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await updateLeadAction(l.id, { status: 'fechado' });
                  toast(r);
                  if (r.ok) aoCorrigir();
                })
              }
              className="h-10 rounded-full border border-border-strong px-3.5 text-[12.5px] font-semibold text-fg-secondary hover:text-fg disabled:opacity-50"
            >
              Corrigir para Fechado
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ detalhe */

const ICONE_DO_ESTADO: Record<EstadoPasso, typeof Check> = { feito: Check, andamento: CircleDot, pendente: Circle };
const PROXIMO_ESTADO: Record<EstadoPasso, EstadoPasso> = { pendente: 'andamento', andamento: 'feito', feito: 'pendente' };

function Detalhe({
  l,
  alertas,
  agora,
  tabelaPronta,
  catalogo,
  portfolio,
  onFechar,
  onMudou,
}: {
  l: LeadDaPreVenda;
  alertas: Alerta[];
  agora: number;
  tabelaPronta: boolean;
  catalogo: PainelDaPreVenda['catalogo']['BRL'];
  portfolio: PainelDaPreVenda['portfolio'];
  onFechar: () => void;
  onMudou: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pv = l.prevenda;
  const moeda = l.pais === 'US' ? 'USD' : 'BRL';
  const [confirmarVenda, setConfirmarVenda] = useState(false);
  const [f, setF] = useState({
    proximoPasso: pv.proximoPasso ?? '',
    proximoResponsavel: quemNormalizado(pv.proximoResponsavel, l.nome),
    proximoPrazo: pv.proximoPrazo ?? '',
    proximoOrigem: pv.proximoOrigem ?? '',
    valorMensal: pv.valorMensal === null ? '' : String(pv.valorMensal),
    pasta: pv.pasta ?? '',
    briefingUrl: pv.briefingUrl ?? '',
    designSystemUrl: pv.designSystemUrl ?? '',
    prototipoUrl: pv.prototipoUrl ?? '',
    propostaUrl: pv.propostaUrl ?? '',
    desconto: pv.desconto === null ? '' : String(pv.desconto),
    valorProposta: pv.valorProposta === null ? '' : String(pv.valorProposta),
    propostaEnviadaEm: pv.propostaEnviadaEm ? pv.propostaEnviadaEm.slice(0, 10) : '',
    prazoPrometido: pv.prazoPrometido ?? '',
    observacoes: pv.observacoes ?? '',
  });
  const [novaPendencia, setNovaPendencia] = useState('');
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }) });

  // Esc fecha; a página por trás não rola enquanto o painel está aberto.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [onFechar]);

  function salvar(a: AlteracaoDaPreVenda, avisar = false) {
    start(async () => {
      const r = await salvarPreVendaAction(l.id, a);
      if (!r.ok || avisar) toast(r);
      if (r.ok) onMudou();
    });
  }
  const numero = (s: string) => (s.trim() ? Number(s.replace(/\./g, '').replace(',', '.')) : null);

  // Pacote montado aqui (itens gravados na hora) e o preço cheio deles.
  const itens = pv.itens;
  const cheio = precoCheioDosItens(itens);
  const temItens = itens.some((i) => i.tipo !== 'portfolio');
  // Sem itens montados, o preço cheio de referência é o do pacote escolhido na conversa (ou sugerido).
  const cheioUnico = temItens ? cheio.unico : (l.pacote?.total ?? 0);
  const cheioMensal = temItens ? cheio.mensal : (l.pacote?.mensal ?? 0);

  function camposAtuais(): AlteracaoDaPreVenda {
    const combinado = numero(f.valorProposta);
    const d = descontoSobre(cheioUnico, combinado);
    return {
      proximoPasso: f.proximoPasso,
      proximoResponsavel: f.proximoResponsavel === 'Outro' ? null : f.proximoResponsavel,
      proximoPrazo: f.proximoPrazo || null,
      proximoOrigem: f.proximoPasso.trim() ? f.proximoOrigem || 'manual' : null,
      pasta: f.pasta,
      briefingUrl: f.briefingUrl,
      designSystemUrl: f.designSystemUrl,
      prototipoUrl: f.prototipoUrl,
      propostaUrl: f.propostaUrl,
      // Desconto guardado = diferença entre o preço cheio e o combinado (só quando é desconto de fato).
      desconto: d && d.valor > 0 ? d.valor : null,
      valorProposta: combinado,
      valorMensal: numero(f.valorMensal),
      propostaEnviadaEm: f.propostaEnviadaEm || null,
      prazoPrometido: f.prazoPrometido || null,
      observacoes: f.observacoes,
    };
  }
  function salvarCampos() {
    salvar(camposAtuais(), true);
  }

  function aceitarSugestao(s: { oQue: string; quem: string | null; prazo: string | null; reuniaoEm: string }, editar: boolean) {
    const novo = { proximoPasso: s.oQue, proximoResponsavel: quemNormalizado(s.quem, l.nome), proximoPrazo: s.prazo ?? '', proximoOrigem: `reuniao:${s.reuniaoEm}` };
    setF({ ...f, ...novo });
    if (!editar) salvar({ ...novo, proximoPrazo: novo.proximoPrazo || null }, true);
  }

  const gravarItens = (novos: ItemDoPacote[]) => salvar({ itens: novos });

  function registrarVenda() {
    start(async () => {
      // Grava o que está na tela antes (valor e mensalidade digitados e ainda não salvos).
      const s = await salvarPreVendaAction(l.id, camposAtuais());
      if (!s.ok) return void toast(s);
      const r = await fecharVendaDaPreVendaAction(l.id).catch(() => ({ ok: false, message: 'Falha de conexão.' }));
      toast(r);
      if (r.ok) router.push('/admin/pos-venda');
    });
  }

  function mudarPasso(p: PassoCalculado) {
    // Toque avança pendente → em andamento → feito → pendente; "auto" devolve ao que os dados dizem.
    const estado = PROXIMO_ESTADO[p.estado];
    salvar({ passo: { chave: p.chave, valor: { estado, em: estado === 'pendente' ? null : (p.manual && p.em ? p.em : hojeISO()) } } });
  }
  const pendencias = pv.pendencias;
  const gravarPendencias = (ps: Pendencia[]) => salvar({ pendencias: ps });

  function mudarEtapa(status: LeadStatus) {
    start(async () => {
      const r = await updateLeadAction(l.id, { status });
      toast(r);
      if (r.ok) onMudou();
    });
  }

  const ultimaReuniao = l.reunioes.at(-1) ?? null;
  const descUnico = descontoSobre(cheioUnico, numero(f.valorProposta));
  const descMensal = descontoSobre(cheioMensal, numero(f.valorMensal));
  const venda = escolhaDosItens(itens);
  const nomes = NOMES[moeda];
  const pacoteDaVenda = venda
    ? [
        nomes[venda.escolha.produto][venda.escolha.nivel],
        venda.escolha.comGestao ? nomes.erp[venda.escolha.nivelGestao] : null,
        venda.escolha.marca ? nomes.marca[venda.escolha.marca - 1] : null,
      ].filter(Boolean)
    : l.pacote?.origem === 'escolhido'
      ? l.pacote.itens
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onFechar}>
      <aside
        role="dialog"
        aria-label={`Pré-venda de ${l.nome}`}
        onClick={(e) => e.stopPropagation()}
        className="ds-prog tema-apple h-full w-full max-w-[680px] overflow-y-auto overflow-x-hidden border-l border-border-strong bg-[#12141A] [color-scheme:dark]"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-[#12141A]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-[family-name:var(--font-sora)] text-[20px] font-semibold tracking-[-0.02em] text-[#F4F5F7]">{l.nome}</h2>
            <p className="truncate text-[12.5px] text-fg-tertiary">
              {[l.empresa, l.cidade, nomeDaOrigem(l.origem)].filter(Boolean).join(' · ')} · na etapa {haQuanto(l.naEtapaDesde, agora)}
            </p>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border-strong">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-5 px-4 py-4 sm:px-6">
          {alertas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {alertas.map((a) => (
                <SeloAlerta key={a.tipo} a={a} />
              ))}
            </div>
          )}

          {/* Ações rápidas: cada botão diz o que acontece por trás (feedback do Arthur, 31/10/2026). */}
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
            {l.conversa && (
              <Acao
                href={`/admin/atendimento?conversa=${l.conversa.id}`}
                Icon={MessageCircle}
                rotulo="Abrir a conversa"
                ajuda="Abre o WhatsApp com a Lia. Não envia nada."
                detalhe="Abre esta conversa na página Atendimento: histórico, resumo da Lia, modo (IA ou você) e o campo para responder. Abrir não manda mensagem nem muda o modo."
              />
            )}
            <Acao
              href={`/admin/captacao?lead=${l.id}`}
              Icon={FileText}
              rotulo="Ficha na Captação"
              ajuda="Abre a ficha completa do lead. Só abre."
              detalhe="Abre a ficha do lead na Captação: dados, etapa, notas, próximo contato, diagnóstico e proposta do ERP. Abrir não altera nada."
            />
            {ultimaReuniao ? (
              <Acao
                href={`/admin/reunioes/${ultimaReuniao.id}`}
                Icon={Video}
                rotulo="Abrir a sala"
                ajuda="Garante a sala da Daily (ou Meet). O link não vai sozinho."
                detalhe="Abre a sala da última reunião deste lead. Ao abrir, se a sala da Daily ainda não existe ou já venceu, cria uma nova; se a Daily não estiver configurada ou os minutos grátis do mês estiverem na trava, usa o Google Meet. Não manda o link ao cliente: copie o link do cliente na sala."
              />
            ) : (
              <Acao
                href="/admin/reunioes"
                Icon={Video}
                rotulo="Marcar reunião"
                ajuda="Vai para Reuniões; lá você cria. Não convida o cliente."
                detalhe="Abre a página Reuniões. Em Nova reunião você escolhe este lead e o horário (ou agora): a reunião nasce com sala própria na Daily (ou Google Meet no plano B). Não cria convite na agenda nem manda o link ao cliente: copie o link do cliente e mande você ou peça à Lia."
              />
            )}
            <a
              href={`/diagnostico/${l.publicToken}?previa=1`}
              target="_blank"
              rel="noreferrer"
              title="Abre a página de diagnóstico que o cliente recebe, em modo prévia: a sua visita não é contada, então o contador de visitas e o aviso de lead quente (que chega no seu WhatsApp) não disparam. O número entre parênteses são as visitas do cliente."
              aria-label="Diagnóstico. Abre a página de diagnóstico do cliente em modo prévia, sem contar a sua visita nem disparar o aviso de lead quente."
              className="flex min-h-11 flex-col justify-center gap-0.5 rounded-[14px] border border-border-strong px-3 py-2 text-[13px] font-semibold text-fg-secondary hover:text-fg"
            >
              <span className="flex items-center gap-2">
                <ExternalLink size={15} className="shrink-0" /> <span className="truncate">Diagnóstico{l.diagViews ? ` (${l.diagViews} visitas)` : ''}</span>
              </span>
              <span className="text-[11px] font-normal leading-snug text-fg-faded">Prévia: sua visita não conta nem gera aviso.</span>
            </a>
            <label
              title="Muda a etapa do lead no funil da Captação e a coluna aqui. A primeira passagem grava a data de contato e de resposta (base da taxa de resposta do placar nos Dashboards); voltar a etapa não apaga essas datas. Sair de Contatado encerra os e-mails de retorno automáticos da Lia. Perdido limpa o próximo contato (sai dos retornos vencidos) e conta como perdido no placar. Lead que estava na lista de um vendedor sai dela e outro entra no lugar. Nada é enviado ao cliente."
              className="flex min-h-11 flex-col justify-center gap-0.5 rounded-[14px] border border-border-strong px-3 py-1.5 text-[13px] text-fg-secondary"
            >
              <span className="flex items-center gap-2">
                Etapa
                <select
                  value={l.etapa}
                  disabled={pending}
                  onChange={(e) => mudarEtapa(e.target.value as LeadStatus)}
                  aria-label="Mudar etapa. Muda o funil e o placar da Captação; sair de Contatado encerra os e-mails de retorno da Lia; Perdido limpa o próximo contato. Nada vai ao cliente."
                  className="min-h-9 min-w-0 flex-1 bg-transparent font-semibold text-fg outline-none"
                >
                  {(['contatado', 'respondeu', 'reuniao', 'proposta', 'perdido'] as LeadStatus[]).map((s) => (
                    <option key={s} value={s} className="bg-[#12141A]">
                      {LEAD_STATUS_LABEL[s]}
                    </option>
                  ))}
                  {l.etapa === 'novo' && (
                    <option value="novo" className="bg-[#12141A]">
                      Novo
                    </option>
                  )}
                </select>
              </span>
              <span className="text-[11px] leading-snug text-fg-faded">Muda funil e placar. Nada vai ao cliente.</span>
            </label>
            <button
              onClick={() => setConfirmarVenda((v) => !v)}
              aria-expanded={confirmarVenda}
              title="Mostra o que será registrado antes de confirmar: o lead vira Fechado (com valor, mensalidade e pacote) e o projeto nasce no Pós-venda com serviços, rodadas e prazo. Não cria a cobrança do sinal e não avisa o cliente."
              aria-label="Fechou: registrar no Pós-venda. Antes de confirmar, mostra o que será criado: lead Fechado e projeto no Pós-venda. Não cria cobrança nem avisa o cliente."
              className="flex min-h-11 flex-col justify-center gap-0.5 rounded-[14px] bg-[#F2F3F5] px-3 py-2 text-left text-[13px] font-semibold text-[#08080A]"
            >
              <span className="flex items-center gap-1.5">
                Fechou → Pós-venda <ArrowRight size={15} />
              </span>
              <span className="text-[11px] font-normal leading-snug text-[#3A3D44]">Cria o projeto. Sem cobrança, sem aviso.</span>
            </button>
          </div>

          {confirmarVenda && (
            <div className="rounded-[16px] border border-[oklch(74%_.12_262/.4)] bg-[oklch(72%_.1_262/.08)] p-4 text-[13px] text-fg-secondary">
              <div className="mb-1.5 text-[14px] font-semibold text-fg">Registrar a venda no Pós-venda</div>
              {pacoteDaVenda ? (
                <>
                  <p>
                    <b className="text-fg">Pacote:</b> {pacoteDaVenda.join(' + ')}
                    {venda && venda.fora.length > 0 && <span className="text-fg-tertiary"> (fora do projeto, só fica aqui: {venda.fora.join(', ')})</span>}
                  </p>
                  <p>
                    <b className="text-fg">Valor único:</b> {numero(f.valorProposta) !== null ? formatMoeda(numero(f.valorProposta)!, moeda) : 'preço da tabela do pacote'}
                    {' · '}
                    <b className="text-fg">Mensalidade:</b> {numero(f.valorMensal) !== null ? formatMoeda(numero(f.valorMensal)!, moeda) : 'a da tabela'}
                  </p>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12.5px]">
                    <li>O lead vira Fechado, com valor, mensalidade, moeda e pacote (entra no placar como venda).</li>
                    <li>Nasce o projeto no Pós-venda com os serviços do pacote, rodadas de ajuste e suporte do guia, prazo do catálogo e entrega prevista em dias úteis.</li>
                    <li>
                      <b className="text-fg">Não</b> cria a cobrança do sinal (peça ao Téo), não manda nada ao cliente e não abre a pasta nem chama a Bia.
                    </li>
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={pending || !tabelaPronta}
                      onClick={registrarVenda}
                      className="h-11 rounded-full bg-[#F2F3F5] px-4 text-[13.5px] font-semibold text-[#08080A] disabled:opacity-50"
                    >
                      {pending ? 'Registrando' : 'Registrar venda e abrir o Pós-venda'}
                    </button>
                    <Link href="/admin/pos-venda" className="flex h-11 items-center rounded-full border border-border-strong px-4 text-[13px] font-semibold text-fg-secondary">
                      Preencher à mão
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p>Inclua no pacote (abaixo) um site, loja ou sistema do catálogo para registrar daqui sem digitar de novo.</p>
                  <Link href="/admin/pos-venda" className="mt-2 inline-flex h-11 items-center rounded-full border border-border-strong px-4 text-[13px] font-semibold text-fg-secondary">
                    Registrar à mão no Pós-venda
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Trilha */}
          <Secao titulo="Trilha da pré-venda" dica={tabelaPronta ? 'Toque para marcar; "auto" volta ao que os dados dizem.' : undefined}>
            <ol className="grid gap-1">
              {l.passos.map((p, i) => {
                const Icone = ICONE_DO_ESTADO[p.estado];
                return (
                  <li key={p.chave} className="flex items-center gap-2">
                    <button
                      disabled={pending || !tabelaPronta}
                      onClick={() => mudarPasso(p)}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[12px] px-2 text-left hover:bg-white/[0.03] disabled:cursor-default"
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
                          p.estado === 'feito'
                            ? 'border-success bg-success text-[#08080A]'
                            : p.estado === 'andamento'
                              ? 'border-[#81AAF7] text-[#81AAF7]'
                              : 'border-border-strong text-fg-faded'
                        }`}
                      >
                        <Icone size={14} strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13.5px] ${p.estado === 'pendente' ? 'text-fg-tertiary' : 'text-fg'}`}>
                          {i + 1}. {p.nome}
                        </span>
                        <span className="block text-[11.5px] text-fg-faded">
                          {p.estado === 'feito' ? 'Feito' : p.estado === 'andamento' ? 'Em andamento' : 'Pendente'}
                          {p.em ? ` · ${dataBR(p.em)}` : ''}
                          {p.manual ? ' · marcado à mão' : ' · automático'}
                        </span>
                      </span>
                    </button>
                    {p.manual && tabelaPronta && (
                      <button
                        disabled={pending}
                        onClick={() => salvar({ passo: { chave: p.chave, valor: null } })}
                        className="h-10 shrink-0 rounded-full border border-border-strong px-3 text-[11.5px] font-semibold text-fg-tertiary"
                        title="Voltar ao automático"
                      >
                        auto
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </Secao>

          {/* Próximo passo (redesenho do feedback de 31/10/2026): o quê, quem (escolha rápida) e até quando. */}
          <Secao titulo="Próximo passo: o que precisa acontecer agora para avançar">
            <p className="mb-2.5 text-[12.5px] leading-snug text-fg-tertiary">
              Uma ação só, com quem faz e até quando. Aparece no card do lead e avisa quando o prazo vence.
            </p>

            {/* Sugestão da reunião ainda não aceita */}
            {l.proximo?.origem === 'reuniao' && !l.proximo.aceito && (
              <div className="mb-3 rounded-[14px] border border-[oklch(74%_.12_262/.35)] bg-[oklch(72%_.1_262/.08)] px-3 py-2.5">
                <div className="text-[11.5px] font-semibold text-[#B1D2FF]">Sugerido pela reunião de {dataBR(l.proximo.reuniaoEm)}</div>
                <p className="mt-0.5 text-[13.5px] text-fg">{l.proximo.oQue}</p>
                <p className="text-[12px] text-fg-tertiary">
                  {[l.proximo.quem, l.proximo.prazo && `até ${dataBR(l.proximo.prazo)}`].filter(Boolean).join(' · ') || 'Sem responsável nem prazo'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    disabled={pending || !tabelaPronta}
                    onClick={() => aceitarSugestao(l.sugestoes[0], false)}
                    className="h-10 rounded-full bg-[#F2F3F5] px-4 text-[13px] font-semibold text-[#08080A] disabled:opacity-50"
                  >
                    Aceitar
                  </button>
                  <button
                    disabled={!tabelaPronta}
                    onClick={() => aceitarSugestao(l.sugestoes[0], true)}
                    className="h-10 rounded-full border border-border-strong px-4 text-[13px] font-semibold text-fg-secondary"
                  >
                    Editar antes
                  </button>
                </div>
              </div>
            )}

            {/* De onde veio o que está gravado */}
            {l.proximo?.aceito && (
              <p className="mb-2 text-[11.5px] text-fg-faded">
                {l.proximo.origem === 'reuniao' ? `Veio da reunião de ${dataBR(l.proximo.reuniaoEm)} (aceito)` : 'Escrito por você'}
              </p>
            )}

            <div className="grid gap-3">
              <Rotulado rotulo="O quê">
                <input
                  value={f.proximoPasso}
                  onChange={(e) => setF({ ...f, proximoPasso: e.target.value })}
                  placeholder="Ex.: mandar a proposta com o valor"
                  className={`${inputClass} w-full`}
                />
              </Rotulado>

              <div className="grid gap-1 text-[11.5px] text-fg-tertiary">
                Quem faz
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Quem faz o próximo passo">
                  {RESPONSAVEIS.map((r) => (
                    <Chip key={r} ativo={f.proximoResponsavel === r} onClick={() => setF({ ...f, proximoResponsavel: f.proximoResponsavel === r ? '' : r })}>
                      {r}
                    </Chip>
                  ))}
                  <Chip
                    ativo={!!f.proximoResponsavel && !(RESPONSAVEIS as readonly string[]).includes(f.proximoResponsavel)}
                    onClick={() => setF({ ...f, proximoResponsavel: (RESPONSAVEIS as readonly string[]).includes(f.proximoResponsavel) || !f.proximoResponsavel ? 'Outro' : '' })}
                  >
                    Outro
                  </Chip>
                </div>
                {!!f.proximoResponsavel && !(RESPONSAVEIS as readonly string[]).includes(f.proximoResponsavel) && (
                  <input
                    value={f.proximoResponsavel === 'Outro' ? '' : f.proximoResponsavel}
                    onChange={(e) => setF({ ...f, proximoResponsavel: e.target.value || 'Outro' })}
                    placeholder="Nome de quem faz"
                    className={`${inputClass} mt-1 w-full`}
                    autoFocus
                  />
                )}
              </div>

              <div className="grid gap-1 text-[11.5px] text-fg-tertiary">
                Até quando
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['Hoje', 0],
                      ['Amanhã', 1],
                      ['Em 3 dias', 3],
                    ] as const
                  ).map(([r, n]) => {
                    const d = somarDias(hojeISO(), n);
                    return (
                      <Chip key={r} ativo={f.proximoPrazo === d} onClick={() => setF({ ...f, proximoPrazo: f.proximoPrazo === d ? '' : d })}>
                        {r}
                      </Chip>
                    );
                  })}
                  <input
                    type="date"
                    value={f.proximoPrazo}
                    onChange={(e) => setF({ ...f, proximoPrazo: e.target.value })}
                    className={`${inputClass} min-h-10 w-[160px]`}
                    aria-label="Escolher a data do prazo"
                  />
                </div>
              </div>
            </div>

            {/* Os outros passos combinados na reunião, para usar com um toque */}
            {l.sugestoes.length > 1 && (
              <div className="mt-3">
                <div className="mb-1 text-[11.5px] text-fg-faded">Outros passos combinados na reunião de {dataBR(l.sugestoes[0].reuniaoEm)}</div>
                <ul className="grid gap-1">
                  {l.sugestoes.map((s, i) =>
                    s.oQue === f.proximoPasso ? null : (
                      <li key={i}>
                        <button
                          onClick={() => aceitarSugestao(s, true)}
                          className="flex min-h-10 w-full items-center gap-2 rounded-[12px] px-2 text-left text-[12.5px] text-fg-secondary hover:bg-white/[0.03]"
                        >
                          <Plus size={14} className="shrink-0 text-fg-tertiary" />
                          <span className="min-w-0">
                            {s.quem ? <b className="text-fg">{s.quem}: </b> : null}
                            {s.oQue}
                            {s.prazo ? ` (até ${dataBR(s.prazo)})` : ''}
                          </span>
                        </button>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </Secao>

          {/* Pendências do cliente */}
          <Secao titulo="Pendências do cliente" dica="O que falta ele mandar.">
            <ul className="grid gap-1">
              {pendencias.map((p, i) => (
                <li key={`${p.texto}-${i}`} className="flex items-center gap-2">
                  <button
                    disabled={pending || !tabelaPronta}
                    onClick={() => gravarPendencias(pendencias.map((x, j) => (j === i ? { ...x, feito: !x.feito } : x)))}
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-1.5 text-left hover:bg-white/[0.03]"
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border ${p.feito ? 'border-success bg-success text-[#08080A]' : 'border-border-strong'}`}>
                      {p.feito && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className={`text-[13.5px] ${p.feito ? 'text-fg-faded line-through' : 'text-fg-secondary'}`}>{p.texto}</span>
                  </button>
                  <button
                    disabled={pending || !tabelaPronta}
                    onClick={() => gravarPendencias(pendencias.filter((_, j) => j !== i))}
                    aria-label={`Remover ${p.texto}`}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-faded hover:text-error"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
              {pendencias.length === 0 && <li className="text-[13px] text-fg-faded">Nada pendente.</li>}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!novaPendencia.trim()) return;
                gravarPendencias([...pendencias, { texto: novaPendencia.trim(), feito: false }]);
                setNovaPendencia('');
              }}
            >
              <input value={novaPendencia} onChange={(e) => setNovaPendencia(e.target.value)} placeholder="Ex.: logo em alta, CNPJ" className={`${inputClass} min-w-0 flex-1`} />
              <button disabled={pending || !tabelaPronta} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-strong" aria-label="Adicionar pendência">
                <Plus size={17} />
              </button>
            </form>
          </Secao>

          {/* Links */}
          <Secao titulo="Links da pré-venda">
            <div className="grid gap-2">
              <CampoLink rotulo="Pasta no PC" Icon={FolderOpen} valor={f.pasta} {...campo('pasta')} texto />
              <CampoLink rotulo="Briefing" valor={f.briefingUrl} {...campo('briefingUrl')} />
              <CampoLink rotulo="Design System (Duda)" valor={f.designSystemUrl} {...campo('designSystemUrl')} />
              <CampoLink rotulo="Protótipo (Nina)" valor={f.prototipoUrl} {...campo('prototipoUrl')} />
              <CampoLink rotulo="Proposta (URL ou PDF)" valor={f.propostaUrl} {...campo('propostaUrl')} />
            </div>
          </Secao>

          {/* Pacote e valor do projeto (feedback de 31/10/2026): itens do catálogo, avulsos e referências do portfólio. */}
          <Secao titulo="Pacote e valor do projeto">
            <p className="mb-2.5 text-[12.5px] leading-snug text-fg-tertiary">
              Monte o que vai ser feito, digite o valor combinado e veja a diferença para o preço cheio. O Fechou → Pós-venda usa estes dados.
            </p>

            {!temItens && l.pacote && (
              <div className="mb-2 rounded-[14px] bg-white/[0.03] px-3 py-2.5 text-[13px]">
                <div className="text-fg-tertiary">
                  Pacote {l.pacote.origem === 'escolhido' ? 'escolhido na conversa' : 'sugerido pela Captação'}: {l.pacote.itens.join(' + ')}
                </div>
                <div className="mt-0.5 text-fg">
                  Preço do simulador <b>{formatMoeda(l.pacote.total, l.pacote.moeda)}</b>
                  {l.pacote.mensal > 0 && <> + {formatMoeda(l.pacote.mensal, l.pacote.moeda)}/mês</>}
                </div>
                {tabelaPronta && (
                  <button
                    disabled={pending}
                    onClick={() =>
                      gravarItens(
                        l.pacote!.itens
                          .map((n) => catalogo.find((c) => c.nome === n))
                          .filter((c): c is NonNullable<typeof c> => !!c)
                          .map((c) => ({ tipo: 'catalogo' as const, nome: c.nome, preco: c.preco, mensal: c.mensal }))
                      )
                    }
                    className="mt-2 h-10 rounded-full border border-border-strong px-3.5 text-[12.5px] font-semibold text-fg-secondary"
                  >
                    Usar este pacote como ponto de partida
                  </button>
                )}
              </div>
            )}

            {/* Itens montados */}
            {itens.length > 0 && (
              <ul className="mb-2 grid gap-1">
                {itens.map((it, i) => (
                  <li key={`${it.nome}-${i}`} className="flex min-h-10 items-center gap-2 rounded-[12px] bg-white/[0.03] pl-3">
                    <span className="min-w-0 flex-1 text-[13px]">
                      {it.tipo === 'portfolio' ? (
                        <span className="text-fg-secondary">
                          <span className="text-fg-faded">Referência: </span>igual ao da {it.nome}
                        </span>
                      ) : (
                        <>
                          <span className="text-fg">{it.nome}</span>
                          {it.tipo === 'avulso' && <span className="text-fg-faded"> (avulso)</span>}
                          <span className="block text-[12px] text-fg-tertiary">
                            {formatMoeda(it.preco, moeda)}
                            {it.mensal > 0 && ` + ${formatMoeda(it.mensal, moeda)}/mês`}
                          </span>
                        </>
                      )}
                    </span>
                    <button
                      disabled={pending || !tabelaPronta}
                      onClick={() => gravarItens(itens.filter((_, j) => j !== i))}
                      aria-label={`Tirar ${it.nome} do pacote`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-faded hover:text-error"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tabelaPronta && <IncluirNoPacote catalogo={catalogo} portfolio={portfolio} moeda={moeda} pending={pending} onIncluir={(it) => gravarItens([...itens, it])} />}

            {/* Valores: cheio × combinado × diferença */}
            <div className="mt-3 grid gap-2 rounded-[14px] border border-border p-3">
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px]">
                <span className="text-fg-tertiary">Preço cheio do catálogo{temItens ? ' (soma, sem desconto de combo)' : l.pacote ? ' (simulador)' : ''}</span>
                <b className="text-right tabular-nums text-fg">
                  {cheioUnico > 0 ? formatMoeda(cheioUnico, moeda) : '–'}
                  {cheioMensal > 0 && <span className="block text-[12px] font-normal text-fg-secondary">+ {formatMoeda(cheioMensal, moeda)}/mês</span>}
                </b>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                <Rotulado rotulo="Seu valor: único">
                  <input inputMode="decimal" {...campo('valorProposta')} placeholder={cheioUnico ? String(cheioUnico) : '0'} className={`${inputClass} w-full`} />
                </Rotulado>
                <Rotulado rotulo="Seu valor: mensalidade">
                  <input inputMode="decimal" {...campo('valorMensal')} placeholder={cheioMensal ? String(cheioMensal) : '0'} className={`${inputClass} w-full`} />
                </Rotulado>
              </div>
              <div className="grid gap-0.5 text-[13px]">
                <Diferenca rotulo="Diferença no valor único" d={descUnico} moeda={moeda} />
                <Diferenca rotulo="Diferença na mensalidade" d={descMensal} moeda={moeda} />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <Rotulado rotulo="Proposta enviada em">
                <input type="date" {...campo('propostaEnviadaEm')} className={`${inputClass} w-full`} />
              </Rotulado>
              <Rotulado rotulo="Prazo prometido">
                <input type="date" {...campo('prazoPrometido')} className={`${inputClass} w-full`} />
              </Rotulado>
            </div>
            {l.sinal && (
              <p className="mt-2 text-[13px] text-fg-secondary">
                Sinal de {formatMoeda(l.sinal.valor, 'BRL')}: {l.sinal.pagoEm ? `pago em ${dataBR(l.sinal.pagoEm)}` : 'aguardando pagamento'}
              </p>
            )}
          </Secao>

          <Secao titulo="Observações">
            <textarea {...campo('observacoes')} rows={3} className={`${inputClass} w-full resize-y`} placeholder="Anotações da pré-venda" />
          </Secao>

          <div className="sticky bottom-0 -mx-4 border-t border-border bg-[#12141A]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <button
              disabled={pending || !tabelaPronta}
              onClick={salvarCampos}
              className="flex h-[52px] w-full items-center justify-center rounded-full bg-[#F2F3F5] text-[15px] font-semibold text-[#08080A] disabled:opacity-50"
            >
              {pending ? 'Salvando a pré-venda' : 'Salvar próximo passo, links e valores'}
            </button>
          </div>

          {/* Resumo: o que já se sabe do cliente */}
          <Secao titulo="Resumo">
            <div className="grid gap-3 text-[13.5px] leading-relaxed text-fg-secondary">
              {l.conversa?.resumo && (
                <Bloco titulo="Conversa com a Lia">
                  {l.conversa.resumo}
                  {l.conversa.precisaDeVoce && <span className="ml-1 font-semibold text-[#ffb36b]">(precisa de você)</span>}
                </Bloco>
              )}
              {l.atualizacoes
                .slice()
                .reverse()
                .map((a) => (
                  <Bloco key={a.em} titulo={`Reunião registrada em ${dataBR(a.em)}`}>
                    {a.resumo && <p>{a.resumo}</p>}
                    {a.escopo && (
                      <p className="mt-1">
                        <b className="text-fg">Escopo:</b> {a.escopo}
                      </p>
                    )}
                    {a.orcamento && (
                      <p className="mt-1">
                        <b className="text-fg">Orçamento citado:</b> {a.orcamento}
                      </p>
                    )}
                    {a.prazo && (
                      <p className="mt-1">
                        <b className="text-fg">Prazo:</b> {a.prazo}
                      </p>
                    )}
                    {a.decisoes.length > 0 && (
                      <ul className="mt-1 list-disc pl-5">
                        {a.decisoes.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    )}
                    {a.proximosPassos.length > 0 && (
                      <ul className="mt-1 grid gap-0.5">
                        {a.proximosPassos.map((p, i) => (
                          <li key={i}>
                            <b className="text-fg">{p.quem ?? 'Alguém'}:</b> {p.oQue}
                            {p.quando ? ` (${p.quando})` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Bloco>
                ))}
              {l.reunioes.length > 0 && (
                <Bloco titulo="Reuniões na agenda">
                  <ul className="grid gap-1">
                    {l.reunioes.map((r) => (
                      <li key={r.id}>
                        <Link href={`/admin/reunioes/${r.id}`} className="font-semibold text-[#91B7FE]">
                          {horaBR(r.inicio)}
                        </Link>{' '}
                        · {r.status}
                        {r.resumo ? ` · ${r.resumo}` : ''}
                      </li>
                    ))}
                  </ul>
                </Bloco>
              )}
              {Object.keys(l.briefing).length > 0 && (
                <Bloco titulo="Briefing">
                  {Object.entries(l.briefing).map(([k, v]) => (
                    <p key={k}>
                      <b className="text-fg">{k.replace(/_/g, ' ')}:</b> {v}
                    </p>
                  ))}
                </Bloco>
              )}
              {l.descoberta.length > 0 && (
                <Bloco titulo="Descoberta">
                  {l.descoberta.map((d) => (
                    <p key={d}>{d}</p>
                  ))}
                </Bloco>
              )}
              {l.pesquisa && (l.pesquisa.resumo || l.pesquisa.itens.length > 0) && (
                <Bloco titulo="Pesquisa da empresa">
                  {l.pesquisa.resumo && <p>{l.pesquisa.resumo}</p>}
                  {l.pesquisa.itens.slice(0, 8).map((i) => (
                    <p key={i.campo} className="mt-0.5">
                      <b className="text-fg">{i.campo}:</b> {i.valor}
                    </p>
                  ))}
                </Bloco>
              )}
              {l.notas && (
                <Bloco titulo="Notas">
                  <p className="whitespace-pre-wrap">{l.notas}</p>
                </Bloco>
              )}
            </div>
          </Secao>
        </div>
      </aside>
    </div>
  );
}

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[.2em] text-[#81AAF7]">{titulo}</h3>
        {dica && <span className="text-[11.5px] text-fg-faded">{dica}</span>}
      </div>
      {children}
    </section>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-border bg-white/[0.02] px-3.5 py-3">
      <div className="mb-1 text-[11.5px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{titulo}</div>
      {children}
    </div>
  );
}

function Rotulado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-[11.5px] text-fg-tertiary">
      {rotulo}
      {children}
    </label>
  );
}

/** Botão de ação com o que acontece por trás: linha curta visível (celular e computador), tooltip e aria-label com o detalhe. */
function Acao({ href, Icon, rotulo, ajuda, detalhe }: { href: string; Icon: typeof Video; rotulo: string; ajuda: string; detalhe: string }) {
  return (
    <Link
      href={href}
      title={detalhe}
      aria-label={`${rotulo}. ${detalhe}`}
      className="flex min-h-11 flex-col justify-center gap-0.5 rounded-[14px] border border-border-strong px-3 py-2 text-[13px] font-semibold text-fg-secondary hover:text-fg"
    >
      <span className="flex items-center gap-2">
        <Icon size={15} className="shrink-0" /> <span className="truncate">{rotulo}</span>
      </span>
      <span className="text-[11px] font-normal leading-snug text-fg-faded">{ajuda}</span>
    </Link>
  );
}

function CampoLink({
  rotulo,
  valor,
  Icon = ExternalLink,
  texto,
  ...input
}: {
  rotulo: string;
  valor: string;
  Icon?: typeof Video;
  texto?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const href = !texto && valor.trim() ? (/^https?:\/\//i.test(valor.trim()) ? valor.trim() : `https://${valor.trim()}`) : null;
  return (
    <label className="grid gap-1 text-[11.5px] text-fg-tertiary">
      <span className="flex items-center gap-1.5">
        {rotulo}
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#91B7FE]" onClick={(e) => e.stopPropagation()}>
            abrir <Icon size={12} />
          </a>
        )}
      </span>
      <input {...input} placeholder={texto ? '1 - Clientes\\Nome - Empresa' : 'https://'} className={`${inputClass} w-full min-w-0`} />
    </label>
  );
}

/* ------------------------------------------------------------ próximo passo e pacote: peças */

/** "Arthur" da reunião vira "Eu (Arthur)"; o nome do lead vira "Cliente"; o resto fica como "Outro". */
function quemNormalizado(quem: string | null, nomeDoLead: string): string {
  const q = quem?.trim() ?? '';
  if (!q) return '';
  const baixo = q.toLowerCase();
  if (baixo === 'arthur' || baixo === 'eu' || baixo.startsWith('eu (')) return 'Eu (Arthur)';
  if (baixo === 'cliente' || baixo === nomeDoLead.trim().toLowerCase().split(' ')[0]) return 'Cliente';
  if (/\b(duda|nina)\b/.test(baixo)) return 'Duda/Nina';
  return RESPONSAVEIS.find((r) => r.toLowerCase() === baixo) ?? q;
}

/** AAAA-MM-DD + n dias (meio-dia, sem pular de dia no horário de verão). */
function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={`h-10 rounded-full px-3.5 text-[13px] font-semibold ${ativo ? 'bg-[oklch(72%_.1_262/.22)] text-[#B1D2FF] ring-1 ring-[#81AAF7]/60' : 'border border-border-strong text-fg-secondary'}`}
    >
      {children}
    </button>
  );
}

function Diferenca({ rotulo, d, moeda }: { rotulo: string; d: { valor: number; pct: number } | null; moeda: 'BRL' | 'USD' }) {
  if (!d) return null;
  const pct = `${Math.abs(d.pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <span className="text-fg-tertiary">{rotulo}</span>
      <b className={`tabular-nums ${d.valor > 0 ? 'text-[#ffb36b]' : d.valor < 0 ? 'text-success' : 'text-fg-secondary'}`}>
        {d.valor > 0
          ? `desconto de ${formatMoeda(d.valor, moeda)} (${pct})`
          : d.valor < 0
            ? `acima do cheio em ${formatMoeda(-d.valor, moeda)} (${pct})`
            : 'igual ao preço cheio'}
      </b>
    </div>
  );
}

/** Incluir no pacote: item do catálogo, item avulso (módulo etc., com valor digitado) ou referência do portfólio. */
function IncluirNoPacote({
  catalogo,
  portfolio,
  moeda,
  pending,
  onIncluir,
}: {
  catalogo: PainelDaPreVenda['catalogo']['BRL'];
  portfolio: PainelDaPreVenda['portfolio'];
  moeda: 'BRL' | 'USD';
  pending: boolean;
  onIncluir: (it: ItemDoPacote) => void;
}) {
  const [modo, setModo] = useState<'catalogo' | 'avulso' | 'portfolio'>('catalogo');
  const [escolhido, setEscolhido] = useState('');
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const categorias = [...new Set(catalogo.map((c) => c.categoria))];

  function incluir() {
    if (modo === 'catalogo') {
      const c = catalogo.find((x) => x.nome === escolhido);
      if (!c) return;
      onIncluir({ tipo: 'catalogo', nome: c.nome, preco: c.preco, mensal: c.mensal });
      setEscolhido('');
    } else if (modo === 'portfolio') {
      const p = portfolio.find((x) => x.slug === escolhido);
      if (!p) return;
      onIncluir({ tipo: 'portfolio', slug: p.slug, nome: p.nome });
      setEscolhido('');
    } else {
      const v = Number(valor.replace(/\./g, '').replace(',', '.'));
      if (!nome.trim() || !Number.isFinite(v) || v < 0) return;
      onIncluir({ tipo: 'avulso', nome: nome.trim(), preco: v, mensal: 0 });
      setNome('');
      setValor('');
    }
  }

  return (
    <div className="grid gap-2 rounded-[14px] border border-dashed border-border-strong p-2.5">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="O que incluir">
        <Chip ativo={modo === 'catalogo'} onClick={() => {
            setModo('catalogo');
            setEscolhido('');
          }}>
          Do catálogo
        </Chip>
        <Chip ativo={modo === 'avulso'} onClick={() => setModo('avulso')}>
          Item avulso
        </Chip>
        <Chip ativo={modo === 'portfolio'} onClick={() => {
            setModo('portfolio');
            setEscolhido('');
          }}>
          Referência do portfólio
        </Chip>
      </div>
      <div className="flex flex-wrap gap-2">
        {modo === 'catalogo' && (
          <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className={`${inputClass} min-h-11 min-w-0 flex-1 basis-[200px]`} aria-label="Produto ou serviço do catálogo">
            <option value="">Escolha um produto ou serviço</option>
            {categorias.map((cat) => (
              <optgroup key={cat} label={cat}>
                {catalogo
                  .filter((c) => c.categoria === cat)
                  .map((c) => (
                    <option key={c.nome} value={c.nome}>
                      {c.nome}: {formatMoeda(c.preco, moeda)}
                      {c.mensal > 0 ? ` + ${formatMoeda(c.mensal, moeda)}/mês` : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        )}
        {modo === 'portfolio' && (
          <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className={`${inputClass} min-h-11 min-w-0 flex-1 basis-[200px]`} aria-label="Case do portfólio">
            <option value="">Igual ao de qual cliente?</option>
            {portfolio.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.nome} ({p.tipo})
              </option>
            ))}
          </select>
        )}
        {modo === 'avulso' && (
          <>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: módulo de agendamento" className={`${inputClass} min-w-0 flex-1 basis-[180px]`} aria-label="Nome do item avulso" />
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="Valor" className={`${inputClass} w-[110px]`} aria-label="Valor do item avulso" />
          </>
        )}
        <button
          type="button"
          disabled={pending || (modo === 'avulso' ? !nome.trim() || !valor.trim() : !escolhido)}
          onClick={incluir}
          className="flex h-11 items-center gap-1.5 rounded-full border border-border-strong px-4 text-[13px] font-semibold text-fg-secondary disabled:opacity-40"
        >
          <Plus size={16} /> Incluir
        </button>
      </div>
    </div>
  );
}
