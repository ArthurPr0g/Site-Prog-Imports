'use client';

// Modo foco: um lead por vez, do mais quente/vencido para o de maior nota, com
// a mensagem da etapa certa já pronta. "Enviei" registra e passa para o
// próximo. Meta diária de contatos guardada no navegador do dono.

import { useMemo, useState } from 'react';
import { MessageCircle, Mail, Phone, Flame, SkipForward, Ban, Star, Target } from 'lucide-react';
import { ehQuente, proximaEtapa, NOME_DA_ETAPA, type Lead, motivoFantasma } from '@/lib/captacao';
import type { Cotacoes, Estimativa } from '@/lib/precos-captacao';
import type { ModeloMensagem } from '@/lib/mensagens-lead';
import { inputClass, corDaNota, haQuanto, diaLocal, ValorDoLead, Selo, useContatoDoLead, usePreferencia } from './comum';

const CHAVE_META = 'captacao.metaDiaria';
const LOTE = 10;

/** Fila do foco: só quem tem próxima mensagem a mandar hoje e um canal para isso. */
export function filaDoFoco(leads: Lead[], hoje: string, agora: number, clientes: Set<string>): Lead[] {
  const candidatos = leads.filter((l) => {
    if (clientes.has(l.id)) return false;
    // Possível empresa fantasma: só entra se já estiver em conversa.
    if (l.status === 'novo' && motivoFantasma(l, agora)) return false;
    const p = proximaEtapa(l);
    if (!p) return false;
    if (p.etapa > 0 && p.vence && p.vence > hoje) return false;
    return !!(l.phone || l.email);
  });
  const peso = (l: Lead) => {
    const p = proximaEtapa(l)!;
    if (ehQuente(l, agora)) return 0;
    if (p.etapa > 0) return 1; // retorno vencido antes de lead novo
    return 2;
  };
  return candidatos.sort((a, b) => peso(a) - peso(b) || b.score - a.score);
}

export function Foco({
  leads,
  fila,
  estimativa,
  cotacoes,
  modelos,
  origem,
  hoje,
  agora,
}: {
  leads: Lead[];
  fila: Lead[];
  estimativa: (l: Lead) => Estimativa;
  cotacoes: Cotacoes;
  modelos: ModeloMensagem[];
  origem: string;
  hoje: string;
  agora: number;
}) {
  const [metaTexto, setMetaTexto] = usePreferencia(CHAVE_META, '20');
  const meta = Math.max(1, Number(metaTexto) || 20);
  const mudarMeta = (v: number) => setMetaTexto(String(v));
  const [pulados, setPulados] = useState<Set<string>>(new Set());
  const [feitosNoLote, setFeitosNoLote] = useState(0);

  const contatosHoje = useMemo(
    () => leads.filter((l) => l.lastContactAt && diaLocal(l.lastContactAt) === hoje).length,
    [leads, hoje]
  );
  const restantes = fila.filter((l) => !pulados.has(l.id));
  const atual = restantes[0] ?? null;
  const pct = Math.min(100, Math.round((contatosHoje / Math.max(1, meta)) * 100));

  return (
    <div>
      <div className="mb-4 rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px] font-bold">
            <Target size={16} className="text-accent" /> Meta de hoje:{' '}
            <span className="tabular-nums">
              {contatosHoje} de {meta} contatos
            </span>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-fg-tertiary">
            Meta diária
            <input
              type="number"
              min={1}
              max={200}
              value={meta}
              onChange={(e) => mudarMeta(Math.max(1, Number(e.target.value) || 1))}
              className={`${inputClass} w-[80px] py-1.5 text-[12.5px]`}
            />
          </label>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-fg-faded/15">
          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-success' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-[12px] text-fg-tertiary">
          {restantes.length} na fila (quentes e retornos vencidos primeiro) · lote de {LOTE}: {Math.min(feitosNoLote, LOTE)}{' '}
          feito(s)
          {pct >= 100 && ' · meta batida!'}
        </div>
      </div>

      {!atual ? (
        <div className="rounded-[18px] border border-border bg-card p-8 text-center text-[14px] text-fg-tertiary">
          Ninguém na fila com esses filtros. Importe mais leads ou mude o ramo/país.
        </div>
      ) : feitosNoLote >= LOTE ? (
        <div className="rounded-[18px] border border-accent/40 bg-card p-8 text-center">
          <div className="text-[16px] font-extrabold">Lote de {LOTE} concluído.</div>
          <div className="mt-1 text-[13px] text-fg-tertiary">Faça uma pausa ou siga para os próximos {LOTE}.</div>
          <button
            onClick={() => setFeitosNoLote(0)}
            className="mt-4 rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page"
          >
            Próximos {LOTE}
          </button>
        </div>
      ) : (
        <CartaoDoFoco
          key={atual.id}
          lead={atual}
          estimativa={estimativa(atual)}
          cotacoes={cotacoes}
          modelos={modelos}
          origem={origem}
          agora={agora}
          posicao={feitosNoLote + 1}
          onFeito={() => {
            setFeitosNoLote((n) => n + 1);
            setPulados((p) => new Set(p).add(atual.id));
          }}
          onPular={() => setPulados((p) => new Set(p).add(atual.id))}
        />
      )}
    </div>
  );
}

function CartaoDoFoco({
  lead: l,
  estimativa,
  cotacoes,
  modelos,
  origem,
  agora,
  posicao,
  onFeito,
  onPular,
}: {
  lead: Lead;
  estimativa: Estimativa;
  cotacoes: Cotacoes;
  modelos: ModeloMensagem[];
  origem: string;
  agora: number;
  posicao: number;
  onFeito: () => void;
  onPular: () => void;
}) {
  const c = useContatoDoLead(l, modelos, origem);
  const quente = ehQuente(l, agora);
  const [canal, setCanal] = useState<'whatsapp' | 'email'>(
    c.linkWhats && c.wa?.celular ? 'whatsapp' : c.linkEmail ? 'email' : 'whatsapp'
  );
  const texto = canal === 'whatsapp' ? c.textoWhats : c.textoEmail;

  return (
    <div
      className={`rounded-[20px] border bg-card p-5 sm:p-7 ${quente ? 'border-[#ff6b3d]/50' : 'border-accent/30'} ${c.pending ? 'opacity-60' : ''}`}
    >
      <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
        {posicao} de {LOTE} · {c.etapa !== null ? NOME_DA_ETAPA[c.etapa] : 'conversa'}
      </div>
      <div className="flex items-start gap-3.5">
        <div
          className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-[14px] font-display text-[20px] font-bold tabular-nums ${corDaNota(l.score)}`}
        >
          {l.score}
        </div>
        <div className="min-w-0">
          <div className="font-display text-[20px] font-bold leading-tight sm:text-[24px]">{l.name}</div>
          <div className="mt-1 text-[13px] text-fg-tertiary">
            {[l.niche, [l.city, l.state].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}
            {l.rating !== null && (
              <span className="ml-1.5 inline-flex items-center gap-0.5">
                · <Star size={12} className="fill-current" /> {l.rating.toFixed(1)} ({l.reviewCount ?? 0})
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {quente && (
              <Selo tom="quente">
                <Flame size={11} /> abriu o diagnóstico {haQuanto(l.diagLastViewAt!, agora)}: ligue agora
              </Selo>
            )}
            {l.reasons.map((r) => (
              <Selo key={r}>{r}</Selo>
            ))}
          </div>
          {estimativa.unico > 0 && (
            <div className="mt-2">
              <ValorDoLead e={estimativa} cotacoes={cotacoes} />
            </div>
          )}
        </div>
      </div>

      {(c.linkWhats || c.linkEmail) && (
        <div className="mt-5">
          <div className="mb-2 flex gap-1.5">
            {c.linkWhats && (
              <button
                onClick={() => setCanal('whatsapp')}
                className={`rounded-full border px-3 py-1 text-[12px] font-bold ${canal === 'whatsapp' ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary'}`}
              >
                WhatsApp{c.wa && !c.wa.celular ? ' (fixo?)' : ''}
              </button>
            )}
            {c.linkEmail && (
              <button
                onClick={() => setCanal('email')}
                className={`rounded-full border px-3 py-1 text-[12px] font-bold ${canal === 'email' ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary'}`}
              >
                E-mail
              </button>
            )}
          </div>
          <div className="max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-[14px] border border-border bg-page/40 p-4 text-[13.5px] leading-relaxed text-fg-secondary">
            {canal === 'email' && c.assunto && <div className="mb-2 font-bold text-fg">{c.assunto}</div>}
            {texto || 'Sem modelo para esta etapa: a conversa abre sem texto.'}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {canal === 'whatsapp' && c.linkWhats && (
          <a
            href={c.linkWhats}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => c.setAbriu('whatsapp')}
            className="flex items-center gap-2 rounded-control bg-accent px-5 py-3 text-[14px] font-extrabold text-page"
          >
            <MessageCircle size={16} /> Abrir no WhatsApp
          </a>
        )}
        {canal === 'email' && c.linkEmail && (
          <a
            href={c.linkEmail}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => c.setAbriu('email')}
            className="flex items-center gap-2 rounded-control bg-accent px-5 py-3 text-[14px] font-extrabold text-page"
          >
            <Mail size={16} /> Abrir no Gmail
          </a>
        )}
        {l.phone && (
          <a
            href={`tel:${l.phone.replace(/[^\d+]/g, '')}`}
            className="flex items-center gap-2 rounded-control border border-border-strong px-4 py-3 text-[13.5px] font-bold text-fg-secondary hover:border-accent"
          >
            <Phone size={15} /> {l.phone}
          </a>
        )}
        <button
          onClick={() => c.enviei(onFeito)}
          className="rounded-control border border-accent/60 px-4 py-3 text-[13.5px] font-extrabold text-accent hover:bg-accent/10"
        >
          Enviei → próximo
        </button>
        <button
          onClick={onPular}
          className="flex items-center gap-1.5 px-2 py-3 text-[13px] font-bold text-fg-tertiary hover:text-fg"
        >
          <SkipForward size={14} /> Pular
        </button>
        {canal === 'whatsapp' && c.linkWhats && (
          <button onClick={c.semWhatsApp} className="px-2 py-3 text-[13px] font-bold text-fg-tertiary hover:text-fg">
            Sem WhatsApp
          </button>
        )}
        <button
          onClick={() => c.salvar({ status: 'nao_contatar' }, onPular)}
          title="Pediu para não ser contatado (LGPD)"
          className="flex items-center gap-1.5 px-2 py-3 text-[13px] font-bold text-fg-tertiary hover:text-error"
        >
          <Ban size={14} /> Não contatar
        </button>
      </div>
    </div>
  );
}
