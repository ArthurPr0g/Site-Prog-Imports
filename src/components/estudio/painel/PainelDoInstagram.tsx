'use client';

// O painel de acompanhamento do Instagram da loja.
//
// Organizado pela pergunta que o dono faz ao abrir, nesta ordem:
//
//   1. Tem alguém esperando o direct?      → a fila, no topo, com a mensagem pronta
//   2. Como a conta está indo?              → os números do período
//   3. O que funciona melhor?               → os gráficos
//   4. Onde está aquele post?               → a tabela, com busca e a mensagem de cada um
//
// A fila não obedece ao filtro de período: um pedido de três meses atrás que
// ninguém respondeu continua sendo a primeira coisa a fazer.

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  MessageCircle,
  Pencil,
  RefreshCw,
  Search,
  Undo2,
} from 'lucide-react';
import type { Painel, PedidoDoPainel, PostDoPainel, FormatoDoPost } from '@/lib/instagram/painel';
import { marcarRespondidoAction, salvarPostAction } from '@/app/actions/painel';
import { mensagemPadrao } from '@/lib/estudio/direct';
import { Dica } from '@/components/ui/Dica';
import {
  Barras,
  CartaoDeGrafico,
  Colunas,
  ColunasEmpilhadas,
  COR_BASE,
  COR_DESTAQUE,
  formatarNumero,
  ItemDaLegenda,
  Linha,
} from './Graficos';

const FUSO = 'America/Sao_Paulo';
const DIA = 86400000;

type Periodo = '30d' | '90d' | '12m' | 'tudo';
const PERIODOS: { valor: Periodo; rotulo: string; dias: number | null }[] = [
  { valor: '30d', rotulo: '30 dias', dias: 30 },
  { valor: '90d', rotulo: '90 dias', dias: 90 },
  { valor: '12m', rotulo: '12 meses', dias: 365 },
  { valor: 'tudo', rotulo: 'Tudo', dias: null },
];

type Metrica = 'interacoes' | 'curtidas' | 'comentarios' | 'pedidos' | 'alcance' | 'salvamentos';
const METRICAS: { valor: Metrica; rotulo: string }[] = [
  { valor: 'interacoes', rotulo: 'Interações' },
  { valor: 'curtidas', rotulo: 'Curtidas' },
  { valor: 'comentarios', rotulo: 'Comentários' },
  { valor: 'pedidos', rotulo: 'Pedidos' },
  // Só aparecem quando o token tem instagram_manage_insights.
  { valor: 'alcance', rotulo: 'Alcance' },
  { valor: 'salvamentos', rotulo: 'Salvamentos' },
];

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Datas sempre no fuso da loja: o servidor roda em UTC e o navegador em
// Brasília, e a mesma data escrita de dois jeitos quebra a hidratação.
const dataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const dataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: 'short', year: 'numeric' });
const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });

/** "há 3 h", contado a partir do momento da leitura — não do relógio do
 *  navegador, que daria um texto diferente do servidor. */
function haQuanto(iso: string, agora: number): string {
  const ms = Math.max(0, agora - new Date(iso).getTime());
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  const m = Math.floor(d / 30);
  return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
}

function primeiraLinha(legenda: string, max = 70): string {
  const linha = legenda.split('\n').find((l) => l.trim())?.trim() ?? '';
  if (!linha) return 'Sem legenda';
  return linha.length > max ? `${linha.slice(0, max - 1)}…` : linha;
}

function interacoes(p: PostDoPainel): number {
  return p.curtidas + p.comentarios;
}

/* ================================================================ painel */

export function PainelDoInstagram({ painel }: { painel: Painel }) {
  const router = useRouter();
  const [atualizando, iniciarAtualizacao] = useTransition();
  const agora = new Date(painel.atualizadoEm).getTime();

  const [periodo, setPeriodo] = useState<Periodo>('tudo');
  const [formato, setFormato] = useState<FormatoDoPost | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [metrica, setMetrica] = useState<Metrica>('interacoes');

  // Cópia local dos pedidos: marcar como respondido muda a tela na hora, e o
  // servidor confirma por trás. Esperar a volta para riscar um nome da lista
  // deixaria a fila lenta justamente quando há muitos para responder.
  const [pedidos, setPedidos] = useState<PedidoDoPainel[]>(painel.pedidos);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(
    painel.novos ? { ok: true, texto: `${painel.novos} pedido(s) novo(s) desde a última leitura.` } : null
  );

  // Ao Atualizar, chega um painel novo: a cópia local é trocada pela lida
  // agora (sem perder o período e o formato escolhidos, que um `key` na página
  // zeraria).
  const [lidoEm, setLidoEm] = useState(painel.atualizadoEm);
  if (lidoEm !== painel.atualizadoEm) {
    setLidoEm(painel.atualizadoEm);
    setPedidos(painel.pedidos);
    if (painel.novos) setAviso({ ok: true, texto: `${painel.novos} pedido(s) novo(s) desde a última leitura.` });
  }

  const postPorId = useMemo(() => new Map(painel.posts.map((p) => [p.id, p])), [painel.posts]);

  const pedidosPorPost = useMemo(() => {
    const mapa = new Map<string, { total: number; pendentes: number }>();
    for (const r of pedidos) {
      const atual = mapa.get(r.mediaId) ?? { total: 0, pendentes: 0 };
      atual.total += 1;
      if (!r.respondidoEm) atual.pendentes += 1;
      mapa.set(r.mediaId, atual);
    }
    return mapa;
  }, [pedidos]);

  const desde = useMemo(() => {
    const dias = PERIODOS.find((p) => p.valor === periodo)?.dias;
    return dias ? agora - dias * DIA : 0;
  }, [periodo, agora]);

  const termo = busca.trim().toLowerCase();
  const postsFiltrados = useMemo(
    () =>
      painel.posts.filter(
        (p) =>
          new Date(p.quando).getTime() >= desde &&
          (formato === 'todos' || p.formato === formato) &&
          (!termo || p.legenda.toLowerCase().includes(termo) || p.palavra.toLowerCase().includes(termo))
      ),
    [painel.posts, desde, formato, termo]
  );

  const pedidosDoPeriodo = useMemo(
    () => pedidos.filter((r) => new Date(r.comentadoEm).getTime() >= desde),
    [pedidos, desde]
  );

  async function marcar(ids: string[], respondido: boolean) {
    const antes = pedidos;
    const quando = new Date().toISOString();
    setPedidos((lista) => lista.map((r) => (ids.includes(r.id) ? { ...r, respondidoEm: respondido ? quando : null } : r)));
    const r = await marcarRespondidoAction(ids, respondido);
    if (!r.ok) {
      setPedidos(antes);
      setAviso({ ok: false, texto: r.message });
    }
  }

  function atualizar() {
    iniciarAtualizacao(() => router.refresh());
  }

  const formatosPresentes = [...new Set(painel.posts.map((p) => p.formato))];

  return (
    <div className="flex flex-col gap-5">
      <Avisos painel={painel} />

      {aviso && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[13px] font-bold ${
            aviso.ok ? 'border-ouro/40 bg-ouro/10 text-ouro' : 'border-error/40 bg-error/10 text-error'
          }`}
        >
          {aviso.texto}
          <button type="button" onClick={() => setAviso(null)} className="text-[12px] underline">
            Fechar
          </button>
        </div>
      )}

      <FilaDeRespostas pedidos={pedidos} postPorId={postPorId} agora={agora} marcar={marcar} />

      {/* Filtros numa linha só, acima de tudo que eles mudam. */}
      <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmentos
            rotulo="Período"
            opcoes={PERIODOS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
            valor={periodo}
            onChange={setPeriodo}
          />
          <Segmentos
            rotulo="Formato"
            opcoes={[{ valor: 'todos' as const, rotulo: 'Todos' }, ...formatosPresentes.map((f) => ({ valor: f, rotulo: f }))]}
            valor={formato}
            onChange={setFormato}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11.5px] text-fg-faded">Lido às {hora.format(new Date(painel.atualizadoEm))}</span>
          <Dica texto="Lê de novo o Instagram: números de cada post, seguidores e comentários novos com a palavra-chave. Os pedidos novos entram na fila automaticamente.">
            <button
              type="button"
              onClick={atualizar}
              disabled={atualizando}
              className="inline-flex items-center gap-2 rounded-control border border-border-strong px-3.5 py-2 text-[12.5px] font-extrabold text-fg-secondary hover:border-fg hover:text-fg disabled:opacity-60"
            >
              <RefreshCw size={14} className={atualizando ? 'animate-spin' : ''} />
              {atualizando ? 'Lendo…' : 'Atualizar'}
            </button>
          </Dica>
        </div>
      </div>

      <Indicadores painel={painel} posts={postsFiltrados} pedidos={pedidosDoPeriodo} todosPedidos={pedidos} />

      <GraficoPorPost
        posts={postsFiltrados}
        pedidosPorPost={pedidosPorPost}
        metrica={metrica}
        setMetrica={setMetrica}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <GraficoDePedidos pedidos={pedidosDoPeriodo} agora={agora} desde={desde} />
        <GraficoDeSeguidores historico={painel.historico} />
        <GraficoPorFormato posts={postsFiltrados} />
        <GraficoPorDia posts={postsFiltrados} />
      </div>

      <TabelaDePosts
        posts={postsFiltrados}
        pedidosPorPost={pedidosPorPost}
        pecas={painel.pecas}
        busca={busca}
        setBusca={setBusca}
        aoSalvar={(texto) => {
          setAviso({ ok: true, texto });
          atualizar();
        }}
        aoFalhar={(texto) => setAviso({ ok: false, texto })}
      />
    </div>
  );
}

/* ================================================================ avisos */

function Avisos({ painel }: { painel: Painel }) {
  const itens: { texto: React.ReactNode; grave: boolean }[] = [];

  if (!painel.configurado) {
    itens.push({
      grave: true,
      texto: (
        <>
          O Instagram ainda não está ligado.{' '}
          <Link href="/admin/estudio/instagram" className="underline">
            Ligar a conta
          </Link>
          .
        </>
      ),
    });
  }
  if (painel.erro) {
    itens.push({ grave: true, texto: `Não consegui ler o Instagram agora: ${painel.erro} A fila abaixo mostra o que já estava anotado.` });
  }
  const dias = painel.token?.diasParaVencer;
  if (painel.token && !painel.token.valido) {
    itens.push({
      grave: true,
      texto: (
        <>
          O token do Instagram não vale mais.{' '}
          <Link href="/admin/estudio/instagram" className="underline">
            Renovar agora
          </Link>
          .
        </>
      ),
    });
  } else if (dias !== null && dias !== undefined && dias <= 10) {
    itens.push({
      grave: dias <= 3,
      texto: (
        <>
          O token do Instagram vence em {dias} {dias === 1 ? 'dia' : 'dias'}. Sem ele, o painel e o botão Publicar param.{' '}
          <Link href="/admin/estudio/instagram" className="underline">
            Renovar
          </Link>
          .
        </>
      ),
    });
  }

  if (itens.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {itens.map((a, i) => (
        <div
          key={i}
          role="alert"
          className={`rounded-2xl border px-4 py-3 text-[13px] font-bold ${
            a.grave ? 'border-error/40 bg-error/10 text-error' : 'border-warning/40 bg-warning/10 text-warning'
          }`}
        >
          {a.texto}
        </div>
      ))}
    </div>
  );
}

/* ====================================================== fila de respostas */

function FilaDeRespostas({
  pedidos,
  postPorId,
  agora,
  marcar,
}: {
  pedidos: PedidoDoPainel[];
  postPorId: Map<string, PostDoPainel>;
  agora: number;
  marcar: (ids: string[], respondido: boolean) => Promise<void>;
}) {
  const [verRespondidos, setVerRespondidos] = useState(false);

  const pendentes = pedidos.filter((r) => !r.respondidoEm);
  const respondidos = pedidos
    .filter((r) => r.respondidoEm)
    .sort((a, b) => (b.respondidoEm ?? '').localeCompare(a.respondidoEm ?? ''));

  // Agrupado por post, e o grupo com o pedido mais antigo primeiro: quem espera
  // há mais tempo é quem mais perto está de desistir.
  const grupos = useMemo(() => {
    const mapa = new Map<string, PedidoDoPainel[]>();
    for (const r of pendentes) mapa.set(r.mediaId, [...(mapa.get(r.mediaId) ?? []), r]);
    return [...mapa.entries()]
      .map(([mediaId, lista]) => ({
        mediaId,
        lista: lista.sort((a, b) => a.comentadoEm.localeCompare(b.comentadoEm)),
      }))
      .sort((a, b) => a.lista[0].comentadoEm.localeCompare(b.lista[0].comentadoEm));
  }, [pendentes]);

  const maisAntigo = grupos[0]?.lista[0];

  return (
    <section className="rounded-[18px] border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="etiqueta mb-2 text-[10px] text-fg-faded">FILA DE RESPOSTAS NO DIRECT</div>
          <div className="flex items-baseline gap-3">
            <span className={`font-display text-[44px] font-bold leading-none tabular-nums ${pendentes.length ? 'text-ouro' : 'text-fg'}`}>
              {pendentes.length}
            </span>
            <span className="text-[14px] font-bold text-fg-secondary">
              {pendentes.length === 0
                ? 'ninguém esperando resposta'
                : pendentes.length === 1
                  ? 'pessoa esperando o direct'
                  : 'pessoas esperando o direct'}
            </span>
          </div>
          {maisAntigo && (
            <div className="mt-1.5 text-[12.5px] text-fg-tertiary">
              O pedido mais antigo foi feito {haQuanto(maisAntigo.comentadoEm, agora)}.
            </div>
          )}
          {pendentes.some((r) => !r.usuario) && (
            <div className="mt-2 max-w-[520px] text-[12px] leading-snug text-warning">
              O Instagram está escondendo quem comentou. Na próxima renovação do token, em{' '}
              <Link href="/admin/estudio/instagram" className="underline">
                Estúdio → Instagram
              </Link>
              , marque também <span className="font-mono">instagram_manage_comments</span> — aí cada pedido vem com o
              @ e o botão de abrir o direct.
            </div>
          )}
        </div>
        <div className="max-w-[420px] text-[12px] leading-relaxed text-fg-tertiary">
          Copie a mensagem do post, abra o direct de cada pessoa, cole e marque como respondido. A resposta é manual
          até a Meta liberar o envio automático.
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-fg-tertiary">
          Tudo respondido. Quando alguém comentar a palavra-chave de um post, a pessoa aparece aqui.
        </div>
      ) : (
        <div className="divide-y divide-divider">
          {grupos.map((g) => (
            <GrupoDaFila key={g.mediaId} post={postPorId.get(g.mediaId) ?? null} lista={g.lista} agora={agora} marcar={marcar} />
          ))}
        </div>
      )}

      {respondidos.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setVerRespondidos((v) => !v)}
            aria-expanded={verRespondidos}
            className="flex w-full items-center justify-between px-5 py-3 text-[12.5px] font-bold text-fg-tertiary hover:text-fg"
          >
            Respondidos ({respondidos.length})
            <ChevronDown size={15} className={`transition-transform ${verRespondidos ? 'rotate-180' : ''}`} />
          </button>
          {verRespondidos && (
            <div className="max-h-[320px] overflow-y-auto px-5 pb-4">
              {respondidos.slice(0, 200).map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-b border-divider py-2 text-[12.5px] last:border-b-0">
                  <Check size={14} className="flex-shrink-0 text-success" aria-hidden />
                  <span className="font-bold">{r.usuario ? `@${r.usuario}` : 'autor oculto'}</span>
                  <span className="min-w-0 flex-1 truncate text-fg-tertiary">
                    {primeiraLinha(postPorId.get(r.mediaId)?.legenda ?? '', 50)}
                  </span>
                  <span className="hidden text-fg-faded sm:inline">respondido {haQuanto(r.respondidoEm ?? '', agora)}</span>
                  <Dica texto="Devolve esta pessoa para a fila, caso tenha marcado sem querer.">
                    <button
                      type="button"
                      onClick={() => marcar([r.id], false)}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-fg-tertiary hover:text-fg"
                    >
                      <Undo2 size={13} /> Desfazer
                    </button>
                  </Dica>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function GrupoDaFila({
  post,
  lista,
  agora,
  marcar,
}: {
  post: PostDoPainel | null;
  lista: PedidoDoPainel[];
  agora: number;
  marcar: (ids: string[], respondido: boolean) => Promise<void>;
}) {
  const [verMensagem, setVerMensagem] = useState(false);
  const mensagem = post?.resposta ?? mensagemPadrao({ palavra: lista[0]?.palavra ?? '', produto: null });

  return (
    <div className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Miniatura post={post} tamanho={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-extrabold">{post ? primeiraLinha(post.legenda) : 'Post fora da lista recente'}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-fg-tertiary">
            {post && <span>{dataLonga.format(new Date(post.quando))}</span>}
            {lista[0]?.palavra && (
              <span className="etiqueta rounded-full border border-ouro/40 px-2 py-0.5 text-[9.5px] text-ouro">{lista[0].palavra}</span>
            )}
            <span className="font-bold text-fg-secondary">
              {lista.length} {lista.length === 1 ? 'pendente' : 'pendentes'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BotaoCopiar texto={mensagem} rotulo="Copiar mensagem" dica="Copia a mensagem de direct deste post. Depois é só colar em cada conversa." destaque />
          <Dica texto="Mostra a mensagem que vai ser copiada, para conferir antes de mandar.">
            <button
              type="button"
              onClick={() => setVerMensagem((v) => !v)}
              aria-expanded={verMensagem}
              className="rounded-control border border-border-strong px-3 py-2 text-[12px] font-bold text-fg-secondary hover:border-fg hover:text-fg"
            >
              {verMensagem ? 'Esconder' : 'Ver mensagem'}
            </button>
          </Dica>
          {lista.length > 1 && (
            <Dica texto="Marca todos os pedidos deste post como respondidos de uma vez — use depois de mandar o direct para todos.">
              <button
                type="button"
                onClick={() => marcar(lista.map((r) => r.id), true)}
                className="rounded-control border border-border-strong px-3 py-2 text-[12px] font-bold text-fg-secondary hover:border-fg hover:text-fg"
              >
                Todos respondidos
              </button>
            </Dica>
          )}
          {post?.link && (
            <Dica texto="Abre o post no Instagram, em outra aba.">
              <a
                href={post.link}
                target="_blank"
                rel="noreferrer"
                className="grid h-9 w-9 place-items-center rounded-control border border-border-strong text-fg-secondary hover:border-fg hover:text-fg"
                aria-label="Abrir o post no Instagram"
              >
                <ExternalLink size={14} />
              </a>
            </Dica>
          )}
        </div>
      </div>

      {verMensagem && (
        <pre className="mb-3 whitespace-pre-wrap rounded-xl border border-border bg-card-dark p-3.5 font-body text-[12.5px] leading-relaxed text-fg-secondary">
          {mensagem}
        </pre>
      )}
      {post?.origemDaResposta === 'padrao' && (
        <div className="mb-3 rounded-xl border border-warning/30 bg-warning/8 px-3 py-2 text-[12px] text-warning">
          Este post ainda usa a mensagem genérica, sem link de produto. Edite a mensagem dele na tabela de posts, lá embaixo.
        </div>
      )}

      <ul className="flex flex-col">
        {lista.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-divider py-2.5 sm:flex-nowrap">
            {r.usuario ? (
              <a
                href={`https://www.instagram.com/${encodeURIComponent(r.usuario)}/`}
                target="_blank"
                rel="noreferrer"
                className="w-[150px] flex-shrink-0 truncate text-[13px] font-extrabold hover:text-ouro"
              >
                @{r.usuario}
              </a>
            ) : (
              <span className="w-[150px] flex-shrink-0 truncate text-[13px] font-bold italic text-fg-tertiary">autor oculto</span>
            )}
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-secondary">&ldquo;{r.texto}&rdquo;</span>
            <span className="flex-shrink-0 text-[11.5px] text-fg-faded">{haQuanto(r.comentadoEm, agora)}</span>
            <div className="flex flex-shrink-0 items-center gap-2">
              {r.usuario ? (
                <Dica texto={`Abre a conversa de direct com @${r.usuario} no Instagram. Cole a mensagem copiada e envie.`}>
                  <a
                    href={`https://ig.me/m/${encodeURIComponent(r.usuario)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-bold text-fg-secondary hover:border-fg hover:text-fg"
                  >
                    <MessageCircle size={13} /> Abrir direct
                  </a>
                </Dica>
              ) : (
                post?.link && (
                  <Dica texto="O Instagram não informou quem comentou. Abre o post para achar o comentário e responder a pessoa por lá.">
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-bold text-fg-secondary hover:border-fg hover:text-fg"
                    >
                      <ExternalLink size={13} /> Achar no post
                    </a>
                  </Dica>
                )
              )}
              <Dica texto="Tira esta pessoa da fila. Use depois de mandar a mensagem — dá para desfazer em Respondidos.">
                <button
                  type="button"
                  onClick={() => marcar([r.id], true)}
                  className="inline-flex items-center gap-1.5 rounded-control bg-fg px-3 py-1.5 text-[12px] font-extrabold text-page hover:opacity-90"
                >
                  <Check size={13} /> Respondido
                </button>
              </Dica>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================ indicadores */

function Indicadores({
  painel,
  posts,
  pedidos,
  todosPedidos,
}: {
  painel: Painel;
  posts: PostDoPainel[];
  pedidos: PedidoDoPainel[];
  todosPedidos: PedidoDoPainel[];
}) {
  const totalInteracoes = posts.reduce((s, p) => s + interacoes(p), 0);
  const media = posts.length ? totalInteracoes / posts.length : 0;
  const seguidores = painel.perfil?.seguidores ?? 0;
  // Engajamento por post: interações médias sobre seguidores. Sem alcance (que
  // pede outra permissão), é a medida honesta que dá para fazer.
  const engajamento = seguidores ? (media / seguidores) * 100 : 0;
  const respondidos = todosPedidos.filter((r) => r.respondidoEm).length;
  const taxa = todosPedidos.length ? (respondidos / todosPedidos.length) * 100 : null;

  const primeiro = painel.historico[0];
  const variacao = primeiro && painel.historico.length > 1 ? seguidores - primeiro.seguidores : null;

  const tiles: { rotulo: string; valor: string; nota?: string; dica: string }[] = [
    {
      rotulo: 'Seguidores',
      valor: formatarNumero(seguidores),
      nota:
        variacao === null
          ? 'a curva começa hoje'
          : `${variacao >= 0 ? '+' : ''}${formatarNumero(variacao)} desde ${dataCurta.format(new Date(`${primeiro.dia}T12:00:00Z`))}`,
      dica: 'Seguidores de agora. A variação conta a partir do primeiro dia em que o painel foi aberto — a API não guarda o histórico.',
    },
    {
      rotulo: 'Posts no período',
      valor: formatarNumero(posts.length),
      nota: posts.length ? `último em ${dataCurta.format(new Date(posts[0].quando))}` : undefined,
      dica: 'Quantos posts de feed e Reels saíram no período escolhido. Stories não entram: a API não os mostra depois de 24 horas.',
    },
    {
      rotulo: 'Interações',
      valor: formatarNumero(totalInteracoes),
      nota: `${formatarNumero(media, 1)} por post`,
      dica: 'Curtidas mais comentários dos posts do período.',
    },
    {
      rotulo: 'Engajamento',
      valor: `${formatarNumero(engajamento, 2)}%`,
      nota: 'interações por post ÷ seguidores',
      dica: 'Média de interações por post dividida pelos seguidores. Para comparar períodos e formatos entre si.',
    },
    {
      rotulo: 'Pedidos no período',
      valor: formatarNumero(pedidos.length),
      nota: taxa === null ? 'nenhum ainda' : `${formatarNumero(taxa)}% respondidos no total`,
      dica: 'Comentários com a palavra-chave do post — cada um é alguém pedindo o link no direct.',
    },
    {
      rotulo: 'Token do Instagram',
      valor: painel.token?.diasParaVencer != null ? `${painel.token.diasParaVencer} dias` : '—',
      nota: 'até precisar renovar',
      dica: 'O token vale 60 dias. Antes de vencer, renove em Estúdio → Instagram — há um lembrete agendado para isso.',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <Dica key={t.rotulo} texto={t.dica}>
          <div tabIndex={0} className="rounded-[18px] border border-border bg-card p-4 outline-none focus-visible:border-fg">
            <div className="etiqueta mb-2 text-[9.5px] text-fg-faded">{t.rotulo.toUpperCase()}</div>
            <div className="font-display text-[24px] font-bold leading-none tabular-nums">{t.valor}</div>
            {t.nota && <div className="mt-1.5 truncate text-[11.5px] text-fg-tertiary">{t.nota}</div>}
          </div>
        </Dica>
      ))}
    </div>
  );
}

/* ============================================================== gráficos */

function GraficoPorPost({
  posts,
  pedidosPorPost,
  metrica,
  setMetrica,
}: {
  posts: PostDoPainel[];
  pedidosPorPost: Map<string, { total: number; pendentes: number }>;
  metrica: Metrica;
  setMetrica: (m: Metrica) => void;
}) {
  const valor = (p: PostDoPainel) =>
    metrica === 'curtidas'
      ? p.curtidas
      : metrica === 'comentarios'
        ? p.comentarios
        : metrica === 'pedidos'
          ? (pedidosPorPost.get(p.id)?.total ?? 0)
          : metrica === 'alcance'
            ? (p.alcance ?? 0)
            : metrica === 'salvamentos'
              ? (p.salvamentos ?? 0)
              : interacoes(p);
  const comInsights = posts.some((p) => p.alcance !== null);
  const metricas = METRICAS.filter((m) => comInsights || (m.valor !== 'alcance' && m.valor !== 'salvamentos'));

  // Em ordem de data, do mais antigo ao mais novo — é uma linha do tempo.
  const ordenados = [...posts].sort((a, b) => a.quando.localeCompare(b.quando));
  const melhor = ordenados.reduce<PostDoPainel | null>((m, p) => (!m || valor(p) > valor(m) ? p : m), null);
  const rotulo = METRICAS.find((m) => m.valor === metrica)?.rotulo ?? '';

  return (
    <CartaoDeGrafico
      titulo={`${rotulo} por post`}
      subtitulo={
        melhor && valor(melhor) > 0 ? (
          <>
            Em ouro, o melhor do período: <b className="text-fg-secondary">{primeiraLinha(melhor.legenda, 60)}</b> ({formatarNumero(valor(melhor))}).
          </>
        ) : (
          'Cada coluna é um post, do mais antigo ao mais recente.'
        )
      }
      tabela={{
        colunas: ['Post', 'Data', rotulo],
        linhas: ordenados.map((p) => [primeiraLinha(p.legenda, 48), dataCurta.format(new Date(p.quando)), valor(p)]),
      }}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {metricas.map((m) => (
          <button
            key={m.valor}
            type="button"
            onClick={() => setMetrica(m.valor)}
            aria-pressed={metrica === m.valor}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-bold ${
              metrica === m.valor ? 'border-fg bg-fg text-page' : 'border-border-strong text-fg-tertiary hover:text-fg'
            }`}
          >
            {m.rotulo}
          </button>
        ))}
      </div>
      <Colunas
        altura={240}
        vazio="Nenhum post no período."
        colunas={ordenados.map((p) => ({
          chave: p.id,
          valor: valor(p),
          rotulo: dataCurta.format(new Date(p.quando)),
          destaque: melhor?.id === p.id && valor(p) > 0,
          dica: (
            <div className="flex gap-2.5">
              <Miniatura post={p} tamanho={44} />
              <div className="min-w-0">
                <div className="mb-1 line-clamp-2 font-bold">{primeiraLinha(p.legenda, 60)}</div>
                <div className="text-fg-tertiary">
                  {p.formato} · {dataLonga.format(new Date(p.quando))}
                </div>
                <div className="mt-1 tabular-nums text-fg-secondary">
                  {formatarNumero(p.curtidas)} curtidas · {formatarNumero(p.comentarios)} comentários
                  {(pedidosPorPost.get(p.id)?.total ?? 0) > 0 && ` · ${pedidosPorPost.get(p.id)?.total} pedidos`}
                </div>
              </div>
            </div>
          ),
        }))}
      />
    </CartaoDeGrafico>
  );
}

function GraficoDePedidos({ pedidos, agora, desde }: { pedidos: PedidoDoPainel[]; agora: number; desde: number }) {
  // Por semana. Por dia, com o volume de uma loja, o gráfico seria um pente de
  // zeros com uma coluna aqui e ali.
  const semanas = useMemo(() => {
    if (pedidos.length === 0) return [];
    const inicio = desde || Math.min(...pedidos.map((r) => new Date(r.comentadoEm).getTime()));
    const total = Math.max(1, Math.min(52, Math.ceil((agora - inicio) / (7 * DIA))));
    const lista = Array.from({ length: total }, (_, i) => {
      const fim = agora - (total - 1 - i) * 7 * DIA;
      return { inicio: fim - 7 * DIA, fim, respondidos: 0, pendentes: 0 };
    });
    for (const r of pedidos) {
      const t = new Date(r.comentadoEm).getTime();
      const s = lista.find((x) => t > x.inicio && t <= x.fim) ?? (t <= lista[0].inicio ? lista[0] : null);
      if (!s) continue;
      if (r.respondidoEm) s.respondidos += 1;
      else s.pendentes += 1;
    }
    return lista;
  }, [pedidos, agora, desde]);

  return (
    <CartaoDeGrafico
      titulo="Pedidos por semana"
      subtitulo="Comentários com a palavra-chave, pela semana em que foram feitos."
      legenda={
        semanas.length > 0 && (
          <>
            <ItemDaLegenda cor={COR_DESTAQUE}>Esperando resposta</ItemDaLegenda>
            <ItemDaLegenda cor={COR_BASE}>Respondidos</ItemDaLegenda>
          </>
        )
      }
      tabela={{
        colunas: ['Semana até', 'Pendentes', 'Respondidos'],
        linhas: semanas.map((s) => [dataCurta.format(new Date(s.fim)), s.pendentes, s.respondidos]),
      }}
    >
      {semanas.length === 0 ? (
        <div className="grid h-[200px] place-items-center px-6 text-center text-[13px] text-fg-tertiary">
          Nenhum pedido no período. Os pedidos aparecem quando alguém comenta a palavra-chave de um post — confira a
          coluna Palavra na tabela de posts.
        </div>
      ) : (
        <ColunasEmpilhadas
          colunas={semanas.map((s) => ({
            chave: String(s.fim),
            rotulo: dataCurta.format(new Date(s.fim)),
            base: s.respondidos,
            topo: s.pendentes,
            dica: (
              <div>
                <div className="mb-1 font-bold">
                  {dataCurta.format(new Date(s.inicio + DIA))} a {dataCurta.format(new Date(s.fim))}
                </div>
                <div className="tabular-nums text-fg-secondary">
                  {s.pendentes} esperando · {s.respondidos} respondidos
                </div>
              </div>
            ),
          }))}
        />
      )}
    </CartaoDeGrafico>
  );
}

function GraficoDeSeguidores({ historico }: { historico: { dia: string; seguidores: number }[] }) {
  const pontos = historico.map((h) => ({
    chave: h.dia,
    rotulo: dataCurta.format(new Date(`${h.dia}T12:00:00Z`)),
    valor: h.seguidores,
    dica: (
      <div>
        <div className="font-bold">{dataLonga.format(new Date(`${h.dia}T12:00:00Z`))}</div>
        <div className="tabular-nums text-fg-secondary">{formatarNumero(h.seguidores)} seguidores</div>
      </div>
    ),
  }));

  return (
    <CartaoDeGrafico
      titulo="Seguidores"
      subtitulo="Um ponto por dia em que o painel é aberto."
      tabela={{ colunas: ['Dia', 'Seguidores'], linhas: historico.map((h) => [h.dia.split('-').reverse().join('/'), h.seguidores]) }}
      rodape={
        historico.length < 2
          ? 'A API do Instagram só informa o número de hoje, sem histórico. A curva começa agora e cresce a cada dia em que o painel for aberto.'
          : undefined
      }
    >
      <Linha pontos={pontos} />
    </CartaoDeGrafico>
  );
}

function GraficoPorFormato({ posts }: { posts: PostDoPainel[] }) {
  const grupos = new Map<FormatoDoPost, PostDoPainel[]>();
  for (const p of posts) grupos.set(p.formato, [...(grupos.get(p.formato) ?? []), p]);
  const linhas = [...grupos.entries()]
    .map(([formato, lista]) => ({
      formato,
      n: lista.length,
      media: lista.reduce((s, p) => s + interacoes(p), 0) / lista.length,
    }))
    .sort((a, b) => b.media - a.media);

  return (
    <CartaoDeGrafico
      titulo="Média de interações por formato"
      subtitulo="Curtidas + comentários, em média por post de cada formato."
      tabela={{ colunas: ['Formato', 'Posts', 'Média'], linhas: linhas.map((l) => [l.formato, l.n, l.media]) }}
      rodape={linhas.some((l) => l.n < 3) ? 'Formato com menos de 3 posts: a média ainda diz pouco.' : undefined}
    >
      {linhas.length === 0 ? (
        <div className="grid h-[120px] place-items-center text-[13px] text-fg-tertiary">Nenhum post no período.</div>
      ) : (
        <Barras
          barras={linhas.map((l, i) => ({
            chave: l.formato,
            rotulo: l.formato,
            valor: l.media,
            nota: `· ${l.n} ${l.n === 1 ? 'post' : 'posts'}`,
            destaque: i === 0 && linhas.length > 1,
            dica: (
              <div>
                <div className="font-bold">{l.formato}</div>
                <div className="tabular-nums text-fg-secondary">
                  {formatarNumero(l.media, 1)} interações por post, em {l.n} {l.n === 1 ? 'post' : 'posts'}
                </div>
              </div>
            ),
          }))}
        />
      )}
    </CartaoDeGrafico>
  );
}

function GraficoPorDia({ posts }: { posts: PostDoPainel[] }) {
  const dias = DIAS_DA_SEMANA.map((rotulo, i) => {
    const lista = posts.filter((p) => p.diaDaSemana === i);
    return {
      rotulo,
      n: lista.length,
      media: lista.length ? lista.reduce((s, p) => s + interacoes(p), 0) / lista.length : 0,
    };
  });
  const melhor = dias.reduce((m, d) => (d.media > m.media ? d : m), dias[0]);

  return (
    <CartaoDeGrafico
      titulo="Média por dia da semana"
      subtitulo="Em que dia os posts rendem mais, pela média de interações."
      tabela={{ colunas: ['Dia', 'Posts', 'Média'], linhas: dias.map((d) => [d.rotulo, d.n, d.media]) }}
      rodape={
        posts.length < 20
          ? `Com ${posts.length} ${posts.length === 1 ? 'post' : 'posts'} no período, use como pista, não como regra — um post bom sozinho decide o dia.`
          : undefined
      }
    >
      <Colunas
        altura={200}
        vazio="Nenhum post no período."
        colunas={
          posts.length === 0
            ? []
            : dias.map((d) => ({
                chave: d.rotulo,
                valor: d.media,
                rotulo: d.rotulo,
                destaque: d === melhor && d.media > 0,
                dica: (
                  <div>
                    <div className="font-bold">{d.rotulo}</div>
                    <div className="tabular-nums text-fg-secondary">
                      {d.n === 0 ? 'Nenhum post neste dia' : `${formatarNumero(d.media, 1)} por post · ${d.n} ${d.n === 1 ? 'post' : 'posts'}`}
                    </div>
                  </div>
                ),
              }))
        }
      />
    </CartaoDeGrafico>
  );
}

/* ======================================================= tabela de posts */

type Ordem = 'data' | 'curtidas' | 'comentarios' | 'interacoes' | 'pedidos';

function TabelaDePosts({
  posts,
  pedidosPorPost,
  pecas,
  busca,
  setBusca,
  aoSalvar,
  aoFalhar,
}: {
  posts: PostDoPainel[];
  pedidosPorPost: Map<string, { total: number; pendentes: number }>;
  pecas: { id: string; titulo: string }[];
  busca: string;
  setBusca: (v: string) => void;
  aoSalvar: (texto: string) => void;
  aoFalhar: (texto: string) => void;
}) {
  const [ordem, setOrdem] = useState<Ordem>('data');
  const [editando, setEditando] = useState<string | null>(null);

  const valor = (p: PostDoPainel, o: Ordem): number | string =>
    o === 'data'
      ? p.quando
      : o === 'curtidas'
        ? p.curtidas
        : o === 'comentarios'
          ? p.comentarios
          : o === 'pedidos'
            ? (pedidosPorPost.get(p.id)?.total ?? 0)
            : interacoes(p);

  const ordenados = [...posts].sort((a, b) => {
    const va = valor(a, ordem);
    const vb = valor(b, ordem);
    return typeof va === 'string' ? String(vb).localeCompare(va) : (vb as number) - va;
  });

  const cabecalho: { chave: Ordem | null; rotulo: string; classe: string }[] = [
    { chave: 'data', rotulo: 'Post', classe: 'text-left' },
    { chave: null, rotulo: 'Formato', classe: 'text-left hidden md:table-cell' },
    { chave: 'curtidas', rotulo: 'Curtidas', classe: 'text-right' },
    { chave: 'comentarios', rotulo: 'Coment.', classe: 'text-right' },
    { chave: 'pedidos', rotulo: 'Pedidos', classe: 'text-right' },
    { chave: null, rotulo: 'Palavra', classe: 'text-left' },
    { chave: null, rotulo: '', classe: 'text-right' },
  ];

  return (
    <section className="rounded-[18px] border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[14.5px] font-extrabold">Posts</h2>
          <div className="mt-0.5 text-[12px] text-fg-tertiary">
            Cada post com a palavra que ele pede e a mensagem de direct. Clique no título da coluna para ordenar.
          </div>
        </div>
        <label className="relative block sm:w-[280px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-faded" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na legenda ou na palavra"
            aria-label="Buscar posts"
            className="w-full rounded-control border border-border-strong bg-input py-2 pl-8.5 pr-3 text-[13px] outline-none focus:border-fg"
          />
        </label>
      </div>

      {ordenados.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-fg-tertiary">Nenhum post com esses filtros.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-[10.5px] uppercase tracking-[.08em] text-fg-faded">
                {cabecalho.map((c, i) => (
                  <th key={i} className={`px-3 py-2.5 font-extrabold first:pl-5 last:pr-5 ${c.classe}`}>
                    {c.chave ? (
                      <button
                        type="button"
                        onClick={() => setOrdem(c.chave as Ordem)}
                        className={`uppercase tracking-[.08em] hover:text-fg ${ordem === c.chave ? 'text-fg' : ''}`}
                        aria-sort={ordem === c.chave ? 'descending' : undefined}
                      >
                        {c.rotulo}
                        {ordem === c.chave && ' ↓'}
                      </button>
                    ) : (
                      c.rotulo
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((p) => {
                const pedidos = pedidosPorPost.get(p.id);
                const aberto = editando === p.id;
                return (
                  <FragmentoDoPost
                    key={p.id}
                    post={p}
                    pedidos={pedidos}
                    aberto={aberto}
                    alternar={() => setEditando(aberto ? null : p.id)}
                    pecas={pecas}
                    aoSalvar={(t) => {
                      setEditando(null);
                      aoSalvar(t);
                    }}
                    aoFalhar={aoFalhar}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FragmentoDoPost({
  post: p,
  pedidos,
  aberto,
  alternar,
  pecas,
  aoSalvar,
  aoFalhar,
}: {
  post: PostDoPainel;
  pedidos: { total: number; pendentes: number } | undefined;
  aberto: boolean;
  alternar: () => void;
  pecas: { id: string; titulo: string }[];
  aoSalvar: (texto: string) => void;
  aoFalhar: (texto: string) => void;
}) {
  return (
    <>
      <tr className={`border-b border-divider ${aberto ? 'bg-card-hover' : 'hover:bg-card-hover'}`}>
        <td className="py-2.5 pl-5 pr-3">
          <div className="flex items-center gap-3">
            <Miniatura post={p} tamanho={40} />
            <div className="min-w-0 max-w-[340px]">
              <div className="truncate font-bold">{primeiraLinha(p.legenda, 60)}</div>
              <div className="mt-0.5 text-[11.5px] text-fg-tertiary">
                {dataLonga.format(new Date(p.quando))}
                {p.peca && (
                  <>
                    {' · '}
                    <Link href={`/admin/estudio/${p.peca.id}`} className="underline hover:text-fg">
                      peça do Estúdio
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="hidden px-3 text-fg-secondary md:table-cell">{p.formato}</td>
        <td className="px-3 text-right tabular-nums">{formatarNumero(p.curtidas)}</td>
        <td className="px-3 text-right tabular-nums">{formatarNumero(p.comentarios)}</td>
        <td className="px-3 text-right tabular-nums">
          {pedidos ? (
            <>
              {pedidos.total}
              {pedidos.pendentes > 0 && <span className="ml-1 text-[11.5px] font-bold text-ouro">({pedidos.pendentes} na fila)</span>}
            </>
          ) : (
            <span className="text-fg-faded">—</span>
          )}
        </td>
        <td className="px-3">
          {p.palavra ? (
            <span className="etiqueta rounded-full border border-ouro/40 px-2 py-0.5 text-[9.5px] text-ouro">{p.palavra}</span>
          ) : (
            <span className="text-[12px] text-fg-faded">nenhuma</span>
          )}
        </td>
        <td className="py-2.5 pl-3 pr-5">
          <div className="flex items-center justify-end gap-1.5">
            <BotaoCopiar texto={p.resposta} rotulo="Mensagem" dica="Copia a mensagem de direct deste post, para responder quem pediu." />
            <Dica texto="Muda a palavra-chave, a mensagem de direct ou a peça do Estúdio ligada a este post.">
              <button
                type="button"
                onClick={alternar}
                aria-expanded={aberto}
                aria-label="Editar post"
                className={`grid h-8 w-8 place-items-center rounded-control border ${aberto ? 'border-fg text-fg' : 'border-border-strong text-fg-secondary hover:border-fg hover:text-fg'}`}
              >
                <Pencil size={13} />
              </button>
            </Dica>
            {p.link && (
              <Dica texto="Abre o post no Instagram, em outra aba.">
                <a
                  href={p.link}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir no Instagram"
                  className="grid h-8 w-8 place-items-center rounded-control border border-border-strong text-fg-secondary hover:border-fg hover:text-fg"
                >
                  <ExternalLink size={13} />
                </a>
              </Dica>
            )}
          </div>
        </td>
      </tr>
      {aberto && (
        <tr className="border-b border-divider bg-card-hover">
          <td colSpan={7} className="px-5 pb-5 pt-1">
            <EditorDoPost post={p} pecas={pecas} aoSalvar={aoSalvar} aoFalhar={aoFalhar} aoCancelar={alternar} />
          </td>
        </tr>
      )}
    </>
  );
}

function EditorDoPost({
  post,
  pecas,
  aoSalvar,
  aoFalhar,
  aoCancelar,
}: {
  post: PostDoPainel;
  pecas: { id: string; titulo: string }[];
  aoSalvar: (texto: string) => void;
  aoFalhar: (texto: string) => void;
  aoCancelar: () => void;
}) {
  const [palavra, setPalavra] = useState(post.origemDaPalavra === 'painel' ? post.palavra : '');
  const [resposta, setResposta] = useState(post.origemDaResposta === 'painel' ? post.resposta : '');
  const [pecaId, setPecaId] = useState(post.peca?.id ?? '');
  const [salvando, iniciar] = useTransition();

  const origem = {
    peca: 'achada na peça do Estúdio',
    legenda: 'achada na legenda',
    painel: 'escrita aqui',
  } as const;

  function salvar() {
    iniciar(async () => {
      const r = await salvarPostAction({ mediaId: post.id, palavra, resposta, pecaId: pecaId || null });
      if (r.ok) aoSalvar('Post salvo. Relendo os comentários com a palavra nova…');
      else aoFalhar(r.message);
    });
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[260px_1fr]">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-fg-secondary">Palavra-chave</span>
          <input
            value={palavra}
            onChange={(e) => setPalavra(e.target.value.toUpperCase())}
            placeholder={post.palavra || 'Ex.: QUERO'}
            maxLength={30}
            className="rounded-control border border-border-strong bg-input px-3 py-2 text-[13px] font-bold uppercase outline-none focus:border-fg"
          />
          <span className="text-[11.5px] leading-snug text-fg-tertiary">
            {post.palavra && post.origemDaPalavra !== 'painel'
              ? `Em branco, vale "${post.palavra}" (${origem[post.origemDaPalavra ?? 'legenda']}).`
              : 'Quem comentar esta palavra entra na fila. Sem acento e sem diferença de maiúscula.'}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-fg-secondary">Peça do Estúdio</span>
          <select
            value={pecaId}
            onChange={(e) => setPecaId(e.target.value)}
            className="rounded-control border border-border-strong bg-input px-3 py-2 text-[13px] outline-none focus:border-fg"
          >
            <option value="">Nenhuma</option>
            {pecas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.titulo}
              </option>
            ))}
          </select>
          <span className="text-[11.5px] leading-snug text-fg-tertiary">
            Ligada a uma peça, o post usa a palavra e a mensagem de direct dela.
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold text-fg-secondary">Mensagem de direct</span>
        <textarea
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          placeholder={post.resposta}
          rows={7}
          maxLength={1000}
          className="min-h-[150px] rounded-control border border-border-strong bg-input px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-fg"
        />
        <span className="text-[11.5px] leading-snug text-fg-tertiary">
          {post.origemDaResposta === 'peca'
            ? 'Em branco, vale a mensagem da peça (o texto em cinza).'
            : 'Em branco, vale a mensagem genérica (o texto em cinza). Inclua o link do produto para o cliente não precisar perguntar de novo.'}
        </span>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={aoCancelar}
            className="rounded-control border border-border-strong px-4 py-2 text-[12.5px] font-bold text-fg-secondary hover:text-fg"
          >
            Cancelar
          </button>
          <Dica texto="Grava a palavra, a mensagem e a peça deste post e relê os comentários com a palavra nova.">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="rounded-control bg-fg px-4 py-2 text-[12.5px] font-extrabold text-page hover:opacity-90 disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </Dica>
        </div>
      </label>
    </div>
  );
}

/* ================================================================ peças */

function Miniatura({ post, tamanho }: { post: PostDoPainel | null; tamanho: number }) {
  if (!post?.miniatura) {
    return <div className="flex-shrink-0 rounded-lg border border-border bg-card-dark" style={{ width: tamanho, height: tamanho }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={post.miniatura}
      alt=""
      width={tamanho}
      height={tamanho}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="flex-shrink-0 rounded-lg border border-border object-cover"
      style={{ width: tamanho, height: tamanho }}
    />
  );
}

function BotaoCopiar({ texto, rotulo, dica, destaque }: { texto: string; rotulo: string; dica: string; destaque?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <Dica texto={dica}>
      <button
        type="button"
        onClick={copiar}
        className={`inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-[12px] font-extrabold ${
          destaque ? 'bg-fg text-page hover:opacity-90' : 'border border-border-strong text-fg-secondary hover:border-fg hover:text-fg'
        }`}
      >
        {copiado ? <Check size={13} /> : <Copy size={13} />}
        {copiado ? 'Copiada' : rotulo}
      </button>
    </Dica>
  );
}

function Segmentos<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex items-center gap-1 rounded-full border border-border p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={valor === o.valor}
          className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
            valor === o.valor ? 'bg-fg text-page' : 'text-fg-tertiary hover:text-fg'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
