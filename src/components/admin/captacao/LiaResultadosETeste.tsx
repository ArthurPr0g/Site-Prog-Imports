'use client';

// Aba Atendimento (pedido do dono em 28/10/2026):
// - Resultados da Lia: custo por conversa, por proposta e por venda (em dólar e
//   reais) e onde as conversas param, com a última fala da Lia antes do silêncio.
// - Testar a Lia: simulador. Você escreve como se fosse o cliente (pode fingir
//   ser um lead real, para ela usar o diagnóstico dele); nada sai pelo WhatsApp e
//   nada muda no lead. Serve para conferir a Lia depois de mexer nas instruções.

import { useEffect, useState, useTransition } from 'react';
import { BarChart3, FlaskConical, RotateCcw, Send } from 'lucide-react';
import type { Lead } from '@/lib/captacao';
import type { MensagemDoPainel } from '@/lib/atendente/regras';
import {
  resultadosDaLiaAction,
  novaConversaDeTesteAction,
  mensagemDeTesteAction,
  type ResultadosDaLia,
} from '@/app/actions/atendente';
import { inputClass } from './comum';

const dinheiro = (usd: number | null, cotacao: number | null) => {
  if (usd === null) return '–';
  const reais = cotacao ? ` · R$ ${(usd * cotacao).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
  return `US$ ${usd.toFixed(2).replace('.', ',')}${reais}`;
};

/* ------------------------------------------------------------ resultados */

export function ResultadosDaLiaPainel({ cotacaoDolar, aoAbrir }: { cotacaoDolar: number | null; aoAbrir: (id: string) => void }) {
  const [r, setR] = useState<ResultadosDaLia | null>(null);
  useEffect(() => {
    let vivo = true;
    resultadosDaLiaAction()
      .then((x) => vivo && setR(x))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  if (!r) return null;
  const por = (n: number) => (n > 0 ? r.gastoTotal / n : null);
  return (
    <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
        <BarChart3 size={13} /> Resultados da Lia (sem os testes)
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Numero rotulo={`Gasto em ${r.conversas} conversa${r.conversas === 1 ? '' : 's'}`} valor={dinheiro(r.gastoTotal, cotacaoDolar)} />
        <Numero rotulo="Por conversa" valor={dinheiro(por(r.conversas), cotacaoDolar)} />
        <Numero rotulo={`Por proposta (${r.propostas})`} valor={dinheiro(por(r.propostas), cotacaoDolar)} />
        <Numero rotulo={`Por venda (${r.fechados})`} valor={r.fechados ? dinheiro(por(r.fechados), cotacaoDolar) : 'nenhuma venda ainda'} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[12px] bg-page/40 p-3 text-[12.5px]">
          <div className="mb-1 font-extrabold">Até o preço</div>
          {r.mensagensDoClienteAtePreco === null ? (
            <span className="text-fg-tertiary">Nenhuma conversa chegou ao preço ainda.</span>
          ) : (
            <span>
              O cliente mandou, em média, <b>{r.mensagensDoClienteAtePreco.toFixed(1).replace('.', ',')} mensagens</b> até ver o preço.
              Quanto menos, menos gente desiste no caminho.
            </span>
          )}
        </div>
        <div className="rounded-[12px] bg-page/40 p-3 text-[12.5px]">
          <div className="mb-1 font-extrabold">Onde as conversas param (2+ dias sem resposta)</div>
          {r.paradas.length === 0 ? (
            <span className="text-fg-tertiary">Nenhuma conversa parada.</span>
          ) : (
            <ul className="space-y-0.5">
              {r.paradas.map((p) => (
                <li key={p.etapa}>
                  <b className="tabular-nums">{p.quantas}</b> {p.etapa}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {r.exemplos.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[12px] font-extrabold text-fg-tertiary">Última fala da Lia antes do silêncio</div>
          <ul className="space-y-1.5">
            {r.exemplos.map((x) => (
              <li key={x.conversaId}>
                <button
                  onClick={() => aoAbrir(x.conversaId)}
                  className="w-full rounded-[10px] border border-border px-3 py-2 text-left text-[12.5px] hover:border-accent/60"
                >
                  <b>{x.quem}</b>
                  <span className="text-fg-faded">
                    {' '}
                    · parou {x.etapa} · há {x.paradaHa} dia{x.paradaHa === 1 ? '' : 's'}
                  </span>
                  {x.ultimaDaLia && <div className="mt-0.5 line-clamp-2 text-fg-secondary">“{x.ultimaDaLia}”</div>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-[12px] bg-page/40 px-3 py-2">
      <div className="text-[11px] font-bold text-fg-tertiary">{rotulo}</div>
      <div className="text-[14px] font-extrabold tabular-nums">{valor}</div>
    </div>
  );
}

/* ------------------------------------------------------------ simulador */

export function TestarALia({ leads }: { leads: Lead[] }) {
  const [busca, setBusca] = useState('');
  const [leadId, setLeadId] = useState<string | null>(null);
  const [conversa, setConversa] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDoPainel[]>([]);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const achados =
    busca.trim().length >= 2 ? leads.filter((l) => l.name.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 6) : [];
  const escolhido = leads.find((l) => l.id === leadId) ?? null;

  const comecar = () =>
    start(async () => {
      setAviso(null);
      const r = await novaConversaDeTesteAction(leadId).catch(() => ({ erro: 'Falha de conexão.' }));
      if ('erro' in r) return setAviso(r.erro);
      setConversa(r.id);
      setMensagens([]);
    });

  // Opções para tocar da última mensagem da Lia (no WhatsApp viram botões).
  const ultima = mensagens.at(-1);
  const opcoes =
    ultima?.author === 'ia' ? (ultima.body.match(/\n\[opções: ([^\]]+)\]$/)?.[1].split(' | ').filter(Boolean) ?? []) : [];

  const enviar = (escolhida?: string) =>
    start(async () => {
      const t = escolhida ?? texto;
      if (!conversa || !t.trim()) return;
      if (!escolhida) setTexto('');
      setMensagens((m) => [
        ...m,
        { id: `local-${m.length}`, direction: 'in', author: 'lead', body: t, status: null, error: null, createdAt: new Date().toISOString() },
      ]);
      const r = await mensagemDeTesteAction(conversa, t).catch(() => ({ mensagens: [], aviso: 'Falha de conexão.' }));
      if (r.mensagens.length) setMensagens(r.mensagens);
      setAviso(r.aviso);
    });

  return (
    <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
        <FlaskConical size={13} /> Testar a Lia
      </div>
      <p className="mb-3 text-[12.5px] text-fg-tertiary">
        Escreva como se fosse o cliente. Nada sai pelo WhatsApp, nenhum lead muda e o teste não conta nos resultados. Escolha um
        lead para a Lia usar o diagnóstico dele, ou teste sem lead.
      </p>

      {!conversa ? (
        <div className="space-y-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Fingir ser um lead (busque pelo nome) ou deixe em branco"
            className={`w-full ${inputClass}`}
          />
          {achados.length > 0 && !escolhido && (
            <ul className="space-y-1">
              {achados.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => {
                      setLeadId(l.id);
                      setBusca(l.name);
                    }}
                    className="w-full rounded-[10px] border border-border px-3 py-1.5 text-left text-[12.5px] hover:border-accent/60"
                  >
                    <b>{l.name}</b> <span className="text-fg-faded">· {l.niche ?? l.category ?? 'sem ramo'} · {l.city ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={comecar}
              disabled={pending}
              className="rounded-control bg-accent px-4 py-2 text-[13px] font-extrabold text-page disabled:opacity-50"
            >
              {escolhido ? `Começar teste como ${escolhido.name}` : 'Começar teste sem lead'}
            </button>
            {escolhido && (
              <button
                onClick={() => {
                  setLeadId(null);
                  setBusca('');
                }}
                className="text-[12.5px] font-bold text-fg-tertiary"
              >
                limpar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-page/40">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-[12.5px]">
            <span className="font-extrabold">{escolhido ? `Você é: ${escolhido.name}` : 'Você é: cliente sem cadastro'}</span>
            <button
              onClick={() => {
                setConversa(null);
                setMensagens([]);
                setAviso(null);
              }}
              className="flex items-center gap-1 text-[12px] font-bold text-accent"
            >
              <RotateCcw size={12} /> Novo teste
            </button>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
            {mensagens.length === 0 && <div className="text-[12.5px] text-fg-tertiary">Mande a primeira mensagem, como um cliente faria (ex.: &quot;oi&quot;).</div>}
            {mensagens.map((m) =>
              m.author === 'sistema' ? (
                <div key={m.id} className="text-center text-[11.5px] text-fg-faded">
                  {m.body}
                </div>
              ) : (
                <div key={m.id} className={`flex ${m.direction === 'in' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-[14px] px-3 py-2 text-[13px] leading-snug ${
                      m.direction === 'in' ? 'bg-accent/15' : 'bg-card'
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              )
            )}
            {!pending && opcoes.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {opcoes.map((o) => (
                  <button
                    key={o}
                    onClick={() => enviar(o)}
                    className="rounded-full border border-accent/60 px-3 py-1 text-[12.5px] font-bold text-accent"
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
            {pending && <div className="text-[12px] text-fg-faded">A Lia está escrevendo…</div>}
          </div>
          {aviso && <div className="px-3 pb-2 text-[12px] text-error">A Lia não respondeu: {aviso}</div>}
          <div className="flex items-end gap-2 border-t border-border p-2.5">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={2}
              placeholder="Escreva como o cliente"
              className={`flex-1 resize-none ${inputClass}`}
            />
            <button
              onClick={() => enviar()}
              disabled={pending || !texto.trim()}
              aria-label="Enviar"
              className="grid h-11 w-11 place-items-center rounded-full bg-accent text-page disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
