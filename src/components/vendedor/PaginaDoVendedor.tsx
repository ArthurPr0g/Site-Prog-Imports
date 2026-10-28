'use client';

// Página do vendedor: leads (quadro ou lista), simulador de preços, perguntas
// difíceis e o passo a passo da venda. Funciona igual no celular e no computador.

import { useMemo, useState } from 'react';
import { LayoutGrid, List, Calculator, HelpCircle, Route, Flame, ClipboardCheck, MessageCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Kanban } from '@/components/kanban/Kanban';
import { formatMoeda } from '@/lib/precos-captacao';
import { proximaEtapa, NOME_DA_ETAPA, type LeadStatus } from '@/lib/captacao';
import { respondidas } from '@/lib/checklist-descoberta';
import { REGRAS_DE_OURO } from '@/lib/perguntas-dificeis';
import {
  ETAPAS_DO_VENDEDOR,
  ETAPAS_QUE_O_VENDEDOR_MARCA,
  tituloDaEtapa,
  primeiroNome,
  comoLeadDoPainel,
  colunaDoVendedor,
  type Kit,
  type LeadDoKit,
} from '@/lib/vendedor';
import type { Escolha } from '@/lib/simulador';
import { registrarPeloVendedorAction } from '@/app/actions/vendedor';
import { Simulador } from './Simulador';
import { PerguntasDificeis, PerguntarAoArthur } from './PerguntasDificeis';
import { LeadDoVendedor } from './LeadDoVendedor';

type Aba = 'leads' | 'simulador' | 'perguntas' | 'como';

/** Pré-seleção do simulador a partir dos serviços sugeridos do lead. */
function escolhaDoLead(l: LeadDoKit): Partial<Escolha> {
  const s = l.suggested_services.join(' ');
  const nivel = (/Premium|Avançado/.test(s) ? 2 : /Profissional|Intermediário/.test(s) ? 1 : 0) as 0 | 1 | 2;
  const temGestao = s.includes('Sistema');
  const produto = s.includes('Loja') ? 'loja' : s.includes('Site') ? 'site' : temGestao ? 'erp' : 'site';
  return { produto, nivel, comGestao: temGestao && produto !== 'erp', nivelGestao: 0, marca: 0 };
}

function CartaoDoLead({ l, agora }: { l: LeadDoKit; agora: number }) {
  const quente = !!l.diag_last_view_at && agora - Date.parse(l.diag_last_view_at) < 48 * 3600 * 1000;
  const prox = proximaEtapa(comoLeadDoPainel(l));
  const hoje = new Date(agora).toISOString().slice(0, 10);
  const retornoHoje = !!prox && prox.etapa > 0 && !!prox.vence && prox.vence <= hoje;
  return (
    <div className={`rounded-[12px] border bg-page/60 p-3 ${quente ? 'border-[#ff6b3d]/50' : 'border-border'}`}>
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[9px] bg-accent text-[12.5px] font-bold text-page">
          {l.score}
        </span>
        <div className="min-w-0">
          <div className="line-clamp-2 text-[13.5px] font-bold leading-snug">
            {quente && <Flame size={12} className="mr-1 inline text-[#ff8a5c]" />}
            {l.name}
          </div>
          <div className="truncate text-[11.5px] text-fg-tertiary">{[l.niche, l.city].filter(Boolean).join(' · ')}</div>
          <div className="text-[12px] font-bold text-fg-secondary">
            {formatMoeda(l.one_time, l.currency)}
            {l.monthly > 0 && ` + ${formatMoeda(l.monthly, l.currency)}/mês`}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[10.5px] font-bold">
            {retornoHoje && (
              <span className="rounded-full bg-error/12 px-1.5 py-0.5 text-error">
                retorno hoje: {NOME_DA_ETAPA[prox!.etapa]}
              </span>
            )}
            {respondidas(l.discovery) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-success/12 px-1.5 py-0.5 text-success">
                <ClipboardCheck size={10} /> checklist
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaginaDoVendedor({
  kit,
  token,
  origem,
  whatsArthur,
}: {
  kit: Kit;
  token: string;
  origem: string;
  whatsArthur: string;
}) {
  const toast = useToast();
  const [agora] = useState(() => Date.now());
  const [aba, setAba] = useState<Aba>('leads');
  const [vista, setVista] = useState<'quadro' | 'lista'>('quadro');
  const [aberto, setAberto] = useState<string | null>(null);
  const [presetSimulador, setPresetSimulador] = useState<{
    chave: number;
    escolha: Partial<Escolha>;
    moeda: 'BRL' | 'USD';
  } | null>(null);
  const vendedor = primeiroNome(kit.seller_name);
  const leadAberto = kit.leads.find((l) => l.id === aberto) ?? null;

  const progresso = useMemo(() => {
    const total = kit.leads.length;
    const conta = (s: LeadStatus[]) => kit.leads.filter((l) => s.includes(l.status)).length;
    return {
      total,
      contatados: total - conta(['novo']),
      conversas: conta(['respondeu', 'reuniao', 'proposta', 'fechado']),
      propostas: conta(['proposta', 'fechado']),
      checklists: kit.leads.filter((l) => respondidas(l.discovery) > 0).length,
    };
  }, [kit.leads]);

  // Ordem da lista: quem abriu o diagnóstico, depois quem tem retorno, depois nota.
  const ordenados = useMemo(
    () =>
      [...kit.leads].sort((a, b) => {
        const q = (l: LeadDoKit) => (l.diag_last_view_at ? Date.parse(l.diag_last_view_at) : 0);
        return q(b) - q(a) || b.score - a.score;
      }),
    [kit.leads]
  );

  const abas: [Aba, string, typeof LayoutGrid][] = [
    ['leads', 'Leads', LayoutGrid],
    ['simulador', 'Simulador', Calculator],
    ['perguntas', 'Perguntas difíceis', HelpCircle],
    ['como', 'Como vender', Route],
  ];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 [color-scheme:dark] sm:px-6 sm:py-8">
      <header className="mb-5">
        <div className="text-[12px] font-extrabold uppercase tracking-[.14em] text-accent">Prog Soluções · área do vendedor</div>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight sm:text-[32px]">Olá, {vendedor}!</h1>
        <p className="mt-1 text-[14px] text-fg-tertiary">
          {progresso.total} empresas para você contatar, com análise, mensagens prontas, roteiro de venda e simulador de preços.
        </p>
        {kit.instructions && (
          <div className="mt-3 rounded-[14px] border border-accent/40 bg-accent/[.06] p-3.5 text-[14px] leading-relaxed">
            <b className="text-accent">Recado do Arthur:</b> {kit.instructions}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            ['Contatados', `${progresso.contatados} de ${progresso.total}`],
            ['Em conversa', String(progresso.conversas)],
            ['Querem proposta', String(progresso.propostas)],
            ['Checklists feitos', String(progresso.checklists)],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-[14px] border border-border bg-card p-3">
              <div className="text-[10.5px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{rotulo}</div>
              <div className="mt-1 font-display text-[22px] font-bold tabular-nums">{valor}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg-faded/15">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.round((progresso.contatados / Math.max(1, progresso.total)) * 100)}%` }}
          />
        </div>
      </header>

      <nav className="sticky top-0 z-20 -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border bg-page/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        {abas.map(([a, nome, Icone]) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13.5px] font-bold ${aba === a ? 'border-accent text-accent' : 'border-transparent text-fg-tertiary hover:text-fg'}`}
          >
            <Icone size={15} /> {nome}
          </button>
        ))}
      </nav>

      {aba === 'leads' && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-fg-tertiary">
              {vista === 'quadro'
                ? 'Arraste o cartão para mudar a etapa (no celular: segure um instante e arraste). Toque para abrir.'
                : 'Toque numa empresa para ver tudo sobre ela.'}
            </p>
            <div className="flex gap-1">
              {(
                [
                  ['quadro', 'Quadro', LayoutGrid],
                  ['lista', 'Lista', List],
                ] as const
              ).map(([v, nome, Icone]) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${vista === v ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary'}`}
                >
                  <Icone size={13} /> {nome}
                </button>
              ))}
            </div>
          </div>

          {vista === 'quadro' ? (
            <Kanban
              colunas={ETAPAS_DO_VENDEDOR}
              itens={ordenados}
              idDe={(l) => l.id}
              colunaDe={(l) => colunaDoVendedor(l.status)}
              aoAbrir={(l) => setAberto(l.id)}
              aoMover={async (l, status) => {
                if (!ETAPAS_QUE_O_VENDEDOR_MARCA.includes(status)) {
                  toast({
                    ok: false,
                    message:
                      status === 'fechado'
                        ? 'Fechamento é com o Arthur: marque "Quer proposta".'
                        : 'Essa etapa não pode ser escolhida.',
                  });
                  return false;
                }
                const r = await registrarPeloVendedorAction(token, l.id, { status });
                if (!r.ok) toast(r);
                return r.ok;
              }}
              cartao={(l) => <CartaoDoLead l={l} agora={agora} />}
            />
          ) : (
            <div className="space-y-2">
              {ordenados.map((l) => (
                <button key={l.id} onClick={() => setAberto(l.id)} className="block w-full text-left">
                  <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card p-1 pr-3 hover:border-accent/50">
                    <div className="min-w-0 flex-1">
                      <CartaoDoLead l={l} agora={agora} />
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-fg-faded/12 px-2.5 py-1 text-[11.5px] font-bold text-fg-secondary">
                      {tituloDaEtapa(l.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {aba === 'simulador' && (
        <Simulador
          key={presetSimulador?.chave ?? 0}
          catalogo={kit.catalog}
          inicial={presetSimulador?.escolha}
          moedaInicial={presetSimulador?.moeda ?? 'BRL'}
        />
      )}

      {aba === 'perguntas' && <PerguntasDificeis whatsArthur={whatsArthur} vendedor={vendedor} />}

      {aba === 'como' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Passo a passo de cada empresa
            </div>
            <ol className="space-y-2.5 text-[14px] leading-relaxed">
              <li>
                <b>1. Abra o card</b> e leia a aba Análise: é o motivo do contato (sem site, site fora do ar, domínio à venda…).
              </li>
              <li>
                <b>2. Mande a mensagem pronta</b> (aba Contato e mensagens) e toque em &quot;Enviei&quot;. O retorno do dia 3
                aparece sozinho.
              </li>
              <li>
                <b>3. Quando responder</b>, siga a aba Como agir: abertura, perguntas, argumentos e respostas para objeções.
              </li>
              <li>
                <b>4. Preencha o Checklist</b> durante a conversa: decisor, dores, urgência, investimento.
              </li>
              <li>
                <b>5. Use o Simulador</b> se perguntarem preço, e mande o resumo copiado.
              </li>
              <li>
                <b>6. Topou?</b> Mude para &quot;Quer proposta&quot;: o Arthur monta a proposta e o contrato.
              </li>
            </ol>
          </section>
          <section className="rounded-[18px] border border-accent/40 bg-accent/[.06] p-4 sm:p-5">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">Regras de ouro</div>
            <ul className="space-y-2 text-[14px] leading-relaxed">
              {REGRAS_DE_OURO.map((r) => (
                <li key={r}>• {r}</li>
              ))}
              <li>• Quem abriu o diagnóstico aparece com a chama laranja: é a melhor hora para ligar.</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <PerguntarAoArthur whatsArthur={whatsArthur} vendedor={vendedor} />
              <a
                href="https://portfolio-arthur-prog.vercel.app/pt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-bold"
              >
                <MessageCircle size={15} /> Portfólio para mostrar ao cliente
              </a>
            </div>
          </section>
        </div>
      )}

      {leadAberto && (
        <LeadDoVendedor
          key={leadAberto.id}
          lead={leadAberto}
          kit={kit}
          token={token}
          origem={origem}
          whatsArthur={whatsArthur}
          onFechar={() => setAberto(null)}
          onSimular={() => {
            setPresetSimulador({ chave: Date.now(), escolha: escolhaDoLead(leadAberto), moeda: leadAberto.currency });
            setAberto(null);
            setAba('simulador');
          }}
        />
      )}
    </main>
  );
}
