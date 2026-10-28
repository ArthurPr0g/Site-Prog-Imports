'use client';

// Aba "Análise" da ficha do lead: o que dá para saber do negócio antes de
// ligar. Sinais de atividade (para não perder tempo com empresa parada), como
// é o negócio, o que os clientes dizem, como ele está perto dos concorrentes e
// o guia do ramo. Dados públicos do Google Maps + src/lib/conhecer-o-ramo.ts.

import { motion, useReducedMotion } from 'framer-motion';
import { Activity, Clock, MapPin, MessageSquareQuote, Users, BookOpen, Star, CalendarCheck } from 'lucide-react';
import type { LeadDoKit } from '@/lib/vendedor';
import { guiaDoRamo } from '@/lib/conhecer-o-ramo';
import { mapsDoLead } from '@/lib/captacao';

const DIAS: [string, string[]][] = [
  ['Seg', ['monday', 'segunda-feira', 'segunda']],
  ['Ter', ['tuesday', 'terça-feira', 'terça']],
  ['Qua', ['wednesday', 'quarta-feira', 'quarta']],
  ['Qui', ['thursday', 'quinta-feira', 'quinta']],
  ['Sex', ['friday', 'sexta-feira', 'sexta']],
  ['Sáb', ['saturday', 'sábado']],
  ['Dom', ['sunday', 'domingo']],
];

/** "8:30 AM–7 PM" → "8:30–19:00"; "Closed" → "Fechado". */
function horaBR(t: string): string {
  if (/clos|fechad/i.test(t)) return 'Fechado';
  if (/24 hours|24 horas/i.test(t)) return '24 horas';
  return t.replace(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)/gi, (_, h, m, ap) => {
    let hora = Number(h) % 12;
    if (ap.toUpperCase() === 'PM') hora += 12;
    return `${hora}:${m ?? '00'}`;
  });
}

function mesesDesde(iso: string, agora: number): number {
  return Math.max(0, Math.round((agora - Date.parse(iso)) / (30.44 * 24 * 3600 * 1000)));
}

const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

function Secao({ titulo, Icone, children, i = 0 }: { titulo: string; Icone: typeof Activity; children: React.ReactNode; i?: number }) {
  const calmo = useReducedMotion();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: calmo ? 0 : 0.35, delay: calmo ? 0 : i * 0.06 }}
      className="rounded-[16px] border border-border bg-card p-4"
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
        <Icone size={13} /> {titulo}
      </div>
      {children}
    </motion.section>
  );
}

function Sinal({ tom, children }: { tom: 'ok' | 'alerta' | 'neutro'; children: React.ReactNode }) {
  const cor = { ok: 'bg-success/12 text-success', alerta: 'bg-error/12 text-error', neutro: 'bg-fg-faded/15 text-fg-secondary' }[tom];
  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${cor}`}>{children}</span>;
}

export function NegocioDoLead({ l, agora }: { l: LeadDoKit; agora: number }) {
  const calmo = useReducedMotion();
  const guia = guiaDoRamo(l.category, l.niche);
  const fechado = !!l.maps_status && /clos|fechad|encerrad/i.test(l.maps_status);
  const meses = l.last_review_at ? mesesDesde(l.last_review_at, agora) : null;
  const dist = l.rating_dist ?? null;
  const totalDist = dist ? Object.values(dist).reduce((s, n) => s + Number(n), 0) : 0;
  const horario = l.opening_hours ?? null;
  const reg = l.regiao ?? null;
  const reviews = (l.recent_reviews ?? []).filter((r) => r.t);
  const verificado = l.last_review_at !== undefined && (l.last_review_at !== null || l.owner_claimed !== null);

  return (
    <div className="space-y-3">
      {/* Sinais de atividade: o vendedor sabe se vale a ligação */}
      <Secao titulo="Sinais de atividade" Icone={Activity} i={0}>
        <div className="flex flex-wrap gap-1.5">
          {fechado ? (
            <Sinal tom="alerta">Fechado no Google</Sinal>
          ) : (
            l.maps_status !== undefined && l.maps_status !== null && <Sinal tom="neutro">{l.maps_status}</Sinal>
          )}
          {meses !== null ? (
            <Sinal tom={meses > 24 ? 'alerta' : meses > 12 ? 'neutro' : 'ok'}>
              Última avaliação {meses <= 1 ? 'este mês' : `há ${meses} meses`} ({dataBR(l.last_review_at!)})
            </Sinal>
          ) : null}
          {l.owner_claimed === true && <Sinal tom="ok">Dono cuida do perfil no Google</Sinal>}
          {l.owner_claimed === false && <Sinal tom="neutro">Perfil do Google sem dono</Sinal>}
          {(l.review_count ?? 0) >= 100 && <Sinal tom="ok">{l.review_count} avaliações: tem movimento</Sinal>}
          {(l.review_count ?? 0) < 10 && <Sinal tom="alerta">Só {l.review_count ?? 0} avaliações</Sinal>}
          {l.phone ? <Sinal tom="ok">Telefone no Google</Sinal> : <Sinal tom="alerta">Sem telefone</Sinal>}
        </div>
        {!verificado && (
          <p className="mt-2 text-[12px] text-fg-tertiary">
            Data da última avaliação e dono do perfil chegam na próxima atualização da busca. Confira no{' '}
            <a href={mapsDoLead({ mapsUrl: l.maps_url, name: l.name, address: l.address, city: l.city })} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">
              Google Maps
            </a>{' '}
            se as avaliações são recentes antes de ligar.
          </p>
        )}
        {dist && totalDist > 0 && (
          <div className="mt-3 space-y-1">
            {['5', '4', '3', '2', '1'].map((n, i) => {
              const qtd = Number(dist[n] ?? 0);
              return (
                <div key={n} className="flex items-center gap-2 text-[11.5px] tabular-nums text-fg-tertiary">
                  <span className="flex w-6 items-center gap-0.5">
                    {n}
                    <Star size={10} className="fill-current" />
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg-faded/15">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${(qtd / totalDist) * 100}%` }}
                      transition={{ duration: calmo ? 0 : 0.7, delay: calmo ? 0 : 0.1 + i * 0.05 }}
                    />
                  </div>
                  <span className="w-9 text-right">{qtd}</span>
                </div>
              );
            })}
          </div>
        )}
      </Secao>

      <Secao titulo="Como é o negócio" Icone={MapPin} i={1}>
        <dl className="space-y-1.5 text-[13.5px]">
          <div>
            <dt className="inline font-bold text-fg-tertiary">Ramo: </dt>
            <dd className="inline">{[l.category, l.niche && l.niche !== l.category?.toLowerCase() ? `busca "${l.niche}"` : null].filter(Boolean).join(' · ') || '—'}</dd>
          </div>
          {l.porte && (
            <div>
              <dt className="inline font-bold text-fg-tertiary">Porte estimado: </dt>
              <dd className="inline">
                {{ pequena: 'pequena empresa', media: 'empresa média', grande: 'empresa grande' }[l.porte]}
                {(l.unidades ?? 1) > 1 ? ` (${l.unidades} unidades na cidade)` : ''}.{' '}
                <span className="text-fg-tertiary">
                  {l.porte === 'pequena'
                    ? 'Comece pelo pacote essencial: preço de entrada e resultado rápido.'
                    : l.porte === 'media'
                      ? 'Pacote intermediário: já tem estrutura para aproveitar mais recursos.'
                      : 'Pacote completo: fale com quem decide e mostre o projeto inteiro.'}
                </span>
              </dd>
            </div>
          )}
          {l.address && (
            <div>
              <dt className="inline font-bold text-fg-tertiary">Endereço: </dt>
              <dd className="inline">{l.address}</dd>
            </div>
          )}
          {l.online_booking && (
            <div className="flex items-start gap-1.5 rounded-[10px] bg-accent/[.07] p-2 text-[13px]">
              <CalendarCheck size={14} className="mt-0.5 flex-shrink-0 text-accent" />
              <span>
                Já usa <b>{l.online_booking}</b> para agendar ou vender online: pergunte o que acham da ferramenta e quanto pagam
                por ela. Nosso sistema pode substituir e juntar com o resto da gestão.
              </span>
            </div>
          )}
        </dl>
        {horario && Object.keys(horario).length > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-fg-faded">
              <Clock size={11} /> Horário no Google
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12.5px] tabular-nums sm:grid-cols-4">
              {DIAS.map(([curto, nomes]) => {
                const chave = Object.keys(horario).find((k) => nomes.includes(k.toLowerCase()));
                const v = chave ? horario[chave] : null;
                return (
                  <div key={curto} className="flex justify-between gap-2">
                    <span className="font-bold text-fg-tertiary">{curto}</span>
                    <span>{v && v.length ? v.map(horaBR).join(', ') : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {(l.attributes ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {(l.attributes ?? []).slice(0, 12).map((a) => (
              <span key={a} className="rounded-full bg-fg-faded/12 px-2 py-0.5 text-[11.5px] text-fg-secondary">
                {a}
              </span>
            ))}
          </div>
        )}
      </Secao>

      {reviews.length > 0 && (
        <Secao titulo="O que os clientes dizem no Google" Icone={MessageSquareQuote} i={2}>
          <div className="space-y-2">
            {reviews.map((r, i) => (
              <figure key={i} className="rounded-[12px] border border-border bg-page/40 p-3">
                <div className="mb-1 flex items-center gap-2 text-[11.5px] text-fg-tertiary">
                  <span className="flex text-accent">
                    {Array.from({ length: 5 }, (_, k) => (
                      <Star key={k} size={11} className={k < Math.round(r.n ?? 0) ? 'fill-current' : 'opacity-30'} />
                    ))}
                  </span>
                  {r.d && <span>{dataBR(r.d)}</span>}
                </div>
                <blockquote className="line-clamp-4 text-[13px] leading-relaxed text-fg-secondary">“{r.t}”</blockquote>
              </figure>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-fg-tertiary">
            Use um elogio real na abertura (“vi que os clientes elogiam muito o atendimento…”) e fique atento às reclamações:
            costumam apontar o que um sistema resolve (demora, agenda, falta de retorno).
          </p>
        </Secao>
      )}

      {reg && reg.total > 0 && (
        <Secao titulo={`Na região (${l.niche ?? 'mesmo ramo'} em ${l.city ?? 'na cidade'})`} Icone={Users} i={3}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[12px] bg-page/40 p-2">
              <div className="text-[18px] font-bold tabular-nums">{reg.total}</div>
              <div className="text-[11px] text-fg-tertiary">concorrentes analisados</div>
            </div>
            <div className="rounded-[12px] bg-page/40 p-2">
              <div className="text-[18px] font-bold tabular-nums">{Math.round((reg.com_site / reg.total) * 100)}%</div>
              <div className="text-[11px] text-fg-tertiary">têm site próprio no ar</div>
            </div>
            <div className="rounded-[12px] bg-page/40 p-2">
              <div className="text-[18px] font-bold tabular-nums">{reg.nota_media !== null ? String(reg.nota_media).replace('.', ',') : '—'}</div>
              <div className="text-[11px] text-fg-tertiary">nota média no Google</div>
            </div>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-secondary">
            {(l.review_count ?? 0) > (reg.avaliacoes_media ?? 0)
              ? `Com ${l.review_count} avaliações, está acima da média da região (${reg.avaliacoes_media}): é bem conhecido, falta a vitrine online à altura.`
              : `Tem menos avaliações que a média da região (${reg.avaliacoes_media}): um site com depoimentos e um bom perfil ajudam a alcançar os concorrentes.`}
          </p>
        </Secao>
      )}

      <Secao titulo={`Conheça o ramo: ${guia.grupo}`} Icone={BookOpen} i={4}>
        <p className="text-[13.5px] leading-relaxed text-fg-secondary">{guia.comoFunciona}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11.5px] font-extrabold text-fg-tertiary">Dores comuns</div>
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-fg-secondary">
              {guia.dores.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[11.5px] font-extrabold text-fg-tertiary">Pergunte</div>
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-fg-secondary">
              {guia.perguntas.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 rounded-[10px] bg-accent/[.07] p-2.5 text-[13px] leading-relaxed">
          <b className="text-accent">Argumento:</b> {guia.argumento}
        </p>
      </Secao>
    </div>
  );
}
