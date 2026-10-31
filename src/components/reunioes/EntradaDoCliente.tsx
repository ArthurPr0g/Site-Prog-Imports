'use client';

// Tela do cliente na sala de reunião (31/10/2026): marca Prog Soluções, aviso de gravação (LGPD) com
// "Concordo e entrar", teste de câmera e microfone e a chamada pensada primeiro para o celular.
// Fase 2: sala de espera com a marca (o consentimento já fica gravado no clique; a página entra sozinha quando o
// Arthur abre a sala, sem gastar minuto da Daily esperando), aviso "o Arthur entrou", qualidade da rede,
// reconexão automática, chat, compartilhar tela e desfoque (no computador) e virar a câmera (no celular).

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Camera, Mic, PhoneOff, ShieldCheck } from 'lucide-react';
import { ProgMark } from '@/brand/ProgMark';
import { entrarComoClienteAction } from '@/app/actions/reunioes';
import { estadoParaClienteAction } from '@/app/actions/sala';
import { useChamada, Quadro, Som } from './chamada';
import { Barra, Chat, Palco, SeloDaRede } from './controles';

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
function TesteDeAparelhos({ abrirSozinho }: { abrirSozinho?: boolean }) {
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

  const testar = useCallback(async () => {
    setErro(null);
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }));
    } catch {
      setErro('O navegador não liberou a câmera ou o microfone. Toque no cadeado ao lado do endereço e permita.');
    }
  }, []);
  useEffect(() => {
    // Depois de montar (a permissão da câmera é pedida fora do render).
    if (abrirSozinho) void Promise.resolve().then(testar);
  }, [abrirSozinho, testar]);

  if (!stream)
    return (
      <div>
        <button onClick={testar} className="flex h-11 items-center gap-2 rounded-full border border-white/[0.14] px-4 text-[13.5px]">
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
      <button onClick={() => setStream(null)} className="min-h-10 justify-self-start text-[12.5px] text-[#91B7FE]">
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
  encerrada: encerradaNoInicio,
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
  const [esperando, setEsperando] = useState(false);
  const [encerrada, setEncerrada] = useState(encerradaNoInicio);
  const [entrando, startEntrar] = useTransition();
  const [gravando, setGravando] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);
  const [lidas, setLidas] = useState(0);
  const [chegou, setChegou] = useState<string | null>(null);
  const c = useChamada({
    aoRecado: (r) => {
      if (r.tipo === 'estado') setGravando(!!r.gravando);
    },
  });
  const { pessoas, estado, aviso: avisoDaChamada, entrar, sair } = c;
  const quem = nome.trim() || 'Cliente';

  const abrir = useCallback(async () => {
    setErro(null);
    const r = await entrarComoClienteAction(token, nome);
    if (!r.ok) return setErro(r.message);
    if (r.meio === 'meet') return setMeet(r.meet);
    if (r.meio === 'espera') return setEsperando(true);
    setEsperando(false);
    await entrar(r.url, r.token, nome.trim() || 'Cliente');
  }, [token, nome, entrar]);
  const concordar = () => startEntrar(abrir);

  // Sala de espera: confere a cada 4 s se o Arthur abriu a sala; abriu, entra sozinho.
  useEffect(() => {
    if (!esperando) return;
    let vivo = true;
    const t = setInterval(async () => {
      const e = await estadoParaClienteAction(token);
      if (!vivo || !e) return;
      if (e.encerrada) {
        setEsperando(false);
        setEncerrada(true);
      } else if (e.aberta) {
        clearInterval(t);
        startEntrar(abrir);
      }
    }, 4000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [esperando, token, abrir]);

  // "O Arthur entrou": quando o dono da sala aparece (ou volta depois de cair).
  const arthurDentro = pessoas.some((p) => !p.local && p.owner);
  const antes = useRef(false);
  useEffect(() => {
    if (arthurDentro && !antes.current) {
      setChegou('O Arthur entrou na reunião');
      const t = setTimeout(() => setChegou(null), 5000);
      antes.current = true;
      return () => clearTimeout(t);
    }
    if (!arthurDentro) antes.current = false;
  }, [arthurDentro]);

  const recebidas = c.mensagens.filter((m) => !m.minha).length;
  const naoLidas = chatAberto ? 0 : Math.max(0, recebidas - lidas);
  const alternarChat = () => {
    setChatAberto((a) => !a);
    setLidas(recebidas);
  };

  // Na chamada: tela cheia, a outra pessoa grande e você no canto.
  if (estado === 'entrando' || estado === 'dentro') {
    const eu = pessoas.find((p) => p.local);
    const outros = pessoas.filter((p) => !p.local);
    return (
      <main className="relative flex h-[100dvh] flex-col gap-3 overflow-hidden p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <Marca />
          <div className="flex items-center gap-2">
            <SeloDaRede rede={c.rede} reconectando={c.reconectando} />
            <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-[#D7DAE0]">
              {gravando ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-[#F2A7A7] shadow-[0_0_8px_#C2413B]" /> Gravando
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-[#5FD37F] shadow-[0_0_8px_#5FD37F]" /> Reunião gravada
                </>
              )}
            </span>
          </div>
        </header>
        {chegou && (
          <div role="status" className="absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border border-[#81AAF7]/40 bg-[#12141A] px-4 py-2 text-[13.5px] text-[#B1D2FF] shadow-[0_20px_60px_rgba(0,0,0,.5)]">
            {chegou}
          </div>
        )}
        <section className={`grid min-h-0 flex-1 gap-3 ${chatAberto ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
          <div className="relative min-h-0">
            {outros.length ? (
              <Palco pessoas={pessoas} falando={c.falando} nomeDoLocal="Você" nomePadrao="Arthur" soOutros />
            ) : (
              <div className="grid h-full place-items-center rounded-[20px] border border-white/[0.09] bg-white/[0.02] p-6 text-center text-[14px] text-[#A3A8B2]">
                {estado === 'entrando' ? (c.reconectando ? 'Reconectando…' : 'Entrando na sala…') : 'Você já está na sala. O Arthur entra em instantes.'}
              </div>
            )}
            {eu && (
              <div className="absolute right-2 top-2 z-10 h-[120px] w-[90px] sm:h-[130px] sm:w-[200px]">
                <Quadro p={eu} nome="Você" />
              </div>
            )}
          </div>
          {chatAberto && (
            <div className="fixed inset-x-0 bottom-0 z-30 h-[min(70dvh,520px)] p-2 pb-[max(8px,env(safe-area-inset-bottom))] lg:static lg:h-auto lg:p-0">
              <Chat mensagens={c.mensagens} enviar={(t) => c.enviarMensagem(t, quem)} fechar={() => setChatAberto(false)} vazio="Mande uma mensagem ou um link para o Arthur." />
            </div>
          )}
        </section>
        {pessoas.map((p) => (
          <Som key={`som-${p.session_id}`} p={p} />
        ))}
        {estado === 'dentro' && (
          <Barra
            c={c}
            chatAberto={chatAberto}
            aoChat={alternarChat}
            naoLidas={naoLidas}
            extra={
              <button onClick={() => void sair()} className="flex h-11 items-center gap-2 rounded-[999px] bg-[#C2413B] px-5 text-[14px] font-semibold text-white">
                <PhoneOff size={18} /> Sair
              </button>
            }
          />
        )}
      </main>
    );
  }

  return (
    <main className="relative mx-auto grid min-h-[100dvh] w-full max-w-[560px] content-center gap-6 px-5 py-10">
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
            <button onClick={concordar} disabled={entrando} className="mt-4 flex h-11 items-center rounded-full border border-white/[0.14] px-5 text-[14px]">
              Entrar de novo
            </button>
          )}
        </div>
      ) : esperando ? (
        // Sala de espera com a marca: a concordância já está registrada; a página entra sozinha.
        <div className="diag-fechamento grid gap-4 rounded-[24px] p-5">
          <div className="flex items-center gap-3">
            <span className="relative grid h-10 w-10 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#81AAF7]/25 motion-reduce:animate-none" />
              <ProgMark s={22} />
            </span>
            <div>
              <b className="block text-[16px] text-[#F4F5F7]">Você está na sala de espera</b>
              <span className="text-[13.5px] text-[#A3A8B2]">O Arthur abre a sala em instantes e a reunião começa sozinha. Pode deixar esta página aberta.</span>
            </div>
          </div>
          <TesteDeAparelhos abrirSozinho />
          {erro && <p className="text-[14px] text-[#F2A7A7]">{erro}</p>}
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
              className="h-12 rounded-[14px] border border-white/[0.14] bg-white/[0.03] px-4 text-[16px] text-[#F4F5F7] outline-none focus:border-[#81AAF7]"
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
