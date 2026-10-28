'use client';

// Detalhe de um lead na página do vendedor, em abas: Análise, Contato e
// mensagens, Oportunidade, Como agir, Checklist e Registro.

import { useState, useTransition } from 'react';
import { X, MessageCircle, Mail, Phone, Globe, AtSign, MapPin, FileSearch, Copy, Check, Star, Flame } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ChecklistForm } from '@/components/checklist/ChecklistForm';
import { whatsappDoLead, proximaEtapa, situacaoDoSite, urlComProtocolo, NOME_DA_ETAPA, CANAL_DA_ETAPA } from '@/lib/captacao';
import { formatMoeda } from '@/lib/precos-captacao';
import {
  idiomaDoLead,
  variaveisDoLead,
  preencher,
  linkWhatsApp,
  linkGmail,
  escolherModelo,
  varianteDoLead,
} from '@/lib/mensagens-lead';
import { roteiroDoLead } from '@/lib/roteiro-venda';
import {
  ETAPAS_QUE_O_VENDEDOR_MARCA,
  tituloDaEtapa,
  comoLeadDoPainel,
  primeiroNome,
  type Kit,
  type LeadDoKit,
} from '@/lib/vendedor';
import { registrarPeloVendedorAction, salvarChecklistDoVendedorAction } from '@/app/actions/vendedor';
import { PerguntarAoArthur } from './PerguntasDificeis';

const ABAS = [
  ['analise', 'Análise'],
  ['contato', 'Contato e mensagens'],
  ['oportunidade', 'Oportunidade'],
  ['agir', 'Como agir'],
  ['checklist', 'Checklist'],
  ['registro', 'Registro'],
] as const;
type Aba = (typeof ABAS)[number][0];

const SITUACAO: Record<string, string> = {
  sem_site: 'Sem site próprio',
  rede_social: 'Usa rede social no lugar de site',
  parado: 'Domínio do site à venda (site perdido)',
  fora: 'Site fora do ar',
  sem_celular: 'Site não se adapta ao celular',
  sem_https: 'Site aparece como "não seguro"',
  vende_online: 'Já vende online',
  ok: 'Site funcionando',
};

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border border-border bg-card p-4">
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{titulo}</div>
      {children}
    </section>
  );
}

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          /* sem permissão: o texto está na tela para copiar à mão */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-[12.5px] font-bold text-fg-secondary"
    >
      {ok ? <Check size={13} /> : <Copy size={13} />} {ok ? 'Copiado' : 'Copiar texto'}
    </button>
  );
}

export function LeadDoVendedor({
  lead: l,
  kit,
  token,
  origem,
  whatsArthur,
  onFechar,
  onSimular,
}: {
  lead: LeadDoKit;
  kit: Kit;
  token: string;
  origem: string;
  whatsArthur: string;
  onFechar: () => void;
  onSimular: () => void;
}) {
  const toast = useToast();
  const [aba, setAba] = useState<Aba>('analise');
  const [pending, startTransition] = useTransition();
  // Lido uma vez ao abrir: o selo "quente" não precisa mudar com a tela aberta.
  const [agora] = useState(() => Date.now());
  const [nota, setNota] = useState('');
  const vendedor = primeiroNome(kit.seller_name);
  const adaptado = comoLeadDoPainel(l);
  const lang = idiomaDoLead(adaptado);
  const remetente = { nome: vendedor, assinatura: kit.seller_name, kit: token };
  const vars = variaveisDoLead(adaptado, lang, origem, remetente);
  const variante = varianteDoLead(adaptado, kit.templates);
  const prox = proximaEtapa(adaptado);
  const [etapa, setEtapa] = useState(prox?.etapa ?? 0);
  const canal = CANAL_DA_ETAPA[etapa];
  const mW = escolherModelo(kit.templates, 'whatsapp', lang, etapa, variante);
  const mE = escolherModelo(kit.templates, 'email', lang, etapa, variante);
  const textoW = mW ? preencher(mW.body, vars) : '';
  const assunto = mE ? preencher(mE.subject ?? '', vars) : '';
  const textoE = mE ? preencher(mE.body, vars) : '';
  const wa = l.sem_whatsapp ? null : whatsappDoLead(l.phone, l.country);
  const roteiro = roteiroDoLead(l);
  const sit = situacaoDoSite(l.website, l.site_check);
  const m = (v: number) => formatMoeda(v, l.currency);
  const quente = !!l.diag_last_view_at && agora - Date.parse(l.diag_last_view_at) < 48 * 3600 * 1000;

  function registrar(dados: Parameters<typeof registrarPeloVendedorAction>[2], aviso = true) {
    startTransition(async () => {
      const r = await registrarPeloVendedorAction(token, l.id, dados);
      if (aviso || !r.ok) toast(r);
      if (r.ok && dados.nota) setNota('');
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm [color-scheme:dark]" onClick={onFechar}>
      <div
        className="flex h-full w-full max-w-[760px] flex-col overflow-hidden border-l border-border-strong bg-page"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={l.name}
      >
        <header className="border-b border-border px-4 pb-0 pt-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent font-display text-[15px] font-bold text-page">
                  {l.score}
                </span>
                <h2 className="font-display text-[19px] font-bold leading-tight sm:text-[22px]">{l.name}</h2>
              </div>
              <div className="mt-1 text-[12.5px] text-fg-tertiary">
                {[l.niche, [l.city, l.state].filter(Boolean).join(' / '), l.country === 'US' ? 'EUA' : null]
                  .filter(Boolean)
                  .join(' · ')}
                {l.rating !== null && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5">
                    · <Star size={11} className="fill-current" /> {Number(l.rating).toFixed(1)} ({l.review_count ?? 0})
                  </span>
                )}
              </div>
              <div className="mt-1 text-[12.5px] font-bold">
                Etapa: <span className="text-accent">{tituloDaEtapa(l.status)}</span>
                {quente && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[#ff8a5c]">
                    <Flame size={12} /> abriu o diagnóstico há pouco: ligue agora
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onFechar}
              aria-label="Fechar"
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border-strong"
            >
              <X size={16} />
            </button>
          </div>
          <nav className="-mx-1 mt-3 flex gap-1 overflow-x-auto">
            {ABAS.map(([a, nome]) => (
              <button
                key={a}
                onClick={() => setAba(a)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-bold ${aba === a ? 'border-accent text-accent' : 'border-transparent text-fg-tertiary'}`}
              >
                {nome}
              </button>
            ))}
          </nav>
        </header>

        <div className={`flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6 ${pending ? 'opacity-70' : ''}`}>
          {aba === 'analise' && (
            <>
              <Bloco titulo="Por que é uma oportunidade">
                <p className="text-[14.5px] leading-relaxed">{roteiro.oportunidade}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-accent/12 px-2.5 py-0.5 text-[11.5px] font-extrabold text-accent">
                    {SITUACAO[sit]}
                  </span>
                  {l.reasons.map((r) => (
                    <span key={r} className="rounded-full bg-fg-faded/15 px-2.5 py-0.5 text-[11.5px] font-bold text-fg-secondary">
                      {r}
                    </span>
                  ))}
                </div>
              </Bloco>
              <Bloco titulo="No Google">
                <p className="text-[14px] leading-relaxed text-fg-secondary">
                  {l.rating !== null
                    ? `Nota ${String(l.rating).replace('.', ',')} com ${l.review_count ?? 0} avaliações.`
                    : 'Sem nota no Google.'}{' '}
                  {(l.review_count ?? 0) >= 30 && (l.rating ?? 0) >= 4.3
                    ? 'Boa reputação: use como elogio na abertura.'
                    : 'Poucas avaliações: um site com depoimentos ajuda a passar confiança.'}
                </p>
                {l.diag_views > 0 && (
                  <p className="mt-1 text-[13px] font-bold text-[#ff8a5c]">Abriu o diagnóstico {l.diag_views}x.</p>
                )}
              </Bloco>
              {l.screenshot_url && (
                <Bloco titulo="O site deles no celular hoje">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.screenshot_url}
                    alt={`Site de ${l.name} no celular`}
                    loading="lazy"
                    className="mx-auto max-h-[460px] rounded-[18px] border-[5px] border-[#1c1c1f]"
                  />
                </Bloco>
              )}
              <a
                href={`/diagnostico/${l.public_token}?k=${token}&previa=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-bold"
              >
                <FileSearch size={15} /> Ver o diagnóstico que o cliente recebe
              </a>
            </>
          )}

          {aba === 'contato' && (
            <>
              <Bloco titulo="Contatos">
                <div className="flex flex-wrap gap-2">
                  {wa && (
                    <a
                      href={`https://wa.me/${wa.numero}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-[13px] font-bold"
                    >
                      <MessageCircle size={14} /> WhatsApp{wa.celular ? '' : ' (parece fixo)'}
                    </a>
                  )}
                  {l.phone && (
                    <a
                      href={`tel:${l.phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-[13px] font-bold"
                    >
                      <Phone size={14} /> {l.phone}
                    </a>
                  )}
                  {l.email && (
                    <a
                      href={`mailto:${l.email}`}
                      className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-[13px] font-bold"
                    >
                      <Mail size={14} /> {l.email}
                    </a>
                  )}
                  {l.website && (
                    <a
                      href={urlComProtocolo(l.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-[13px] font-bold"
                    >
                      <Globe size={14} /> Site
                    </a>
                  )}
                  {l.instagram && (
                    <a
                      href={urlComProtocolo(l.instagram)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-[13px] font-bold"
                    >
                      <AtSign size={14} /> Instagram
                    </a>
                  )}
                  <a
                    href={
                      l.maps_url ??
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.name, l.address ?? l.city].filter(Boolean).join(', '))}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-[13px] font-bold"
                  >
                    <MapPin size={14} /> Maps
                  </a>
                </div>
              </Bloco>

              <Bloco titulo="Mensagem pronta">
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {NOME_DA_ETAPA.map((nome, i) => (
                    <button
                      key={nome}
                      onClick={() => setEtapa(i)}
                      className={`rounded-full border px-3 py-1 text-[12px] font-bold ${i === etapa ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary'}`}
                    >
                      {nome}
                      {prox?.etapa === i && ' · agora'}
                    </button>
                  ))}
                </div>
                {prox?.vence && etapa === prox.etapa && etapa > 0 && (
                  <div className="mb-2 text-[12.5px] text-fg-tertiary">
                    Este retorno vence em {new Date(`${prox.vence}T12:00:00`).toLocaleDateString('pt-BR')}.
                  </div>
                )}
                <div className="text-[12px] font-bold text-fg-faded">
                  Canal sugerido: {canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'}
                </div>

                <div className="mt-2 text-[12px] font-extrabold text-fg-faded">WhatsApp</div>
                <div className="mt-1 max-h-[200px] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-border bg-page/50 p-3 text-[13.5px] leading-relaxed text-fg-secondary">
                  {textoW || 'Sem modelo para esta etapa.'}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {wa && textoW && (
                    <a
                      href={linkWhatsApp(wa.numero, textoW)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 text-[13px] font-extrabold text-page"
                    >
                      <MessageCircle size={14} /> Abrir no WhatsApp
                    </a>
                  )}
                  {textoW && <Copiar texto={textoW} />}
                </div>

                {l.email && (
                  <>
                    <div className="mt-4 text-[12px] font-extrabold text-fg-faded">E-mail</div>
                    {assunto && <div className="mt-1 text-[13.5px] font-bold">{assunto}</div>}
                    <div className="mt-1 max-h-[200px] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-border bg-page/50 p-3 text-[13.5px] leading-relaxed text-fg-secondary">
                      {textoE || 'Sem modelo para esta etapa.'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {textoE && (
                        <a
                          href={linkGmail(l.email, assunto, textoE)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 text-[13px] font-extrabold text-page"
                        >
                          <Mail size={14} /> Abrir no Gmail
                        </a>
                      )}
                      {textoE && <Copiar texto={textoE} />}
                    </div>
                  </>
                )}

                <button
                  onClick={() => registrar({ status: 'contatado', etapaEnviada: etapa, nota: `Enviou: ${NOME_DA_ETAPA[etapa]}` })}
                  disabled={pending}
                  className="mt-4 w-full rounded-control border border-accent/60 px-4 py-2.5 text-[13.5px] font-extrabold text-accent"
                >
                  Enviei esta mensagem (registrar)
                </button>
              </Bloco>
            </>
          )}

          {aba === 'oportunidade' && (
            <>
              <Bloco titulo="O que oferecer">
                <div className="font-display text-[24px] font-bold tabular-nums">
                  {m(l.one_time)}
                  {l.monthly > 0 && <span className="text-[14px] font-bold text-fg-tertiary"> + {m(l.monthly)}/mês</span>}
                </div>
                {l.combo && <div className="text-[12.5px] font-bold text-success">Preço de combo (já com desconto)</div>}
                {l.services.filter((s) => s.mensal).length > 1 && (
                  <div className="mt-1 text-[12.5px] text-fg-tertiary">
                    Abaixo aparecem as mensalidades de cada serviço, mas o cliente paga uma só: a maior ({m(l.monthly)}/mês).
                  </div>
                )}
                <div className="mt-3 space-y-3">
                  {l.services.map((s) => (
                    <div key={s.nome} className="rounded-[12px] border border-border bg-page/40 p-3">
                      <div className="flex justify-between gap-3 text-[13.5px] font-bold">
                        <span>{s.nome}</span>
                        {l.currency === 'BRL' && (
                          <span className="tabular-nums text-fg-secondary">
                            {formatMoeda(s.preco, 'BRL')}
                            {s.mensal ? '/mês' : ''}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-fg-tertiary">{s.descricao}</p>
                      {!s.mensal && s.prazoDias > 0 && (
                        <p className="mt-1 text-[12px] font-bold text-fg-faded">Prazo: até {s.prazoDias} dias</p>
                      )}
                    </div>
                  ))}
                </div>
                {l.currency === 'USD' && (
                  <p className="mt-2 text-[12px] text-fg-tertiary">
                    Cliente dos EUA: preço em dólar da tabela do portfólio. As descrições acima valem para os mesmos planos.
                  </p>
                )}
                <button
                  onClick={onSimular}
                  className="mt-3 rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-extrabold text-page"
                >
                  Simular outras opções
                </button>
              </Bloco>
            </>
          )}

          {aba === 'agir' && (
            <>
              <Bloco titulo="1. Abertura">
                <p className="text-[14px] leading-relaxed">{roteiro.abertura}</p>
              </Bloco>
              <Bloco titulo="2. Perguntas para entender o negócio">
                <ul className="space-y-1.5 text-[14px] leading-relaxed">
                  {roteiro.perguntas.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[12.5px] text-fg-tertiary">
                  Anote as respostas na aba Checklist: o Arthur usa isso para montar a proposta.
                </p>
              </Bloco>
              <Bloco titulo="3. Argumentos">
                <ul className="space-y-1.5 text-[14px] leading-relaxed">
                  {roteiro.argumentos.map((a) => (
                    <li key={a}>• {a}</li>
                  ))}
                </ul>
              </Bloco>
              <Bloco titulo="4. Se o cliente disser…">
                <div className="space-y-2.5">
                  {roteiro.objecoes.map((o) => (
                    <div key={o.objecao}>
                      <div className="text-[13.5px] font-extrabold">{o.objecao}</div>
                      <div className="text-[13.5px] leading-relaxed text-fg-secondary">{o.resposta}</div>
                    </div>
                  ))}
                </div>
              </Bloco>
              <Bloco titulo="5. Próximo passo">
                <p className="text-[14px] leading-relaxed">{roteiro.proximoPasso}</p>
              </Bloco>
              <Bloco titulo="Pergunta que você não sabe responder?">
                <PerguntarAoArthur whatsArthur={whatsArthur} vendedor={vendedor} cliente={l.name} />
              </Bloco>
            </>
          )}

          {aba === 'checklist' && (
            <Bloco titulo="Checklist de descoberta">
              <ChecklistForm
                inicial={l.discovery ?? {}}
                aoSalvar={async (r) => {
                  const res = await salvarChecklistDoVendedorAction(token, l.id, r);
                  toast(res);
                  return res.ok;
                }}
              />
            </Bloco>
          )}

          {aba === 'registro' && (
            <>
              <Bloco titulo="Em que etapa está">
                <div className="flex flex-wrap gap-1.5">
                  {ETAPAS_QUE_O_VENDEDOR_MARCA.map((s) => (
                    <button
                      key={s}
                      onClick={() => registrar({ status: s })}
                      disabled={pending}
                      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${l.status === s ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary'}`}
                    >
                      {tituloDaEtapa(s)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-fg-tertiary">
                  &quot;Quer proposta&quot; avisa o Arthur para montar a proposta e o contrato. &quot;Não contatar&quot; é para
                  quem pediu para não receber mais mensagens.
                </p>
              </Bloco>
              <Bloco titulo="Anotação">
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={3}
                  placeholder="O que conversaram, próximo passo, melhor horário…"
                  className="w-full resize-y rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
                />
                <button
                  onClick={() => registrar({ nota })}
                  disabled={pending || !nota.trim()}
                  className="mt-2 rounded-control bg-accent px-4 py-2 text-[13px] font-extrabold text-page disabled:opacity-50"
                >
                  Salvar anotação
                </button>
                {l.notes && (
                  <div className="mt-3 whitespace-pre-line rounded-[12px] border border-border bg-page/40 p-3 text-[12.5px] leading-relaxed text-fg-tertiary">
                    {l.notes}
                  </div>
                )}
              </Bloco>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
