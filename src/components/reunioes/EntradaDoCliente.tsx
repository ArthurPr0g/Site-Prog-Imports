'use client';

// Tela do cliente na sala de reunião (31/10/2026): marca Prog Soluções, aviso de gravação (LGPD) com
// "Concordo e entrar", teste de câmera e microfone antes de entrar e a chamada pensada primeiro para o celular.

import { useEffect, useRef, useState, useTransition } from 'react';
import { Camera, CameraOff, Mic, MicOff, PhoneOff, ShieldCheck, Video } from 'lucide-react';
import { ProgMark } from '@/brand/ProgMark';
import { entrarComoClienteAction } from '@/app/actions/reunioes';
import { useChamada, Quadro, Som, nomeDe } from './chamada';

const quandoPorExtenso = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <ProgMark s={28} />
      <span className="font-[family-name:var(--font-sora)] text-[17px] tracking-[-0.03em] text-[#F4F5F7]">
        <span className="font-semibold">Prog</span> <span className="font-normal text-[#A3A8B2]">Soluções</span>
      </span>
    </div>
  );
}

/** Prévia da câmera e barra do microfone, antes de entrar. Libera os aparelhos ao sair. */
function TesteDeAparelhos() {
  const video = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [nivel, setNivel] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!stream) return;
    if (video.current) video.current.srcObject = stream;
    const ctx = new AudioContext();
    const a = ctx.createAnalyser();
    a.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(a);
    const buf = new Float32Array(a.fftSize);
    const t = setInterval(() => {
      a.getFloatTimeDomainData(buf);
      let s = 0;
      for (const v of buf) s += v * v;
      setNivel(Math.min(1, Math.sqrt(s / buf.length) * 8));
    }, 100);
    return () => {
      clearInterval(t);
      void ctx.close();
      stream.getTracks().forEach((x) => x.stop());
    };
  }, [stream]);

  const testar = async () => {
    setErro(null);
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }));
    } catch {
      setErro('O navegador não liberou a câmera ou o microfone. Toque no cadeado ao lado do endereço e permita.');
    }
  };

  if (!stream)
    return (
      <div>
        <button onClick={testar} className="flex h-10 items-center gap-2 rounded-full border px-4 text-[13.5px]">
          <Camera size={16} /> Testar câmera e microfone
        </button>
        {erro && <p className="mt-2 text-[13px] text-[#F2A7A7]">{erro}</p>}
      </div>
    );
  return (
    <div className="grid gap-2">
      <video ref={video} autoPlay playsInline muted className="aspect-video w-full -scale-x-100 rounded-[20px] border border-white/[0.09] bg-[#12141A] object-cover" />
      <div className="flex items-center gap-2 text-[12.5px] text-[#A3A8B2]">
        <Mic size={14} />
        <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-[#81AAF7] transition-[width] duration-100" style={{ width: `${Math.round(nivel * 100)}%` }} />
        </div>
        <span>{nivel > 0.08 ? 'ouvindo você' : 'fale algo'}</span>
      </div>
      <button onClick={() => setStream(null)} className="justify-self-start text-[12.5px] text-[#91B7FE]">
        Fechar o teste
      </button>
    </div>
  );
}

export function EntradaDoCliente({
  token,
  nome: nomeInicial,
  inicio,
  meio,
  encerrada,
  aviso,
}: {
  token: string;
  nome: string;
  inicio: string;
  meio: 'daily' | 'meet';
  encerrada: boolean;
  aviso: string;
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [meet, setMeet] = useState<string | null | undefined>(undefined);
  const [entrando, startEntrar] = useTransition();
  const { call, pessoas, estado, aviso: avisoDaChamada, entrar, sair } = useChamada();
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  const concordar = () =>
    startEntrar(async () => {
      setErro(null);
      const r = await entrarComoClienteAction(token, nome);
      if (!r.ok) return setErro(r.message);
      if (r.meio === 'meet') return setMeet(r.meet);
      await entrar(r.url, r.token, nome.trim() || 'Cliente');
    });

  const alternarMic = () => {
    call?.setLocalAudio(!mic);
    setMic(!mic);
  };
  const alternarCam = () => {
    call?.setLocalVideo(!cam);
    setCam(!cam);
  };

  // Na chamada: tela cheia, a outra pessoa grande e você no canto.
  if (estado === 'entrando' || estado === 'dentro') {
    const eu = pessoas.find((p) => p.local);
    const outros = pessoas.filter((p) => !p.local);
    return (
      <main className="relative flex h-[100dvh] flex-col gap-3 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-5">
        <header className="flex items-center justify-between">
          <Marca />
          <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-[#D7DAE0]">
            <span className="h-2 w-2 rounded-full bg-[#5FD37F] shadow-[0_0_8px_#5FD37F]" /> Gravando
          </span>
        </header>
        <section className={`grid min-h-0 flex-1 gap-3 ${outros.length > 1 ? 'grid-rows-2 sm:grid-cols-2 sm:grid-rows-1' : ''}`}>
          {outros.length ? (
            outros.map((p) => <Quadro key={p.session_id} p={p} nome={nomeDe(p, 'Arthur')} />)
          ) : (
            <div className="grid place-items-center rounded-[20px] border border-white/[0.09] bg-white/[0.02] p-6 text-center text-[14px] text-[#A3A8B2]">
              {estado === 'entrando' ? 'Entrando na sala…' : 'Você já está na sala. O Arthur entra em instantes.'}
            </div>
          )}
        </section>
        {eu && (
          <div className="absolute right-5 top-16 h-[120px] w-[90px] sm:h-[150px] sm:w-[220px]">
            <Quadro p={eu} nome="Você" />
          </div>
        )}
        {pessoas.map((p) => (
          <Som key={`som-${p.session_id}`} p={p} />
        ))}
        <nav className="flex items-center justify-center gap-3">
          <button onClick={alternarMic} aria-label={mic ? 'Desligar microfone' : 'Ligar microfone'} className="grid h-12 w-12 place-items-center rounded-full border">
            {mic ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button onClick={alternarCam} aria-label={cam ? 'Desligar câmera' : 'Ligar câmera'} className="grid h-12 w-12 place-items-center rounded-full border">
            {cam ? <Video size={20} /> : <CameraOff size={20} />}
          </button>
          <button onClick={() => void sair()} className="flex h-12 items-center gap-2 rounded-[999px] bg-[#C2413B] px-5 text-[14px] font-semibold text-white">
            <PhoneOff size={18} /> Sair
          </button>
        </nav>
      </main>
    );
  }

  return (
    <main className="relative mx-auto grid min-h-[100dvh] max-w-[560px] content-center gap-6 px-5 py-10">
      <Marca />
      <div>
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[38px]">
          {nomeInicial ? `${nomeInicial}, sua reunião com a Prog Soluções` : 'Sua reunião com a Prog Soluções'}
        </h1>
        <p className="mt-2 text-[15px] text-[#A3A8B2]">Com o Arthur · {quandoPorExtenso(inicio)}</p>
      </div>

      {encerrada || estado === 'saiu' || estado === 'erro' ? (
        <div className="rounded-[24px] border border-white/[0.09] bg-white/[0.03] p-5 text-[15px] leading-relaxed">
          {encerrada
            ? 'Esta reunião já foi encerrada. Obrigado pela conversa. Qualquer dúvida, é só chamar a Prog Soluções no WhatsApp.'
            : estado === 'erro'
              ? avisoDaChamada ?? 'A chamada caiu.'
              : (avisoDaChamada ?? 'Você saiu da reunião.')}
          {!encerrada && (
            <button onClick={concordar} disabled={entrando} className="mt-4 flex h-11 items-center rounded-full border px-5 text-[14px]">
              Entrar de novo
            </button>
          )}
        </div>
      ) : meet !== undefined ? (
        <div className="rounded-[24px] border border-white/[0.09] bg-white/[0.03] p-5 text-[15px] leading-relaxed">
          {meet ? (
            <>
              <p>Hoje a reunião acontece pelo Google Meet.</p>
              <a href={meet} className="bg-accent mt-4 flex h-[52px] items-center justify-center rounded-full text-[15px] font-semibold">
                Entrar no Google Meet
              </a>
            </>
          ) : (
            <p>O Arthur vai mandar o link da chamada pelo WhatsApp alguns minutos antes do horário.</p>
          )}
        </div>
      ) : (
        <>
          <div className="diag-fechamento rounded-[24px] p-5">
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.24em] text-[#81AAF7]">
              <ShieldCheck size={15} /> Aviso de gravação
            </div>
            <p className="text-[15px] leading-relaxed text-[#ECEEF1]">{aviso}</p>
          </div>

          {meio === 'daily' && <TesteDeAparelhos />}

          <label className="grid gap-1.5">
            <span className="text-[13px] text-[#A3A8B2]">Seu nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={40}
              autoComplete="name"
              className="h-12 rounded-[14px] border border-white/[0.14] bg-white/[0.03] px-4 text-[15px] text-[#F4F5F7] outline-none"
            />
          </label>

          {erro && <p className="text-[14px] text-[#F2A7A7]">{erro}</p>}
          <button onClick={concordar} disabled={entrando} className="bg-accent flex h-[54px] w-full items-center justify-center rounded-full text-[16px] font-semibold disabled:opacity-60">
            {entrando ? 'Abrindo a sala…' : 'Concordo e entrar'}
          </button>
        </>
      )}
    </main>
  );
}
