'use client';

// Sala do Arthur (Fase 1, 31/10/2026). Vídeo no centro, painel do lead à esquerda, transcrição ao vivo embaixo
// do vídeo e a coluna do Copiloto (Fase 2, "em breve") com o espaço dos botões de ação (Fase 3).
//
// Gravar = três coisas ao mesmo tempo, todas no navegador do Arthur (gravacao.ts):
//   * trechos de ~15 s de cada lado → /api/reunioes/<id>/trecho → Groq → transcrição ao vivo;
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
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Sparkles,
  Square,
  Video,
  VideoOff,
  Zap,
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
import { dataDoArquivo, mmss, nomeDeArquivo, transcricaoEmTexto, type Trecho } from '@/lib/reunioes/comum';
import { useChamada, Quadro, Som, nomeDe, audioDe } from './chamada';
import { baixar, Compositor, Fatiador, GravadorDeArquivo, MesaDeSom, mimeDeVideo } from './gravacao';
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
            <a href={l.diagnostico} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
              <ExternalLink size={13} /> Diagnóstico
            </a>
          )}
          <Link href={`/admin/captacao?lead=${l.id}`} className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
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

export function SalaDoArthur({ d }: { d: DadosDaSala }) {
  const toast = useToast();
  const { call, pessoas, estado, aviso, entrar, sair } = useChamada();
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
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  // Peças da gravação (fora do estado do React: não redesenham a tela).
  const mesa = useRef<MesaDeSom | null>(null);
  const fatiadores = useRef<Fatiador[]>([]);
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

  const enviarTrecho = useCallback(
    (audio: Blob, quem: 'arthur' | 'cliente', t: number) => {
      const f = new FormData();
      f.append('audio', audio, `${quem}-${Math.round(t)}.webm`);
      f.append('quem', quem);
      f.append('t', String(t));
      const p = fetch(`/api/reunioes/${d.id}/trecho`, { method: 'POST', body: f })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          const j = (await r.json()) as { trecho: Trecho | null };
          if (!j.trecho) return;
          // Ref na hora: o fim da gravação lê a transcrição logo depois do último envio.
          trechosRef.current = [...trechosRef.current, j.trecho];
          setTrechos(trechosRef.current);
        })
        .catch(() => setFalhas((n) => n + 1))
        .finally(() => envios.current.delete(p));
      envios.current.add(p);
    },
    [d.id],
  );

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
        const c = new Compositor(() => {
          const agora = pessoasRef.current;
          const ordem = [...agora.filter((p) => !p.local), ...agora.filter((p) => p.local)];
          return ordem.map((p) => ({ video: videos.current.get(p.session_id) ?? null, nome: p.local ? 'Arthur · Prog Soluções' : nomeDe(p, 'Cliente') }));
        });
        compositor.current = c;
        videoTrack = c.iniciar(15);
      }
    } catch (e) {
      m.fechar();
      mesa.current = null;
      await arquivoVideo?.abort().catch(() => undefined);
      return void toast({ ok: false, message: e instanceof Error && e.name === 'NotAllowedError' ? 'Permissão negada: a gravação não começou.' : 'Não foi possível começar a gravação.' });
    }

    fatiadores.current = (['arthur', 'cliente'] as const).map((lado) => new Fatiador(m, lado, inicio, enviarTrecho));
    fatiadores.current.forEach((f) => f.iniciar());
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
    fatiadores.current.forEach((f) => f.parar());
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

  const alternarMic = () => {
    call?.setLocalAudio(!mic);
    setMic(!mic);
  };
  const alternarCam = () => {
    call?.setLocalVideo(!cam);
    setCam(!cam);
  };

  const dentro = estado === 'dentro';
  const outros = pessoas.filter((p) => !p.local);
  const aoVideo = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) videos.current.set(id, el);
    else videos.current.delete(id);
  }, []);

  return (
    <div className="tema-apple relative z-[1] min-h-screen [color-scheme:dark]">
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
          <Link href="/admin/reunioes" className="mb-1 flex items-center gap-1 text-[12.5px] text-[#8B919B] hover:text-[#F4F5F7]">
            <ArrowLeft size={14} /> Reuniões
          </Link>
          <h1 className="truncate font-display text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">{d.lead?.nome ?? d.titulo}</h1>
          <p className="text-[12.5px] text-[#8B919B]">
            {new Date(d.inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {modoMeet ? 'Google Meet (plano B)' : 'sala própria'}
            {' · '}
            {d.consentimentoEm ? 'cliente aceitou a gravação' : 'cliente ainda não aceitou a gravação'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {gravando && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#C2413B]/15 px-3 py-1.5 text-[12.5px] text-[#F2A7A7]">
              <Circle size={10} className="fill-current" /> Gravando
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

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        <aside className="order-2 xl:order-1">
          <PainelDoLead d={d} />
        </aside>

        <main className="order-1 grid content-start gap-4 xl:order-2">
          {/* Vídeo */}
          <section className="relative grid aspect-video max-h-[62vh] w-full overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0B0C10]">
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
              <div className={`grid min-h-0 gap-2 p-2 ${pessoas.length > 1 ? 'grid-cols-2' : ''}`}>
                {[...outros, ...pessoas.filter((p) => p.local)].map((p) => (
                  <Quadro key={p.session_id} p={p} nome={p.local ? 'Você' : nomeDe(p, 'Cliente')} aoVideo={aoVideo} />
                ))}
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
            {dentro && !encerrada && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                <button onClick={alternarMic} aria-label="Microfone" className="grid h-10 w-10 place-items-center rounded-full border bg-[#08080A]/70">
                  {mic ? <Mic size={17} /> : <MicOff size={17} />}
                </button>
                <button onClick={alternarCam} aria-label="Câmera" className="grid h-10 w-10 place-items-center rounded-full border bg-[#08080A]/70">
                  {cam ? <Video size={17} /> : <VideoOff size={17} />}
                </button>
              </div>
            )}
          </section>

          {dentro && outros.length === 0 && !encerrada && (
            <p className="text-[13px] text-[#A3A8B2]">Esperando o cliente. Mande o link a ele (botão “Copiar link do cliente”).</p>
          )}
          {falhas > 0 && <p className="text-[12.5px] text-[#F2A7A7]">{falhas} trecho(s) não transcritos (rede ou limite da Groq). O áudio completo continua gravando.</p>}

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
                <button onClick={ligarPasta} className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
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
                {d.temAudio && d.audioArquivado && <span>Áudio arquivado no OneDrive: {d.audioArquivado}</span>}
                {d.temAudio &&
                  !d.audioArquivado &&
                  (audioUrl ? (
                    <audio controls src={audioUrl} className="w-full" />
                  ) : (
                    <button onClick={async () => setAudioUrl(await ouvirAudioAction(d.id))} className="flex h-8 w-fit items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
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
                    className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]"
                  >
                    <RefreshCw size={13} /> Processar de novo
                  </button>
                )}
              </div>
            </Bloco>
          )}
        </main>

        {/* Fase 2 (copiloto com balões) e Fase 3 (botões de ação, como a cobrança do sinal) entram aqui. */}
        <aside className="order-3 grid content-start gap-3">
          <Bloco titulo="Copiloto">
            <div className="grid place-items-center gap-2 py-8 text-center">
              <Sparkles size={22} className="text-[#9BA1AB]" />
              <p className="text-[13.5px] text-[#A3A8B2]">Em breve: sugestões da IA durante a conversa.</p>
            </div>
          </Bloco>
          <Bloco titulo="Ações">
            <div className="grid place-items-center gap-2 py-6 text-center">
              <Zap size={20} className="text-[#9BA1AB]" />
              <p className="text-[13px] text-[#8B919B]">Em breve: cobrar o sinal e outros atalhos da venda.</p>
            </div>
          </Bloco>
        </aside>
      </div>
    </div>
  );
}
