'use client';

// Sala do Arthur (31/10/2026). Vídeo no centro, painel do lead e anotações à esquerda, transcrição ao vivo embaixo
// do vídeo, e à direita o Copiloto (Fase 2: balões da IA, só ele vê) e as Ações (Fase 3: sinal, proposta,
// desconto, próxima reunião, case, fechou).
//
// Gravar = três coisas ao mesmo tempo, todas no navegador do Arthur (gravacao.ts):
//   * a mistura em fatias de ~15 s + a energia de cada lado → /api/reunioes/<id>/trecho → Groq → transcrição ao
//     vivo com quem falou (um áudio só: metade do limite grátis da Groq de antes);
//   * áudio completo (opus 32 kbps) → Storage do Supabase (bucket privado "reunioes") ao encerrar;
//   * vídeo da composição da sala → pasta do cliente em "1 - Clientes" (OneDrive) ou download automático.
// Plano B (Meet): o Arthur compartilha a aba do Meet com o áudio; o áudio da aba é o lado do cliente e o vídeo é a aba.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Circle,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  PhoneOff,
  RefreshCw,
  Square,
  Video,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { AppLoader } from '@/brand/loaders/AppLoader';
import {
  encerrarReuniaoAction,
  entrarNaSalaAction,
  estadoDaReuniaoAction,
  linkDoAudioAction,
  ouvirAudioAction,
  registrarArquivosAction,
  reprocessarReuniaoAction,
} from '@/app/actions/reunioes';
import { dataDoArquivo, mmss, nomeDeArquivo, transcricaoEmTexto, type Balao, type Trecho } from '@/lib/reunioes/comum';
import { copilotoAction, dispensarBalaoAction, salvarAnotacoesAction } from '@/app/actions/sala';
import { useChamada, Som, nomeDe, audioDe, telaDe } from './chamada';
import { Barra, Chat, Palco, SeloDaRede } from './controles';
import { Copiloto } from './Copiloto';
import { Acoes, type PedidoDeAcao } from './Acoes';
import { baixar, Compositor, Fatiador, GravadorDeArquivo, MesaDeSom, mimeDeVideo, type Energia } from './gravacao';
import {
  arquivoParaEscrever,
  ehBrave,
  escolherPastaRaiz,
  liberarPasta,
  pastaDeReunioesDoCliente,
  pastaLigada,
  salvarNaPasta,
  temSeletorDePasta,
  type PastaLigada,
} from './pastas';

export type DadosDaSala = {
  id: string;
  titulo: string;
  inicio: string;
  salaStatus: string;
  meio: 'daily' | 'meet';
  linkCliente: string | null;
  meet: string | null;
  consentimentoEm: string | null;
  trechos: Trecho[];
  baloes: Balao[];
  anotacoes: string | null;
  pendentes: number;
  resumo: string | null;
  temAudio: boolean;
  /** Caminho no OneDrive quando o áudio já foi arquivado pelo PC e saiu do Storage (0116). */
  audioArquivado?: string | null;
  videoArquivo: string | null;
  minutos: number | null;
  custoUsd: number;
  processamento: string | null;
  /** Subpasta do cliente dentro de "1 - Clientes". */
  pasta: string | null;
  lead: {
    id: string;
    nome: string;
    contato: string | null;
    ramo: string | null;
    local: string | null;
    telefone: string | null;
    email: string | null;
    site: string | null;
    instagram: string | null;
    etapa: string;
    notas: string | null;
    diagnostico: string | null;
    google: string | null;
    pacote: string[];
    pacoteDaLia: boolean;
    briefing: { campo: string; valor: string }[];
  } | null;
  resumoDaConversa: string | null;
};

type Arquivos = { video: Blob | null; videoNome: string; texto: string; textoNome: string; salvoNaPasta: boolean };

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015))] p-4">
      <h2 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[.24em] text-[#81AAF7]">{titulo}</h2>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor, href }: { rotulo: string; valor: string | null; href?: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex gap-2 py-0.5 text-[13px]">
      <span className="w-[74px] flex-shrink-0 text-[#8B919B]">{rotulo}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 truncate text-[#91B7FE] hover:underline">
          {valor}
        </a>
      ) : (
        <span className="min-w-0 break-words text-[#ECEEF1]">{valor}</span>
      )}
    </div>
  );
}

function PainelDoLead({ d }: { d: DadosDaSala }) {
  const l = d.lead;
  if (!l) return <Bloco titulo="Lead">Reunião sem lead ligado.</Bloco>;
  const site = l.site ? (l.site.startsWith('http') ? l.site : `https://${l.site}`) : null;
  return (
    <div className="grid content-start gap-3">
      <Bloco titulo="Cliente">
        <div className="mb-1 font-[family-name:var(--font-sora)] text-[18px] font-semibold leading-tight tracking-[-0.02em] text-[#F4F5F7]">{l.nome}</div>
        <Linha rotulo="Contato" valor={l.contato} />
        <Linha rotulo="Ramo" valor={l.ramo} />
        <Linha rotulo="Cidade" valor={l.local} />
        <Linha rotulo="Etapa" valor={l.etapa} />
        <Linha rotulo="Telefone" valor={l.telefone} />
        <Linha rotulo="E-mail" valor={l.email} />
        <Linha rotulo="Site" valor={l.site} href={site} />
        <Linha rotulo="Instagram" valor={l.instagram} href={l.instagram?.startsWith('http') ? l.instagram : null} />
        <Linha rotulo="Google" valor={l.google} />
        <div className="mt-2 flex flex-wrap gap-2">
          {l.diagnostico && (
            <a href={l.diagnostico} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
              <ExternalLink size={13} /> Diagnóstico
            </a>
          )}
          <Link href={`/admin/captacao?lead=${l.id}`} className="flex h-10 items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
            Ficha na Captação
          </Link>
        </div>
      </Bloco>
      <Bloco titulo={l.pacoteDaLia ? 'Pacote sugerido pela Lia' : 'Serviços sugeridos'}>
        {l.pacote.length ? (
          <ul className="grid gap-1 text-[13.5px] text-[#ECEEF1]">
            {l.pacote.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[#8B919B]">Ainda sem pacote.</p>
        )}
      </Bloco>
      <Bloco titulo="Conversa com a Lia">
        <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#D7DAE0]">{d.resumoDaConversa || 'Sem resumo da conversa no WhatsApp.'}</p>
      </Bloco>
      {l.briefing.length > 0 && (
        <Bloco titulo="Briefing">
          {l.briefing.map((b) => (
            <Linha key={b.campo} rotulo={b.campo} valor={b.valor} />
          ))}
        </Bloco>
      )}
      {l.notas && (
        <Bloco titulo="Notas">
          <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[#A3A8B2]">{l.notas}</p>
        </Bloco>
      )}
    </div>
  );
}

function Transcricao({ trechos, ao_vivo }: { trechos: Trecho[]; ao_vivo: boolean }) {
  const fim = useRef<HTMLDivElement | null>(null);
  const ordenados = useMemo(() => [...trechos].sort((a, b) => a.t - b.t), [trechos]);
  useEffect(() => fim.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), [ordenados.length]);
  return (
    <Bloco titulo={ao_vivo ? 'Transcrição ao vivo' : 'Transcrição'}>
      <div className="max-h-[260px] overflow-y-auto pr-1">
        {ordenados.length === 0 ? (
          <p className="text-[13px] text-[#8B919B]">{ao_vivo ? 'Os trechos aparecem aqui a cada ~15 segundos de fala.' : 'Sem transcrição.'}</p>
        ) : (
          ordenados.map((x, i) => (
            <p key={`${x.t}-${x.quem}-${i}`} className="py-1 text-[13.5px] leading-relaxed">
              <span className="mr-2 font-mono text-[11px] text-[#6D727C]">{mmss(x.t)}</span>
              <b className={x.quem === 'arthur' ? 'text-[#B1D2FF]' : 'text-[#F4F5F7]'}>{x.quem === 'arthur' ? 'Arthur' : 'Cliente'}:</b>{' '}
              <span className="text-[#D7DAE0]">{x.texto}</span>
            </p>
          ))
        )}
        <div ref={fim} />
      </div>
    </Bloco>
  );
}


/** Anotações do Arthur durante a reunião: salvam sozinhas e entram no relato da negociação ao encerrar. */
function Anotacoes({ id, inicial }: { id: string; inicial: string | null }) {
  const [texto, setTexto] = useState(inicial ?? '');
  const [estado, setEstado] = useState<'salvo' | 'mudou' | 'salvando'>('salvo');
  useEffect(() => {
    if (estado !== 'mudou') return;
    const t = setTimeout(async () => {
      setEstado('salvando');
      await salvarAnotacoesAction(id, texto);
      setEstado((e) => (e === 'salvando' ? 'salvo' : e));
    }, 1200);
    return () => clearTimeout(t);
  }, [texto, estado, id]);
  return (
    <Bloco titulo="Anotações">
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setEstado('mudou');
        }}
        maxLength={20000}
        rows={5}
        placeholder="Só você vê. Entram no resumo da reunião ao encerrar."
        className="w-full resize-y rounded-[14px] border border-white/[0.14] bg-white/[0.03] p-3 text-[16px] leading-relaxed text-[#ECEEF1] outline-none focus:border-[#81AAF7] sm:text-[13.5px]"
      />
      <p className="mt-1 text-[11.5px] text-[#6D727C]">{estado === 'salvo' ? 'Salvo' : estado === 'salvando' ? 'Salvando…' : 'Editando'}</p>
    </Bloco>
  );
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

export function SalaDoArthur({ d }: { d: DadosDaSala }) {
  const toast = useToast();
  const c = useChamada();
  const { pessoas, estado, aviso, entrar, sair, enviarRecado } = c;
  const [trechos, setTrechos] = useState<Trecho[]>(d.trechos);
  const [encerrada, setEncerrada] = useState(d.salaStatus === 'encerrada');
  const [meetAberto, setMeetAberto] = useState<string | null>(null);
  const [entrando, startEntrar] = useTransition();
  const [gravando, setGravando] = useState(false);
  const [finalizando, setFinalizando] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<Arquivos | null>(null);
  const [pasta, setPasta] = useState<PastaLigada>(null);
  const [semSeletor, setSemSeletor] = useState(false);
  const [brave, setBrave] = useState(false);
  const [falhas, setFalhas] = useState(0);
  const [processo, setProcesso] = useState({ status: d.processamento, resumo: d.resumo, minutos: d.minutos, custo: d.custoUsd });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [consentimento, setConsentimento] = useState<string | null>(d.consentimentoEm);
  const [chatAberto, setChatAberto] = useState(false);
  const [lidas, setLidas] = useState(0);
  // Transcrição: envios em andamento e o último "limite batido" (para o aviso discreto de atraso).
  const [emAndamento, setEmAndamento] = useState(0);
  const [adiadoEm, setAdiadoEm] = useState<number | null>(null);
  const [guardados, setGuardados] = useState(d.pendentes);
  // Copiloto
  const [baloes, setBaloes] = useState<Balao[]>(d.baloes);
  const [pensando, setPensando] = useState(false);
  const [erroDoCopiloto, setErroDoCopiloto] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoDeAcao>(null);
  const copiloto = useRef({ ultimoTotal: d.trechos.length, ultimaVez: 0, indo: false });

  // Peças da gravação (fora do estado do React: não redesenham a tela).
  const mesa = useRef<MesaDeSom | null>(null);
  const fatiador = useRef<Fatiador | null>(null);
  const gravAudio = useRef<GravadorDeArquivo | null>(null);
  const gravVideo = useRef<GravadorDeArquivo | null>(null);
  const compositor = useRef<Compositor | null>(null);
  const extras = useRef<MediaStream[]>([]);
  const envios = useRef(new Set<Promise<unknown>>());
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const destino = useRef<{ pasta: FileSystemDirectoryHandle | null; video: string; texto: string } | null>(null);
  // O compositor e o fim da gravação leem o valor atual (não o da hora em que a gravação começou).
  const pessoasRef = useRef(pessoas);
  const trechosRef = useRef(trechos);
  useEffect(() => {
    pessoasRef.current = pessoas;
    trechosRef.current = trechos;
  }, [pessoas, trechos]);

  useEffect(() => {
    // Depois de montar (no servidor não há window): sem o seletor de pasta, a gravação vira download.
    void Promise.resolve().then(() => setSemSeletor(!temSeletorDePasta()));
    void pastaLigada().then(setPasta);
    void ehBrave().then(setBrave);
  }, []);

  // Fechar a aba no meio da gravação perde o vídeo: o navegador pergunta antes.
  useEffect(() => {
    if (!gravando) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [gravando]);

  // Consentimento: o cliente pode aceitar antes de o Arthur entrar (ou com a sala aberta). Confere a cada 10 s.
  useEffect(() => {
    if (encerrada || consentimento) return;
    const t = setInterval(async () => {
      const e = await estadoDaReuniaoAction(d.id);
      if (e?.consentimento_em) setConsentimento(e.consentimento_em);
    }, 10_000);
    return () => clearInterval(t);
  }, [encerrada, consentimento, d.id]);

  // Áudio da chamada no mixer: o microfone do Arthur (faixa local da Daily) e cada pessoa remota.
  useEffect(() => {
    const m = mesa.current;
    if (!m || d.meio === 'meet' || meetAberto) return;
    const chaves = new Set<string>();
    for (const p of pessoas) {
      const chave = p.local ? 'mic' : p.session_id;
      chaves.add(chave);
      m.ligar(chave, p.local ? 'arthur' : 'cliente', audioDe(p));
    }
    m.manterSo(chaves);
  }, [pessoas, d.meio, meetAberto]);

  // O selo do cliente mostra "Gravando" só quando o Arthur grava de verdade (avisa quem entra depois também).
  const outros = pessoas.filter((p) => !p.local);
  useEffect(() => {
    if (estado === 'dentro') enviarRecado({ tipo: 'estado', gravando });
  }, [gravando, outros.length, estado, enviarRecado]);

  const enviarTrecho = useCallback(
    (audio: Blob, t: number, energia: Energia) => {
      const f = new FormData();
      f.append('audio', audio, `mistura-${Math.round(t)}.webm`);
      f.append('t', String(t));
      f.append('energia', JSON.stringify(energia));
      setEmAndamento((n) => n + 1);
      const p = fetch(`/api/reunioes/${d.id}/trecho`, { method: 'POST', body: f })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          const j = (await r.json()) as { trechos?: Trecho[]; adiado?: boolean; guardado?: boolean };
          if (j.adiado) {
            setAdiadoEm(Date.now());
            if (j.guardado) setGuardados((n) => n + 1);
            else setFalhas((n) => n + 1);
            return;
          }
          if (!j.trechos?.length) return;
          // Ref na hora: o fim da gravação lê a transcrição logo depois do último envio.
          trechosRef.current = [...trechosRef.current, ...j.trechos];
          setTrechos(trechosRef.current);
        })
        .catch(() => setFalhas((n) => n + 1))
        .finally(() => {
          envios.current.delete(p);
          setEmAndamento((n) => Math.max(0, n - 1));
        });
      envios.current.add(p);
    },
    [d.id],
  );

  // Copiloto: a cada trecho novo (no máximo um pedido a cada 20 s, um por vez), a IA lê a conversa.
  useEffect(() => {
    const k = copiloto.current;
    if (trechos.length <= k.ultimoTotal || k.indo || encerrada) return;
    const espera = Math.max(0, 20_000 - (Date.now() - k.ultimaVez));
    const t = setTimeout(async () => {
      if (k.indo) return;
      k.indo = true;
      k.ultimoTotal = trechosRef.current.length;
      k.ultimaVez = Date.now();
      setPensando(true);
      try {
        const r = await copilotoAction(d.id);
        setBaloes(r.baloes);
        setErroDoCopiloto(r.erro ?? null);
      } catch {
        setErroDoCopiloto('O copiloto não respondeu agora.');
      } finally {
        k.indo = false;
        setPensando(false);
      }
    }, espera);
    return () => clearTimeout(t);
  }, [trechos.length, encerrada, d.id]);

  const dispensar = (balaoId: string) => {
    setBaloes((b) => b.map((x) => (x.id === balaoId ? { ...x, dispensado: true } : x)));
    void dispensarBalaoAction(d.id, balaoId);
  };

  // Aviso discreto de atraso: limite batido há menos de 2 min, ou 3+ trechos esperando resposta.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [gravando]);
  const atrasada = gravando && ((adiadoEm !== null && agora - adiadoEm < 120_000) || emAndamento >= 3);

  const entrarNaSala = () =>
    startEntrar(async () => {
      const r = await entrarNaSalaAction(d.id);
      if (!r.ok) return void toast({ ok: false, message: r.message });
      if (r.meio === 'meet') {
        setMeetAberto(r.meet ?? '');
        if (r.motivo) toast({ ok: true, message: `Hoje pelo Google Meet: ${r.motivo}.` });
        if (r.meet) window.open(r.meet, '_blank', 'noopener');
        return;
      }
      await entrar(r.url, r.token, 'Arthur · Prog Soluções');
    });

  const ligarPasta = async () => {
    try {
      setPasta(await escolherPastaRaiz());
    } catch {
      /* o Arthur cancelou a escolha */
    }
  };

  const modoMeet = d.meio === 'meet' || meetAberto !== null;

  const iniciarGravacao = async () => {
    if (gravando) return;
    const inicio = Date.now();
    const quando = dataDoArquivo(new Date());
    const base = nomeDeArquivo(`${quando} - ${d.lead?.nome ?? d.titulo}`);
    destino.current = { pasta: null, video: `${base}.webm`, texto: `${nomeDeArquivo(`${quando} - ${d.titulo}`)}.txt` };
    // Pasta do cliente (pede a permissão aqui, dentro do clique). Sem ela, a gravação segue e vira download.
    let arquivoVideo: FileSystemWritableFileStream | undefined;
    try {
      const raiz = temSeletorDePasta() ? await liberarPasta() : null;
      if (raiz && d.pasta) {
        const p = await pastaDeReunioesDoCliente(raiz, d.pasta);
        destino.current.pasta = p;
        arquivoVideo = await arquivoParaEscrever(p, destino.current.video);
        setPasta({ nome: raiz.name, permissao: 'granted' });
      }
    } catch (e) {
      console.warn('[sala] pasta indisponível, a gravação vira download', e);
    }

    const m = new MesaDeSom();
    await m.retomar();
    mesa.current = m;
    let videoTrack: MediaStreamTrack | null = null;
    try {
      if (modoMeet) {
        // Plano B: microfone do Arthur + a aba do Meet (vídeo e áudio do cliente).
        const microfone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const aba = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        extras.current = [microfone, aba];
        m.ligar('mic', 'arthur', microfone.getAudioTracks()[0]);
        const somDaAba = aba.getAudioTracks()[0];
        if (!somDaAba) toast({ ok: false, message: 'A aba foi compartilhada sem o áudio: marque "Compartilhar áudio da guia" para transcrever o cliente.' });
        m.ligar('aba', 'cliente', somDaAba);
        videoTrack = aba.getVideoTracks()[0] ?? null;
      } else {
        for (const p of pessoas) m.ligar(p.local ? 'mic' : p.session_id, p.local ? 'arthur' : 'cliente', audioDe(p));
        const comp = new Compositor(() => {
          const atuais = pessoasRef.current;
          const ordem = [...atuais.filter((p) => !p.local), ...atuais.filter((p) => p.local)];
          const nome = (p: (typeof ordem)[number]) => (p.local ? 'Arthur · Prog Soluções' : nomeDe(p, 'Cliente'));
          // Tela compartilhada entra primeiro na gravação (modo apresentação).
          const telas = ordem.filter((p) => telaDe(p)).map((p) => ({ video: videos.current.get(`${p.session_id}-tela`) ?? null, nome: `Tela de ${nome(p)}` }));
          return [...telas, ...ordem.map((p) => ({ video: videos.current.get(p.session_id) ?? null, nome: nome(p) }))];
        });
        compositor.current = comp;
        videoTrack = comp.iniciar(15);
      }
    } catch (e) {
      m.fechar();
      mesa.current = null;
      await arquivoVideo?.abort().catch(() => undefined);
      return void toast({ ok: false, message: e instanceof Error && e.name === 'NotAllowedError' ? 'Permissão negada: a gravação não começou.' : 'Não foi possível começar a gravação.' });
    }

    fatiador.current = new Fatiador(m, inicio, enviarTrecho);
    fatiador.current.iniciar();
    gravAudio.current = new GravadorDeArquivo(m.mistura.stream, 'audio/webm;codecs=opus', { audioBitsPerSecond: 32000 });
    gravAudio.current.iniciar();
    const mimeVideo = mimeDeVideo();
    if (videoTrack && mimeVideo) {
      const s = new MediaStream([videoTrack, ...m.mistura.stream.getAudioTracks()]);
      gravVideo.current = new GravadorDeArquivo(s, mimeVideo, { videoBitsPerSecond: 900_000, audioBitsPerSecond: 48000 }, arquivoVideo);
      gravVideo.current.iniciar();
    }
    setGravando(true);
    toast({ ok: true, message: destino.current.pasta ? `Gravando. O vídeo vai para ${d.pasta}\\Reuniões.` : 'Gravando. Ao encerrar, o vídeo é baixado no seu PC.' });
  };

  /** Para tudo e guarda: áudio no Storage, vídeo e transcrição na pasta (ou download). */
  const pararGravacao = async (): Promise<void> => {
    if (!mesa.current) return;
    setFinalizando('Fechando a gravação');
    fatiador.current?.parar();
    compositor.current?.parar();
    const [audio, video] = await Promise.all([gravAudio.current?.parar() ?? null, gravVideo.current?.parar() ?? null]);
    extras.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    mesa.current.fechar();
    mesa.current = null;
    setGravando(false);

    // Últimos trechos antes de encerrar (o servidor monta a transcrição completa com eles).
    setFinalizando('Transcrevendo os últimos trechos');
    await Promise.allSettled([...envios.current]);

    const dest = destino.current!;
    const registro: { audioPath?: string; videoArquivo?: string } = {};
    if (audio && audio.size > 2000) {
      setFinalizando('Enviando o áudio');
      const l = await linkDoAudioAction(d.id);
      if (l.ok) {
        const { error } = await createClient().storage.from('reunioes').uploadToSignedUrl(l.path, l.token, audio, { contentType: 'audio/webm' });
        if (!error) registro.audioPath = l.path;
        else toast({ ok: false, message: 'O áudio não subiu para o Storage. O vídeo e a transcrição continuam salvos.' });
      }
    }

    setFinalizando('Salvando o vídeo e a transcrição');
    const texto = transcricaoEmTexto(trechosRef.current);
    const cabecalho = `${d.titulo}\n${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n`;
    let salvoNaPasta = false;
    if (dest.pasta) {
      try {
        await salvarNaPasta(dest.pasta, dest.texto, cabecalho + texto);
        if (video) await salvarNaPasta(dest.pasta, dest.video, video);
        salvoNaPasta = true;
        registro.videoArquivo = `${d.pasta}\\Reuniões\\${dest.video}`;
      } catch {
        salvoNaPasta = false;
      }
    }
    const arq: Arquivos = { video, videoNome: dest.video, texto: cabecalho + texto, textoNome: dest.texto, salvoNaPasta };
    if (!salvoNaPasta) {
      // Brave, Firefox ou pasta sem permissão: baixa sozinho; se o navegador segurar, ficam os botões grandes.
      if (video) baixar(video, dest.video);
      baixar(new Blob([arq.texto], { type: 'text/plain;charset=utf-8' }), dest.texto);
      if (video) registro.videoArquivo = `${dest.video} (baixado)`;
    }
    setArquivos(arq);
    await registrarArquivosAction(d.id, registro);
    setFinalizando(null);
  };

  const encerrar = async () => {
    if (!confirm('Encerrar a reunião? A sala fecha para o cliente e o resumo vai para o seu WhatsApp.')) return;
    if (gravando) await pararGravacao();
    await sair();
    const r = await encerrarReuniaoAction(d.id);
    toast(r);
    if (r.ok) {
      setEncerrada(true);
      setProcesso((p) => ({ ...p, status: 'processando' }));
    }
  };

  // Depois de encerrar: acompanha o processamento até o resumo chegar.
  useEffect(() => {
    if (!encerrada || processo.status !== 'processando') return;
    const t = setInterval(async () => {
      const e = await estadoDaReuniaoAction(d.id);
      if (e && e.processamento !== 'processando')
        setProcesso({ status: e.processamento, resumo: e.resumo, minutos: e.minutos_participante === null ? null : Number(e.minutos_participante), custo: Number(e.custo_usd ?? 0) });
    }, 5000);
    return () => clearInterval(t);
  }, [encerrada, processo.status, d.id]);

  const copiarLink = async () => {
    if (!d.linkCliente) return;
    await navigator.clipboard.writeText(d.linkCliente).catch(() => undefined);
    toast({ ok: true, message: 'Link do cliente copiado.' });
  };

  const dentro = estado === 'dentro';
  const aoVideo = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) videos.current.set(id, el);
    else videos.current.delete(id);
  }, []);
  const recebidas = c.mensagens.filter((m) => !m.minha).length;
  const naoLidas = chatAberto ? 0 : Math.max(0, recebidas - lidas);
  const alternarChat = () => {
    setChatAberto((a) => !a);
    setLidas(recebidas);
  };
  const { enviarMensagem } = c;
  // Ações e copiloto mandam links no chat da reunião (o cliente abre na hora).
  const noChat = useCallback(
    (texto: string) => {
      if (!dentro) return;
      enviarMensagem(texto, 'Arthur · Prog Soluções');
      setChatAberto(true);
    },
    [dentro, enviarMensagem],
  );

  return (
    <div className="tema-apple relative z-[1] min-h-screen overflow-x-clip [color-scheme:dark]">
      <div className="aurora aurora-suave" aria-hidden />
      {finalizando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#08080A]/80">
          <div className="w-full max-w-[420px]">
            <AppLoader rotulo={finalizando} altura={200} />
          </div>
        </div>
      )}

      {/* Cabeçalho com os botões da reunião */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/reunioes" className="mb-1 flex min-h-10 items-center gap-1 text-[12.5px] text-[#8B919B] hover:text-[#F4F5F7]">
            <ArrowLeft size={14} /> Reuniões
          </Link>
          <h1 className="truncate font-display text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">{d.lead?.nome ?? d.titulo}</h1>
          <p className="text-[12.5px] text-[#8B919B]">
            {new Date(d.inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {modoMeet ? 'Google Meet (plano B)' : 'sala própria'}
            {' · '}
            {consentimento ? <span className="text-[#5FD37F]">Cliente aceitou a gravação às {hhmm(consentimento)}</span> : 'cliente ainda não aceitou a gravação'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dentro && <SeloDaRede rede={c.rede} reconectando={c.reconectando} />}
          {gravando && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#C2413B]/15 px-3 py-1.5 text-[12.5px] text-[#F2A7A7]">
              <Circle size={10} className="fill-current" /> Gravando
            </span>
          )}
          {atrasada && (
            <span title="O limite grátis da transcrição apertou: os trechos ficam guardados e entram no fim." className="rounded-full bg-[#E8B44C]/12 px-3 py-1.5 text-[12px] text-[#F1D08A]">
              Transcrição atrasada
            </span>
          )}
          {d.linkCliente && (
            <button onClick={copiarLink} className="flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px]">
              <Copy size={14} /> Copiar link do cliente
            </button>
          )}
          {!encerrada && (dentro || modoMeet) && !gravando && (
            <button onClick={iniciarGravacao} className="bg-accent flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
              <Circle size={12} className="fill-[#C2413B] text-[#C2413B]" /> Iniciar gravação
            </button>
          )}
          {gravando && (
            <button onClick={() => void pararGravacao()} className="flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px]">
              <Square size={13} /> Parar gravação
            </button>
          )}
          {!encerrada && (
            <button onClick={() => void encerrar()} className="flex h-10 items-center gap-1.5 rounded-[999px] bg-[#C2413B] px-4 text-[13px] font-semibold text-white">
              <PhoneOff size={14} /> Encerrar
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)_330px]">
        <aside className="order-3 grid min-w-0 content-start gap-3 xl:order-1">
          <PainelDoLead d={d} />
          {!encerrada && <Anotacoes id={d.id} inicial={d.anotacoes} />}
        </aside>

        <main className="order-1 grid min-w-0 content-start gap-4 xl:order-2">
          {/* Vídeo (com o chat ao lado quando aberto) */}
          <section className={`grid min-w-0 gap-3 ${chatAberto && dentro ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
            <div className="relative grid aspect-video max-h-[62vh] w-full overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0B0C10]">
              {encerrada ? (
                <div className="grid place-items-center p-6 text-center text-[14px] text-[#A3A8B2]">Reunião encerrada.</div>
              ) : modoMeet ? (
                <div className="grid place-items-center p-6 text-center">
                  <div className="max-w-[440px] text-[14px] leading-relaxed text-[#D7DAE0]">
                    <p className="mb-3">
                      Hoje a reunião é pelo Google Meet. Abra o Meet, depois toque em <b>Iniciar gravação</b> e compartilhe a aba do Meet <b>com o áudio da guia</b>:
                      a transcrição usa o seu microfone e o áudio da aba.
                    </p>
                    {(meetAberto || d.meet) && (
                      <a href={meetAberto || d.meet || '#'} target="_blank" rel="noreferrer" className="bg-accent inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
                        <ExternalLink size={14} /> Abrir o Meet
                      </a>
                    )}
                    {!meetAberto && !d.meet && <p className="text-[#F2A7A7]">A reunião não tem link do Meet: crie um na sua agenda e mande ao cliente.</p>}
                  </div>
                </div>
              ) : dentro ? (
                <div className="min-h-0 p-2">
                  <Palco pessoas={pessoas} falando={c.falando} nomeDoLocal="Você" nomePadrao="Cliente" aoVideo={aoVideo} />
                </div>
              ) : (
                <div className="grid place-items-center p-6 text-center">
                  <div>
                    {aviso && <p className="mb-3 max-w-[420px] text-[13.5px] text-[#F2A7A7]">{aviso}</p>}
                    <button onClick={entrarNaSala} disabled={entrando || estado === 'entrando'} className="bg-accent flex h-[52px] items-center gap-2 rounded-full px-6 text-[15px] font-semibold disabled:opacity-60">
                      <Video size={18} /> {entrando || estado === 'entrando' ? 'Abrindo a sala…' : 'Entrar na sala'}
                    </button>
                  </div>
                </div>
              )}
              {pessoas.map((p) => (
                <Som key={`som-${p.session_id}`} p={p} />
              ))}
              {c.reconectando && (
                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-[#08080A]/80 px-4 py-1.5 text-[12.5px] text-[#F1D08A]">Reconectando…</div>
              )}
            </div>
            {chatAberto && dentro && (
              <div className="h-[320px] lg:h-auto">
                <Chat mensagens={c.mensagens} enviar={(t) => enviarMensagem(t, 'Arthur · Prog Soluções')} fechar={() => setChatAberto(false)} vazio="Mande links, a proposta ou o que o cliente pedir. Ele vê na hora." />
              </div>
            )}
          </section>

          {dentro && !encerrada && <Barra c={c} chatAberto={chatAberto} aoChat={alternarChat} naoLidas={naoLidas} />}

          {dentro && outros.length === 0 && !encerrada && (
            <p className="text-[13px] text-[#A3A8B2]">Esperando o cliente. Quem já está na sala de espera entra sozinho agora que você abriu a sala.</p>
          )}
          {(falhas > 0 || guardados > 0) && (
            <p className="text-[12.5px] text-[#A3A8B2]">
              {guardados > 0 && `${guardados} trecho(s) guardados por causa do limite grátis da transcrição: entram na transcrição ao encerrar. `}
              {falhas > 0 && <span className="text-[#F2A7A7]">{falhas} trecho(s) não transcritos (rede). O áudio completo continua gravando.</span>}
            </p>
          )}

          <Transcricao trechos={trechos} ao_vivo={gravando} />

          {/* Pasta das gravações */}
          <Bloco titulo="Gravações">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <FolderOpen size={16} className="text-[#9BA1AB]" />
              {semSeletor ? (
                <span className="text-[#A3A8B2]">Este navegador não salva direto em pasta: ao encerrar, o vídeo e a transcrição são baixados.</span>
              ) : pasta ? (
                <span className="text-[#D7DAE0]">
                  Pasta ligada: <b>{pasta.nome}</b>
                  {d.pasta ? ` → ${d.pasta}\\Reuniões` : ''}
                  {pasta.permissao !== 'granted' ? ' (o navegador pede a permissão de novo ao gravar)' : ''}
                </span>
              ) : (
                <span className="text-[#A3A8B2]">Nenhuma pasta ligada: escolha a pasta “1 - Clientes”.</span>
              )}
              {!semSeletor && (
                <button onClick={ligarPasta} className="flex h-10 items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
                  Escolher pasta das gravações
                </button>
              )}
            </div>
            {brave && (
              <p className="mt-2 text-[12.5px] text-[#A3A8B2]">
                No Brave, ative “File System Access” em brave://flags para salvar direto na pasta do OneDrive, ou ative “Perguntar onde salvar” nos downloads.
              </p>
            )}
            {arquivos && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {arquivos.salvoNaPasta ? (
                  <span className="text-[13px] text-[#5FD37F]">Vídeo e transcrição salvos em {d.pasta}\Reuniões.</span>
                ) : (
                  <>
                    {arquivos.video && (
                      <button onClick={() => baixar(arquivos.video!, arquivos.videoNome)} className="bg-accent flex h-[52px] items-center gap-2 rounded-full px-6 text-[15px] font-semibold">
                        <Download size={18} /> Baixar gravação
                      </button>
                    )}
                    <button
                      onClick={() => baixar(new Blob([arquivos.texto], { type: 'text/plain;charset=utf-8' }), arquivos.textoNome)}
                      className="flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px]"
                    >
                      <Download size={14} /> Baixar transcrição
                    </button>
                  </>
                )}
              </div>
            )}
            {encerrada && (d.videoArquivo || d.temAudio) && !arquivos && (
              <div className="mt-2 grid gap-2 text-[13px] text-[#A3A8B2]">
                {d.videoArquivo && <span>Vídeo: {d.videoArquivo}</span>}
                {d.temAudio &&
                  (audioUrl ? (
                    <audio controls src={audioUrl} className="w-full" />
                  ) : (
                    <button onClick={async () => setAudioUrl(await ouvirAudioAction(d.id))} className="flex h-10 w-fit items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
                      Ouvir o áudio
                    </button>
                  ))}
              </div>
            )}
          </Bloco>

          {encerrada && (
            <Bloco titulo="Resumo da reunião">
              {processo.status === 'processando' ? (
                <p className="text-[13.5px] text-[#A3A8B2]">A IA está lendo a transcrição e atualizando a negociação. O resumo também vai para o seu WhatsApp.</p>
              ) : processo.resumo ? (
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-[#ECEEF1]">{processo.resumo}</p>
              ) : (
                <p className="text-[13.5px] text-[#A3A8B2]">{processo.status === 'erro' ? 'A IA não conseguiu processar a transcrição.' : 'Sem resumo (a reunião não teve fala transcrita).'}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] text-[#8B919B]">
                {processo.minutos !== null && <span>{Math.round(processo.minutos)} min de participante na Daily</span>}
                <span>Custo: US$ {processo.custo.toFixed(3)}</span>
                {processo.status !== 'processando' && (
                  <button
                    onClick={async () => {
                      const r = await reprocessarReuniaoAction(d.id);
                      toast(r);
                      if (r.ok) setProcesso((p) => ({ ...p, status: 'processando' }));
                    }}
                    className="flex h-10 items-center gap-1.5 rounded-full border px-3 text-[12.5px]"
                  >
                    <RefreshCw size={13} /> Processar de novo
                  </button>
                )}
              </div>
            </Bloco>
          )}
        </main>

        {/* Fase 2 (copiloto com balões) e Fase 3 (botões de ação). */}
        <aside className="order-2 grid min-w-0 content-start gap-3 xl:order-3">
          <Copiloto
            baloes={baloes}
            pensando={pensando}
            erro={erroDoCopiloto}
            ativo={gravando || trechos.length > 0}
            dispensar={dispensar}
            aoUsarPacote={(ref) => setPedido({ qual: 'proposta', ref })}
            aoMandarCase={(slug) => setPedido({ qual: 'case', ref: { slug } })}
          />
          {!encerrada || d.lead ? <Acoes id={d.id} aberta={pedido} setAberta={setPedido} aoChat={noChat} /> : null}
        </aside>
      </div>
    </div>
  );
}
