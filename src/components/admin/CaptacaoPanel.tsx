'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Search,
  Upload,
  MessageCircle,
  Phone,
  Mail,
  Globe,
  AtSign,
  MapPin,
  StickyNote,
  UserPlus,
  TriangleAlert,
  Star,
  FileSearch,
  MessagesSquare,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL, formatDateBR } from '@/lib/format';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  EM_NEGOCIACAO,
  ENCERRADOS,
  whatsappDoLead,
  urlComProtocolo,
  mapsDoLead,
  type Lead,
  type Pais,
  type LeadStatus,
} from '@/lib/captacao';
import { importLeadsAction, updateLeadAction, convertLeadToCustomerAction, saveLeadTemplatesAction } from '@/app/actions/leads';
import {
  TABELA_USD,
  tabelaBRL,
  estimar,
  emReais,
  formatMoeda,
  type Cotacoes,
  type Estimativa,
  type Moeda,
} from '@/lib/precos-captacao';
import {
  VARIAVEIS,
  idiomaDoLead,
  variaveisDoLead,
  preencher,
  linkWhatsApp,
  linkGmail,
  type ModeloMensagem,
  type Canal,
  type Idioma,
} from '@/lib/mensagens-lead';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const POR_PAGINA = 50;
const DIA = 24 * 60 * 60 * 1000;

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function maisDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Dias até o retorno depois da primeira mensagem. */
const RETORNO_APOS_CONTATO = 3;

function corDaNota(n: number): string {
  if (n >= 70) return 'bg-accent text-page';
  if (n >= 50) return 'bg-accent/20 text-accent';
  return 'bg-fg-faded/15 text-fg-tertiary';
}

export function CaptacaoPanel({
  leads,
  catalogo,
  cotacoes,
  modelos,
  origem,
}: {
  leads: Lead[];
  /** Nome → preço de todos os serviços do catálogo (únicos e mensalidades). */
  catalogo: [string, number][];
  cotacoes: Cotacoes;
  modelos: ModeloMensagem[];
  /** Endereço do site em produção, para o link do diagnóstico. */
  origem: string;
}) {
  const tabBRL = useMemo(() => tabelaBRL(new Map(catalogo)), [catalogo]);
  const estimativa = (l: Lead) => estimar(l.suggestedServices, l.country === 'US' ? TABELA_USD : tabBRL);
  // Totais sempre em reais; lead de fora sem cotação do dia fica de fora da soma.
  const valor = (l: Lead) => {
    const e = estimativa(l);
    return emReais(e.unico, e.moeda, cotacoes) ?? 0;
  };
  const mensalidade = (l: Lead) => {
    const e = estimativa(l);
    return emReais(e.mensal, e.moeda, cotacoes) ?? 0;
  };
  // Lidos uma vez na montagem: o painel não precisa virar o dia sozinho.
  const [hoje] = useState(hojeISO);
  const [agora] = useState(() => Date.now());

  const [busca, setBusca] = useState('');
  const [pais, setPais] = useState<'' | 'BR' | 'US'>('');
  const [etapa, setEtapa] = useState<'' | 'atrasados' | LeadStatus>('');
  const [servico, setServico] = useState('');
  const [notaMin, setNotaMin] = useState(0);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [importando, setImportando] = useState(false);
  const [notasDe, setNotasDe] = useState<Lead | null>(null);
  const [editandoModelos, setEditandoModelos] = useState(false);

  const atrasado = (l: Lead) => !ENCERRADOS.includes(l.status) && !!l.nextContact && l.nextContact <= hoje;

  /* ---------------------------------------------------------- indicadores */
  const ind = useMemo(() => {
    const contatados = leads.filter((l) => l.firstContactAt);
    const responderam = contatados.filter((l) => l.repliedAt);
    const negociando = leads.filter((l) => EM_NEGOCIACAO.includes(l.status));
    const fechados30 = leads.filter((l) => l.closedAt && agora - Date.parse(l.closedAt) <= 30 * DIA);
    const fila = leads.filter((l) => l.status === 'novo');
    return {
      // Valor na mesa: tudo que ainda pode virar venda (fora fechados, perdidos e não contatar).
      naMesa: leads.filter((l) => !ENCERRADOS.includes(l.status)).reduce((s, l) => s + valor(l), 0),
      naMesaMensal: leads.filter((l) => !ENCERRADOS.includes(l.status)).reduce((s, l) => s + mensalidade(l), 0),
      naMesaLeads: leads.filter((l) => !ENCERRADOS.includes(l.status) && valor(l) > 0).length,
      naMesaPorPais: PAISES.map((pais) => {
        const abertos = leads.filter((l) => l.country === pais && !ENCERRADOS.includes(l.status));
        const ests = abertos.map(estimativa);
        const unico = ests.reduce((s, e) => s + e.unico, 0);
        const mensal = ests.reduce((s, e) => s + e.mensal, 0);
        const moeda = ests[0]?.moeda ?? (pais === 'US' ? 'USD' : 'BRL');
        return {
          pais,
          moeda,
          unico,
          mensal,
          unicoBRL: emReais(unico, moeda, cotacoes),
          mensalBRL: emReais(mensal, moeda, cotacoes),
        };
      }).filter((p) => p.unico > 0),
      fila: fila.length,
      filaBoa: fila.filter((l) => l.score >= 60).length,
      contatados7: contatados.filter((l) => agora - Date.parse(l.firstContactAt!) <= 7 * DIA).length,
      taxaResposta: contatados.length ? Math.round((responderam.length / contatados.length) * 100) : null,
      negociando: negociando.length,
      valorNegociando: negociando.reduce((s, l) => s + valor(l), 0),
      mensalNegociando: negociando.reduce((s, l) => s + mensalidade(l), 0),
      fechados30: fechados30.length,
      valorFechados30: fechados30.reduce((s, l) => s + valor(l), 0),
      mensalFechados30: fechados30.reduce((s, l) => s + mensalidade(l), 0),
      atrasados: leads.filter(atrasado),
      porEtapa: LEAD_STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length] as const),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, tabBRL, cotacoes, hoje, agora]);

  const servicosSugeridos = useMemo(() => [...new Set(leads.flatMap((l) => l.suggestedServices))].sort(), [leads]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (pais && l.country !== pais) return false;
      if (etapa === 'atrasados' ? !atrasado(l) : etapa ? l.status !== etapa : l.status === 'nao_contatar') return false;
      if (servico && !l.suggestedServices.includes(servico)) return false;
      if (l.score < notaMin) return false;
      if (termo && ![l.name, l.category, l.city, l.niche, l.state].some((c) => c?.toLowerCase().includes(termo))) {
        return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, busca, pais, etapa, servico, notaMin, hoje]);

  const total = leads.length;

  return (
    // color-scheme escuro: sem ele o WebKit desenha select e calendário em branco.
    <div className="[color-scheme:dark]">
      {/* Indicadores */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ValorNaMesa
          implementacao={ind.naMesa}
          mensal={ind.naMesaMensal}
          porPais={ind.naMesaPorPais}
          rodape={`${ind.naMesaLeads} lead(s) em aberto, pelos serviços sugeridos${
            cotacoes.USD ? ' · EUA convertido pela cotação de hoje' : ' · EUA fora (sem cotação hoje)'
          }`}
        />
        <Indicador rotulo="Na fila" valor={String(ind.fila)} rodape={`${ind.filaBoa} com nota 60 ou mais`} />
        <Indicador
          rotulo="Contatados (7 dias)"
          valor={String(ind.contatados7)}
          rodape={
            ind.taxaResposta === null
              ? 'Taxa de resposta aparece após o 1º contato'
              : `${ind.taxaResposta}% responderam (desde o início)`
          }
        />
        <Indicador
          rotulo="Em negociação"
          valor={String(ind.negociando)}
          rodape={`${semCentavos(ind.valorNegociando)} + ${semCentavos(ind.mensalNegociando)}/mês estimados`}
        />
        <Indicador
          rotulo="Fechados (30 dias)"
          valor={String(ind.fechados30)}
          rodape={`${semCentavos(ind.valorFechados30)} + ${semCentavos(ind.mensalFechados30)}/mês pela tabela`}
        />
      </div>

      {ind.atrasados.length > 0 && (
        <button
          onClick={() => {
            setEtapa('atrasados');
            setLimite(POR_PAGINA);
          }}
          className="mb-4 flex w-full items-center gap-2.5 rounded-[14px] border border-error/40 bg-error/10 px-4 py-3 text-left text-[13px] font-bold text-error"
        >
          <TriangleAlert size={16} className="flex-shrink-0" />
          {ind.atrasados.length} lead(s) com retorno marcado para hoje ou antes. Toque para ver.
        </button>
      )}

      {/* Funil */}
      {total > 0 && (
        <div className="mb-4 rounded-[18px] border border-border bg-card p-4 sm:p-5">
          <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Funil</div>
          <div className="flex flex-wrap gap-2">
            {ind.porEtapa.map(([s, n]) => (
              <button
                key={s}
                onClick={() => {
                  setEtapa(etapa === s ? '' : s);
                  setLimite(POR_PAGINA);
                }}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  etapa === s
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border-strong text-fg-secondary hover:border-accent'
                }`}
              >
                {LEAD_STATUS_LABEL[s]} <span className="tabular-nums text-fg-tertiary">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faded" />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setLimite(POR_PAGINA);
            }}
            placeholder="Buscar por nome, ramo ou cidade"
            className={`w-full pl-10 ${inputClass}`}
          />
        </div>
        <select value={pais} onChange={(e) => setPais(e.target.value as '' | 'BR' | 'US')} className={inputClass}>
          <option value="">Brasil e EUA</option>
          <option value="BR">Brasil</option>
          <option value="US">EUA</option>
        </select>
        <select value={etapa} onChange={(e) => setEtapa(e.target.value as '' | LeadStatus)} className={inputClass}>
          <option value="">Todas as etapas</option>
          <option value="atrasados">Retorno vencido</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={servico} onChange={(e) => setServico(e.target.value)} className={inputClass}>
          <option value="">Qualquer serviço</option>
          {servicosSugeridos.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={notaMin} onChange={(e) => setNotaMin(Number(e.target.value))} className={inputClass}>
          <option value={0}>Qualquer nota</option>
          <option value={50}>Nota 50+</option>
          <option value={70}>Nota 70+</option>
        </select>
        <button
          onClick={() => setEditandoModelos(true)}
          className="flex items-center gap-1.5 rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-bold text-fg-secondary hover:border-accent hover:text-accent"
        >
          <MessagesSquare size={15} /> Mensagens
        </button>
        <button
          onClick={() => setImportando(true)}
          className="flex items-center gap-1.5 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
        >
          <Upload size={15} /> Importar CSV
        </button>
      </div>

      <div className="mb-2 text-[12.5px] text-fg-tertiary">
        {filtrados.length} de {total} lead(s)
        {etapa === '' && ' · "Não contatar" fica escondido; escolha a etapa para ver'}
      </div>

      {/* Lista */}
      <div className="space-y-2.5">
        {total === 0 && (
          <div className="rounded-[18px] border border-border bg-card p-6 text-[13px] text-fg-tertiary">
            Nenhum lead ainda. Rode o google-maps-scraper-kit para um ramo e uma cidade e importe o CSV aqui.
          </div>
        )}
        {total > 0 && filtrados.length === 0 && (
          <div className="rounded-[18px] border border-border bg-card p-6 text-[13px] text-fg-tertiary">
            Nada encontrado com esses filtros.
          </div>
        )}
        {filtrados.slice(0, limite).map((l) => (
          <LinhaDoLead
            key={l.id}
            lead={l}
            estimativa={estimativa(l)}
            cotacoes={cotacoes}
            hoje={hoje}
            modelos={modelos}
            origem={origem}
            onNotas={() => setNotasDe(l)}
          />
        ))}
      </div>

      {filtrados.length > limite && (
        <button
          onClick={() => setLimite(limite + POR_PAGINA)}
          className="mt-4 w-full rounded-control border border-border-strong py-2.5 text-[13px] font-bold text-fg-secondary hover:border-accent hover:text-accent"
        >
          Mostrar mais {Math.min(POR_PAGINA, filtrados.length - limite)}
        </button>
      )}

      {importando && <ImportarModal onFechar={() => setImportando(false)} />}
      {editandoModelos && (
        <ModelosModal
          modelos={modelos}
          exemplo={(filtrados[0] ?? leads[0]) || null}
          origem={origem}
          onFechar={() => setEditandoModelos(false)}
        />
      )}
      {notasDe && <NotasModal lead={notasDe} onFechar={() => setNotasDe(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------ peças */

const semCentavos = (v: number) => formatBRL(v).replace(/,00$/, '');

const PAISES: Pais[] = ['BR', 'US'];
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

type ValorDoPais = {
  pais: Pais;
  moeda: Moeda;
  unico: number;
  mensal: number;
  unicoBRL: number | null;
  mensalBRL: number | null;
};

/** Total em reais primeiro; ao lado, cada país na moeda dele (e em reais, se não for o Brasil). */
function ValorNaMesa({
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
            <div className="text-[11px] text-fg-faded">Implementação (total)</div>
            <div className="truncate font-display text-[22px] font-bold tabular-nums tracking-[-.01em] sm:text-[34px]">
              {semCentavos(implementacao)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-fg-faded">Mensalidades (total)</div>
            <div className="truncate font-display text-[22px] font-bold tabular-nums tracking-[-.01em] sm:text-[34px]">
              {semCentavos(mensal)}
              <span className="text-[13px] font-bold text-fg-tertiary">/mês</span>
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
                    <div className="mt-0.5 text-[16px] font-bold tabular-nums leading-tight sm:text-[18px]">{formatMoeda(p.unico, p.moeda)}</div>
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

function Indicador({ rotulo, valor, rodape }: { rotulo: string; valor: string; rodape: string }) {
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

/** "≈ US$ 2.880 (R$ 15.552) + US$ 99/mês"; em reais quando o lead é do Brasil. */
function ValorDoLead({ e, cotacoes }: { e: Estimativa; cotacoes: Cotacoes }) {
  const brl = e.moeda === 'BRL' ? null : emReais(e.unico, e.moeda, cotacoes);
  return (
    <span
      className="text-[11.5px] font-bold text-fg-tertiary"
      title={`${e.combo ? 'Preço de combo. ' : ''}${
        e.moeda === 'USD'
          ? 'Tabela em dólar do portfólio; reais pela cotação de mercado do dia.'
          : 'Preços do catálogo de Serviços.'
      }`}
    >
      ≈ <span className="text-fg-secondary">{formatMoeda(e.unico, e.moeda)}</span>
      {brl !== null && <> ({formatMoeda(brl, 'BRL')})</>}
      {e.mensal > 0 && <> + {formatMoeda(e.mensal, e.moeda)}/mês</>}
      {e.combo && <span className="ml-1 text-accent">combo</span>}
    </span>
  );
}

function BotaoContato({
  href,
  titulo,
  children,
  destaque,
  onClick,
}: {
  href: string;
  titulo: string;
  children: React.ReactNode;
  destaque?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={`grid h-8 w-8 place-items-center rounded-full border transition-colors ${
        destaque
          ? 'border-accent/50 text-accent hover:bg-accent/10'
          : 'border-border-strong text-fg-tertiary hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </a>
  );
}

function LinhaDoLead({
  lead: l,
  estimativa: e,
  cotacoes,
  hoje,
  modelos,
  origem,
  onNotas,
}: {
  lead: Lead;
  estimativa: Estimativa;
  cotacoes: Cotacoes;
  hoje: string;
  modelos: ModeloMensagem[];
  origem: string;
  onNotas: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const wa = l.semWhatsapp ? null : whatsappDoLead(l.phone, l.country);
  // Depois de abrir o WhatsApp/Gmail, a tela pergunta se a mensagem saiu:
  // o clique sozinho não prova envio (o número pode nem ter WhatsApp).
  const [abriu, setAbriu] = useState<'whatsapp' | 'email' | null>(null);
  const lang = idiomaDoLead(l);
  const vars = variaveisDoLead(l, lang, origem);
  const modelo = (canal: Canal) => modelos.find((m) => m.channel === canal && m.lang === lang);
  const mWhats = modelo('whatsapp');
  const mEmail = modelo('email');

  // A primeira mensagem tira o lead da fila e já marca quando cobrar resposta.
  function registrarContato() {
    setAbriu(null);
    if (l.status !== 'novo') return;
    salvar({
      status: 'contatado',
      nextContact: l.nextContact ?? maisDias(hoje, RETORNO_APOS_CONTATO),
    });
  }

  function semWhatsApp() {
    setAbriu(null);
    salvar({ semWhatsapp: true });
  }
  const vencido = !ENCERRADOS.includes(l.status) && !!l.nextContact && l.nextContact <= hoje;

  function salvar(input: Parameters<typeof updateLeadAction>[1]) {
    startTransition(async () => {
      const r = await updateLeadAction(l.id, input);
      if (!r.ok) toast(r);
    });
  }

  function virarCliente() {
    startTransition(async () => {
      toast(await convertLeadToCustomerAction(l.id));
    });
  }

  const local = [l.city, l.state].filter(Boolean).join(' / ');

  return (
    <div className={`rounded-[18px] border border-border bg-card p-4 sm:p-5 ${pending ? 'opacity-60' : ''}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            title="Nota de 0 a 100: chance de precisar dos serviços e de responder"
            className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] font-display text-[16px] font-bold tabular-nums ${corDaNota(l.score)}`}
          >
            {l.score}
          </div>
          <div className="min-w-0">
            <div className="font-bold leading-snug">
              {l.name} <span className="text-[11px] font-extrabold text-fg-faded">{l.country === 'US' ? 'EUA' : 'BR'}</span>
            </div>
            <div className="mt-0.5 text-[12px] text-fg-tertiary">
              {[l.category, local].filter(Boolean).join(' · ') || '—'}
              {l.rating !== null && (
                <span className="ml-1.5 inline-flex items-center gap-0.5">
                  · <Star size={11} className="fill-current" /> {l.rating.toFixed(1)} ({l.reviewCount ?? 0})
                </span>
              )}
            </div>
            {l.reasons.length > 0 && <div className="mt-1 text-[12px] text-fg-secondary">{l.reasons.join(' · ')}</div>}
            {l.suggestedServices.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {l.suggestedServices.map((s) => (
                  <span key={s} className="rounded-full bg-accent/12 px-2.5 py-0.5 text-[11px] font-extrabold text-accent">
                    {s}
                  </span>
                ))}
                {e.unico > 0 && <ValorDoLead e={e} cotacoes={cotacoes} />}
              </div>
            )}
            {l.notes && <div className="mt-1.5 line-clamp-2 text-[12px] italic text-fg-tertiary">{l.notes}</div>}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 lg:items-end">
          <div className="flex flex-wrap gap-1.5">
            {wa && (
              <BotaoContato
                href={mWhats ? linkWhatsApp(wa.numero, preencher(mWhats.body, vars)) : `https://wa.me/${wa.numero}`}
                titulo={wa.celular ? 'WhatsApp com a mensagem pronta' : 'WhatsApp (parece telefone fixo)'}
                destaque={wa.celular}
                onClick={() => setAbriu('whatsapp')}
              >
                <MessageCircle size={14} />
              </BotaoContato>
            )}
            {l.phone && (
              <BotaoContato href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} titulo={`Ligar: ${l.phone}`}>
                <Phone size={14} />
              </BotaoContato>
            )}
            {l.email && (
              <BotaoContato
                href={
                  mEmail
                    ? linkGmail(l.email, preencher(mEmail.subject ?? '', vars), preencher(mEmail.body, vars))
                    : `mailto:${l.email}`
                }
                titulo={`E-mail pronto no Gmail: ${l.email}`}
                destaque={!wa?.celular}
                onClick={() => setAbriu('email')}
              >
                <Mail size={14} />
              </BotaoContato>
            )}
            {l.website && (
              <BotaoContato href={urlComProtocolo(l.website)} titulo={l.website}>
                <Globe size={14} />
              </BotaoContato>
            )}
            {l.instagram && (
              <BotaoContato href={urlComProtocolo(l.instagram)} titulo="Instagram">
                <AtSign size={14} />
              </BotaoContato>
            )}
            <BotaoContato href={`/diagnostico/${l.publicToken}`} titulo="Diagnóstico (o link que vai na mensagem)">
              <FileSearch size={14} />
            </BotaoContato>
            <BotaoContato href={mapsDoLead(l)} titulo="Ver no Google Maps">
              <MapPin size={14} />
            </BotaoContato>
            <button
              onClick={onNotas}
              title="Anotações"
              aria-label="Anotações"
              className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent"
            >
              <StickyNote size={14} />
            </button>
          </div>

          {abriu && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-accent/40 bg-accent/[.06] px-2.5 py-1.5 text-[12px]">
              <span className="text-fg-secondary">A mensagem saiu?</span>
              <button onClick={registrarContato} className="rounded-full bg-accent px-2.5 py-0.5 font-extrabold text-page">
                Enviei
              </button>
              {abriu === 'whatsapp' && (
                <button
                  onClick={semWhatsApp}
                  className="rounded-full border border-border-strong px-2.5 py-0.5 font-bold text-fg-secondary"
                >
                  Sem WhatsApp
                </button>
              )}
              <button onClick={() => setAbriu(null)} className="px-1 font-bold text-fg-faded" aria-label="Fechar">
                ×
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={l.status}
              disabled={pending}
              onChange={(e) => salvar({ status: e.target.value as LeadStatus })}
              aria-label="Etapa"
              className={`${inputClass} py-1.5 text-[12.5px]`}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {!ENCERRADOS.includes(l.status) && (
              <label
                className={`flex flex-col gap-0.5 text-[11px] sm:flex-row sm:items-center sm:gap-1.5 sm:text-[11.5px] ${vencido ? 'font-bold text-error' : 'text-fg-faded'}`}
              >
                Retorno
                <input
                  type="date"
                  value={l.nextContact ?? ''}
                  disabled={pending}
                  onChange={(e) => salvar({ nextContact: e.target.value || null })}
                  title="Data do próximo contato"
                  aria-label="Data do próximo contato"
                  className={`${inputClass} w-[150px] py-1.5 text-[12.5px]`}
                />
              </label>
            )}
            {l.customerId ? (
              <Link href={`/admin/clientes/${l.customerId}`} className="text-[12.5px] font-bold text-accent hover:underline">
                Ver cliente
              </Link>
            ) : (
              ['respondeu', 'reuniao', 'proposta', 'fechado'].includes(l.status) && (
                <button
                  onClick={virarCliente}
                  disabled={pending}
                  className="flex items-center gap-1.5 rounded-control border border-accent/50 px-3 py-1.5 text-[12.5px] font-bold text-accent hover:bg-accent/10"
                >
                  <UserPlus size={13} /> Virar cliente
                </button>
              )
            )}
          </div>
          {l.firstContactAt && <div className="text-[11px] text-fg-faded">1º contato em {formatDateBR(l.firstContactAt)}</div>}
        </div>
      </div>
    </div>
  );
}

function Modal({ titulo, children, onFechar }: { titulo: string; children: React.ReactNode; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div
        className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 text-[15px] font-extrabold">{titulo}</div>
        {children}
      </div>
    </div>
  );
}

function ImportarModal({ onFechar }: { onFechar: () => void }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await importLeadsAction(formData);
      toast(r);
      if (r.ok) onFechar();
    });
  }

  return (
    <Modal titulo="Importar leads do Google Maps" onFechar={onFechar}>
      <form action={enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <div className="mb-1.5 text-[11px] text-fg-faded">CSV gerado pelo google-maps-scraper-kit *</div>
          <input name="arquivo" type="file" accept=".csv,text/csv" required className={`w-full ${inputClass}`} />
        </label>
        <label>
          <div className="mb-1.5 text-[11px] text-fg-faded">País</div>
          <select name="pais" defaultValue="BR" className={`w-full ${inputClass}`}>
            <option value="BR">Brasil</option>
            <option value="US">EUA</option>
          </select>
        </label>
        <label>
          <div className="mb-1.5 text-[11px] text-fg-faded">Ramo buscado</div>
          <input name="nicho" placeholder="Ex: clínica odontológica" className={`w-full ${inputClass}`} />
        </label>
        <label>
          <div className="mb-1.5 text-[11px] text-fg-faded">Cidade</div>
          <input name="cidade" placeholder="Ex: Brasília" className={`w-full ${inputClass}`} />
        </label>
        <label>
          <div className="mb-1.5 text-[11px] text-fg-faded">Estado (sigla)</div>
          <input name="estado" placeholder="Ex: DF ou FL" maxLength={2} className={`w-full uppercase ${inputClass}`} />
        </label>
        <div className="text-[12px] leading-relaxed text-fg-tertiary sm:col-span-2">
          Reimportar a mesma busca atualiza os dados e a nota, sem mexer na etapa, no retorno nem nas anotações.
        </div>
        <div className="flex justify-end gap-2.5 sm:col-span-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-bold text-fg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
          >
            {pending ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NotasModal({ lead, onFechar }: { lead: Lead; onFechar: () => void }) {
  const [texto, setTexto] = useState(lead.notes ?? '');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function salvar() {
    startTransition(async () => {
      const r = await updateLeadAction(lead.id, { notes: texto });
      toast(r);
      if (r.ok) onFechar();
    });
  }

  return (
    <Modal titulo={`Anotações: ${lead.name}`} onFechar={onFechar}>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        placeholder="O que conversaram, quem decide, objeções, próximo passo…"
        className={`mb-4 w-full resize-none ${inputClass}`}
      />
      <div className="flex justify-end gap-2.5">
        <button
          onClick={onFechar}
          className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-bold text-fg-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={pending}
          className="rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
        >
          Salvar
        </button>
      </div>
    </Modal>
  );
}

const NOMES_MODELO: Record<`${Canal}-${Idioma}`, string> = {
  'whatsapp-pt': 'WhatsApp · português (Brasil)',
  'whatsapp-en': 'WhatsApp · inglês (EUA)',
  'email-pt': 'E-mail · português (Brasil)',
  'email-en': 'E-mail · inglês (EUA)',
};

function ModelosModal({
  modelos,
  exemplo,
  origem,
  onFechar,
}: {
  modelos: ModeloMensagem[];
  exemplo: Lead | null;
  origem: string;
  onFechar: () => void;
}) {
  const ordem: [Canal, Idioma][] = [
    ['whatsapp', 'pt'],
    ['email', 'pt'],
    ['whatsapp', 'en'],
    ['email', 'en'],
  ];
  const [form, setForm] = useState<ModeloMensagem[]>(() =>
    ordem.map(
      ([channel, lang]) =>
        modelos.find((m) => m.channel === channel && m.lang === lang) ?? {
          channel,
          lang,
          subject: channel === 'email' ? '' : null,
          body: '',
        }
    )
  );
  const [aba, setAba] = useState(0);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const atual = form[aba];
  const set = (campo: 'subject' | 'body', valor: string) =>
    setForm((f) => f.map((m, i) => (i === aba ? { ...m, [campo]: valor } : m)));
  const vars = exemplo ? variaveisDoLead(exemplo, atual.lang, origem) : null;

  function salvar() {
    startTransition(async () => {
      const r = await saveLeadTemplatesAction(form);
      toast(r);
      if (r.ok) onFechar();
    });
  }

  return (
    <Modal titulo="Mensagens prontas" onFechar={onFechar}>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {form.map((m, i) => (
          <button
            key={`${m.channel}-${m.lang}`}
            onClick={() => setAba(i)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${
              i === aba ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary'
            }`}
          >
            {NOMES_MODELO[`${m.channel}-${m.lang}`]}
          </button>
        ))}
      </div>

      {atual.channel === 'email' && (
        <input
          value={atual.subject ?? ''}
          onChange={(e) => set('subject', e.target.value)}
          placeholder="Assunto"
          className={`mb-2.5 w-full ${inputClass}`}
        />
      )}
      <textarea
        value={atual.body}
        onChange={(e) => set('body', e.target.value)}
        rows={10}
        className={`w-full resize-y ${inputClass}`}
      />
      <div className="mt-2 text-[11.5px] leading-relaxed text-fg-tertiary">
        Variáveis: {VARIAVEIS.map((v) => `{${v}}`).join(' ')}. O {'{problema}'} muda conforme o lead (sem site, site fora do ar,
        não abre bem no celular…) e o {'{elogio}'} só aparece com 30+ avaliações e nota 4,3+.
      </div>

      {exemplo && vars && (
        <div className="mt-4 rounded-[14px] border border-border bg-page/40 p-4">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Como fica para {exemplo.name}
          </div>
          {atual.channel === 'email' && <div className="mb-2 text-[13px] font-bold">{preencher(atual.subject ?? '', vars)}</div>}
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-secondary">{preencher(atual.body, vars)}</div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2.5">
        <button
          onClick={onFechar}
          className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-bold text-fg-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={pending}
          className="rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
        >
          Salvar as 4 mensagens
        </button>
      </div>
    </Modal>
  );
}
