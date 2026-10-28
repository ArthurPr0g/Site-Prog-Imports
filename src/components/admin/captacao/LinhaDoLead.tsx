'use client';

import Link from 'next/link';
import {
  MessageCircle,
  Phone,
  Mail,
  Globe,
  AtSign,
  MapPin,
  StickyNote,
  UserPlus,
  Star,
  FileSearch,
  Flame,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { resumoDoChecklist } from '@/lib/checklist-descoberta';
import { formatDateBR } from '@/lib/format';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  ENCERRADOS,
  urlComProtocolo,
  mapsDoLead,
  ehQuente,
  motivoFantasma,
  type Lead,
  type LeadStatus,
} from '@/lib/captacao';
import type { Cotacoes, Estimativa } from '@/lib/precos-captacao';
import type { ModeloMensagem } from '@/lib/mensagens-lead';
import { convertLeadToCustomerAction, criarPropostaAction } from '@/app/actions/leads';
import { inputClass, corDaNota, haQuanto, BotaoContato, ValorDoLead, Selo, ConfirmarEnvio, useContatoDoLead } from './comum';

export function LinhaDoLead({
  lead: l,
  estimativa: e,
  cotacoes,
  hoje,
  agora,
  modelos,
  origem,
  jaCliente,
  vendedor,
  onNotas,
  onChecklist,
}: {
  lead: Lead;
  estimativa: Estimativa;
  cotacoes: Cotacoes;
  hoje: string;
  agora: number;
  modelos: ModeloMensagem[];
  origem: string;
  jaCliente: boolean;
  /** Vendedor com link ativo que tem este lead. */
  vendedor?: string;
  onNotas: () => void;
  onChecklist: () => void;
}) {
  const c = useContatoDoLead(l, modelos, origem);
  const vencido = !ENCERRADOS.includes(l.status) && !!l.nextContact && l.nextContact <= hoje;
  const quente = ehQuente(l, agora);
  const fantasma = motivoFantasma(l, agora);
  const local = [l.city, l.state].filter(Boolean).join(' / ');
  const respondeu = ['respondeu', 'reuniao', 'proposta', 'fechado'].includes(l.status);

  return (
    <div
      className={`rounded-[18px] border bg-card p-4 sm:p-5 ${quente ? 'border-[#ff6b3d]/45' : 'border-border'} ${c.pending ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            title="Nota de 0 a 100: chance de precisar dos serviços e de responder"
            className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] font-display text-[16px] font-bold tabular-nums ${corDaNota(l.score)}`}
          >
            {l.score}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 font-bold leading-snug">
              {l.name} <span className="text-[11px] font-extrabold text-fg-faded">{l.country === 'US' ? 'EUA' : 'BR'}</span>
              {quente && (
                <Selo tom="quente" titulo="Abriu o diagnóstico nas últimas 48 h: bom momento para ligar">
                  <Flame size={11} /> abriu {l.diagViews}x · {haQuanto(l.diagLastViewAt!, agora)}
                </Selo>
              )}
              {!quente && l.diagViews > 0 && <Selo titulo="Aberturas do diagnóstico">viu o diagnóstico {l.diagViews}x</Selo>}
              {jaCliente && (
                <Selo tom="ok" titulo="Mesmo telefone ou e-mail de um cliente do ERP">
                  já é cliente
                </Selo>
              )}
              {vendedor && <Selo titulo="Está no link de um vendedor">com {vendedor}</Selo>}
              {fantasma && (
                <Selo tom="alerta" titulo="Fica fora do link do vendedor e do modo foco">
                  possível fantasma: {fantasma.toLowerCase()}
                </Selo>
              )}
              {l.lastReviewAt && !fantasma && (
                <Selo titulo="Avaliação mais recente no Google">última avaliação {haQuanto(l.lastReviewAt, agora)}</Selo>
              )}
            </div>
            <div className="mt-0.5 text-[12px] text-fg-tertiary">
              {[l.niche, l.category !== l.niche ? l.category : null, local].filter(Boolean).join(' · ') || '—'}
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
            {c.nomeDaEtapa && c.etapa! > 0 && (
              <div className={`mt-1.5 text-[12px] font-bold ${c.vence && c.vence <= hoje ? 'text-error' : 'text-fg-tertiary'}`}>
                Próximo: {c.nomeDaEtapa}
                {c.vence && ` · ${c.vence <= hoje ? 'vence hoje ou já venceu' : `em ${formatDateBR(`${c.vence}T12:00:00`)}`}`}
              </div>
            )}
            {resumoDoChecklist(l.discovery).length > 0 && (
              <button
                onClick={onChecklist}
                className="mt-2 block w-full rounded-[12px] border border-success/30 bg-success/[.06] px-3 py-2 text-left text-[12px] leading-relaxed text-fg-secondary hover:border-success/60"
              >
                <span className="font-extrabold text-success">Contexto do cliente</span>
                {l.discoveryBy && (
                  <span className="text-fg-faded">
                    {' '}
                    · {l.discoveryBy}
                    {l.discoveryAt && ` em ${formatDateBR(l.discoveryAt)}`}
                  </span>
                )}
                {resumoDoChecklist(l.discovery).map((linha) => (
                  <span key={linha} className="block">
                    {linha}
                  </span>
                ))}
              </button>
            )}
            {l.notes && (
              <div className="mt-1.5 line-clamp-3 whitespace-pre-line text-[12px] italic text-fg-tertiary">{l.notes}</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 lg:items-end">
          <div className="flex flex-wrap gap-1.5">
            {c.linkWhats && (
              <BotaoContato
                href={c.linkWhats}
                titulo={
                  c.wa?.celular
                    ? `WhatsApp: ${c.nomeDaEtapa ?? 'conversa'} com a mensagem pronta`
                    : 'WhatsApp (parece telefone fixo)'
                }
                destaque={c.wa?.celular}
                onClick={() => c.setAbriu('whatsapp')}
              >
                <MessageCircle size={14} />
              </BotaoContato>
            )}
            {l.phone && (
              <BotaoContato href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} titulo={`Ligar: ${l.phone}`} destaque={quente}>
                <Phone size={14} />
              </BotaoContato>
            )}
            {c.linkEmail && (
              <BotaoContato
                href={c.linkEmail}
                titulo={`E-mail pronto no Gmail (${c.nomeDaEtapa ?? 'conversa'}): ${l.email}`}
                destaque={!c.wa?.celular}
                onClick={() => c.setAbriu('email')}
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
            {/* ?previa=1: abrir pelo painel não conta como abertura do lead */}
            <BotaoContato href={`/diagnostico/${l.publicToken}?previa=1`} titulo="Diagnóstico (o link que vai na mensagem)">
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
            <button
              onClick={onChecklist}
              title="Checklist de descoberta"
              aria-label="Checklist de descoberta"
              className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent"
            >
              <ClipboardList size={14} />
            </button>
          </div>

          <ConfirmarEnvio c={c} />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={l.status}
              disabled={c.pending}
              onChange={(ev) => c.salvar({ status: ev.target.value as LeadStatus })}
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
                  disabled={c.pending}
                  onChange={(ev) => c.salvar({ nextContact: ev.target.value || null })}
                  title="Data do próximo contato"
                  aria-label="Data do próximo contato"
                  className={`${inputClass} w-[150px] py-1.5 text-[12.5px]`}
                />
              </label>
            )}
            {l.quoteId ? (
              <Link
                href="/admin/orcamentos-servicos"
                className="flex items-center gap-1 text-[12.5px] font-bold text-accent hover:underline"
              >
                <FileText size={13} /> Ver proposta
              </Link>
            ) : (
              respondeu &&
              l.country === 'BR' && (
                <button
                  onClick={() => c.executar(() => criarPropostaAction(l.id), true)}
                  disabled={c.pending}
                  title="Cria o cliente e o Orçamento de Serviço com os serviços sugeridos (combo aplicado)"
                  className="flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 text-[12.5px] font-extrabold text-page"
                >
                  <FileText size={13} /> Criar proposta
                </button>
              )
            )}
            {l.customerId ? (
              <Link href={`/admin/clientes/${l.customerId}`} className="text-[12.5px] font-bold text-accent hover:underline">
                Ver cliente
              </Link>
            ) : (
              respondeu && (
                <button
                  onClick={() => c.executar(async () => convertLeadToCustomerAction(l.id), true)}
                  disabled={c.pending}
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
