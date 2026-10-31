'use client';

// Videochamada da sala (Daily, 31/10/2026). Usa o "call object" da Daily, não o iframe pronto: a tela é nossa
// (marca Prog Soluções), as faixas de áudio ficam acessíveis para a gravação, e os escudos do Brave não têm
// iframe de terceiro para bloquear (só a conexão com a Daily, que é o próprio serviço da chamada).
// A biblioteca carrega só ao entrar (import dinâmico), para a página abrir rápido no celular.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { MicOff, VideoOff } from 'lucide-react';

export type Estado = 'fora' | 'entrando' | 'dentro' | 'saiu' | 'erro';

/** Sozinho na sala por este tempo: sai sozinho (a Daily não tem essa trava; evita minutos à toa). */
const SOZINHO_MS = 10 * 60_000;

export function useChamada() {
  const [call, setCall] = useState<DailyCall | null>(null);
  const [pessoas, setPessoas] = useState<DailyParticipant[]>([]);
  const [estado, setEstado] = useState<Estado>('fora');
  const [aviso, setAviso] = useState<string | null>(null);
  const callRef = useRef<DailyCall | null>(null);

  const atualizar = useCallback(() => {
    const c = callRef.current;
    if (!c || c.isDestroyed()) return;
    const ps = c.participants();
    setPessoas([ps.local, ...Object.values(ps).filter((p) => !p.local)].filter(Boolean));
  }, []);

  const sair = useCallback(async () => {
    const c = callRef.current;
    callRef.current = null;
    setCall(null);
    if (c && !c.isDestroyed()) {
      await c.leave().catch(() => undefined);
      await c.destroy().catch(() => undefined);
    }
    setPessoas([]);
    setEstado((e) => (e === 'erro' ? e : 'saiu'));
  }, []);

  const entrar = useCallback(
    async (url: string, token: string, nome: string) => {
      setEstado('entrando');
      setAviso(null);
      const Daily = (await import('@daily-co/daily-js')).default;
      // Só um call object por página: sobra de uma tentativa anterior sai antes.
      const velho = Daily.getCallInstance?.();
      if (velho && !velho.isDestroyed()) await velho.destroy();
      const c = Daily.createCallObject({ subscribeToTracksAutomatically: true });
      callRef.current = c;
      setCall(c);
      c.on('joined-meeting', () => {
        setEstado('dentro');
        atualizar();
      })
        .on('participant-joined', atualizar)
        .on('participant-updated', atualizar)
        .on('participant-left', atualizar)
        .on('track-started', atualizar)
        .on('track-stopped', atualizar)
        .on('left-meeting', () => setEstado((e) => (e === 'erro' ? e : 'saiu')))
        .on('camera-error', (e) => setAviso(`Câmera ou microfone bloqueados: ${e?.errorMsg?.errorMsg ?? 'libere o acesso no navegador'}.`))
        .on('error', (e) => {
          const tipo = e?.error?.type;
          // Fim normal da sala (horário, encerrada, cheia) com palavras de gente; o resto, a mensagem da Daily.
          const fim: Record<string, string> = {
            ejected: 'A sala fechou: a reunião foi encerrada ou passou do tempo.',
            'exp-room': 'O horário desta sala já passou.',
            'exp-token': 'O acesso a esta sala expirou.',
            'no-room': 'A sala foi encerrada.',
            'meeting-full': 'A sala está cheia (até 3 pessoas).',
          };
          setAviso((tipo && fim[tipo]) || e?.errorMsg || 'A chamada caiu.');
          setEstado('erro');
        });
      try {
        await c.join({ url, token, userName: nome });
      } catch (e) {
        setAviso(e instanceof Error ? e.message : 'Não foi possível entrar.');
        setEstado('erro');
      }
    },
    [atualizar],
  );

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

  useEffect(() => () => void callRef.current?.destroy(), []);

  return { call, pessoas, estado, aviso, entrar, sair };
}

const faixa = (p: DailyParticipant, tipo: 'video' | 'audio') => {
  const t = p.tracks?.[tipo];
  return t && t.state === 'playable' ? (t.persistentTrack ?? null) : null;
};
export const videoDe = (p: DailyParticipant) => faixa(p, 'video');
export const audioDe = (p: DailyParticipant) => faixa(p, 'audio');

/** Quadro de uma pessoa. `aoVideo` entrega o <video> (a gravação desenha a partir dele). */
export function Quadro({ p, nome, aoVideo }: { p: DailyParticipant; nome: string; aoVideo?: (id: string, el: HTMLVideoElement | null) => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const track = videoDe(p);
  const temSom = !!audioDe(p);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (track) {
      if (!(v.srcObject instanceof MediaStream) || v.srcObject.getVideoTracks()[0]?.id !== track.id) v.srcObject = new MediaStream([track]);
    } else v.srcObject = null;
  }, [track]);
  return (
    <div className="relative min-h-0 overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#12141A]">
      <video
        ref={(el) => {
          ref.current = el;
          aoVideo?.(p.session_id, el);
        }}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${p.local ? '-scale-x-100' : ''} ${track ? '' : 'invisible'}`}
      />
      {!track && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.06] font-[family-name:var(--font-sora)] text-[22px] text-[#D7DAE0]">
            {nome.trim().charAt(0).toUpperCase() || '?'}
          </span>
        </div>
      )}
      <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-[#08080A]/75 px-3 py-1 text-[12.5px] text-[#F4F5F7]">
        {!temSom && <MicOff size={13} className="text-[#A3A8B2]" />}
        {!track && <VideoOff size={13} className="text-[#A3A8B2]" />}
        {nome}
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
