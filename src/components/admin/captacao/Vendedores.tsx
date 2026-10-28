'use client';

// Aba Vendedores: gera o link com os 20 melhores leads do filtro atual para
// um vendedor e acompanha o andamento de cada link.

import { useState, useTransition } from 'react';
import { Bot, Copy, ExternalLink, MessageCircle, Power } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatDateBR } from '@/lib/format';
import { LEAD_STATUS_LABEL, emailDeVerdade, type Lead, type LeadStatus } from '@/lib/captacao';
import { respondidas } from '@/lib/checklist-descoberta';
import { linkWhatsApp } from '@/lib/mensagens-lead';
import type { KitDoVendedor } from '@/lib/data/leads';
import { criarKitAction, alternarKitAction, adicionarAoKitAction, type FiltrosDoKit } from '@/app/actions/leads';
import { inputClass } from './comum';

const LIMITE = 20;
/** Número de WhatsApp da atendente de IA (chip da Vivo comprado em 27/10/2026). */
export const WHATSAPP_DA_IA = '5562996368281';
const ETAPAS_DO_RESUMO: LeadStatus[] = ['contatado', 'respondeu', 'reuniao', 'proposta', 'fechado', 'perdido'];

export function Vendedores({
  candidatos,
  kits,
  leadsPorId,
  origem,
  filtros,
}: {
  /** Leads do filtro atual que podem ir para um vendedor (novos, sem link ativo). */
  candidatos: Lead[];
  kits: KitDoVendedor[];
  leadsPorId: Map<string, Lead>;
  origem: string;
  /** Filtros atuais do painel: ficam guardados no link para o "Adicionar mais 20". */
  filtros: FiltrosDoKit;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [nome, setNome] = useState('Felipe');
  const [whats, setWhats] = useState('');
  const [email, setEmail] = useState('');
  const [recado, setRecado] = useState('');
  const [novo, setNovo] = useState<{ token: string; nome: string; whats: string } | null>(null);
  // Link da IA: a atendente chega por e-mail, então só leads com e-mail.
  const [ia, setIa] = useState(false);
  const escolhidos = (ia ? candidatos.filter((l) => l.email && emailDeVerdade(l.email)) : candidatos).slice(0, LIMITE);

  function alternarIa(v: boolean) {
    setIa(v);
    if (v) {
      setNome('Lia');
      setWhats(WHATSAPP_DA_IA);
    } else {
      setNome('Felipe');
      setWhats('');
    }
  }
  const url = (token: string) => `${origem}/vendedor/${token}`;

  function gerar() {
    startTransition(async () => {
      const r = await criarKitAction({
        leadIds: escolhidos.map((l) => l.id),
        sellerName: nome,
        sellerWhatsapp: whats,
        sellerEmail: email,
        instructions: recado,
        filtros,
        ia,
      });
      toast(r);
      if (r.ok && r.token) setNovo({ token: r.token, nome: nome.trim(), whats: whats.replace(/\D/g, '') });
    });
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ ok: true, message: 'Link copiado.' });
    } catch {
      toast({ ok: false, message: 'Não deu para copiar: selecione o link e copie.' });
    }
  }

  const mensagemPara = (n: string, token: string) =>
    `Oi, ${n}! Aqui está sua página com os leads para contato, mensagens prontas, roteiro de venda e simulador de preços: ${url(token)}\nQualquer dúvida, me chama.`;

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Novo link para vendedor</div>
        <p className="mb-3 text-[12.5px] leading-relaxed text-fg-tertiary">
          Leva os {LIMITE} leads de maior nota da lista atual (use os filtros de ramo, cidade, país e nota antes), que ainda estão
          como Novo e não estão com outro vendedor. As mensagens e o diagnóstico saem no nome do vendedor, e o que ele registrar
          volta para cá.
        </p>
        <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-border bg-page/40 px-3 py-2.5 text-[13px]">
          <input type="checkbox" checked={ia} onChange={(e) => alternarIa(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
          <span>
            <b className="flex items-center gap-1.5">
              <Bot size={14} /> Link da atendente de IA
            </b>
            <span className="text-fg-tertiary">
              A IA manda o 1º contato por e-mail (só leads com e-mail) e atende quem chamar no WhatsApp dela. Acompanhe na aba
              Atendimento.
            </span>
          </span>
        </label>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do vendedor"
            className={inputClass}
            aria-label="Nome do vendedor"
          />
          <input
            value={whats}
            onChange={(e) => setWhats(e.target.value)}
            placeholder="WhatsApp dele (com DDD)"
            inputMode="tel"
            className={inputClass}
            aria-label="WhatsApp do vendedor"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail dele (opcional)"
            className={inputClass}
            aria-label="E-mail do vendedor"
          />
          <textarea
            value={recado}
            onChange={(e) => setRecado(e.target.value)}
            rows={2}
            placeholder="Recado para o topo da página (opcional). Ex.: comece pelos quentes; me avise de cada reunião marcada."
            className={`resize-y sm:col-span-3 ${inputClass}`}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={gerar}
            disabled={pending || escolhidos.length === 0 || !nome.trim()}
            className="rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-50"
          >
            Gerar link com {escolhidos.length} lead(s)
          </button>
          <span className="text-[12px] text-fg-tertiary">
            {escolhidos.length
              ? `Do ${escolhidos[0].name} (nota ${escolhidos[0].score}) ao ${escolhidos.at(-1)!.name} (nota ${escolhidos.at(-1)!.score})`
              : 'Nenhum lead livre com esses filtros.'}
          </span>
        </div>

        {novo && (
          <div className="mt-4 rounded-[14px] border border-accent/40 bg-accent/[.06] p-3.5">
            <div className="mb-1.5 text-[12.5px] font-extrabold text-accent">Link do {novo.nome} pronto</div>
            <div className="break-all text-[13px] font-bold">{url(novo.token)}</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                onClick={() => copiar(url(novo.token))}
                className="flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-1.5 text-[12.5px] font-bold"
              >
                <Copy size={13} /> Copiar link
              </button>
              {novo.whats && (
                <a
                  href={linkWhatsApp(
                    novo.whats.length <= 11 ? `55${novo.whats}` : novo.whats,
                    mensagemPara(novo.nome, novo.token)
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 text-[12.5px] font-extrabold text-page"
                >
                  <MessageCircle size={13} /> Mandar no WhatsApp dele
                </a>
              )}
              <a
                href={url(novo.token)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-1.5 text-[12.5px] font-bold"
              >
                <ExternalLink size={13} /> Abrir como ele vê
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Links enviados</div>
        {kits.length === 0 ? (
          <div className="text-[13px] text-fg-tertiary">Nenhum link ainda.</div>
        ) : (
          <div className="space-y-2.5">
            {kits.map((k) => {
              const leads = k.leadIds.map((id) => leadsPorId.get(id)).filter((l): l is Lead => !!l);
              const contagem = ETAPAS_DO_RESUMO.map((s) => [s, leads.filter((l) => l.status === s).length] as const).filter(
                ([, n]) => n > 0
              );
              const comChecklist = leads.filter((l) => respondidas(l.discovery) > 0).length;
              const aContatar = leads.filter((l) => l.status === 'novo').length;
              return (
                <div
                  key={k.id}
                  className={`rounded-[14px] border border-border bg-page/40 p-3.5 ${k.active ? '' : 'opacity-55'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[14px] font-extrabold">
                      {k.kind === 'ia' && (
                        <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 align-middle text-[11px] text-accent">
                          <Bot size={11} /> IA
                        </span>
                      )}
                      {k.sellerName}{' '}
                      <span className="text-[12px] font-bold text-fg-faded">
                        · {leads.length} lead(s) · desde {formatDateBR(k.createdAt)} {k.active ? '' : '· desativado'}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => copiar(url(k.token))}
                        title="Copiar link"
                        aria-label="Copiar link"
                        className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:text-accent"
                      >
                        <Copy size={13} />
                      </button>
                      <a
                        href={url(k.token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir como ele vê"
                        aria-label="Abrir como ele vê"
                        className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:text-accent"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <button
                        onClick={() => startTransition(async () => toast(await alternarKitAction(k.id, !k.active)))}
                        title={k.active ? 'Desativar link' : 'Reativar link'}
                        aria-label={k.active ? 'Desativar link' : 'Reativar link'}
                        className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:text-error"
                      >
                        <Power size={13} />
                      </button>
                    </div>
                  </div>
                  {k.moreRequestedAt && k.active && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[12px] border border-accent/50 bg-accent/[.08] px-3 py-2 text-[12.5px]">
                      <b className="text-accent">{k.sellerName} pediu mais leads</b>
                      <span className="text-fg-tertiary">em {formatDateBR(k.moreRequestedAt)}</span>
                    </div>
                  )}
                  {k.active && (
                    <button
                      onClick={() => startTransition(async () => toast(await adicionarAoKitAction(k.id)))}
                      disabled={pending}
                      title="Os próximos 20 de maior nota, com os mesmos filtros de quando o link foi gerado"
                      className={`mt-2 rounded-control px-3 py-1.5 text-[12.5px] font-extrabold disabled:opacity-50 ${
                        k.moreRequestedAt ? 'bg-accent text-page' : 'border border-border-strong text-fg-secondary'
                      }`}
                    >
                      Adicionar mais 20
                    </button>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-bold">
                    <span className="rounded-full bg-fg-faded/12 px-2 py-0.5 text-fg-secondary">{aContatar} a contatar</span>
                    {contagem.map(([s, n]) => (
                      <span key={s} className="rounded-full bg-accent/12 px-2 py-0.5 text-accent">
                        {n} {LEAD_STATUS_LABEL[s].toLowerCase()}
                      </span>
                    ))}
                    {comChecklist > 0 && (
                      <span className="rounded-full bg-success/12 px-2 py-0.5 text-success">{comChecklist} com checklist</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
