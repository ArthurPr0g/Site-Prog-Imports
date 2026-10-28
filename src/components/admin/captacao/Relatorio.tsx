'use client';

// Relatório da Captação: onde vale buscar mais (por ramo e por cidade), qual
// mensagem responde mais (teste A/B) e quais motivos da nota respondem mais
// ("nota que aprende": sugere ajuste, não muda os pesos sozinho).

import { useMemo, useState } from 'react';
import { ENCERRADOS, type Lead } from '@/lib/captacao';
import { emReais, type Cotacoes, type Estimativa } from '@/lib/precos-captacao';
import { semCentavos } from './comum';
import { BarrasHorizontais, Cartao, Funil, Medidor, RitmoSemanal, type Semana } from './GraficosDoRelatorio';

const SEMANAS = 12;
const DIA_MS = 24 * 3600_000;

/** Segunda-feira 0h (Brasília, UTC−3) da semana do instante. */
function inicioDaSemana(ms: number): number {
  const d = new Date(ms - 3 * 3600_000);
  const dia = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia) + 3 * 3600_000;
}

/** Contatos e respostas por semana, das últimas SEMANAS semanas até a atual. */
function ritmo(leads: Lead[], agora: number): Semana[] {
  const atual = inicioDaSemana(agora);
  const semanas: Semana[] = Array.from({ length: SEMANAS }, (_, i) => {
    const inicio = atual - (SEMANAS - 1 - i) * 7 * DIA_MS;
    const d = new Date(inicio - 3 * 3600_000);
    const rotulo = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { inicio, rotulo, contatos: 0, respostas: 0 };
  });
  const indice = (iso: string | null) =>
    iso ? semanas.findIndex((s) => s.inicio === inicioDaSemana(new Date(iso).getTime())) : -1;
  for (const l of leads) {
    const c = indice(l.firstContactAt);
    if (c >= 0) semanas[c].contatos++;
    const r = indice(l.repliedAt);
    if (r >= 0) semanas[r].respostas++;
  }
  return semanas;
}

const MINIMO_PARA_APRENDER = 30;
const respondeu = (l: Lead) => !!l.repliedAt;
const fechou = (l: Lead) => l.status === 'fechado';
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

type Linha = {
  chave: string;
  leads: number;
  contatados: number;
  responderam: number;
  reunioes: number;
  fechados: number;
  naMesa: number;
};

function agrupar(leads: Lead[], chave: (l: Lead) => string, valor: (l: Lead) => number): Linha[] {
  const m = new Map<string, Linha>();
  for (const l of leads) {
    const k = chave(l) || '—';
    const g = m.get(k) ?? { chave: k, leads: 0, contatados: 0, responderam: 0, reunioes: 0, fechados: 0, naMesa: 0 };
    g.leads++;
    if (l.firstContactAt) g.contatados++;
    if (respondeu(l)) g.responderam++;
    if (['reuniao', 'proposta', 'fechado'].includes(l.status)) g.reunioes++;
    if (fechou(l)) g.fechados++;
    if (!ENCERRADOS.includes(l.status)) g.naMesa += valor(l);
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.contatados - a.contatados || b.leads - a.leads);
}

export function Relatorio({
  leads,
  estimativa,
  cotacoes,
  agora,
}: {
  leads: Lead[];
  estimativa: (l: Lead) => Estimativa;
  cotacoes: Cotacoes;
  /** Hora da última leitura do painel (as semanas do ritmo partem dela). */
  agora: number;
}) {
  const [por, setPor] = useState<'ramo' | 'cidade'>('ramo');
  const valor = (l: Lead) => {
    const e = estimativa(l);
    return emReais(e.unico, e.moeda, cotacoes) ?? 0;
  };

  const linhas = useMemo(
    () => agrupar(leads, por === 'ramo' ? (l) => l.niche ?? '' : (l) => [l.city, l.state].filter(Boolean).join(' / '), valor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, por, cotacoes]
  );

  const contatados = leads.filter((l) => l.firstContactAt);
  const ab = (['A', 'B'] as const).map((v) => {
    const g = contatados.filter((l) => (l.abVariant ?? 'A') === v);
    return { v, enviados: g.length, responderam: g.filter(respondeu).length, fechados: g.filter(fechou).length };
  });

  const motivos = useMemo(() => {
    const m = new Map<string, { contatados: number; responderam: number }>();
    for (const l of contatados) {
      for (const r of l.reasons.length ? l.reasons : ['(sem motivo)']) {
        // Junta "227 avaliações: empresa com movimento" num motivo só.
        const k = r.replace(/^\d+ avaliações: /, 'Muitas avaliações: ');
        const g = m.get(k) ?? { contatados: 0, responderam: 0 };
        g.contatados++;
        if (respondeu(l)) g.responderam++;
        m.set(k, g);
      }
    }
    return [...m.entries()].sort((a, b) => b[1].responderam / b[1].contatados - a[1].responderam / a[1].contatados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const funil = useMemo(
    () => [
      { nome: 'Contatados', valor: leads.filter((l) => l.firstContactAt).length },
      { nome: 'Responderam', valor: leads.filter(respondeu).length },
      { nome: 'Reunião ou +', valor: leads.filter((l) => ['reuniao', 'proposta', 'fechado'].includes(l.status)).length },
      { nome: 'Fechados', valor: leads.filter(fechou).length },
    ],
    [leads]
  );
  const semanas = useMemo(() => ritmo(leads, agora), [leads, agora]);
  const nomeDoGrupo = por === 'ramo' ? 'ramo' : 'cidade';
  const taxaPorGrupo = linhas
    .filter((g) => g.contatados > 0 && g.chave !== '—')
    .sort((a, b) => b.contatados - a.contatados)
    .slice(0, 8)
    .map((g) => ({
      chave: g.chave,
      nome: g.chave,
      valor: g.responderam / g.contatados,
      rotulo: pct(g.responderam, g.contatados),
      detalhe: `${g.responderam} de ${g.contatados} contatados responderam · ${g.fechados} fechado(s)`,
    }))
    .sort((a, b) => b.valor - a.valor);
  const mesaPorGrupo = [...linhas]
    .filter((g) => g.naMesa > 0 && g.chave !== '—')
    .sort((a, b) => b.naMesa - a.naMesa)
    .slice(0, 8)
    .map((g) => ({
      chave: g.chave,
      nome: g.chave,
      valor: g.naMesa,
      rotulo: semCentavos(g.naMesa),
      detalhe: `${g.leads} lead(s) · implementação estimada pela tabela`,
    }));

  const alternarPor = (
    <div className="flex gap-1.5">
      {(['ramo', 'cidade'] as const).map((p) => (
        <button
          key={p}
          onClick={() => setPor(p)}
          className={`rounded-full border px-3 py-1 text-[12px] font-bold ${por === p ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary'}`}
        >
          Por {p}
        </button>
      ))}
    </div>
  );

  const th = 'px-2 py-2 text-right font-extrabold';
  const td = 'px-2 py-2 text-right tabular-nums';

  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <Cartao
          titulo="Funil da captação"
          subtitulo={`De ${leads.length.toLocaleString('pt-BR')} leads na base: quantos passam de uma etapa para a outra`}
        >
          <Funil etapas={funil} />
        </Cartao>
        <Cartao titulo="Ritmo semanal" subtitulo={`Contatos feitos e respostas, últimas ${SEMANAS} semanas`}>
          <RitmoSemanal semanas={semanas} />
        </Cartao>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo={`Taxa de resposta por ${nomeDoGrupo}`} subtitulo="Os 8 com mais contatos" acoes={alternarPor}>
          <BarrasHorizontais barras={taxaPorGrupo} maximo={1} vazio={`Ainda não há contatos para comparar por ${nomeDoGrupo}.`} />
        </Cartao>
        <Cartao titulo={`Dinheiro na mesa por ${nomeDoGrupo}`} subtitulo="Implementação estimada dos leads em aberto">
          <BarrasHorizontais barras={mesaPorGrupo} vazio="Nenhum valor em aberto." />
        </Cartao>
      </section>

      <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Onde vale buscar mais (tabela)</div>
          {alternarPor}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead className="text-[10.5px] uppercase tracking-[.06em] text-fg-faded">
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left font-extrabold">{por === 'ramo' ? 'Ramo' : 'Cidade'}</th>
                <th className={th}>Leads</th>
                <th className={th}>Contatados</th>
                <th className={th}>Responderam</th>
                <th className={th}>Reunião+</th>
                <th className={th}>Fechados</th>
                <th className={th}>Na mesa</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((g) => (
                <tr key={g.chave} className="border-b border-divider last:border-b-0">
                  <td className="px-2 py-2 font-bold">{g.chave}</td>
                  <td className={td}>{g.leads}</td>
                  <td className={td}>{g.contatados}</td>
                  <td className={td}>
                    {g.responderam} <span className="text-fg-faded">({pct(g.responderam, g.contatados)})</span>
                  </td>
                  <td className={td}>{g.reunioes}</td>
                  <td className={`${td} font-bold text-accent`}>{g.fechados}</td>
                  <td className={td}>{semCentavos(g.naMesa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Teste A/B das mensagens</div>
          <div className="grid grid-cols-2 gap-3">
            {ab.map((g) => (
              <div key={g.v} className="rounded-[14px] border border-border bg-page/40 p-3.5">
                <div className="text-[12px] font-extrabold text-fg-faded">Variante {g.v}</div>
                <div className="mt-1 font-display text-[26px] font-bold tabular-nums">{pct(g.responderam, g.enviados)}</div>
                <div className="text-[12px] text-fg-tertiary">
                  {g.responderam} de {g.enviados} responderam · {g.fechados} fechado(s)
                </div>
                <Medidor valor={g.enviados ? g.responderam / g.enviados : 0} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-fg-tertiary">
            Crie a variante B em <b>Mensagens</b> (primeiro contato). Metade dos leads novos recebe cada uma. Com 30+ envios em
            cada lado, a diferença começa a ser confiável.
          </p>
        </div>

        <div className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">A nota está acertando?</div>
          {contatados.length < MINIMO_PARA_APRENDER ? (
            <p className="text-[13px] leading-relaxed text-fg-tertiary">
              Faltam {MINIMO_PARA_APRENDER - contatados.length} contato(s) para ter dados. Com {MINIMO_PARA_APRENDER}+ leads
              contatados, aqui aparece a taxa de resposta de cada motivo da nota (sem site, site fora do ar, muitas avaliações…),
              para ajustar os pesos com números reais.
            </p>
          ) : (
            <>
              <BarrasHorizontais
                maximo={1}
                vazio="Sem motivos ainda."
                barras={motivos.map(([motivo, g]) => ({
                  chave: motivo,
                  nome: motivo,
                  valor: g.contatados ? g.responderam / g.contatados : 0,
                  rotulo: pct(g.responderam, g.contatados),
                  detalhe: `${g.responderam} de ${g.contatados} contatados responderam`,
                }))}
              />
              <p className="mt-3 text-[12px] leading-relaxed text-fg-tertiary">
                Motivos no topo respondem mais: vale dar mais peso a eles na nota (em <code>src/lib/captacao.ts</code>). Os pesos
                não mudam sozinhos.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
