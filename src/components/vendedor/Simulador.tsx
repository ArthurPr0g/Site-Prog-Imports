'use client';

// Simulador de preços na página do vendedor: igual ao do portfólio (produto,
// nível, gestão em combo, marca, mensalidade única e pagamento). Brasil pelo
// catálogo retratado no link; EUA pela tabela em dólar do portfólio.
// Cada escolha mostra para quem é e o que inclui (lib/guia-dos-pacotes), para o
// vendedor saber qual pacote indicar sem decorar a página de planos.

import { useMemo, useState, type ReactNode } from 'react';
import { Copy, Check, Lightbulb, CircleCheck, CircleSlash, Info } from 'lucide-react';
import { tabelaBRL, formatMoeda, type Moeda } from '@/lib/precos-captacao';
import { simular, parcela, tabelaDaMoeda, NOMES, type Escolha, type Produto } from '@/lib/simulador';
import {
  GUIA_DO_PRODUTO,
  GUIA_DA_MARCA,
  REGRA_DA_MARCA,
  COMBO_INTEGRACAO,
  COMPARATIVO,
  NAO_INCLUSO,
  BOM_SABER,
  type GuiaDoNivel,
} from '@/lib/guia-dos-pacotes';
import type { ItemDoCatalogo } from '@/lib/vendedor';

const NIVEIS: Record<Moeda, Record<Produto, string[]>> = {
  BRL: {
    site: ['Essencial', 'Profissional', 'Premium'],
    loja: ['Essencial', 'Profissional', 'Premium'],
    erp: ['Básico', 'Intermediário', 'Avançado'],
  },
  USD: {
    site: ['Starter', 'Business', 'Premium'],
    loja: ['Starter', 'Growth', 'Enterprise'],
    erp: ['Essential', 'Professional', 'Custom'],
  },
};

const ROTULO = 'mb-1.5 text-[12px] font-extrabold uppercase tracking-[.06em] text-fg-faded';

function Seg<T extends string | number>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: [T, string][];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map(([v, rotulo]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
            v === valor ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary hover:border-accent'
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

type Cartao<T> = { valor: T; titulo: string; texto?: string; preco?: string; selo?: string; economia?: string[] };

/** Opções em cartões: nome, preço e para quem é, para escolher sem decorar. */
function Cartoes<T extends string | number>({
  opcoes,
  valor,
  onChange,
  colunas = 'sm:grid-cols-3',
}: {
  opcoes: Cartao<T>[];
  valor: T;
  onChange: (v: T) => void;
  colunas?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-2 ${colunas}`}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={String(o.valor)}
            onClick={() => onChange(o.valor)}
            aria-pressed={ativo}
            className={`flex flex-col gap-1 rounded-[14px] border p-3 text-left transition-colors ${
              ativo ? 'border-accent bg-accent/10' : 'border-border-strong hover:border-accent/70'
            }`}
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`text-[13.5px] font-extrabold ${ativo ? 'text-accent' : ''}`}>{o.titulo}</span>
              {o.selo && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">{o.selo}</span>
              )}
            </span>
            {o.preco && <span className="text-[12.5px] font-bold tabular-nums text-fg-secondary">{o.preco}</span>}
            {o.economia?.map((x) => (
              <span key={x} className="text-[12px] font-bold tabular-nums leading-snug text-success">
                {x}
              </span>
            ))}
            {o.texto && <span className="text-[12px] leading-snug text-fg-tertiary">{o.texto}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Dica({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex gap-2 rounded-[12px] border border-border bg-page/40 p-2.5 text-[12.5px] leading-snug text-fg-secondary">
      <Lightbulb size={14} className="mt-0.5 shrink-0 text-accent" />
      <div>{children}</div>
    </div>
  );
}

function Comparativo({ titulo, linhas, niveis, ativo }: { titulo: string; linhas: string[][]; niveis: string[]; ativo: number }) {
  return (
    <div>
      <div className="mb-2 text-[13.5px] font-extrabold">{titulo}</div>
      <div className="overflow-x-auto rounded-[12px] border border-border">
        <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] bg-card p-2 text-left font-bold text-fg-faded" />
              {niveis.map((n, i) => (
                <th
                  key={n}
                  className={`p-2 text-left font-extrabold ${i === ativo ? 'bg-accent/15 text-accent' : 'text-fg-secondary'}`}
                >
                  {n}
                  {i === ativo && <span className="ml-1 text-[10.5px] font-bold">(escolhido)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(([item, ...cols]) => (
              <tr key={item} className="border-t border-divider">
                <td className="sticky left-0 z-[1] w-[34%] bg-card p-2 font-bold text-fg-secondary">{item}</td>
                {cols.map((c, i) => (
                  <td
                    key={i}
                    className={`p-2 ${i === ativo ? 'bg-accent/10 font-bold text-fg' : 'text-fg-tertiary'} ${
                      c === '—' ? 'text-fg-faded' : ''
                    }`}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Simulador({
  catalogo,
  inicial,
  moedaInicial = 'BRL',
}: {
  catalogo: ItemDoCatalogo[];
  inicial?: Partial<Escolha>;
  moedaInicial?: Moeda;
}) {
  const tabBRL = useMemo(() => tabelaBRL(new Map(catalogo.map((c) => [c.nome, c.preco]))), [catalogo]);
  const porNome = useMemo(() => new Map(catalogo.map((c) => [c.nome, c])), [catalogo]);
  const [moeda, setMoeda] = useState<Moeda>(moedaInicial);
  const [e, setE] = useState<Escolha>({ produto: 'site', nivel: 0, comGestao: false, nivelGestao: 0, marca: 0, ...inicial });
  const [n, setN] = useState(12);
  const [copiado, setCopiado] = useState(false);

  const t = tabelaDaMoeda(moeda, tabBRL);
  const s = simular(e, t);
  const nomesBR = NOMES.BRL;
  const combo = e.comGestao && e.produto !== 'erp';
  const guia = GUIA_DO_PRODUTO[e.produto];

  // O que entra no pacote, com o guia de cada item (mesmos serviços nos dois países).
  const itens: { nome: string; guia: GuiaDoNivel }[] = [
    { nome: nomesBR[e.produto][e.nivel], guia: guia.niveis[e.nivel] },
    ...(combo ? [{ nome: nomesBR.erp[e.nivelGestao], guia: GUIA_DO_PRODUTO.erp.niveis[e.nivelGestao] }] : []),
    ...(e.marca ? [{ nome: nomesBR.marca[e.marca - 1], guia: GUIA_DA_MARCA[e.marca - 1] }] : []),
  ];
  // Prazo pelo catálogo: o combo de mesmo nível tem prazo próprio (menor que a soma).
  const itemCombo =
    combo && e.nivel === e.nivelGestao
      ? catalogo.find((c) => c.nome.includes(`(${nomesBR[e.produto][e.nivel]} + Gestão ${NIVEIS.BRL.erp[e.nivelGestao]})`))
      : undefined;
  const prazo =
    (itemCombo ? itemCombo.prazoDias : itens.slice(0, combo ? 2 : 1).reduce((soma, i) => soma + (porNome.get(i.nome)?.prazoDias || 0), 0)) +
    (e.marca ? porNome.get(nomesBR.marca[e.marca - 1])?.prazoDias || 0 : 0);
  const mensalidade =
    e.produto === 'erp'
      ? porNome.get(`Mensalidade Gestão ${NIVEIS.BRL.erp[e.nivel]}`)
      : porNome.get(e.produto === 'site' ? 'Mensalidade Site' : 'Mensalidade Loja');

  const set = <K extends keyof Escolha>(k: K, v: Escolha[K]) => setE((x) => ({ ...x, [k]: v }));
  const m = (v: number) => formatMoeda(v, moeda);
  const precoDoNivel = (p: Produto, i: number) => `${p === 'erp' && i === 2 ? 'a partir de ' : ''}${m(t[p][i][0])}`;

  const resumo =
    `${s.linhas.map((l) => l.nome).join(' + ')}\n` +
    `Total${s.aPartirDe ? ' (a partir de)' : ''}: ${m(s.total)}${s.desconto ? ` (já com ${m(s.desconto)} de desconto do combo)` : ''}\n` +
    `Depois: ${m(s.mensal)}/mês (hospedagem, segurança, backups e suporte)` +
    (s.mensalSeparadas
      ? `, em vez de ${m(s.mensalSeparadas)}: economia de ${m(s.mensalSeparadas - s.mensal)}/mês por contratar os 2 juntos`
      : '') +
    (moeda === 'BRL'
      ? `\nPagamento: 50% no fechamento e 50% na entrega, ou 2x de ${m(s.total / 2)} sem juros no cartão, ou ${n}x de ${m(parcela(s.total, n))}.` +
        itens.map((i) => `\n\n${i.nome} inclui:\n${i.guia.inclui.map((x) => `• ${x}`).join('\n')}`).join('')
      : `\nPayment: 50% to start (${m(s.total / 2)}) and 50% on delivery.`);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o texto continua na tela */
    }
  }

  return (
    <div className="space-y-4">
      {/* Celular: as escolhas ocupam várias telas, então o total fica sempre à vista. */}
      <a
        href="#resumo-do-simulador"
        className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-[14px] border border-accent/40 bg-card/95 px-3.5 py-2.5 shadow-lg backdrop-blur lg:hidden"
      >
        <span className="text-[12.5px] text-fg-tertiary">
          Total{s.aPartirDe ? ' (a partir de)' : ''}{' '}
          <b className="font-display text-[17px] tabular-nums text-fg">{m(s.total)}</b>
          <span className="ml-1">+ {m(s.mensal)}/mês</span>
        </span>
        <span className="shrink-0 text-[12.5px] font-extrabold text-accent">Ver resumo ↓</span>
      </a>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5 rounded-[18px] border border-border bg-card p-4 sm:p-5">
          <div>
            <div className={ROTULO}>Cliente do</div>
            <Seg<Moeda>
              opcoes={[
                ['BRL', 'Brasil (R$)'],
                ['USD', 'EUA (US$)'],
              ]}
              valor={moeda}
              onChange={setMoeda}
            />
          </div>

          <div>
            <div className={ROTULO}>1. O que o cliente precisa</div>
            <Cartoes<Produto>
              opcoes={(['site', 'loja', 'erp'] as Produto[]).map((p) => ({
                valor: p,
                titulo: p === 'site' ? 'Site' : p === 'loja' ? 'Loja virtual' : 'Só sistema de gestão',
                texto: GUIA_DO_PRODUTO[p].quandoOferecer,
              }))}
              valor={e.produto}
              onChange={(p) => setE((x) => ({ ...x, produto: p, comGestao: p === 'erp' ? false : x.comGestao }))}
            />
            <Dica>
              <b>O que é:</b> {guia.oQueE}
            </Dica>
          </div>

          <div>
            <div className={ROTULO}>2. Nível</div>
            <Cartoes<0 | 1 | 2>
              opcoes={NIVEIS[moeda][e.produto].map((r, i) => ({
                valor: i as 0 | 1 | 2,
                titulo: r,
                preco: precoDoNivel(e.produto, i),
                texto: guia.niveis[i].ideal,
                selo: guia.niveis[i].maisEscolhido ? 'Mais escolhido' : undefined,
              }))}
              valor={e.nivel}
              onChange={(v) => set('nivel', v)}
            />
            <Dica>
              Cada nível tem tudo do anterior e vai além. Na dúvida, comece pelo que resolve a dor de hoje: o cliente pode
              subir de nível em até 6 meses pagando só a diferença. A tabela <b>O que muda entre os níveis</b>, lá embaixo,
              compara item por item.
            </Dica>
          </div>

          {e.produto !== 'erp' && (
            // Bloco destacado: o combo é a venda maior, então não pode ficar escondido numa caixinha.
            <div className="rounded-[16px] border border-accent/50 bg-accent/[0.06] p-3 sm:p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-extrabold uppercase tracking-[.06em] text-accent">
                  3. Adicionar sistema de gestão
                </span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
                  combo: até 20% off + paga só a maior mensalidade
                </span>
              </div>
              <div className="mb-2.5 text-[12.5px] leading-snug text-fg-secondary">
                {COMBO_INTEGRACAO[e.produto]}
              </div>
              <Cartoes<number>
                colunas="sm:grid-cols-2"
                opcoes={[
                  {
                    valor: -1,
                    titulo: 'Sem sistema',
                    texto: `Só ${e.produto === 'site' ? 'o site' : 'a loja'}.`,
                  },
                  ...NIVEIS[moeda].erp.map((r, i) => {
                    const c = simular({ ...e, comGestao: true, nivelGestao: i as 0 | 1 | 2 }, t);
                    return {
                      valor: i,
                      titulo: r,
                      preco: precoDoNivel('erp', i),
                      economia: [
                        `Economiza ${m(c.desconto)} no projeto`,
                        `e ${m((c.mensalSeparadas ?? c.mensal) - c.mensal)}/mês na mensalidade`,
                      ],
                      texto: GUIA_DO_PRODUTO.erp.niveis[i].ideal,
                      selo: GUIA_DO_PRODUTO.erp.niveis[i].maisEscolhido ? 'Mais escolhido' : undefined,
                    };
                  }),
                ]}
                valor={e.comGestao ? e.nivelGestao : -1}
                onChange={(v) =>
                  setE((x) => (v < 0 ? { ...x, comGestao: false } : { ...x, comGestao: true, nivelGestao: v as 0 | 1 | 2 }))
                }
              />
              <Dica>
                Ofereça quando ele controla clientes, estoque ou financeiro em planilha ou caderno. Desconto de 15% (20% no
                Premium + Avançado) e <b>uma mensalidade só</b>, a maior das duas.
              </Dica>
            </div>
          )}

          <div>
            <div className={ROTULO}>{e.produto === 'erp' ? '3' : '4'}. Marca</div>
            <Cartoes<0 | 1 | 2 | 3>
              colunas="sm:grid-cols-2"
              opcoes={[
                { valor: 0, titulo: 'Já tem', texto: 'Já tem logo e identidade visual (cores, fontes, padrão nas redes).' },
                ...GUIA_DA_MARCA.map((g, i) => ({
                  valor: (i + 1) as 1 | 2 | 3,
                  titulo:
                    moeda === 'BRL'
                      ? ['Logo Essencial', 'Identidade a partir do logo', 'Identidade completa'][i]
                      : ['Logo Design', 'Brand kit', 'Full identity'][i],
                  preco: m(t.marca[i]),
                  texto: g.ideal,
                  selo: g.maisEscolhido ? 'Mais escolhido' : undefined,
                })),
              ]}
              valor={e.marca}
              onChange={(v) => set('marca', v)}
            />
            <Dica>
              <b>Como escolher:</b>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {REGRA_DA_MARCA.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Dica>
          </div>
        </div>

        <div className="space-y-4">
          <div id="resumo-do-simulador" className="scroll-mt-20 rounded-[18px] border border-accent/40 bg-card p-4 sm:p-5">
            <div className="mb-2 text-[12px] font-extrabold uppercase tracking-[.06em] text-accent">Resumo para o cliente</div>
            {s.linhas.map((l) => (
              <div key={l.nome} className="flex justify-between gap-3 border-b border-divider py-1.5 text-[13.5px]">
                <span>{l.nome}</span>
                <span className="tabular-nums">{m(l.valor)}</span>
              </div>
            ))}
            {s.desconto > 0 && (
              <div className="flex justify-between gap-3 border-b border-divider py-1.5 text-[13.5px] text-success">
                <span>Desconto do combo</span>
                <span className="tabular-nums">− {m(s.desconto)}</span>
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-bold">Total{s.aPartirDe ? ' (a partir de)' : ''}</span>
              <span className="font-display text-[28px] font-bold tabular-nums">{m(s.total)}</span>
            </div>
            <div className="text-[13px] text-fg-tertiary">
              Depois, <b className="text-fg">{m(s.mensal)}/mês</b>
              {s.mensalSeparadas && <s className="ml-1">{m(s.mensalSeparadas)}</s>} · domínio grátis no 1º ano
              {prazo > 0 && moeda === 'BRL' && <> · prazo de até {prazo} dias úteis</>}
            </div>
            {s.mensalSeparadas && (
              <div className="mt-2 rounded-[12px] border border-success/30 bg-success/10 p-2.5 text-[13px] text-success">
                <b>Economia de {m(s.mensalSeparadas - s.mensal)}/mês</b> na mensalidade por contratar os 2 juntos (separados
                seriam {m(s.mensalSeparadas)}/mês), além de {m(s.desconto)} de desconto no projeto.
              </div>
            )}

            {moeda === 'BRL' ? (
              <div className="mt-3 space-y-2 text-[13px]">
                <div className="rounded-[12px] border border-border bg-page/40 p-2.5">
                  <b>Pix ou boleto:</b> {m(s.total / 2)} no fechamento + {m(s.total / 2)} na entrega
                </div>
                <div className="rounded-[12px] border border-border bg-page/40 p-2.5">
                  <b>Cartão 2x sem juros:</b> 2x de {m(s.total / 2)}
                </div>
                <div className="rounded-[12px] border border-border bg-page/40 p-2.5">
                  <div className="mb-1">
                    <b>Cartão em {n}x</b> (taxa da operadora): {n}x de {m(parcela(s.total, n))}{' '}
                    <span className="text-fg-faded">· total {m(parcela(s.total, n) * n)}</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    value={n}
                    onChange={(ev) => setN(Number(ev.target.value))}
                    className="w-full accent-[var(--color-accent)]"
                    aria-label="Número de parcelas"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-[12px] border border-border bg-page/40 p-2.5 text-[13px]">
                <b>50% to start</b> ({m(s.total / 2)}) and <b>50% on delivery</b> ({m(s.total / 2)}), by card. The second half is
                only paid after approval.
              </div>
            )}

            <button
              onClick={copiar}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-extrabold text-page"
            >
              {copiado ? <Check size={15} /> : <Copy size={15} />}{' '}
              {copiado ? 'Copiado: cole no WhatsApp' : 'Copiar resumo para o cliente'}
            </button>
            {moeda === 'BRL' && (
              <div className="mt-1.5 text-center text-[11.5px] text-fg-faded">O resumo copiado já leva o que cada item inclui.</div>
            )}
          </div>

          <div className="space-y-4 rounded-[18px] border border-border bg-card p-4 text-[12.5px] sm:p-5">
            <div className="text-[12px] font-extrabold uppercase tracking-[.06em] text-fg-faded">O que está incluído</div>
            {itens.map((i) => (
              <div key={i.nome}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[13.5px] font-extrabold">{i.nome}</span>
                  <span className="text-fg-faded">{i.guia.prazo}</span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {i.guia.inclui.map((x) => (
                    <li key={x} className="flex gap-2 leading-snug text-fg-secondary">
                      <CircleCheck size={14} className="mt-0.5 shrink-0 text-success" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {mensalidade && (
              <div className="border-t border-divider pt-3">
                <div className="font-extrabold">
                  Mensalidade ({m(s.mensal)}/mês){combo && ' · uma só no combo'}
                </div>
                <div className="mt-1 leading-snug text-fg-tertiary">{mensalidade.descricao}</div>
              </div>
            )}
            <div className="border-t border-divider pt-3">
              <div className="flex items-center gap-1.5 font-extrabold">
                <CircleSlash size={14} className="text-fg-faded" /> Não está incluído
              </div>
              <div className="mt-1 leading-snug text-fg-tertiary">{NAO_INCLUSO}</div>
            </div>
            <div className="border-t border-divider pt-3">
              <div className="flex items-center gap-1.5 font-extrabold">
                <Info size={14} className="text-accent" /> Bom saber
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-snug text-fg-tertiary">
                {BOM_SABER.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div className="text-[12px] font-extrabold uppercase tracking-[.06em] text-fg-faded">O que muda entre os níveis</div>
        <Comparativo
          titulo={e.produto === 'site' ? 'Site' : e.produto === 'loja' ? 'Loja virtual' : 'Sistema de gestão'}
          linhas={COMPARATIVO[e.produto]}
          niveis={NIVEIS[moeda][e.produto]}
          ativo={e.nivel}
        />
        {combo && (
          <Comparativo titulo="Sistema de gestão" linhas={COMPARATIVO.erp} niveis={NIVEIS[moeda].erp} ativo={e.nivelGestao} />
        )}
      </div>
    </div>
  );
}
