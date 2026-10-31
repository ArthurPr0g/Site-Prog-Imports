'use client';

// Central de decisões (pedido do Arthur, 31/10/2026): um card por decisão que espera por ele, com de onde veio,
// o que decidir, o contexto, botões rápidos (as mesmas ações do WhatsApp) e uma caixa para responder livre.
// O link "Abrir decisões" dos avisos chega com #d-<id>: o navegador rola até o card e o :target o destaca.

import { useState, useTransition } from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, History, Send } from 'lucide-react';
import clsx from 'clsx';
import { responderNaCentral, type Decisao } from '@/app/actions/decisoes';

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

export function DecisoesPanel({ abertas, historico }: { abertas: Decisao[]; historico: Decisao[] }) {
  const pendentes = abertas.filter((d) => d.status === 'pendente');
  const enviadas = abertas.filter((d) => d.status === 'enviada');

  return (
    <div className="grid gap-8">
      <p className="text-[12.5px] text-fg-faded">
        Respostas em texto rodam no seu plano do Claude (pelo PC); se o PC estiver desligado, rodam quando ligar.
      </p>

      <section className="grid gap-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[.12em] text-fg-faded">
          Esperando você · {pendentes.length}
        </h2>
        {pendentes.length === 0 && (
          <div className="rounded-[20px] border border-border bg-card p-6 text-[14px] text-fg-tertiary">Nenhuma decisão pendente.</div>
        )}
        {pendentes.map((d) => (
          <CardDaDecisao key={d.id} d={d} />
        ))}
      </section>

      {enviadas.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[.12em] text-fg-faded">Com o Claude · {enviadas.length}</h2>
          {enviadas.map((d) => (
            <CardDaDecisao key={d.id} d={d} />
          ))}
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-fg-faded">
          <History className="h-3.5 w-3.5" strokeWidth={1.5} /> Histórico
        </h2>
        {historico.length === 0 && <div className="text-[13px] text-fg-faded">Nada resolvido ainda.</div>}
        {historico.map((d) => (
          <div key={d.id} id={`d-${d.id}`} className="flex flex-col gap-0.5 rounded-[14px] border border-border px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] text-fg-secondary">{d.titulo}</div>
              <div className="text-[12px] text-fg-faded">
                {d.origem} · {d.resposta ? `“${d.resposta.slice(0, 120)}”` : 'sem resposta registrada'}
              </div>
            </div>
            <div className="shrink-0 font-mono text-[11.5px] text-fg-faded">
              {d.resolvidaPor === 'painel' ? 'painel' : d.resolvidaPor === 'whatsapp' ? 'WhatsApp' : 'automático'} · {quando(d.resolvidaEm)}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function CardDaDecisao({ d }: { d: Decisao }) {
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, comecar] = useTransition();
  const enviada = d.status === 'enviada';

  const responder = (r: { opcaoId?: string; texto?: string }) =>
    comecar(async () => {
      const res = await responderNaCentral(d.id, r);
      setMsg({ ok: res.ok, texto: res.message });
      if (res.ok) setTexto('');
    });

  return (
    <article
      id={`d-${d.id}`}
      className="scroll-mt-24 rounded-[24px] border border-border bg-card p-5 transition-colors target:border-[#81AAF7]/60 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[.12em] text-fg-faded">
        <span className="rounded-md bg-[oklch(72%_.1_262/.18)] px-2 py-0.5 text-[#B1D2FF]">{d.origem}</span>
        <span className="flex items-center gap-1">
          <Clock3 className="h-3 w-3" strokeWidth={1.5} /> {quando(d.criadaEm)}
        </span>
      </div>

      <h3 className="mt-3 text-[18px] font-semibold leading-snug text-fg">{d.titulo}</h3>
      {d.resumo && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-fg-secondary">{d.resumo}</p>}
      {d.pergunta && <p className="mt-2 text-[13.5px] text-fg-tertiary">{d.pergunta}</p>}

      {(d.contexto.cliente || d.contexto.valores?.length || d.contexto.links?.length) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]">
          {d.contexto.cliente && <span className="rounded-full border border-border px-3 py-1 text-fg-secondary">{d.contexto.cliente}</span>}
          {d.contexto.valores?.map((v) => (
            <span key={v} className="rounded-full border border-border px-3 py-1 text-fg-tertiary">
              {v}
            </span>
          ))}
          {d.contexto.links?.map((l) => (
            <a
              key={l.url + l.rotulo}
              href={l.url}
              target={l.url.startsWith('http') && !l.url.includes('/admin/') ? '_blank' : undefined}
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[#91B7FE] hover:border-border-strong"
            >
              {l.rotulo} <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
            </a>
          ))}
        </div>
      )}

      {enviada ? (
        <div className="mt-5 flex items-start gap-2 rounded-[14px] border border-border px-4 py-3 text-[13px] text-fg-tertiary">
          <Send className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
          <div>
            <div className="text-fg-secondary">Enviado ao Claude (fila do PC) · aguardando</div>
            {d.resposta && <div className="mt-1">“{d.resposta.slice(0, 300)}”</div>}
          </div>
        </div>
      ) : (
        <>
          {d.opcoes.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {d.opcoes.map((o, i) => (
                <button
                  key={o.id}
                  disabled={pendente}
                  onClick={() => responder({ opcaoId: o.id })}
                  className={clsx(
                    'min-h-10 rounded-full px-4 text-[13.5px] font-medium transition-colors duration-150 disabled:opacity-50',
                    i === 0 ? 'bg-[#F2F3F5] text-[#08080A] hover:bg-white' : 'border border-border-strong text-fg-secondary hover:text-fg',
                  )}
                >
                  {o.titulo}
                </button>
              ))}
            </div>
          )}
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (texto.trim()) responder({ texto });
            }}
          >
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Ou responda do seu jeito, como um pedido ao Claude"
              className="min-h-[52px] w-full flex-1 resize-y rounded-[14px] border border-border bg-transparent px-4 py-3 text-[14px] text-fg placeholder:text-fg-faded focus:border-[#81AAF7] focus:outline-none"
            />
            <button
              type="submit"
              disabled={pendente || !texto.trim()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-border-strong px-4 text-[13.5px] font-medium text-fg-secondary hover:text-fg disabled:opacity-40"
            >
              <Send className="h-4 w-4" strokeWidth={1.5} /> Enviar
            </button>
          </form>
        </>
      )}

      {pendente && <div className="mt-3 text-[12.5px] text-fg-faded">Registrando a decisão…</div>}
      {msg && (
        <div className={clsx('mt-3 flex items-center gap-2 text-[13px]', msg.ok ? 'text-[#5FD37F]' : 'text-error')}>
          {msg.ok && <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />} {msg.texto}
        </div>
      )}
    </article>
  );
}
