'use client';

// Captação: indicadores, avisos (quentes e retornos do dia), funil, filtros e
// as abas Lista, Foco, Quadro, Mapa, Relatório e Buscas. Cada aba mora em
// src/components/admin/captacao/; as peças comuns em captacao/comum.tsx.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Search, Upload, MessagesSquare, TriangleAlert, Flame } from 'lucide-react';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  EM_NEGOCIACAO,
  ENCERRADOS,
  ehQuente,
  motivoFantasma,
  proximaEtapa,
  type Lead,
  type LeadStatus,
} from '@/lib/captacao';
import { TABELA_USD, tabelaBRL, estimar, emReais, type Cotacoes } from '@/lib/precos-captacao';
import type { ModeloMensagem } from '@/lib/mensagens-lead';
import type { PedidoDeBusca, KitDoVendedor } from '@/lib/data/leads';
import { inputClass, hojeISO, semCentavos, DIA, usePreferencia } from './captacao/comum';
import { ValorNaMesa, Indicador, PAISES } from './captacao/ValorNaMesa';
import { LinhaDoLead } from './captacao/LinhaDoLead';
import { Foco, filaDoFoco } from './captacao/Foco';
import { Quadro } from './captacao/Quadro';
import { Mapa } from './captacao/Mapa';
import { Relatorio } from './captacao/Relatorio';
import { Buscas } from './captacao/Buscas';
import { ImportarModal, NotasModal, ModelosModal, ChecklistModal } from './captacao/Modais';
import { Vendedores } from './captacao/Vendedores';
import { FichaDoLead } from './captacao/FichaDoLead';
import type { ServicoDoCatalogo } from '@/lib/itens-do-kit';
import { GraficoDaMeta } from '@/components/captacao/GraficoDaMeta';
import { NumeroAnimado, SUAVE } from '@/components/captacao/NumeroAnimado';
import { resumoDaMeta } from '@/lib/meta-captacao';

const POR_PAGINA = 50;
const ABAS = [
  ['lista', 'Lista'],
  ['foco', 'Foco'],
  ['quadro', 'Quadro'],
  ['mapa', 'Mapa'],
  ['relatorio', 'Relatório'],
  ['vendedores', 'Vendedores'],
  ['buscas', 'Buscas'],
] as const;
type Aba = (typeof ABAS)[number][0];
const CHAVE_ABA = 'captacao.aba';
/** Cor de cada etapa do funil (cores de sistema da Apple). */
const COR_DA_ETAPA: Record<LeadStatus, string> = {
  novo: '#8e8e93',
  contatado: '#0a84ff',
  respondeu: '#64d2ff',
  reuniao: '#bf5af2',
  proposta: '#ff9f0a',
  fechado: '#30d158',
  perdido: '#ff453a',
  nao_contatar: '#636366',
};
/** O painel relê os dados sozinho (o que o vendedor registra aparece aqui). */
const ATUALIZAR_A_CADA = 60_000;

type FiltroEtapa = '' | 'parahoje' | 'quentes' | LeadStatus;

export function CaptacaoPanel({
  leads,
  catalogo,
  servicos,
  cotacoes,
  modelos,
  origem,
  pedidos,
  clientes: clientesLista,
  kits,
}: {
  leads: Lead[];
  /** Nome → preço de todos os serviços do catálogo (únicos e mensalidades). */
  catalogo: [string, number][];
  /** Catálogo com descrição e prazo (ficha do lead, aba Oportunidade). */
  servicos: ServicoDoCatalogo[];
  cotacoes: Cotacoes;
  modelos: ModeloMensagem[];
  /** Endereço do site em produção, para o link do diagnóstico. */
  origem: string;
  pedidos: PedidoDeBusca[];
  /** Ids dos leads que já são clientes do ERP. */
  clientes: string[];
  /** Links de vendedor (página /vendedor/<token>). */
  kits: KitDoVendedor[];
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
  const clientes = useMemo(() => new Set(clientesLista), [clientesLista]);
  // Lead → vendedor com link ativo (o mais recente, se estiver em mais de um).
  const vendedorPorLead = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of [...kits].reverse()) if (k.active) for (const id of k.leadIds) m.set(id, k.sellerName);
    return m;
  }, [kits]);
  const leadsPorId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  // Lidos uma vez na montagem: o painel não precisa virar o dia sozinho.
  const [hoje] = useState(hojeISO);
  const [agora] = useState(() => Date.now());
  const calmo = useReducedMotion();

  // Atualização automática: com a aba do navegador visível, relê os leads a
  // cada minuto e ao voltar para a aba. A meta usa a hora da última leitura.
  const router = useRouter();
  const [agoraDaMeta, setAgoraDaMeta] = useState(() => Date.now());
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState !== 'visible') return;
      router.refresh();
      setAgoraDaMeta(Date.now());
    };
    const id = window.setInterval(atualizar, ATUALIZAR_A_CADA);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [router]);

  const [abaSalva, setAbaSalva] = usePreferencia(CHAVE_ABA, 'lista');
  const aba: Aba = ABAS.some(([a]) => a === abaSalva) ? (abaSalva as Aba) : 'lista';
  const mudarAba = (a: Aba) => setAbaSalva(a);

  const [busca, setBusca] = useState('');
  const [pais, setPais] = useState<'' | 'BR' | 'US'>('');
  const [etapa, setEtapa] = useState<FiltroEtapa>('');
  const [servico, setServico] = useState('');
  const [ramo, setRamo] = useState('');
  const [notaMin, setNotaMin] = useState(0);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [importando, setImportando] = useState(false);
  const [notasDe, setNotasDe] = useState<Lead | null>(null);
  const [checklistDe, setChecklistDe] = useState<Lead | null>(null);
  // Ficha completa (a mesma do vendedor). Guarda o id: depois de salvar, a
  // atualização da página traz o lead novo e a ficha mostra na hora.
  const [fichaDe, setFichaDe] = useState<string | null>(null);
  const [editandoModelos, setEditandoModelos] = useState(false);

  // Para hoje: retorno marcado à mão ou etapa da sequência vencida.
  const paraHoje = (l: Lead) => {
    if (ENCERRADOS.includes(l.status)) return false;
    if (l.nextContact && l.nextContact <= hoje) return true;
    const p = proximaEtapa(l);
    return !!p && p.etapa > 0 && !!p.vence && p.vence <= hoje;
  };

  /* ---------------------------------------------------------- indicadores */
  const ind = useMemo(() => {
    const abertos = leads.filter((l) => !ENCERRADOS.includes(l.status));
    const contatados = leads.filter((l) => l.firstContactAt);
    const responderam = contatados.filter((l) => l.repliedAt);
    const negociando = leads.filter((l) => EM_NEGOCIACAO.includes(l.status));
    const fechados30 = leads.filter((l) => l.closedAt && agora - Date.parse(l.closedAt) <= 30 * DIA);
    const fila = leads.filter((l) => l.status === 'novo');
    return {
      naMesa: abertos.reduce((s, l) => s + valor(l), 0),
      naMesaMensal: abertos.reduce((s, l) => s + mensalidade(l), 0),
      naMesaLeads: abertos.filter((l) => valor(l) > 0).length,
      naMesaPorPais: PAISES.map((p) => {
        const ests = abertos.filter((l) => l.country === p).map(estimativa);
        const unico = ests.reduce((s, e) => s + e.unico, 0);
        const mensal = ests.reduce((s, e) => s + e.mensal, 0);
        const moeda = ests[0]?.moeda ?? (p === 'US' ? 'USD' : 'BRL');
        return {
          pais: p,
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
      paraHoje: leads.filter(paraHoje).length,
      quentes: leads.filter((l) => ehQuente(l, agora)).length,
      porEtapa: LEAD_STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length] as const),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, tabBRL, cotacoes, hoje, agora]);

  const meta = useMemo(
    () =>
      resumoDaMeta(
        leads.map((l) => ({
          status: l.status,
          unico: valor(l),
          mensal: mensalidade(l),
          firstContactAt: l.firstContactAt,
          repliedAt: l.repliedAt,
          closedAt: l.closedAt,
        })),
        agoraDaMeta
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, tabBRL, cotacoes, agoraDaMeta]
  );

  const servicosSugeridos = useMemo(() => [...new Set(leads.flatMap((l) => l.suggestedServices))].sort(), [leads]);
  // Ramos das buscas importadas, com quantos leads em aberto cada um tem.
  const ramos = useMemo(() => {
    const n = new Map<string, number>();
    for (const l of leads) if (l.niche && !ENCERRADOS.includes(l.status)) n.set(l.niche, (n.get(l.niche) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [leads]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = leads.filter((l) => {
      if (pais && l.country !== pais) return false;
      if (etapa === 'parahoje') {
        if (!paraHoje(l)) return false;
      } else if (etapa === 'quentes') {
        if (!ehQuente(l, agora)) return false;
      } else if (etapa ? l.status !== etapa : l.status === 'nao_contatar') return false;
      if (servico && !l.suggestedServices.includes(servico)) return false;
      if (ramo && l.niche !== ramo) return false;
      if (l.score < notaMin) return false;
      if (termo && ![l.name, l.category, l.city, l.niche, l.state].some((c) => c?.toLowerCase().includes(termo))) return false;
      return true;
    });
    // Quentes primeiro; depois a ordem da nota (já vem do servidor).
    return [...lista.filter((l) => ehQuente(l, agora)), ...lista.filter((l) => !ehQuente(l, agora))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, busca, pais, etapa, servico, ramo, notaMin, hoje, agora]);

  const fila = useMemo(() => filaDoFoco(filtrados, hoje, agora, clientes), [filtrados, hoje, agora, clientes]);
  const total = leads.length;
  const filtrar = (e: FiltroEtapa) => {
    setEtapa(e);
    setLimite(POR_PAGINA);
    if (aba !== 'lista' && aba !== 'foco') mudarAba('lista');
  };

  return (
    // color-scheme escuro: sem ele o WebKit desenha select e calendário em branco.
    // tema-apple: cores de sistema, profundidade e aurora (globals.css).
    <div className="tema-apple [color-scheme:dark]">
      <div className="aurora" aria-hidden />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 grid gap-3 lg:col-span-4 xl:grid-cols-2">
        <ValorNaMesa
          implementacao={ind.naMesa}
          mensal={ind.naMesaMensal}
          porPais={ind.naMesaPorPais}
          rodape={`${ind.naMesaLeads} lead(s) em aberto · estimativa pelo pacote provável (a necessidade real sai da conversa)${
            cotacoes.USD ? ' · EUA convertido pela cotação de hoje' : ' · EUA fora (sem cotação hoje)'
          }`}
        />
        <GraficoDaMeta resumo={meta} aoVivo />
        </div>
        <Indicador i={0} cor="#0a84ff" rotulo="Na fila" valor={ind.fila} rodape={`${ind.filaBoa} com nota 60 ou mais`} />
        <Indicador
          i={1}
          cor="#64d2ff"
          rotulo="Contatados (7 dias)"
          valor={ind.contatados7}
          rodape={
            ind.taxaResposta === null
              ? 'Taxa de resposta aparece após o 1º contato'
              : `${ind.taxaResposta}% responderam (desde o início)`
          }
        />
        <Indicador
          i={2}
          cor="#ff9f0a"
          rotulo="Em negociação"
          valor={ind.negociando}
          rodape={`${semCentavos(ind.valorNegociando)} + ${semCentavos(ind.mensalNegociando)}/mês estimados`}
        />
        <Indicador
          i={3}
          cor="#30d158"
          rotulo="Fechados (30 dias)"
          valor={ind.fechados30}
          rodape={`${semCentavos(ind.valorFechados30)} + ${semCentavos(ind.mensalFechados30)}/mês pela tabela`}
        />
      </div>

      {(ind.quentes > 0 || ind.paraHoje > 0) && (
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
          {ind.quentes > 0 && (
            <button
              onClick={() => filtrar('quentes')}
              className="flex items-center gap-2.5 rounded-[14px] border border-[#ff6b3d]/45 bg-[#ff6b3d]/10 px-4 py-3 text-left text-[13px] font-bold text-[#ff8a5c]"
            >
              <Flame size={16} className="flex-shrink-0" />
              {ind.quentes} lead(s) abriram o diagnóstico nas últimas 48 h. Bom momento para ligar.
            </button>
          )}
          {ind.paraHoje > 0 && (
            <button
              onClick={() => filtrar('parahoje')}
              className="flex items-center gap-2.5 rounded-[14px] border border-error/40 bg-error/10 px-4 py-3 text-left text-[13px] font-bold text-error"
            >
              <TriangleAlert size={16} className="flex-shrink-0" />
              {ind.paraHoje} retorno(s) para hoje (sequência ou data marcada). Toque para ver.
            </button>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="mb-4 rounded-[18px] border border-border bg-card p-4 sm:p-5">
          <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Funil</div>
          <div className="flex flex-wrap gap-2">
            {ind.porEtapa.map(([s, n]) => (
              <button
                key={s}
                onClick={() => filtrar(etapa === s ? '' : s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-all hover:-translate-y-0.5 ${
                  etapa === s ? 'text-fg' : 'border-border-strong text-fg-secondary'
                }`}
                style={etapa === s ? { borderColor: COR_DA_ETAPA[s], background: `${COR_DA_ETAPA[s]}26` } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: COR_DA_ETAPA[s], boxShadow: `0 0 8px ${COR_DA_ETAPA[s]}` }} />
                {LEAD_STATUS_LABEL[s]}{' '}
                <span className="tabular-nums text-fg-tertiary">
                  <NumeroAnimado valor={n} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="mb-3.5 flex gap-1 overflow-x-auto border-b border-border">
        {ABAS.map(([a, nome]) => (
          <button
            key={a}
            onClick={() => mudarAba(a)}
            className={`relative -mb-px whitespace-nowrap px-3.5 py-2.5 text-[13.5px] font-bold transition-colors ${
              aba === a ? 'text-accent' : 'text-fg-tertiary hover:text-fg'
            }`}
          >
            {aba === a && (
              <motion.span
                layoutId="captacao-aba"
                className="barra-cor absolute inset-x-0 bottom-0 h-[2px] rounded-full"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            {nome}
            {a === 'foco' && fila.length > 0 && <span className="ml-1.5 tabular-nums text-fg-faded">{fila.length}</span>}
            {a === 'buscas' && pedidos.some((p) => p.status === 'pendente' || p.status === 'rodando') && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
            )}
          </button>
        ))}
      </div>

      {aba !== 'buscas' && aba !== 'relatorio' && aba !== 'vendedores' && (
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
          <select
            value={pais}
            onChange={(e) => setPais(e.target.value as '' | 'BR' | 'US')}
            className={inputClass}
            aria-label="País"
          >
            <option value="">Brasil e EUA</option>
            <option value="BR">Brasil</option>
            <option value="US">EUA</option>
          </select>
          <select
            value={etapa}
            onChange={(e) => filtrar(e.target.value as FiltroEtapa)}
            className={inputClass}
            aria-label="Etapa"
          >
            <option value="">Todas as etapas</option>
            <option value="parahoje">Retorno para hoje</option>
            <option value="quentes">Quentes (abriram o diagnóstico)</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={ramo}
            onChange={(e) => {
              setRamo(e.target.value);
              setLimite(POR_PAGINA);
            }}
            className={inputClass}
            aria-label="Ramo"
          >
            <option value="">Todos os ramos</option>
            {ramos.map(([r, n]) => (
              <option key={r} value={r}>
                {r} ({n})
              </option>
            ))}
          </select>
          <select
            value={servico}
            onChange={(e) => setServico(e.target.value)}
            className={inputClass}
            aria-label="Serviço sugerido"
          >
            <option value="">Qualquer serviço</option>
            {servicosSugeridos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={notaMin}
            onChange={(e) => setNotaMin(Number(e.target.value))}
            className={inputClass}
            aria-label="Nota mínima"
          >
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
      )}

      <motion.div
        key={aba}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: calmo ? 0 : 0.35, ease: SUAVE }}
      >
      {aba === 'lista' && (
        <>
          <div className="mb-2 text-[12.5px] text-fg-tertiary">
            {filtrados.length} de {total} lead(s)
            {etapa === '' && ' · "Não contatar" fica escondido; escolha a etapa para ver'}
          </div>
          <div className="space-y-2.5">
            {total === 0 && (
              <div className="rounded-[18px] border border-border bg-card p-6 text-[13px] text-fg-tertiary">
                Nenhum lead ainda. Peça uma busca na aba Buscas ou importe um CSV do captar.ps1.
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
                agora={agora}
                modelos={modelos}
                origem={origem}
                jaCliente={clientes.has(l.id)}
                vendedor={vendedorPorLead.get(l.id)}
                onNotas={() => setNotasDe(l)}
                onChecklist={() => setChecklistDe(l)}
                onAbrir={() => setFichaDe(l.id)}
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
        </>
      )}

      {aba === 'foco' && (
        <Foco
          leads={leads}
          fila={fila}
          estimativa={estimativa}
          cotacoes={cotacoes}
          modelos={modelos}
          origem={origem}
          hoje={hoje}
          agora={agora}
        />
      )}
      {aba === 'quadro' && (
        <Quadro
          leads={filtrados}
          estimativa={estimativa}
          agora={agora}
          vendedorDe={(id) => vendedorPorLead.get(id)}
          aoAbrir={(l) => setFichaDe(l.id)}
        />
      )}
      {aba === 'mapa' && <Mapa leads={filtrados} estimativa={estimativa} agora={agora} />}
      {aba === 'relatorio' && <Relatorio leads={leads} estimativa={estimativa} cotacoes={cotacoes} />}
      {aba === 'buscas' && <Buscas pedidos={pedidos} />}
      {aba === 'vendedores' && (
        <>
          <div className="mb-3 text-[12.5px] text-fg-tertiary">
            Os filtros da aba Lista (ramo, cidade, país, nota) definem quais leads vão no próximo link.
          </div>
          <Vendedores
            candidatos={filtrados.filter(
              (l) => l.status === 'novo' && !vendedorPorLead.has(l.id) && !clientes.has(l.id) && !motivoFantasma(l, agora)
            )}
            kits={kits}
            leadsPorId={leadsPorId}
            origem={origem}
            filtros={{
              pais: pais || undefined,
              ramo: ramo || undefined,
              servico: servico || undefined,
              notaMin: notaMin || undefined,
              busca: busca.trim() || undefined,
            }}
          />
        </>
      )}
      </motion.div>

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
      {checklistDe && <ChecklistModal lead={checklistDe} onFechar={() => setChecklistDe(null)} />}
      {fichaDe && leadsPorId.get(fichaDe) && (
        <FichaDoLead
          lead={leadsPorId.get(fichaDe)!}
          leads={leads}
          modelos={modelos}
          origem={origem}
          servicos={servicos}
          tabBRL={tabBRL}
          onFechar={() => setFichaDe(null)}
        />
      )}
    </div>
  );
}
