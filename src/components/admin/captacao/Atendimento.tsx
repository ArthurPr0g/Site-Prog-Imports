'use client';

// Aba Atendimento: o placar de quem converte mais (Felipe × IA, em tempo real),
// as conversas da atendente de IA no WhatsApp, os pedidos de desconto extra
// esperando o "superior", o que a Lia aprendeu (para aprovar) e a configuração. Relê tudo a cada 10 s com a aba
// visível; o placar usa os leads do painel (relidos a cada minuto).

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Bell, Bot, CalendarDays, Mail, CheckCircle2, CircleAlert, FlaskConical, GraduationCap, Hand, MessageCircle, Send, Settings, Sparkles, Trophy, UserRound } from 'lucide-react';
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
} from '@/app/actions/atendente';
import { inputClass, semCentavos } from './comum';
import { ResultadosDaLiaPainel, TestarALia } from './LiaResultadosETeste';
import { ResumoDaConversa } from './ResumoDaConversa';
import { AgendaEReunioes } from './AgendaEReunioes';
import { ModelosDaMeta } from './ModelosDaMeta';
import { CustoDaIa } from './CustoDaIa';

const RELER_A_CADA = 10_000;

// Site atualizado com a aba aberta: a página antiga chama ações que o servidor
// novo não tem mais. Recarrega em vez de derrubar a tela; outras falhas de rede
// mantêm os dados que já estão na tela e avisam.
const VERSAO_NOVA = /Server Action .* was not found|UnrecognizedActionError|Failed to find Server Action/i;
async function seguro<T>(f: () => Promise<T>, aoFalhar?: (msg: string) => void): Promise<T | undefined> {
  try {
    return await f();
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    if (VERSAO_NOVA.test(msg)) {
      window.location.reload();
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
}: {
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
  const [filtro, setFiltro] = useState<'todas' | 'precisa' | 'comigo'>('todas');

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

  const conversas = (painel?.conversas ?? []).filter((c) =>
    filtro === 'precisa' ? c.needsHuman : filtro === 'comigo' ? c.mode === 'humano' : true
  );
  const aguardando = (painel?.pedidos ?? []).filter((p) => p.status === 'aguardando');
  const precisam = (painel?.conversas ?? []).filter((c) => c.needsHuman).length;

  return (
    <div className="space-y-4">
      <Placar linhas={linhas} lidoEm={lidoEm} />

      <ResultadosDaLiaPainel cotacaoDolar={cotacaoDolar} aoAbrir={setAberta} />

      {painel && <Situacao painel={painel} cotacaoDolar={cotacaoDolar} />}

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
          <div className="flex gap-1.5 text-[12px] font-bold">
            {(
              [
                ['todas', 'Todas'],
                ['precisa', `Precisam de você${precisam ? ` (${precisam})` : ''}`],
                ['comigo', 'Com você'],
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
          </div>
        </div>
        {!painel ? (
          <div className="p-3 text-[13px] text-fg-tertiary">Carregando…</div>
        ) : conversas.length === 0 ? (
          <div className="p-3 text-[13px] text-fg-tertiary">
            Nenhuma conversa ainda. Elas aparecem aqui quando um lead chama a atendente no WhatsApp.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
            <ul className={`max-h-[560px] space-y-1 overflow-y-auto ${aberta ? 'hidden lg:block' : ''}`}>
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

      <TestarALia leads={leads} />

      {painel && <Aprendizados licoes={painel.licoes} aoMudar={reler} />}

      {painel && <Configuracao inicial={painel.config} aoSalvar={reler} />}
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
        {c.isTest && (
          <span className="flex items-center gap-1 rounded-full bg-fg-faded/12 px-1.5 py-0.5 font-bold">
            <FlaskConical size={10} /> teste
          </span>
        )}
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
  const [texto, setTexto] = useState('');
  // Responder como Arthur (a IA para) ou orientar a Lia (ela responde seguindo a instrução).
  const [modoDoTexto, setModoDoTexto] = useState<'arthur' | 'lia'>('arthur');
  const [pending, start] = useTransition();
  const toast = useToast();
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    void seguro(() => mensagensDaConversaAction(id)).then((m) => vivo && m && setMensagens(m));
    return () => {
      vivo = false;
    };
  }, [id, versao]);
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

  return (
    <div className="flex min-h-[420px] flex-col rounded-[14px] border border-border bg-page/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <button onClick={aoVoltar} className="text-[12.5px] font-bold text-accent lg:hidden">
          ← Conversas
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-extrabold">
            {conversa?.leadName ?? conversa?.contactName ?? (conversa ? `+${conversa.contactId}` : '…')}
          </div>
          <div className="text-[11.5px] text-fg-tertiary">
            {conversa ? `+${conversa.contactId}` : ''}
            {conversa?.mode === 'humano' ? ' · com você' : ' · a IA responde'}
            {conversa && !janelaAberta ? ' · janela de 24 h fechada' : ''}
            {conversa ? ` · IA gastou ${gasto(conversa.gastoUsd, cotacaoDolar)}` : ''}
          </div>
        </div>
        {conversa?.leadId && (
          <button
            onClick={() => aoAbrirLead(conversa.leadId!)}
            className="rounded-control border border-border-strong px-2.5 py-1 text-[12px] font-bold"
          >
            Ficha do lead
          </button>
        )}
        {conversa?.needsHuman && (
          <button
            disabled={pending}
            onClick={() => acao(() => resolverChamadoAction(id))}
            className="flex items-center gap-1 rounded-control border border-success/60 px-2.5 py-1 text-[12px] font-bold text-success"
          >
            <CheckCircle2 size={13} /> Resolvido
          </button>
        )}
        {conversa && (
          <button
            disabled={pending}
            onClick={() => acao(() => alternarModoAction(id, conversa.mode === 'ia' ? 'humano' : 'ia'))}
            className="flex items-center gap-1 rounded-control bg-accent px-2.5 py-1 text-[12px] font-extrabold text-page disabled:opacity-50"
          >
            {conversa.mode === 'ia' ? (
              <>
                <Hand size={13} /> Assumir
              </>
            ) : (
              <>
                <Bot size={13} /> Devolver para a IA
              </>
            )}
          </button>
        )}
      </div>
      {conversa && <TrilhaDaVenda conversa={conversa} />}
      {conversa?.needsHuman && conversa.needsHumanReason && (
        <div className="mx-3 mt-2 rounded-[10px] border border-error/40 bg-error/[.06] px-3 py-2 text-[12.5px]">
          <b>Precisa de você:</b> {conversa.needsHumanReason}
        </div>
      )}
      {conversa && <ResumoDaConversa resumo={conversa.summary} descoberta={conversa.descoberta} />}
      <div className="max-h-[440px] flex-1 space-y-2 overflow-y-auto p-3">
        {!mensagens ? (
          <div className="text-[13px] text-fg-tertiary">Carregando…</div>
        ) : (
          mensagens.map((m) =>
            m.author === 'sistema' ? (
              <div key={m.id} className="text-center text-[11.5px] text-fg-faded">
                {m.body} · {hora(m.createdAt)}
              </div>
            ) : (
              <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[14px] px-3 py-2 text-[13px] leading-snug ${
                    m.direction === 'out' ? (m.author === 'arthur' ? 'bg-accent/20' : 'bg-accent/10') : 'bg-card'
                  }`}
                >
                  {m.body}
                  <div className="mt-1 text-right text-[10.5px] text-fg-faded">
                    {m.author === 'ia' ? 'IA · ' : m.author === 'arthur' ? 'Você · ' : ''}
                    {hora(m.createdAt)}
                    {m.status === 'read' ? ' · lida' : m.status === 'failed' ? ` · não saiu: ${m.error ?? ''}` : ''}
                  </div>
                </div>
              </div>
            )
          )
        )}
        <div ref={fim} />
      </div>
      {janelaAberta && conversa?.mode === 'ia' && (
        <div className="flex gap-1.5 border-t border-border px-2.5 pt-2.5 text-[12px] font-bold">
          {(
            [
              ['arthur', 'Responder como você', <UserRound key="a" size={12} />],
              ['lia', 'Orientar a Lia', <Sparkles key="l" size={12} />],
            ] as const
          ).map(([k, t, icone]) => (
            <button
              key={k}
              onClick={() => setModoDoTexto(k)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 ${
                modoDoTexto === k ? 'bg-accent text-page' : 'border border-border-strong text-fg-secondary'
              }`}
            >
              {icone} {t}
            </button>
          ))}
        </div>
      )}
      <div className={`flex items-end gap-2 p-2.5 ${janelaAberta && conversa?.mode === 'ia' ? '' : 'border-t border-border'}`}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          disabled={!janelaAberta}
          placeholder={
            !janelaAberta
              ? 'Mais de 24 h sem mensagem do cliente: o WhatsApp não deixa responder por aqui.'
              : modoDoTexto === 'lia' && conversa?.mode === 'ia'
                ? 'Diga à Lia o que fazer (ex.: mande você mesma 2 exemplos de site). O cliente não vê isto.'
                : 'Responder como Arthur (a IA para nesta conversa)'
          }
          className={`flex-1 resize-none ${inputClass}`}
        />
        <button
          onClick={enviar}
          disabled={pending || !texto.trim() || !janelaAberta}
          aria-label="Enviar"
          className="grid h-11 w-11 place-items-center rounded-full bg-accent text-page disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
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
