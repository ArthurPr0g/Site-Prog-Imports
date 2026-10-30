'use client';

// Aba Atendimento: o placar de quem converte mais (Felipe × IA, em tempo real),
// as conversas da atendente de IA no WhatsApp, os pedidos de desconto extra
// esperando o "superior", o que a Lia aprendeu (para aprovar) e a configuração. Relê tudo a cada 10 s com a aba
// visível; o placar usa os leads do painel (relidos a cada minuto).

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeft, Bell, Bot, CalendarDays, Check, CheckCheck, Clock, Info, Mail, CheckCircle2, CircleAlert, FlaskConical, GraduationCap, Hand, MessageCircle, Search, Send, Settings, Sparkles, Trash2, Trophy, UserRound } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { LEAD_STATUS_LABEL, type Lead } from '@/lib/captacao';
import { TrilhaDaVenda, BarraDaEtapa } from './TrilhaDaVenda';
import type { KitDoVendedor } from '@/lib/data/leads';
import {
  MODELOS_DA_IA,
  placar,
  TIPO_DA_LICAO,
  type ConfigDoAtendente,
  type LicaoDaLia,
  type ConversaDoPainel,
  type MensagemDoPainel,
  type PainelDoAtendente,
  type Vendedor,
} from '@/lib/atendente/regras';
import {
  painelDoAtendenteAction,
  mensagensDaConversaAction,
  responderComoArthurAction,
  alternarModoAction,
  resolverChamadoAction,
  decidirDescontoAction,
  decidirLicaoAction,
  salvarConfigAtendenteAction,
  orientarLiaAction,
  enviarEmailDeTesteAction,
  excluirConversaDeTesteAction,
} from '@/app/actions/atendente';
import { inputClass, semCentavos } from './comum';
import { ResultadosDaLiaPainel, TestarALia } from './LiaResultadosETeste';
import { ResumoDaConversa } from './ResumoDaConversa';
import { AgendaEReunioes } from './AgendaEReunioes';
import { ModelosDaMeta } from './ModelosDaMeta';
import { CustoDaIa } from './CustoDaIa';
import { avisarVersaoNova, ERRO_DE_VERSAO_NOVA, Esqueleto } from '@/components/admin/VersaoNova';

const RELER_A_CADA = 10_000;

// Site atualizado com a aba aberta: a página antiga chama ações que o servidor novo não tem mais. Antes
// recarregava na hora (e a tela voltava para o topo no meio da leitura, 30/10/2026); agora só avisa
// ("Saiu uma versão nova · Atualizar", que volta para o mesmo lugar). Outras falhas mantêm o que está na tela.
async function seguro<T>(f: () => Promise<T>, aoFalhar?: (msg: string) => void): Promise<T | undefined> {
  try {
    return await f();
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    if (ERRO_DE_VERSAO_NOVA.test(msg)) {
      avisarVersaoNova();
      return undefined;
    }
    console.error('[atendimento]', e);
    aoFalhar?.('Não deu para falar com o servidor agora. Tente de novo em instantes.');
    return undefined;
  }
}
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
/** Gasto da IA em dólar e, com a cotação do dia, em reais. */
const gasto = (usd: number, cotacao: number | null) =>
  `US$ ${usd.toFixed(2).replace('.', ',')}${cotacao ? ` · R$ ${(usd * cotacao).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}`;
const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function Atendimento({
  kits,
  leads,
  valorDoLead,
  aoAbrirLead,
  cotacaoDolar,
  parte = 'inbox',
}: {
  /**
   * Qual parte mostrar (menu novo da Prog Soluções, 30/10/2026): 'inbox' = página Atendimento (só as conversas),
   * 'painel' = placar e resultados da Lia (Dashboards), 'lia' = situação, simulador, lições e configuração (página Lia).
   */
  parte?: 'inbox' | 'painel' | 'lia';
  /** Dólar do dia (mercado), para mostrar o gasto com IA em reais. null = sem cotação. */
  cotacaoDolar: number | null;
  kits: KitDoVendedor[];
  leads: Lead[];
  /** Implementação e mensalidade em reais (mesma estimativa do painel). */
  valorDoLead: (id: string) => { unico: number; mensal: number };
  aoAbrirLead: (id: string) => void;
}) {
  const [painel, setPainel] = useState<PainelDoAtendente | null>(null);
  const [lidoEm, setLidoEm] = useState<number | null>(null);
  // Link do e-mail de aviso: ?conversa=<id> abre a conversa (a aba só monta no navegador).
  const [aberta, setAberta] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('conversa')
  );
  const [filtro, setFiltro] = useState<'todas' | 'precisa' | 'comigo' | 'esperando' | 'novos'>('todas');
  const [busca, setBusca] = useState('');
  const [verTestes, setVerTestes] = useState(false);
  // A conversa aberta fica no endereço (?conversa=): atualizar a página volta para ela.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (aberta) u.searchParams.set('conversa', aberta);
    else u.searchParams.delete('conversa');
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href);
  }, [aberta]);

  const reler = useCallback(async () => {
    const p = await seguro(() => painelDoAtendenteAction());
    if (p === undefined) return; // falhou: fica com o que já está na tela
    setPainel(p);
    setLidoEm(Date.now());
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void reler();
    };
    tick();
    const t = window.setInterval(tick, RELER_A_CADA);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [reler]);

  // Placar: um vendedor por pessoa (links do mesmo nome somam) e a IA.
  const linhas = useMemo(() => {
    const porChave = new Map<string, Vendedor>();
    for (const k of kits) {
      const chave = k.kind === 'ia' ? 'ia' : k.sellerName.trim().toLowerCase();
      const v = porChave.get(chave) ?? { chave, nome: k.sellerName, ia: k.kind === 'ia', leadIds: [] };
      v.leadIds.push(...k.leadIds);
      porChave.set(chave, v);
    }
    // Lead de teste não conta no placar.
    return placar([...porChave.values()], leads.filter((l) => !l.teste), valorDoLead);
  }, [kits, leads, valorDoLead]);

  const todas = painel?.conversas ?? [];
  const termo = busca.trim().toLowerCase();
  const conversas = todas.filter((c) => {
    if (!verTestes && c.isTest && c.id !== aberta) return false;
    if (filtro === 'precisa' && !c.needsHuman) return false;
    if (filtro === 'comigo' && c.mode !== 'humano') return false;
    if (filtro === 'esperando' && !c.esperandoLia) return false;
    if (filtro === 'novos' && c.fonte !== 'whatsapp_direto') return false;
    if (termo && ![c.leadName, c.contactName, c.contactId, c.ultimaMensagem].some((x) => x?.toLowerCase().includes(termo))) return false;
    return true;
  });
  const aguardando = (painel?.pedidos ?? []).filter((p) => p.status === 'aguardando');
  const reais = todas.filter((c) => !c.isTest);
  const precisam = reais.filter((c) => c.needsHuman).length;
  const esperando = reais.filter((c) => c.esperandoLia).length;
  const novos = reais.filter((c) => c.fonte === 'whatsapp_direto').length;
  const testes = todas.filter((c) => c.isTest).length;
  const naoLidas = reais.reduce((n, c) => n + (c.unread || 0), 0);
  // "Hoje" pela hora da última leitura do painel (render puro, sem Date.now).
  const hojeISO = lidoEm ? new Date(lidoEm - 3 * 3600_000).toISOString().slice(0, 10) : '';
  const ativasHoje = reais.filter((c) => c.lastInboundAt && new Date(new Date(c.lastInboundAt).getTime() - 3 * 3600_000).toISOString().slice(0, 10) === hojeISO).length;

  // Dashboards: placar de quem converte e resultados da Lia (abrir uma conversa leva para o Atendimento).
  if (parte === 'painel')
    return (
      <div className="space-y-4">
        <Placar linhas={linhas} lidoEm={lidoEm} />
        <ResultadosDaLiaPainel cotacaoDolar={cotacaoDolar} aoAbrir={(id) => (window.location.href = `/admin/atendimento?conversa=${id}`)} />
      </div>
    );

  // Página da Lia: situação, simulador, lições e configuração.
  if (parte === 'lia')
    return (
      <div className="space-y-4">
        {painel ? (
          <Situacao painel={painel} cotacaoDolar={cotacaoDolar} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Esqueleto key={i} className="h-[86px]" />
            ))}
          </div>
        )}
        <TestarALia leads={leads} />
        {painel && <Aprendizados licoes={painel.licoes} aoMudar={reler} />}
        {painel && <Configuracao inicial={painel.config} aoSalvar={reler} />}
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Resumo do atendimento: cada número é um atalho de filtro. */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {(
          [
            ['Ativas hoje', ativasHoje, 'todas', 'text-accent'],
            ['Não lidas', naoLidas, 'todas', 'text-accent'],
            ['Precisam de você', precisam, 'precisa', 'text-error'],
            ['Esperando a Lia', esperando, 'esperando', 'text-warning'],
            ['Contatos novos', novos, 'novos', 'text-success'],
          ] as const
        ).map(([rotulo, n, f, cor]) => (
          <button
            key={rotulo}
            onClick={() => setFiltro(f)}
            className={`rounded-[16px] border bg-card px-3.5 py-3 text-left transition-transform hover:-translate-y-0.5 ${filtro === f && f !== 'todas' ? 'border-accent/60' : 'border-border'}`}
          >
            <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-fg-faded">{rotulo}</span>
            <span className={`block text-[24px] font-extrabold tabular-nums ${n ? cor : 'text-fg-tertiary'}`}>{painel ? n : '–'}</span>
          </button>
        ))}
      </section>

      {aguardando.length > 0 && (
        <section className="rounded-[18px] border border-accent/50 bg-accent/[.06] p-4 sm:p-5">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">
            Desconto extra esperando você (o &quot;superior&quot;)
          </div>
          <div className="space-y-2">
            {aguardando.map((p) => (
              <PedidoAguardando key={p.id} pedido={p} aoAbrir={() => setAberta(p.conversationId)} aoDecidir={reler} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[18px] border border-border bg-card p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <MessageCircle size={13} /> Conversas no WhatsApp
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold">
            <label className="flex min-w-[180px] items-center gap-1.5 rounded-full border border-border-strong px-3 py-1">
              <Search size={12} className="text-fg-faded" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome, número ou mensagem"
                className="w-full bg-transparent text-[12px] font-normal outline-none placeholder:text-fg-faded"
              />
            </label>
            {(
              [
                ['todas', 'Todas'],
                ['precisa', `Precisam de você${precisam ? ` (${precisam})` : ''}`],
                ['comigo', 'Com você'],
                ['esperando', `Esperando a Lia${esperando ? ` (${esperando})` : ''}`],
                ['novos', 'Contatos novos'],
              ] as const
            ).map(([k, t]) => (
              <button
                key={k}
                onClick={() => setFiltro(k)}
                className={`rounded-full px-3 py-1 ${filtro === k ? 'bg-accent text-page' : 'border border-border-strong text-fg-secondary'}`}
              >
                {t}
              </button>
            ))}
            {testes > 0 && (
              <button
                onClick={() => setVerTestes((v) => !v)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 ${verTestes ? 'bg-fg-faded/20 text-fg' : 'border border-border-strong text-fg-tertiary'}`}
                title="Conversas de teste ficam escondidas; mostre para ver ou excluir"
              >
                <FlaskConical size={12} /> {verTestes ? 'Esconder testes' : `Testes (${testes})`}
              </button>
            )}
          </div>
        </div>
        {!painel ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]" aria-busy="true" aria-label="Carregando conversas">
            <ul className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="rounded-[14px] border border-border p-3" style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="mb-2 flex justify-between gap-3">
                    <Esqueleto className="h-3.5 w-2/5" />
                    <Esqueleto className="h-3 w-16" />
                  </div>
                  <Esqueleto className="mb-2.5 h-3 w-4/5" />
                  <Esqueleto className="h-1.5 w-full" />
                </li>
              ))}
            </ul>
            <div className="hidden space-y-3 rounded-[14px] border border-border p-4 lg:block">
              <Esqueleto className="h-4 w-1/3" />
              <Esqueleto className="h-14 w-3/5" />
              <Esqueleto className="ml-auto h-10 w-1/2" />
              <Esqueleto className="h-16 w-2/3" />
            </div>
          </div>
        ) : conversas.length === 0 ? (
          <div className="p-3 text-[13px] text-fg-tertiary">
            {todas.length === 0
              ? 'Nenhuma conversa ainda. Elas aparecem aqui quando um lead chama a atendente no WhatsApp.'
              : 'Nenhuma conversa com esse filtro.'}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
            <ul className={`max-h-[560px] space-y-1 overflow-y-auto lg:max-h-[calc(100vh-300px)] lg:min-h-[480px] ${aberta ? 'hidden lg:block' : ''}`}>
              {conversas.map((c) => (
                <li key={c.id}>
                  <ItemDaConversa c={c} ativa={aberta === c.id} aoAbrir={() => setAberta(c.id)} cotacaoDolar={cotacaoDolar} />
                </li>
              ))}
            </ul>
            {aberta ? (
              <Conversa
                key={aberta}
                conversa={painel.conversas.find((c) => c.id === aberta) ?? null}
                id={aberta}
                versao={lidoEm}
                cotacaoDolar={cotacaoDolar}
                aoVoltar={() => setAberta(null)}
                aoMudar={reler}
                aoAbrirLead={aoAbrirLead}
              />
            ) : (
              <div className="hidden place-items-center rounded-[14px] border border-dashed border-border p-6 text-[13px] text-fg-tertiary lg:grid">
                Escolha uma conversa.
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
}

/* ------------------------------------------------------------ placar */

function Placar({ linhas, lidoEm }: { linhas: ReturnType<typeof placar>; lidoEm: number | null }) {
  if (linhas.length === 0) {
    return (
      <section className="rounded-[18px] border border-border bg-card p-4 text-[13px] text-fg-tertiary sm:p-5">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
          <Trophy size={13} /> Quem converte mais
        </div>
        Gere os links do Felipe e da IA na aba Vendedores para o placar começar.
      </section>
    );
  }
  const melhor = linhas[0];
  return (
    <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
          <Trophy size={13} /> Quem converte mais
        </div>
        <span className="text-[11.5px] text-fg-faded">
          ao vivo{lidoEm ? ` · lido às ${new Date(lidoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {linhas.map((l) => (
          <div
            key={l.chave}
            className={`rounded-[14px] border p-3.5 ${l === melhor && l.fechados > 0 ? 'border-success/60 bg-success/[.06]' : 'border-border bg-page/40'}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[15px] font-extrabold">
                {l.ia ? <Bot size={15} /> : <UserRound size={15} />} {l.nome}
                {l.ia && <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10.5px] text-accent">IA</span>}
              </div>
              {l === melhor && l.fechados > 0 && <Trophy size={16} className="text-success" />}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Numero rotulo="fechados" valor={String(l.fechados)} destaque />
              <Numero rotulo="conversão" valor={pct(l.taxaFechamento)} />
              <Numero rotulo="resposta" valor={pct(l.taxaResposta)} />
            </div>
            <Funil l={l} />
            <div className="mt-2 text-[12px] text-fg-tertiary">
              {l.valorFechado > 0
                ? `${semCentavos(l.valorFechado)} + ${semCentavos(l.mensalFechado)}/mês fechados pela tabela`
                : 'Nenhum fechamento ainda'}
              {` · ${l.emNegociacao} em negociação · ${l.perdidos} perdidos`}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11.5px] leading-snug text-fg-faded">
        Conversão = fechados ÷ contatados; resposta = responderam ÷ contatados. Cada um tem a sua lista de leads, então compare
        também quantos já foram contatados.
      </p>
    </section>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-[10px] bg-card px-2 py-2">
      <div className={`tabular-nums ${destaque ? 'text-[22px]' : 'text-[18px]'} font-extrabold`}>{valor}</div>
      <div className="text-[11px] font-bold text-fg-tertiary">{rotulo}</div>
    </div>
  );
}

function Funil({ l }: { l: ReturnType<typeof placar>[number] }) {
  const etapas = [
    ['Leads', l.leads],
    ['Contatados', l.contatados],
    ['Responderam', l.responderam],
    ['Reunião', l.reunioes],
    ['Proposta', l.propostas],
    ['Fechados', l.fechados],
  ] as const;
  const max = Math.max(1, l.leads);
  return (
    <div className="mt-3 space-y-1">
      {etapas.map(([nome, n]) => (
        <div key={nome} className="flex items-center gap-2 text-[11.5px]">
          <span className="w-[84px] shrink-0 text-fg-tertiary">{nome}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-fg-faded/12">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <span className="w-7 text-right font-bold tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ situação */

function Situacao({ painel, cotacaoDolar }: { painel: PainelDoAtendente; cotacaoDolar: number | null }) {
  const emReais = (usd: number) =>
    cotacaoDolar ? ` (R$ ${(usd * cotacaoDolar).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '';
  const i = painel.integracoes;
  const faltam = [
    !i.whatsapp && 'WhatsApp (WHATSAPP_*)',
    !i.ia && 'IA (ANTHROPIC_API_KEY)',
    !i.banco && 'banco (ATENDENTE_SUPABASE_KEY)',
    !i.relogio && 'relógio (ATENDENTE_TICK_SECRET)',
    !i.email && 'e-mail (SMTP_*)',
  ].filter(Boolean);
  const c = painel.config;
  return (
    <section className="grid gap-3 sm:grid-cols-4">
      <Cartao rotulo="Atendente" valor={c.active ? `${c.personaName} ligada` : 'Desligada'} ok={c.active} />
      <Cartao
        rotulo="Gasto com IA no mês"
        valor={`US$ ${painel.gastoDoMes.toFixed(2)}${emReais(painel.gastoDoMes)} de US$ ${c.monthlyBudgetUsd.toFixed(0)}${emReais(c.monthlyBudgetUsd)}`}
        ok={painel.gastoDoMes < c.monthlyBudgetUsd * 0.8}
      />
      <Cartao rotulo="Mensagens no mês (grátis até 1.000)" valor={painel.mensagensDoMes.toLocaleString('pt-BR')} ok={painel.mensagensDoMes < 900} />
      <Cartao rotulo="E-mails de 1º contato hoje" valor={`${painel.emailsHoje} de ${c.dailyEmailCap}`} ok />
      <AvisosNoWhatsapp avisos={painel.avisos} />
      <AgendaDoGoogle estado={painel.agenda} />
      <AgendaEReunioes />
      <ModelosDaMeta />
      <CustoDaIa />
      {i.email && (
        <EmailDeTeste
          padrao={[c.ownerEmail, 'arthur.matos@liberdademedicaedu.com.br', 'progimports01@gmail.com'].filter(Boolean).join(', ')}
          limite={c.dailyEmailCap}
        />
      )}
      {faltam.length > 0 && (
        <div className="flex items-start gap-2 rounded-[14px] border border-error/40 bg-error/[.06] px-3.5 py-2.5 text-[12.5px] sm:col-span-4">
          <CircleAlert size={15} className="mt-0.5 shrink-0 text-error" />
          <span>
            <b>Falta configurar na Vercel:</b> {faltam.join(', ')}. Passo a passo em docs/ATENDENTE-IA.md.
          </span>
        </div>
      )}
    </section>
  );
}

/** Manda para o Arthur o mesmo 1º e-mail que o próximo lead da Lia vai receber. */
function EmailDeTeste({ padrao, limite }: { padrao: string; limite: number }) {
  const [para, setPara] = useState(padrao);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-border bg-card px-3.5 py-2.5 text-[12.5px] sm:col-span-4">
      <Mail size={13} className="text-accent" />
      <b>E-mail de 1º contato</b>
      <span className="text-fg-tertiary">
        · {limite > 0 ? `até ${limite} por dia, dias úteis das 8h às 18h` : 'pausado (limite do dia em 0 na Configuração)'}
      </span>
      <span className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
        <input
          value={para}
          onChange={(e) => setPara(e.target.value)}
          placeholder="seus e-mails, separados por vírgula"
          className={`min-w-[220px] flex-1 sm:max-w-[420px] ${inputClass}`}
        />
        <button
          disabled={pending || !para.trim()}
          onClick={() =>
            start(async () => {
              const r = await seguro(() => enviarEmailDeTesteAction(para), (m) => toast({ ok: false, message: m }));
              if (r) toast(r);
            })
          }
          className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-extrabold text-page disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar teste (2 versões)'}
        </button>
      </span>
    </div>
  );
}

function AgendaDoGoogle({ estado }: { estado: PainelDoAtendente['agenda'] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] border border-border bg-card px-3.5 py-2.5 text-[12.5px] sm:col-span-4">
      <CalendarDays size={13} className="text-accent" />
      <b>Google Agenda</b>
      {estado === 'conectada' ? (
        <span className="text-fg-tertiary">
          · conectada: a Lia vê seus horários livres e marca a reunião com link do Meet.{' '}
          <a href="/api/google/conectar" className="font-bold text-accent">
            Reconectar
          </a>
        </span>
      ) : estado === 'desconectada' ? (
        <>
          <span className="text-fg-tertiary">· não conectada: a Lia só evita as reuniões que ela mesma marcou.</span>
          <a href="/api/google/conectar" className="rounded-full bg-accent px-3 py-1 text-[12px] font-extrabold text-page">
            Conectar minha agenda
          </a>
        </>
      ) : (
        <span className="text-fg-tertiary">
          · falta configurar GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel (passo a passo em docs/ATENDENTE-IA.md).
        </span>
      )}
    </div>
  );
}

const VIA: Record<string, string> = { texto: 'WhatsApp', modelo: 'WhatsApp (modelo)', email: 'e-mail', nenhum: 'não saiu' };

function AvisosNoWhatsapp({ avisos }: { avisos: PainelDoAtendente['avisos'] }) {
  const janela = avisos.janelaAberta;
  const modelo =
    avisos.modelo === 'APPROVED'
      ? 'modelo aprovado pela Meta: avisa a qualquer hora'
      : avisos.modelo === null
        ? 'modelo ainda não criado (o relógio cria quando o WhatsApp mandar a primeira mensagem)'
        : avisos.modelo.startsWith('ERRO')
          ? `a Meta recusou criar o modelo (${avisos.modelo.slice(6)})`
          : `modelo aguardando aprovação da Meta (${avisos.modelo})`;
  const fone = avisos.whatsappDoDono?.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') ?? 'sem número';
  return (
    <div className="rounded-[14px] border border-border bg-card px-3.5 py-2.5 text-[12.5px] sm:col-span-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Bell size={13} className="text-accent" />
        <b>Avisos no seu WhatsApp {fone}</b>
        <span className="text-fg-tertiary">
          · {janela ? 'janela aberta: sai como mensagem normal' : modelo}
        </span>
      </div>
      {!janela && avisos.modelo !== 'APPROVED' && (
        <div className="mt-1 text-[12px] text-fg-tertiary">
          Enquanto o modelo não é aprovado, mande um &quot;oi&quot; do seu WhatsApp para o número da Lia: isso abre 24 h de avisos.
        </div>
      )}
      {avisos.ultimos.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[12px] text-fg-secondary">
          {avisos.ultimos.slice(0, 4).map((a, i) => (
            <li key={i} className="truncate">
              {hora(a.criadoEm)} · {a.titulo} ·{' '}
              <span className={a.status === 'failed' ? 'text-error' : 'text-fg-faded'}>
                {VIA[a.via] ?? a.via}
                {a.status === 'failed' ? `: ${a.erro ?? 'falhou'}` : a.status === 'read' ? ', lido' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Cartao({ rotulo, valor, ok }: { rotulo: string; valor: string; ok: boolean }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-3.5 py-2.5">
      <div className="text-[11px] font-bold text-fg-tertiary">{rotulo}</div>
      <div className={`text-[14px] font-extrabold ${ok ? '' : 'text-error'}`}>{valor}</div>
    </div>
  );
}

/* ------------------------------------------------------------ desconto */

function PedidoAguardando({
  pedido,
  aoAbrir,
  aoDecidir,
}: {
  pedido: PainelDoAtendente['pedidos'][number];
  aoAbrir: () => void;
  aoDecidir: () => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const falta = Math.max(0, new Date(pedido.releaseAt).getTime() - agora);
  const decidir = (d: 'aprovado' | 'negado') =>
    start(async () => {
      const r = await seguro(() => decidirDescontoAction(pedido.id, d), (m) => toast({ ok: false, message: m }));
      if (r) toast(r);
      aoDecidir();
    });
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] bg-card px-3 py-2.5 text-[13px]">
      <button onClick={aoAbrir} className="font-extrabold hover:text-accent">
        {pedido.leadName ?? 'Contato'}: {pedido.percent}% extra
      </button>
      <span className="flex-1 text-fg-tertiary">{pedido.reason}</span>
      <span className="tabular-nums text-[12px] font-bold text-accent">
        {falta > 0 ? `libera sozinha em ${Math.floor(falta / 60000)}:${String(Math.floor((falta % 60000) / 1000)).padStart(2, '0')}` : 'liberando…'}
      </span>
      <button
        disabled={pending}
        onClick={() => decidir('aprovado')}
        className="rounded-control bg-success px-3 py-1.5 text-[12.5px] font-extrabold text-page disabled:opacity-50"
      >
        Liberar agora
      </button>
      <button
        disabled={pending}
        onClick={() => decidir('negado')}
        className="rounded-control border border-error/60 px-3 py-1.5 text-[12.5px] font-extrabold text-error disabled:opacity-50"
      >
        Negar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ aprendizados */

function Aprendizados({ licoes, aoMudar }: { licoes: LicaoDaLia[]; aoMudar: () => void }) {
  const sugeridas = licoes.filter((l) => l.status === 'sugerido');
  const ativas = licoes.filter((l) => l.status === 'ativo');
  return (
    <details open={sugeridas.length > 0} className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
        <GraduationCap size={13} /> O que a Lia aprendeu
        {sugeridas.length > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] normal-case tracking-normal text-page">
            {sugeridas.length} para aprovar
          </span>
        )}
      </summary>
      <p className="mt-2 text-[12.5px] text-fg-tertiary">
        A cada conversa encerrada, a Lia anota dores novas, objeções e o que funcionou. Só o que você aprovar entra no jeito dela de atender.
      </p>
      {licoes.length === 0 && (
        <div className="mt-3 text-[13px] text-fg-tertiary">Nada ainda: as lições aparecem depois das primeiras conversas encerradas.</div>
      )}
      {sugeridas.length > 0 && (
        <div className="mt-3 space-y-2">
          {sugeridas.map((l) => (
            <Licao key={l.id} licao={l} aoMudar={aoMudar} />
          ))}
        </div>
      )}
      {ativas.length > 0 && (
        <>
          <div className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Em uso ({ativas.length})</div>
          <div className="space-y-2">
            {ativas.map((l) => (
              <Licao key={l.id} licao={l} aoMudar={aoMudar} />
            ))}
          </div>
        </>
      )}
    </details>
  );
}

function Licao({ licao, aoMudar }: { licao: LicaoDaLia; aoMudar: () => void }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [texto, setTexto] = useState(licao.texto);
  const sugerida = licao.status === 'sugerido';
  const decidir = (status: 'ativo' | 'descartado') =>
    start(async () => {
      const r = await seguro(
        () => decidirLicaoAction(licao.id, status, status === 'ativo' && texto !== licao.texto ? texto : undefined),
        (m) => toast({ ok: false, message: m })
      );
      if (r) toast(r);
      aoMudar();
    });
  return (
    <div className="rounded-[12px] border border-border px-3 py-2.5 text-[13px]">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
        <span className="rounded-full bg-accent/12 px-2 py-0.5 text-accent">{TIPO_DA_LICAO[licao.tipo]}</span>
        {licao.ramo && <span className="rounded-full border border-border-strong px-2 py-0.5 text-fg-secondary">{licao.ramo}</span>}
        {licao.vezes > 1 && <span className="text-fg-tertiary">apareceu em {licao.vezes} conversas</span>}
      </div>
      {sugerida ? (
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={400} className={`${inputClass} w-full resize-y`} />
      ) : (
        <div>{licao.texto}</div>
      )}
      {licao.exemplo && <div className="mt-1 text-[12px] italic text-fg-tertiary">&ldquo;{licao.exemplo}&rdquo;</div>}
      <div className="mt-2 flex gap-2">
        {sugerida && (
          <button
            disabled={pending}
            onClick={() => decidir('ativo')}
            className="rounded-control bg-success px-3 py-1.5 text-[12.5px] font-extrabold text-page disabled:opacity-50"
          >
            Aprovar
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => decidir('descartado')}
          className="rounded-control border border-error/60 px-3 py-1.5 text-[12.5px] font-extrabold text-error disabled:opacity-50"
        >
          {sugerida ? 'Descartar' : 'Desativar'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ conversas */

function ItemDaConversa({
  c,
  ativa,
  aoAbrir,
  cotacaoDolar,
}: {
  c: ConversaDoPainel;
  ativa: boolean;
  aoAbrir: () => void;
  cotacaoDolar: number | null;
}) {
  return (
    <button
      onClick={aoAbrir}
      className={`w-full rounded-[12px] px-3 py-2.5 text-left transition-colors ${ativa ? 'bg-accent/10' : 'hover:bg-page/60'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13.5px] font-extrabold">{c.leadName ?? c.contactName ?? `+${c.contactId}`}</span>
        <span className="shrink-0 text-[11px] text-fg-faded">{hora(c.lastMessageAt)}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        {c.needsHuman && <CircleAlert size={12} className="shrink-0 text-error" />}
        {c.mode === 'humano' ? <Hand size={12} className="shrink-0 text-accent" /> : <Bot size={12} className="shrink-0 text-fg-faded" />}
        <span className="truncate text-[12px] text-fg-tertiary">{c.ultimaMensagem ?? ''}</span>
        {c.unread > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 text-[10.5px] font-extrabold text-page">{c.unread}</span>
        )}
      </div>
      <BarraDaEtapa status={c.leadStatus} />
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-fg-faded">
        <span className="tabular-nums" title="Quanto a IA já gastou nesta conversa">
          IA gastou {gasto(c.gastoUsd, cotacaoDolar)}
        </span>
        <span className="flex items-center gap-1">
          {c.esperandoLia && <span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-bold text-warning">esperando a Lia</span>}
          {c.fonte === 'whatsapp_direto' && <span className="rounded-full bg-success/15 px-1.5 py-0.5 font-bold text-success">novo</span>}
          {c.isTest && (
            <span className="flex items-center gap-1 rounded-full bg-fg-faded/12 px-1.5 py-0.5 font-bold">
              <FlaskConical size={10} /> teste
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

function Conversa({
  conversa,
  id,
  versao,
  cotacaoDolar,
  aoVoltar,
  aoMudar,
  aoAbrirLead,
}: {
  conversa: ConversaDoPainel | null;
  id: string;
  /** Muda a cada releitura do painel: relê as mensagens junto. */
  versao: number | null;
  cotacaoDolar: number | null;
  aoVoltar: () => void;
  aoMudar: () => void;
  aoAbrirLead: (id: string) => void;
}) {
  const [mensagens, setMensagens] = useState<MensagemDoPainel[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [texto, setTexto] = useState('');
  // Responder como Arthur (a IA para) ou orientar a Lia (ela responde seguindo a instrução).
  const [modoDoTexto, setModoDoTexto] = useState<'arthur' | 'lia'>('arthur');
  const [excluindo, setExcluindo] = useState(false);
  // Dados do cliente (trilha da venda e resumo) ficam num painel que abre ao tocar no nome, como no WhatsApp.
  const [info, setInfo] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    void seguro(() => mensagensDaConversaAction(id)).then((m) => {
      if (!vivo) return;
      if (m) {
        setMensagens(m);
        setFalhou(false);
      } else setFalhou(true); // sem mensagens ainda na tela: mostra "Tentar de novo" em vez de "Carregando…" para sempre
    });
    return () => {
      vivo = false;
    };
  }, [id, versao, tentativa]);
  // Mensagem nova: rola só a caixa da conversa até o fim (scrollIntoView rolava
  // a página inteira e brigava com a rolagem de quem estava lendo).
  useEffect(() => {
    const caixa = fim.current?.parentElement;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [mensagens?.length]);

  // "Agora" = hora da última leitura do painel (a cada 10 s).
  const janelaAberta = !!conversa?.lastInboundAt && !!versao && versao - new Date(conversa.lastInboundAt).getTime() < 24 * 3600_000;

  const enviar = () =>
    start(async () => {
      const falhou = (m: string) => toast({ ok: false, message: m });
      const r = await seguro(
        () => (modoDoTexto === 'lia' && conversa?.mode === 'ia' ? orientarLiaAction(id, texto) : responderComoArthurAction(id, texto)),
        falhou
      );
      if (!r) return;
      toast(r);
      if (r.ok) {
        setTexto('');
        const m = await seguro(() => mensagensDaConversaAction(id));
        if (m) setMensagens(m);
        aoMudar();
      }
    });
  const acao = (f: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await seguro(f, (m) => toast({ ok: false, message: m }));
      if (r) toast(r);
      aoMudar();
    });

  const nome = conversa?.leadName ?? conversa?.contactName ?? (conversa ? `+${conversa.contactId}` : '…');
  const agora = versao ?? 0;

  return (
    // Tela de conversa igual ao WhatsApp (pedido do Arthur, 30/10/2026): modo escuro do WhatsApp Web,
    // balões com rabinho, hora e tiques dentro do balão, separador de dia e caixa de texto com Enter.
    <div className="flex h-[78vh] min-h-[520px] flex-col overflow-hidden rounded-[14px] border border-[#222d34] bg-[#0b141a] lg:h-[calc(100vh-300px)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[#202c33] px-3 py-2.5">
        <button onClick={aoVoltar} aria-label="Voltar às conversas" className="text-[#aebac1] lg:hidden">
          <ArrowLeft size={22} />
        </button>
        <button onClick={() => setInfo((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Dados do cliente">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#6a7175] text-[15px] font-bold text-[#e9edef]">
            {iniciais(nome)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] text-[#e9edef]">{nome}</span>
            <span className="block truncate text-[13px] text-[#8696a0]">
              {conversa ? `+${conversa.contactId}` : ''}
              {conversa?.mode === 'humano' ? ' · com você' : ' · a Lia responde'}
              {conversa && !janelaAberta ? ' · janela de 24 h fechada' : ''}
              {conversa ? ` · IA ${gasto(conversa.gastoUsd, cotacaoDolar)}` : ''}
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setInfo((v) => !v)}
            aria-label="Dados do cliente"
            className={`grid h-8 w-8 place-items-center rounded-full ${info ? 'bg-[#374248] text-[#e9edef]' : 'text-[#aebac1] hover:bg-[#374248]'}`}
          >
            <Info size={18} />
          </button>
          {conversa?.leadId && (
            <button onClick={() => aoAbrirLead(conversa.leadId!)} className="rounded-full border border-[#8696a0]/40 px-2.5 py-1 text-[12px] font-medium text-[#d1d7db] hover:bg-[#374248]">
              Ficha do lead
            </button>
          )}
          {conversa?.isTest && (
            <button
              disabled={pending}
              onClick={() => {
                if (!excluindo) return setExcluindo(true);
                start(async () => {
                  const r = await seguro(() => excluirConversaDeTesteAction(id), (m) => toast({ ok: false, message: m }));
                  if (!r) return;
                  toast(r);
                  if (r.ok) {
                    aoVoltar();
                    aoMudar();
                  }
                });
              }}
              onBlur={() => setExcluindo(false)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${excluindo ? 'bg-[#f15c6d] text-[#111b21]' : 'border border-[#f15c6d]/50 text-[#f15c6d]'}`}
              title="Exclui esta conversa de teste e as mensagens dela"
            >
              <Trash2 size={13} /> {excluindo ? 'Confirmar exclusão' : 'Excluir teste'}
            </button>
          )}
          {conversa?.needsHuman && (
            <button
              disabled={pending}
              onClick={() => acao(() => resolverChamadoAction(id))}
              className="flex items-center gap-1 rounded-full border border-[#00a884]/60 px-2.5 py-1 text-[12px] font-medium text-[#00a884]"
            >
              <CheckCircle2 size={13} /> Resolvido
            </button>
          )}
          {conversa && (
            <button
              disabled={pending}
              onClick={() => acao(() => alternarModoAction(id, conversa.mode === 'ia' ? 'humano' : 'ia'))}
              className="flex items-center gap-1 rounded-full bg-[#00a884] px-3 py-1 text-[12px] font-bold text-[#111b21] disabled:opacity-50"
            >
              {conversa.mode === 'ia' ? (
                <>
                  <Hand size={13} /> Assumir
                </>
              ) : (
                <>
                  <Bot size={13} /> Devolver para a Lia
                </>
              )}
            </button>
          )}
        </div>
      </div>
      {info && conversa && (
        <div className="max-h-[45%] overflow-y-auto border-b border-[#222d34] bg-[#111b21] pb-2">
          <TrilhaDaVenda conversa={conversa} />
          <ResumoDaConversa resumo={conversa.summary} descoberta={conversa.descoberta} />
        </div>
      )}
      <div className="fundo-whatsapp flex-1 overflow-y-auto px-[4%] py-3">
        {conversa?.needsHuman && conversa.needsHumanReason && (
          <div className="mx-auto mb-3 w-fit max-w-[90%] rounded-[7.5px] bg-[#182229] px-3 py-1.5 text-center text-[12.5px] text-[#ffd279]">
            ⚠️ Precisa de você: {conversa.needsHumanReason}
          </div>
        )}
        {!mensagens && falhou ? (
          <div className="grid place-items-center gap-2 py-10 text-center text-[13px] text-[#8696a0]">
            <span>Não carregou as mensagens desta conversa.</span>
            <button
              onClick={() => {
                setFalhou(false);
                setTentativa((t) => t + 1);
              }}
              className="rounded-full bg-[#00a884] px-3 py-1.5 text-[12.5px] font-bold text-[#111b21]"
            >
              Tentar de novo
            </button>
          </div>
        ) : !mensagens ? (
          <div className="space-y-2.5" aria-busy="true" aria-label="Carregando mensagens">
            <Esqueleto className="h-12 w-3/5" />
            <Esqueleto className="ml-auto h-9 w-2/5" />
            <Esqueleto className="h-16 w-2/3" />
            <Esqueleto className="ml-auto h-10 w-1/2" />
          </div>
        ) : (
          mensagens.map((m, i) => {
            const antes = mensagens[i - 1];
            const dia = diaDaMensagem(m.createdAt, agora);
            const novoDia = !antes || diaDaMensagem(antes.createdAt, agora) !== dia;
            const separador = novoDia && (
              <div className="sticky top-0 z-[1] my-3 flex justify-center">
                <span className="rounded-[7.5px] bg-[#182229] px-3 py-[5px] text-[12.5px] uppercase text-[#8696a0] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">{dia}</span>
              </div>
            );
            if (m.author === 'sistema')
              return (
                <div key={m.id}>
                  {separador}
                  <div className="my-2 flex justify-center">
                    <span className="max-w-[90%] rounded-[7.5px] bg-[#182229] px-3 py-[5px] text-center text-[12.5px] text-[#8696a0]">
                      {m.body} · {hora(m.createdAt)}
                    </span>
                  </div>
                </div>
              );
            const saiu = m.direction === 'out';
            // Primeira de uma sequência (mesmo lado e autor): leva o rabinho e, se saiu, o nome de quem mandou.
            const primeira = novoDia || !antes || antes.direction !== m.direction || antes.author !== m.author;
            return (
              <div key={m.id}>
                {separador}
                <div className={`flex ${saiu ? 'justify-end' : 'justify-start'} ${primeira ? 'mt-3' : 'mt-[2px]'}`}>
                  <div
                    className={`relative max-w-[88%] rounded-[7.5px] px-[9px] pb-[8px] pt-[6px] text-[14.2px] leading-[19px] text-[#e9edef] shadow-[0_1px_0.5px_rgba(11,20,26,.13)] sm:max-w-[65%] ${
                      saiu ? 'bg-[#005c4b]' : 'bg-[#202c33]'
                    } ${primeira ? (saiu ? 'rounded-tr-none' : 'rounded-tl-none') : ''}`}
                  >
                    {primeira && (
                      <svg
                        viewBox="0 0 8 13"
                        width="8"
                        height="13"
                        aria-hidden
                        className={`absolute top-0 ${saiu ? '-right-[8px] text-[#005c4b]' : '-left-[8px] -scale-x-100 text-[#202c33]'}`}
                      >
                        <path fill="currentColor" d="M0 0h8C6 2.5 3.5 6.5 0 13z" />
                      </svg>
                    )}
                    {primeira && saiu && (
                      <span className={`block text-[12.8px] font-medium ${m.author === 'arthur' ? 'text-[#ffd279]' : 'text-[#53bdeb]'}`}>
                        {m.author === 'arthur' ? 'Você' : 'Lia (IA)'}
                      </span>
                    )}
                    <span className="whitespace-pre-wrap break-words">
                      <TextoDoWhatsapp texto={m.body} />
                    </span>
                    {/* Espaço para a hora e os tiques não ficarem por cima do texto. */}
                    <span className={`inline-block ${saiu ? 'w-[72px]' : 'w-[50px]'}`} />
                    <span className="absolute bottom-[4px] right-[7px] flex items-center gap-[3px] text-[11px] leading-none text-[#ffffff99]">
                      {hora(m.createdAt)}
                      {saiu && <Tique status={m.status} />}
                    </span>
                  </div>
                </div>
                {m.status === 'failed' && (
                  <div className="mt-0.5 text-right text-[11px] text-[#f15c6d]">Não saiu: {m.error ?? 'erro do WhatsApp'}</div>
                )}
              </div>
            );
          })
        )}
        <div ref={fim} />
      </div>
      <div className="bg-[#202c33] px-3 py-2">
        {janelaAberta && conversa?.mode === 'ia' && (
          <div className="mb-2 flex flex-wrap gap-1.5 text-[12px] font-medium">
            {(
              [
                ['arthur', 'Responder como você', <UserRound key="a" size={12} />],
                ['lia', 'Orientar a Lia (o cliente não vê)', <Sparkles key="l" size={12} />],
              ] as const
            ).map(([k, t, icone]) => (
              <button
                key={k}
                onClick={() => setModoDoTexto(k)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 ${modoDoTexto === k ? 'bg-[#00a884] text-[#111b21]' : 'bg-[#2a3942] text-[#d1d7db]'}`}
              >
                {icone} {t}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Como no WhatsApp Web: Enter envia, Shift+Enter quebra a linha.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!pending && texto.trim() && janelaAberta) enviar();
              }
            }}
            rows={1}
            disabled={!janelaAberta}
            placeholder={
              !janelaAberta
                ? 'Mais de 24 h sem mensagem do cliente: o WhatsApp não deixa responder por aqui.'
                : modoDoTexto === 'lia' && conversa?.mode === 'ia'
                  ? 'Diga à Lia o que fazer (o cliente não vê)'
                  : 'Digite uma mensagem'
            }
            className="max-h-[140px] min-h-[42px] flex-1 resize-none rounded-[8px] bg-[#2a3942] px-3 py-[10px] text-[15px] leading-[21px] text-[#d1d7db] outline-none [field-sizing:content] placeholder:text-[#8696a0] disabled:opacity-60"
          />
          <button
            onClick={enviar}
            disabled={pending || !texto.trim() || !janelaAberta}
            aria-label="Enviar"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-[#00a884] text-[#111b21] disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Iniciais para a "foto" do contato (como o WhatsApp sem foto): "Felipe - Personal" → "FP". */
function iniciais(nome: string): string {
  const p = nome.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** "HOJE", "ONTEM", dia da semana (até 6 dias) ou a data, no fuso de Brasília. */
function diaDaMensagem(iso: string, agora: number): string {
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const d = new Date(iso);
  const ref = new Date(agora || d.getTime());
  if (fmt(d) === fmt(ref)) return 'Hoje';
  if (fmt(d) === fmt(new Date(ref.getTime() - 86400_000))) return 'Ontem';
  if (ref.getTime() - d.getTime() < 6 * 86400_000) return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });
  return fmt(d);
}

/** Tiques do WhatsApp: relógio (saindo), ✓ enviada, ✓✓ entregue, ✓✓ azul lida, alerta se falhou. */
function Tique({ status }: { status: string | null }) {
  if (status === 'failed') return <CircleAlert size={14} className="text-[#f15c6d]" aria-label="não saiu" />;
  if (status === 'read') return <CheckCheck size={16} className="text-[#53bdeb]" aria-label="lida" />;
  if (status === 'delivered') return <CheckCheck size={16} aria-label="entregue" />;
  if (status === 'sent') return <Check size={16} aria-label="enviada" />;
  return <Clock size={12} aria-label="enviando" />;
}

/** Formatação do WhatsApp: *negrito*, _itálico_, ~riscado~ e links clicáveis. */
function TextoDoWhatsapp({ texto }: { texto: string }) {
  const partes = texto.split(/(https?:\/\/[^\s]+|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return (
    <>
      {partes.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-[#53bdeb] hover:underline">
            {p}
          </a>
        ) : /^\*[^*\n]+\*$/.test(p) ? (
          <strong key={i}>{p.slice(1, -1)}</strong>
        ) : /^_[^_\n]+_$/.test(p) ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : /^~[^~\n]+~$/.test(p) ? (
          <s key={i}>{p.slice(1, -1)}</s>
        ) : (
          p
        )
      )}
    </>
  );
}

/* ------------------------------------------------------------ configuração */

function Configuracao({ inicial, aoSalvar }: { inicial: ConfigDoAtendente; aoSalvar: () => void }) {
  const [c, setC] = useState(inicial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const mudar = <K extends keyof ConfigDoAtendente>(k: K, v: ConfigDoAtendente[K]) => setC((x) => ({ ...x, [k]: v }));
  const num = (v: string) => Number(v.replace(',', '.')) || 0;
  return (
    <details className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
        <Settings size={13} /> Configuração da atendente
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2.5 text-[13.5px] font-bold sm:col-span-2">
          <input type="checkbox" checked={c.active} onChange={(e) => mudar('active', e.target.checked)} className="h-4 w-4" />
          Atendente ligada (responde no WhatsApp e manda os e-mails)
        </label>
        <Campo rotulo="Nome com que ela se apresenta">
          <input value={c.personaName} onChange={(e) => mudar('personaName', e.target.value)} className={inputClass} />
        </Campo>
        <Campo rotulo={c.autoModel ? 'Modelo nos momentos decisivos (preço, objeção, fechamento)' : 'Modelo da IA'}>
          <select value={c.model} onChange={(e) => mudar('model', e.target.value as ConfigDoAtendente['model'])} className={inputClass}>
            {MODELOS_DA_IA.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
        <label className="flex items-start gap-2.5 text-[13px] leading-snug sm:col-span-2">
          <input type="checkbox" checked={c.autoModel} onChange={(e) => mudar('autoModel', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Economizar: escolher o modelo pelo momento</b>
            <span className="block text-fg-tertiary">
              Confirmações curtas (&quot;ok&quot;, &quot;obrigado&quot;) no Haiku, a descoberta no Sonnet e o modelo acima só no preço,
              objeção, desconto, prazo e fechamento.
            </span>
          </span>
        </label>
        <Campo rotulo="Teto de gasto com IA no mês (US$)">
          <input inputMode="decimal" value={c.monthlyBudgetUsd} onChange={(e) => mudar('monthlyBudgetUsd', num(e.target.value))} className={inputClass} />
        </Campo>
        <Campo rotulo="Desconto extra máximo (% além do combo)">
          <input inputMode="decimal" value={c.extraDiscountMax} onChange={(e) => mudar('extraDiscountMax', num(e.target.value))} className={inputClass} />
        </Campo>
        <Campo rotulo='Tempo do "vou ver com meu superior" (minutos)'>
          <input inputMode="numeric" value={c.discountWaitMinutes} onChange={(e) => mudar('discountWaitMinutes', num(e.target.value))} className={inputClass} />
        </Campo>
        <Campo rotulo="E-mails de 1º contato por dia">
          <input inputMode="numeric" value={c.dailyEmailCap} onChange={(e) => mudar('dailyEmailCap', num(e.target.value))} className={inputClass} />
        </Campo>
        <Campo rotulo="Seu e-mail (avisos e respostas dos e-mails)">
          <input value={c.ownerEmail ?? ''} onChange={(e) => mudar('ownerEmail', e.target.value)} className={inputClass} />
        </Campo>
      </div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await seguro(() => salvarConfigAtendenteAction(c), (m) => toast({ ok: false, message: m }));
            if (r) toast(r);
            aoSalvar();
          })
        }
        className="mt-4 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-50"
      >
        Salvar
      </button>
    </details>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-bold text-fg-tertiary">
      {rotulo}
      {children}
    </label>
  );
}
