'use client';

// Coluna de Ações da sala do Arthur (Fase 3, 31/10/2026). Cada botão abre uma folha com o que ele faz, o resumo
// do que vai acontecer e o "Confirmar": nada grava nem sai para o cliente sem esse segundo toque.

import { useEffect, useState, useTransition } from 'react';
import { BadgePercent, BookOpen, CalendarPlus, CheckCircle2, FileText, Handshake, Receipt, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { CASES } from '@/lib/cases-portfolio';
import { NOMES, type Escolha, type Produto } from '@/lib/simulador';
import type { AcaoDaSala } from '@/lib/reunioes/comum';
import {
  acoesDaReuniaoAction,
  aplicarDescontoAction,
  dadosDaPropostaAction,
  dispararSinalAction,
  enviarPropostaAction,
  fechouAction,
  horariosLivresAction,
  mandarCaseAction,
  marcarProximaAction,
  resumoDoSinalAction,
  type DadosDaProposta,
  type ResumoDoSinal,
} from '@/app/actions/sala';
import { baixar } from './gravacao';

export type QualAcao = 'sinal' | 'proposta' | 'desconto' | 'proxima' | 'case' | 'fechou';
export type PedidoDeAcao = { qual: QualAcao; ref?: Record<string, unknown> } | null;

const BOTOES: { qual: QualAcao; rotulo: string; Icone: typeof Receipt; dica: string }[] = [
  { qual: 'proposta', rotulo: 'Enviar proposta em PDF', Icone: FileText, dica: 'A mesma da Lia' },
  { qual: 'desconto', rotulo: 'Aplicar desconto', Icone: BadgePercent, dica: 'Dentro do limite' },
  { qual: 'case', rotulo: 'Mandar case do portfólio', Icone: BookOpen, dica: 'Link no chat' },
  { qual: 'proxima', rotulo: 'Marcar a próxima reunião', Icone: CalendarPlus, dica: 'Sala nova + agenda' },
  { qual: 'sinal', rotulo: 'Disparar cobrança do sinal', Icone: Receipt, dica: 'Asaas, 50%' },
  { qual: 'fechou', rotulo: 'Fechou', Icone: Handshake, dica: 'Vai para o Pós-venda' },
];

const campo = 'h-11 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.03] px-3 text-[16px] text-[#F4F5F7] outline-none focus:border-[#81AAF7] sm:text-[14px]';
const solido = 'flex h-11 items-center justify-center rounded-full bg-[#F2F3F5] px-5 text-[14px] font-semibold text-[#08080A] disabled:opacity-50';

function Folha({ titulo, explica, fechar, children }: { titulo: string; explica: string; fechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [fechar]);
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-[#08080A]/70 sm:place-items-center" onClick={fechar} role="dialog" aria-modal aria-label={titulo}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border border-white/[0.14] bg-[#12141A] p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_40px_120px_rgba(0,0,0,.55)] sm:max-w-[480px] sm:rounded-[32px]"
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#F4F5F7]">{titulo}</h3>
          <button onClick={fechar} aria-label="Fechar" className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-[#A3A8B2]">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-[13.5px] leading-relaxed text-[#A3A8B2]">{explica}</p>
        {children}
      </div>
    </div>
  );
}

function Linha({ r, v }: { r: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.06] py-2 text-[13.5px]">
      <span className="text-[#8B919B]">{r}</span>
      <span className="text-right text-[#ECEEF1]">{v}</span>
    </div>
  );
}

const reais = (v: number, moeda: 'BRL' | 'USD' = 'BRL') => v.toLocaleString(moeda === 'USD' ? 'en-US' : 'pt-BR', { style: 'currency', currency: moeda });

/** `aberta` fica com a sala: o copiloto também abre uma folha ("Enviar proposta deste", "Mandar o case"). */
export function Acoes({ id, aberta, setAberta, aoChat }: { id: string; aberta: PedidoDeAcao; setAberta: (p: PedidoDeAcao) => void; aoChat: (texto: string) => void }) {
  const [registro, setRegistro] = useState<AcaoDaSala[]>([]);
  useEffect(() => {
    void acoesDaReuniaoAction(id).then(setRegistro);
  }, [id]);
  const fechar = () => {
    setAberta(null);
    void acoesDaReuniaoAction(id).then(setRegistro);
  };

  return (
    <section className="rounded-[20px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015))] p-4">
      <h2 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[.24em] text-[#81AAF7]">Ações</h2>
      <div className="grid gap-1.5">
        {BOTOES.map(({ qual, rotulo, Icone, dica }) => (
          <button
            key={qual}
            onClick={() => setAberta({ qual })}
            className="flex min-h-11 items-center gap-2.5 rounded-[14px] border border-white/[0.09] bg-[#12141A] px-3 py-2 text-left text-[13.5px] text-[#ECEEF1] transition-colors duration-150 hover:border-white/[0.18]"
          >
            <Icone size={17} className="flex-shrink-0 text-[#9BA1AB]" />
            <span className="min-w-0 flex-1">{rotulo}</span>
            <span className="text-[11.5px] text-[#8B919B]">{dica}</span>
          </button>
        ))}
      </div>
      {registro.length > 0 && (
        <div className="mt-3 grid gap-1.5 border-t border-white/[0.06] pt-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[.16em] text-[#6D727C]">Feito nesta reunião</span>
          {registro.slice(0, 6).map((a, i) => (
            <p key={`${a.em}-${i}`} className="text-[12px] leading-snug text-[#A3A8B2]">
              <span className={a.ok ? 'text-[#5FD37F]' : 'text-[#F2A7A7]'}>●</span>{' '}
              {new Date(a.em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} · {a.texto.replace(/https?:\/\/\S+/g, '').slice(0, 160)}
            </p>
          ))}
        </div>
      )}

      {aberta?.qual === 'sinal' && <FolhaDoSinal id={id} fechar={fechar} aoChat={aoChat} />}
      {aberta?.qual === 'proposta' && <FolhaDaProposta id={id} fechar={fechar} inicial={aberta.ref as Escolha | undefined} />}
      {aberta?.qual === 'desconto' && <FolhaDoDesconto id={id} fechar={fechar} />}
      {aberta?.qual === 'proxima' && <FolhaDaProxima id={id} fechar={fechar} aoChat={aoChat} />}
      {aberta?.qual === 'case' && <FolhaDoCase id={id} fechar={fechar} aoChat={aoChat} inicial={typeof aberta.ref?.slug === 'string' ? aberta.ref.slug : undefined} />}
      {aberta?.qual === 'fechou' && <FolhaDoFechou id={id} fechar={fechar} />}
    </section>
  );
}

function FolhaDoSinal({ id, fechar, aoChat }: { id: string; fechar: () => void; aoChat: (t: string) => void }) {
  const toast = useToast();
  const [r, setR] = useState<ResumoDoSinal | null>(null);
  const [doc, setDoc] = useState('');
  const [indo, start] = useTransition();
  useEffect(() => {
    void resumoDoSinalAction(id).then(setR);
  }, [id]);
  return (
    <Folha
      titulo="Cobrança do sinal"
      explica="Cria no Asaas a cobrança de 50% do projeto (o cliente escolhe Pix, boleto ou cartão) e manda o link por e-mail e pelo WhatsApp. Confira antes de confirmar."
      fechar={fechar}
    >
      {!r ? (
        <p className="text-[13.5px] text-[#A3A8B2]">Montando o resumo…</p>
      ) : !r.ok ? (
        <p className="text-[14px] text-[#F2A7A7]">{r.message}</p>
      ) : (
        <>
          <Linha r="Cliente" v={r.cliente} />
          <Linha r="Valor do projeto" v={<>{reais(r.total, r.moeda)}<br /><span className="text-[11.5px] text-[#8B919B]">{r.origem}</span></>} />
          <Linha r="Sinal (50%)" v={<b>{r.existente ? reais(r.existente.valor) : reais(r.sinal, r.moeda)}</b>} />
          <Linha r="Vencimento" v={r.existente ? 'o da cobrança já criada' : r.vencimento.split('-').reverse().join('/')} />
          <Linha r="E-mail" v={r.email ?? 'sem e-mail'} />
          <Linha r="WhatsApp" v={r.whatsapp} />
          <Linha r="Asaas" v={r.ambiente === 'producao' ? 'produção (cobrança real)' : 'ambiente de testes (sandbox)'} />
          {r.existente && <p className="mt-3 text-[13px] text-[#E8B44C]">A cobrança do sinal já existe: confirmar só reenvia o mesmo link.</p>}
          {r.precisaDocumento && !r.existente && (
            <label className="mt-3 grid gap-1.5">
              <span className="text-[13px] text-[#A3A8B2]">CPF ou CNPJ do cliente (o Asaas exige)</span>
              <input value={doc} onChange={(e) => setDoc(e.target.value)} inputMode="numeric" autoComplete="off" className={campo} />
            </label>
          )}
          <button
            disabled={indo || (r.precisaDocumento && !r.existente && doc.replace(/\D/g, '').length < 11)}
            onClick={() =>
              start(async () => {
                const x = await dispararSinalAction(id, { documento: doc });
                toast(x);
                if (x.ok) {
                  if (x.link) aoChat(`Link do sinal (50%): ${x.link}`);
                  fechar();
                }
              })
            }
            className={`${solido} mt-4 w-full`}
          >
            {indo ? 'Criando a cobrança…' : r.existente ? 'Confirmar e reenviar o link' : 'Confirmar e criar a cobrança'}
          </button>
        </>
      )}
    </Folha>
  );
}

const PRODUTOS: Produto[] = ['site', 'loja', 'erp'];

function FolhaDaProposta({ id, fechar, inicial }: { id: string; fechar: () => void; inicial?: Escolha }) {
  const toast = useToast();
  const [e, setE] = useState<Escolha | null>(inicial ?? null);
  const [dados, setDados] = useState<DadosDaProposta | null>(null);
  const [indo, start] = useTransition();
  useEffect(() => {
    void dadosDaPropostaAction(id, e ?? undefined).then((d) => {
      setDados(d);
      if (!e && d?.escolha) setE(d.escolha);
    });
  }, [id, e]);
  const esc: Escolha = e ?? { produto: 'site', nivel: 1, comGestao: false, nivelGestao: 0, marca: 0 };
  const mudar = (x: Partial<Escolha>) => setE({ ...esc, ...x });
  const select = (rotulo: string, valor: number | string, opcoes: [string | number, string][], f: (v: string) => void) => (
    <label className="grid gap-1">
      <span className="text-[12px] text-[#A3A8B2]">{rotulo}</span>
      <select value={valor} onChange={(ev) => f(ev.target.value)} className={campo}>
        {opcoes.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Folha
      titulo="Proposta em PDF"
      explica="Gera a mesma pré-proposta que a Lia manda (o que inclui, valores do catálogo, desconto aprovado, formas de pagamento) e envia pelo WhatsApp. O lead passa para Proposta."
      fechar={fechar}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {select('Produto', esc.produto, PRODUTOS.map((p) => [p, p === 'site' ? 'Site' : p === 'loja' ? 'Loja virtual' : 'Sistema de gestão']), (v) => mudar({ produto: v as Produto, comGestao: v === 'erp' ? false : esc.comGestao }))}
        {select('Nível', esc.nivel, NOMES.BRL[esc.produto].map((n, i) => [i, n]), (v) => mudar({ nivel: Number(v) as Escolha['nivel'] }))}
        {esc.produto !== 'erp' &&
          select('Sistema de gestão junto', esc.comGestao ? esc.nivelGestao : -1, [[-1, 'Não'], ...NOMES.BRL.erp.map((n, i) => [i, n] as [number, string])], (v) =>
            mudar(Number(v) < 0 ? { comGestao: false } : { comGestao: true, nivelGestao: Number(v) as Escolha['nivelGestao'] }),
          )}
        {select('Marca', esc.marca, [[0, 'Já tem'], ...NOMES.BRL.marca.map((n, i) => [i + 1, n] as [number, string])], (v) => mudar({ marca: Number(v) as Escolha['marca'] }))}
      </div>
      {dados && (
        <div className="mt-3">
          <Linha r="Pacote" v={dados.resumo ?? 'sem preço no catálogo'} />
          <Linha r="Desconto aprovado" v={dados.descontoPct ? `${dados.descontoPct}%` : 'nenhum'} />
          <Linha r="WhatsApp" v={dados.whatsapp} />
        </div>
      )}
      <button
        disabled={indo || !dados?.resumo}
        onClick={() =>
          start(async () => {
            const x = await enviarPropostaAction(id, esc);
            toast(x);
            if (x.ok && x.pdf && x.arquivo) {
              const bin = Uint8Array.from(atob(x.pdf), (ch) => ch.charCodeAt(0));
              baixar(new Blob([bin], { type: 'application/pdf' }), x.arquivo);
            }
            if (x.ok) fechar();
          })
        }
        className={`${solido} mt-4 w-full`}
      >
        {indo ? 'Gerando o PDF…' : 'Confirmar e enviar a proposta'}
      </button>
    </Folha>
  );
}

function FolhaDoDesconto({ id, fechar }: { id: string; fechar: () => void }) {
  const toast = useToast();
  const [dados, setDados] = useState<DadosDaProposta | null>(null);
  const [pct, setPct] = useState('');
  const [indo, start] = useTransition();
  useEffect(() => {
    void dadosDaPropostaAction(id).then(setDados);
  }, [id]);
  const n = Number(pct.replace(',', '.'));
  const max = dados?.descontoMax ?? 10;
  return (
    <Folha
      titulo="Aplicar desconto"
      explica={`Dá um desconto extra sobre o pacote, até ${max}% (limite das configurações do atendimento). Fica valendo para a próxima proposta, sua ou da Lia, e entra na pré-venda.`}
      fechar={fechar}
    >
      {dados?.resumo && <Linha r="Pacote agora" v={dados.resumo} />}
      <label className="mt-3 grid gap-1.5">
        <span className="text-[13px] text-[#A3A8B2]">Desconto (%)</span>
        <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" placeholder={`até ${max}`} className={campo} />
      </label>
      {n > max && <p className="mt-2 text-[13px] text-[#F2A7A7]">Acima do limite de {max}%.</p>}
      <button
        disabled={indo || !(n > 0) || n > max}
        onClick={() =>
          start(async () => {
            const x = await aplicarDescontoAction(id, n);
            toast(x);
            if (x.ok) fechar();
          })
        }
        className={`${solido} mt-4 w-full`}
      >
        {indo ? 'Aplicando…' : `Confirmar ${n > 0 ? `${n}%` : ''}`}
      </button>
    </Folha>
  );
}

function FolhaDaProxima({ id, fechar, aoChat }: { id: string; fechar: () => void; aoChat: (t: string) => void }) {
  const toast = useToast();
  const [livres, setLivres] = useState<{ iso: string; texto: string }[] | null>(null);
  const [quando, setQuando] = useState<string>('');
  const [assunto, setAssunto] = useState('continuação');
  const [indo, start] = useTransition();
  useEffect(() => {
    void horariosLivresAction().then(setLivres);
  }, []);
  // datetime-local no horário de Brasília (UTC−3) → ISO.
  const iso = quando && !quando.endsWith('Z') ? new Date(`${quando}:00-03:00`).toISOString() : quando;
  return (
    <Folha
      titulo="Próxima reunião"
      explica="Cria a próxima reunião com sala própria, põe na sua agenda do Google (convite ao cliente, se tiver e-mail) e manda o link no WhatsApp quando a janela de 24 h estiver aberta. O link também vai para o chat."
      fechar={fechar}
    >
      {livres === null ? (
        <p className="text-[13px] text-[#A3A8B2]">Procurando horários livres…</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {livres.map((h) => (
            <button
              key={h.iso}
              onClick={() => setQuando(h.iso)}
              className={`min-h-11 rounded-[14px] border px-3 py-2 text-left text-[13px] ${quando === h.iso ? 'border-[#81AAF7]/60 bg-[#81AAF7]/15 text-[#B1D2FF]' : 'border-white/[0.09] text-[#D7DAE0]'}`}
            >
              {h.texto}
            </button>
          ))}
        </div>
      )}
      <label className="mt-3 grid gap-1.5">
        <span className="text-[13px] text-[#A3A8B2]">Ou outro horário (Brasília)</span>
        <input type="datetime-local" value={quando.includes('Z') ? '' : quando} onChange={(e) => setQuando(e.target.value)} className={campo} />
      </label>
      <label className="mt-2 grid gap-1.5">
        <span className="text-[13px] text-[#A3A8B2]">Assunto</span>
        <input value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={80} className={campo} />
      </label>
      <button
        disabled={indo || !quando}
        onClick={() =>
          start(async () => {
            const x = await marcarProximaAction(id, iso, assunto);
            toast(x);
            if (x.ok) {
              if (x.link) aoChat(`Nossa próxima reunião: ${x.message.split('.')[0].replace('Marcada: ', '')}. Link: ${x.link}`);
              fechar();
            }
          })
        }
        className={`${solido} mt-4 w-full`}
      >
        {indo ? 'Marcando…' : 'Confirmar e marcar'}
      </button>
    </Folha>
  );
}

function FolhaDoCase({ id, fechar, aoChat, inicial }: { id: string; fechar: () => void; aoChat: (t: string) => void; inicial?: string }) {
  const toast = useToast();
  const [slug, setSlug] = useState(inicial ?? Object.keys(CASES)[0]);
  const [whats, setWhats] = useState(false);
  const [indo, start] = useTransition();
  const c = CASES[slug];
  return (
    <Folha titulo="Mandar case do portfólio" explica="Manda o link do case escolhido no chat da reunião (o cliente abre na hora). Marque para mandar também pelo WhatsApp." fechar={fechar}>
      <div className="grid gap-1.5">
        {Object.values(CASES).map((x) => (
          <button
            key={x.slug}
            onClick={() => setSlug(x.slug)}
            className={`min-h-11 rounded-[14px] border px-3 py-2 text-left ${slug === x.slug ? 'border-[#81AAF7]/60 bg-[#81AAF7]/15' : 'border-white/[0.09]'}`}
          >
            <b className="block text-[13.5px] text-[#F4F5F7]">{x.titulo}</b>
            <span className="text-[12px] text-[#A3A8B2]">{x.tipo}</span>
          </button>
        ))}
      </div>
      {c && <p className="mt-2 text-[12.5px] leading-relaxed text-[#A3A8B2]">{c.depois}</p>}
      <label className="mt-3 flex min-h-11 items-center gap-2 text-[13.5px] text-[#D7DAE0]">
        <input type="checkbox" checked={whats} onChange={(e) => setWhats(e.target.checked)} className="h-5 w-5 accent-[#81AAF7]" /> Mandar também pelo WhatsApp
      </label>
      <button
        disabled={indo}
        onClick={() =>
          start(async () => {
            const x = await mandarCaseAction(id, slug, whats);
            toast(x);
            if (x.ok && x.link) {
              aoChat(`${c.titulo}: ${x.link}`);
              fechar();
            }
          })
        }
        className={`${solido} mt-3 w-full`}
      >
        {indo ? 'Mandando…' : 'Confirmar e mandar'}
      </button>
    </Folha>
  );
}

function FolhaDoFechou({ id, fechar }: { id: string; fechar: () => void }) {
  const toast = useToast();
  const [resp, setResp] = useState('');
  const [indo, start] = useTransition();
  return (
    <Folha
      titulo="Fechou"
      explica="Move o lead para Fechado e abre o projeto no Pós-venda com o último pacote passado (o mesmo caminho de quando a Lia fecha). A cobrança do sinal é o botão próprio; com o sinal pago, a Bia abre o projeto como sempre."
      fechar={fechar}
    >
      <label className="grid gap-1.5">
        <span className="text-[13px] text-[#A3A8B2]">Nome do responsável (dá nome à pasta do cliente)</span>
        <input value={resp} onChange={(e) => setResp(e.target.value)} maxLength={120} autoComplete="off" className={campo} />
      </label>
      <button
        disabled={indo}
        onClick={() =>
          start(async () => {
            const x = await fechouAction(id, resp);
            toast(x);
            if (x.ok) fechar();
          })
        }
        className={`${solido} mt-4 w-full`}
      >
        <CheckCircle2 size={16} className="mr-1.5" /> {indo ? 'Registrando…' : 'Confirmar: fechou'}
      </button>
    </Folha>
  );
}
