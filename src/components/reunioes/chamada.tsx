'use client';

// Videochamada da sala (Daily, 31/10/2026). Usa o "call object" da Daily, não o iframe pronto: a tela é nossa
// (marca Prog Soluções), as faixas de áudio ficam acessíveis para a gravação, e os escudos do Brave não têm
// iframe de terceiro para bloquear (só a conexão com a Daily, que é o próprio serviço da chamada).
// A biblioteca carrega só ao entrar (import dinâmico), para a página abrir rápido no celular.
//
// Fase 2 (31/10/2026), recursos de reunião de venda conferidos nos tipos do daily-js 0.93.0 e em docs.daily.co:
//   * compartilhar tela: startScreenShare/stopScreenShare; a tela chega em tracks.screenVideo (só onde
//     supportedBrowser().supportsScreenShare: no celular o navegador não compartilha a tela);
//   * chat: sendAppMessage(data, '*') (JSON até 4 KB; quem manda não recebe o próprio broadcast) e o evento
//     app-message. O mesmo canal leva o estado "gravando" do Arthur para o selo do cliente;
//   * desfoque: updateInputSettings({ video: { processor: { type: 'background-blur', config: { strength } } } }),
//     só em navegador de computador (supportsVideoProcessing);
//   * qualidade da rede: evento network-quality-change (networkState good/low|warning/bad);
//   * reconexão: a Daily reconecta sozinha a mídia enquanto a sinalização vive (evento network-connection
//     interrupted/connected). Se a sinalização cai de vez, vem error (connection-error) + left-meeting: aí esta
//     tela entra de novo sozinha, até 3 vezes, com o mesmo token;
//   * aparelhos: enumerateDevices + setInputDevicesAsync; no celular, cycleCamera (frente/traseira);
//   * quem fala: active-speaker-change.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { MicOff, MonitorUp, VideoOff } from 'lucide-react';

export type Estado = 'fora' | 'entrando' | 'dentro' | 'saiu' | 'erro';
export type Rede = 'boa' | 'fraca' | 'ruim';
export type MensagemDoChat = { id: string; de: string; texto: string; em: number; minha: boolean };
export type Aparelho = { id: string; nome: string };

/** Sozinho na sala por este tempo: sai sozinho (a Daily não tem essa trava; evita minutos à toa). */
const SOZINHO_MS = 10 * 60_000;
/** Tentativas de voltar sozinho quando a chamada cai (sinalização perdida). */
const TENTATIVAS = [2_000, 5_000, 10_000];
/** Fins que não adianta tentar de novo: a sala acabou ou o acesso venceu. */
const FIM_DEFINITIVO = new Set(['ejected', 'exp-room', 'exp-token', 'no-room', 'meeting-full', 'not-allowed']);

type Entrada = { url: string; token: string; nome: string };

/** Mensagens que andam pelo canal da Daily (app messages). */
type Recado = { tipo: 'chat'; texto: string; nome: string } | { tipo: 'estado'; gravando: boolean };

export function useChamada(o?: { aoRecado?: (r: Recado, de: string) => void }) {
  const [call, setCall] = useState<DailyCall | null>(null);
  const [pessoas, setPessoas] = useState<DailyParticipant[]>([]);
  const [estado, setEstado] = useState<Estado>('fora');
  const [aviso, setAviso] = useState<string | null>(null);
  const [rede, setRede] = useState<Rede | null>(null);
  const [reconectando, setReconectando] = useState(false);
  const [falando, setFalando] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDoChat[]>([]);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [desfoque, setDesfoque] = useState(false);
  const [suporte, setSuporte] = useState({ tela: false, desfoque: false, celular: false });
  const callRef = useRef<DailyCall | null>(null);
  const entradaRef = useRef<Entrada | null>(null);
  const saindo = useRef(false);
  const tentativa = useRef(0);
  const aoRecado = useRef(o?.aoRecado);
  useEffect(() => {
    aoRecado.current = o?.aoRecado;
  });

  const atualizar = useCallback(() => {
    const c = callRef.current;
    if (!c || c.isDestroyed()) return;
    const ps = c.participants();
    setPessoas([ps.local, ...Object.values(ps).filter((p) => !p.local)].filter(Boolean));
  }, []);

  const sair = useCallback(async () => {
    saindo.current = true;
    const c = callRef.current;
    callRef.current = null;
    setCall(null);
    if (c && !c.isDestroyed()) {
      await c.leave().catch(() => undefined);
      await c.destroy().catch(() => undefined);
    }
    setPessoas([]);
    setRede(null);
    setReconectando(false);
    setEstado((e) => (e === 'erro' ? e : 'saiu'));
  }, []);

  const entrarRef = useRef<((url: string, token: string, nome: string) => Promise<void>) | null>(null);

  /** A chamada caiu sem a pessoa pedir: tenta voltar sozinha (até 3 vezes). */
  const voltarSozinho = useCallback((tipo: string | undefined) => {
    const e = entradaRef.current;
    if (saindo.current || !e || (tipo && FIM_DEFINITIVO.has(tipo)) || tentativa.current >= TENTATIVAS.length) return false;
    const espera = TENTATIVAS[tentativa.current++];
    setReconectando(true);
    setAviso('A conexão caiu. Reconectando…');
    setTimeout(() => {
      if (!saindo.current) void entrarRef.current?.(e.url, e.token, e.nome);
    }, espera);
    return true;
  }, []);

  const entrar = useCallback(
    async (url: string, token: string, nome: string) => {
      saindo.current = false;
      entradaRef.current = { url, token, nome };
      setEstado('entrando');
      const Daily = (await import('@daily-co/daily-js')).default;
      const nav = Daily.supportedBrowser();
      setSuporte({ tela: nav.supportsScreenShare, desfoque: nav.supportsVideoProcessing && !nav.mobile, celular: nav.mobile });
      // Só um call object por página: sobra de uma tentativa anterior sai antes.
      const velho = Daily.getCallInstance?.();
      if (velho && !velho.isDestroyed()) await velho.destroy();
      const c = Daily.createCallObject({ subscribeToTracksAutomatically: true });
      callRef.current = c;
      setCall(c);
      c.on('joined-meeting', () => {
        tentativa.current = 0;
        setEstado('dentro');
        setReconectando(false);
        setAviso(null);
        atualizar();
      })
        .on('participant-joined', atualizar)
        .on('participant-updated', atualizar)
        .on('participant-left', atualizar)
        .on('track-started', atualizar)
        .on('track-stopped', atualizar)
        .on('local-screen-share-started', atualizar)
        .on('local-screen-share-stopped', atualizar)
        .on('active-speaker-change', (e) => setFalando(e?.activeSpeaker?.peerId ?? null))
        .on('network-quality-change', (e) => {
          const s = (e?.networkState ?? e?.threshold) as string | undefined;
          setRede(s === 'good' ? 'boa' : s === 'bad' || s === 'very-low' ? 'ruim' : s ? 'fraca' : null);
        })
        .on('network-connection', (e) => {
          if (e?.type === 'peer-to-peer' && e.event === 'interrupted') return;
          if (e?.event === 'interrupted') setReconectando(true);
          if (e?.event === 'connected') setReconectando(false);
        })
        .on('app-message', (e) => {
          const r = e?.data as Recado | undefined;
          if (!r || typeof r !== 'object') return;
          if (r.tipo === 'chat' && typeof r.texto === 'string') {
            setMensagens((m) => [...m, { id: `${e.fromId}-${Date.now()}`, de: String(r.nome ?? 'Participante').slice(0, 40), texto: r.texto.slice(0, 1000), em: Date.now(), minha: false }].slice(-200));
          }
          aoRecado.current?.(r, e.fromId);
        })
        .on('left-meeting', () => {
          if (!saindo.current && voltarSozinho(undefined)) return;
          setEstado((x) => (x === 'erro' ? x : 'saiu'));
        })
        .on('camera-error', (e) => setAviso(`Câmera ou microfone bloqueados: ${e?.errorMsg?.errorMsg ?? 'libere o acesso no navegador'}.`))
        .on('error', (e) => {
          const tipo = e?.error?.type;
          if (voltarSozinho(tipo)) return;
          // Fim normal da sala (horário, encerrada, cheia) com palavras de gente; o resto, a mensagem da Daily.
          const fim: Record<string, string> = {
            ejected: 'A sala fechou: a reunião foi encerrada ou passou do tempo.',
            'exp-room': 'O horário desta sala já passou.',
            'exp-token': 'O acesso a esta sala expirou.',
            'no-room': 'A sala foi encerrada.',
            'meeting-full': 'A sala está cheia.',
            'connection-error': 'A conexão caiu e não voltou. Confira a internet e entre de novo.',
          };
          setReconectando(false);
          setAviso((tipo && fim[tipo]) || e?.errorMsg || 'A chamada caiu.');
          setEstado('erro');
        });
      try {
        await c.join({ url, token, userName: nome, startVideoOff: !cam, startAudioOff: !mic });
        if (desfoque) await c.updateInputSettings({ video: { processor: { type: 'background-blur', config: { strength: 0.6 } } } }).catch(() => undefined);
      } catch (e) {
        if (voltarSozinho(undefined)) return;
        setAviso(e instanceof Error ? e.message : 'Não foi possível entrar.');
        setEstado('erro');
      }
    },
    // mic/cam/desfoque: o valor da hora em que entra (a reconexão mantém o que a pessoa escolheu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atualizar, voltarSozinho],
  );
  useEffect(() => {
    entrarRef.current = entrar;
  }, [entrar]);

  // Ninguém mais na sala por 10 min: sai.
  const outros = pessoas.filter((p) => !p.local).length;
  useEffect(() => {
    if (estado !== 'dentro' || outros > 0) return;
    const t = setTimeout(() => {
      setAviso('Você ficou sozinho na sala por 10 minutos e saiu automaticamente. Entre de novo quando a outra pessoa chegar.');
      void sair();
    }, SOZINHO_MS);
    return () => clearTimeout(t);
  }, [estado, outros, sair]);

  useEffect(
    () => () => {
      saindo.current = true;
      void callRef.current?.destroy();
    },
    [],
  );

  const alternarMic = useCallback(() => {
    callRef.current?.setLocalAudio(!mic);
    setMic(!mic);
  }, [mic]);
  const alternarCam = useCallback(() => {
    callRef.current?.setLocalVideo(!cam);
    setCam(!cam);
  }, [cam]);

  const eu = pessoas.find((p) => p.local);
  const compartilhando = !!eu && !!telaDe(eu);
  const alternarTela = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.localScreenVideo()) c.stopScreenShare();
    else c.startScreenShare();
  }, []);

  const alternarDesfoque = useCallback(async () => {
    const c = callRef.current;
    const novo = !desfoque;
    setDesfoque(novo);
    if (!c) return;
    try {
      await c.updateInputSettings({ video: { processor: novo ? { type: 'background-blur', config: { strength: 0.6 } } : { type: 'none' } } });
    } catch {
      setDesfoque(!novo);
      setAviso('Este navegador não conseguiu desfocar o fundo.');
    }
  }, [desfoque]);

  const aparelhos = useCallback(async (): Promise<{ cameras: Aparelho[]; mics: Aparelho[]; atuais: { camera: string | null; mic: string | null } }> => {
    const c = callRef.current;
    if (!c) return { cameras: [], mics: [], atuais: { camera: null, mic: null } };
    const [{ devices }, atuais] = await Promise.all([c.enumerateDevices(), c.getInputDevices()]);
    const lista = (k: string) => devices.filter((d) => d.kind === k && d.deviceId).map((d, i) => ({ id: d.deviceId, nome: d.label || `${k === 'videoinput' ? 'Câmera' : 'Microfone'} ${i + 1}` }));
    return {
      cameras: lista('videoinput'),
      mics: lista('audioinput'),
      atuais: { camera: 'deviceId' in atuais.camera ? atuais.camera.deviceId : null, mic: 'deviceId' in atuais.mic ? atuais.mic.deviceId : null },
    };
  }, []);
  const trocarAparelho = useCallback(async (tipo: 'camera' | 'mic', id: string) => {
    await callRef.current?.setInputDevicesAsync(tipo === 'camera' ? { videoDeviceId: id } : { audioDeviceId: id });
  }, []);
  const virarCamera = useCallback(async () => {
    await callRef.current?.cycleCamera({ preferDifferentFacingMode: true });
  }, []);

  const enviarRecado = useCallback((r: Recado) => {
    const c = callRef.current;
    if (!c || c.isDestroyed() || c.meetingState() !== 'joined-meeting') return;
    c.sendAppMessage(r, '*');
  }, []);
  const enviarMensagem = useCallback(
    (texto: string, nome: string) => {
      const t = texto.trim().slice(0, 1000);
      if (!t) return;
      enviarRecado({ tipo: 'chat', texto: t, nome });
      setMensagens((m) => [...m, { id: `eu-${Date.now()}`, de: nome, texto: t, em: Date.now(), minha: true }].slice(-200));
    },
    [enviarRecado],
  );

  return {
    call,
    pessoas,
    estado,
    aviso,
    entrar,
    sair,
    rede,
    reconectando,
    falando,
    mensagens,
    enviarMensagem,
    enviarRecado,
    mic,
    cam,
    alternarMic,
    alternarCam,
    compartilhando,
    alternarTela,
    desfoque,
    alternarDesfoque,
    suporte,
    aparelhos,
    trocarAparelho,
    virarCamera,
  };
}

export type Chamada = ReturnType<typeof useChamada>;

const faixa = (p: DailyParticipant, tipo: 'video' | 'audio' | 'screenVideo') => {
  const t = p.tracks?.[tipo];
  return t && t.state === 'playable' ? (t.persistentTrack ?? null) : null;
};
export const videoDe = (p: DailyParticipant) => faixa(p, 'video');
export const audioDe = (p: DailyParticipant) => faixa(p, 'audio');
export const telaDe = (p: DailyParticipant) => faixa(p, 'screenVideo');

/** Quadro de uma pessoa (ou da tela que ela compartilha). `aoVideo` entrega o <video> (a gravação desenha a partir dele). */
export function Quadro({
  p,
  nome,
  aoVideo,
  tela,
  falando,
}: {
  p: DailyParticipant;
  nome: string;
  aoVideo?: (id: string, el: HTMLVideoElement | null) => void;
  tela?: boolean;
  falando?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const track = tela ? telaDe(p) : videoDe(p);
  const temSom = !!audioDe(p);
  const chave = tela ? `${p.session_id}-tela` : p.session_id;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (track) {
      if (!(v.srcObject instanceof MediaStream) || v.srcObject.getVideoTracks()[0]?.id !== track.id) v.srcObject = new MediaStream([track]);
    } else v.srcObject = null;
  }, [track]);
  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden rounded-[20px] border bg-[#12141A] transition-[border-color,box-shadow] duration-150 ${
        falando && !tela ? 'border-[#81AAF7]/70 shadow-[0_0_0_2px_rgba(129,170,247,0.35)]' : 'border-white/[0.09]'
      }`}
    >
      <video
        ref={(el) => {
          ref.current = el;
          aoVideo?.(chave, el);
        }}
        autoPlay
        playsInline
        muted
        className={`h-full w-full ${tela ? 'object-contain' : 'object-cover'} ${p.local && !tela ? '-scale-x-100' : ''} ${track ? '' : 'invisible'}`}
      />
      {!track && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.06] font-[family-name:var(--font-sora)] text-[22px] text-[#D7DAE0]">
            {nome.trim().charAt(0).toUpperCase() || '?'}
          </span>
        </div>
      )}
      <span className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-20px)] items-center gap-1.5 truncate rounded-full bg-[#08080A]/75 px-3 py-1 text-[12.5px] text-[#F4F5F7]">
        {tela && <MonitorUp size={13} className="text-[#B1D2FF]" />}
        {!tela && !temSom && <MicOff size={13} className="text-[#A3A8B2]" />}
        {!tela && !track && <VideoOff size={13} className="text-[#A3A8B2]" />}
        {tela ? `Tela de ${nome}` : nome}
      </span>
    </div>
  );
}

/** Som de quem está na chamada (o call object não toca sozinho). Também destrava o áudio remoto no Web Audio do Chrome. */
export function Som({ p }: { p: DailyParticipant }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const track = audioDe(p);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    if (track) {
      if (!(a.srcObject instanceof MediaStream) || a.srcObject.getAudioTracks()[0]?.id !== track.id) {
        a.srcObject = new MediaStream([track]);
        void a.play().catch(() => undefined);
      }
    } else a.srcObject = null;
  }, [track]);
  if (p.local) return null;
  return <audio ref={ref} autoPlay playsInline />;
}

export function nomeDe(p: DailyParticipant, padrao: string) {
  return p.user_name?.trim() || padrao;
}
