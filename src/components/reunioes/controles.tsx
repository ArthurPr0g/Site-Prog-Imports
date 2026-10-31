'use client';

// Peças da chamada usadas pelos dois lados (Arthur e cliente), Fase 2 da sala (31/10/2026):
// palco (grade das câmeras ou modo apresentação quando alguém compartilha a tela), barra de controles,
// selo da rede, menu de aparelhos e o chat da reunião. Toques de 44 px ou mais (celular).

import { useEffect, useRef, useState } from 'react';
import type { DailyParticipant } from '@daily-co/daily-js';
import { Camera, MessageSquare, Mic, MicOff, MonitorUp, MonitorX, Send, Settings2, SwitchCamera, Video, VideoOff, Wand2, Wifi, WifiOff, X } from 'lucide-react';
import { Quadro, nomeDe, telaDe, type Aparelho, type Chamada, type MensagemDoChat, type Rede } from './chamada';

/** Câmeras em grade; com tela compartilhada, a tela grande e as câmeras numa faixa (modo apresentação). */
export function Palco({
  pessoas,
  falando,
  nomeDoLocal,
  nomePadrao,
  aoVideo,
  soOutros,
}: {
  pessoas: DailyParticipant[];
  falando: string | null;
  nomeDoLocal: string;
  nomePadrao: string;
  aoVideo?: (id: string, el: HTMLVideoElement | null) => void;
  /** Cliente no celular: o próprio quadro fica no canto, fora da grade. */
  soOutros?: boolean;
}) {
  const nome = (p: DailyParticipant) => (p.local ? nomeDoLocal : nomeDe(p, nomePadrao));
  const ordem = [...pessoas.filter((p) => !p.local), ...pessoas.filter((p) => p.local)];
  const comTela = ordem.find((p) => telaDe(p));
  const cameras = soOutros ? ordem.filter((p) => !p.local) : ordem;
  if (comTela) {
    return (
      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2">
        <Quadro p={comTela} nome={comTela.local ? 'você' : nome(comTela)} aoVideo={aoVideo} tela />
        <div className="flex gap-2 overflow-x-auto">
          {cameras.map((p) => (
            <div key={p.session_id} className="h-[84px] w-[120px] flex-shrink-0 sm:h-[96px] sm:w-[150px]">
              <Quadro p={p} nome={nome(p)} aoVideo={aoVideo} falando={falando === p.session_id} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  const n = cameras.length;
  const grade = n <= 1 ? '' : n === 2 ? 'grid-rows-2 sm:grid-cols-2 sm:grid-rows-1' : n <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';
  return (
    <div className={`grid h-full min-h-0 gap-2 ${grade}`}>
      {cameras.map((p) => (
        <Quadro key={p.session_id} p={p} nome={nome(p)} aoVideo={aoVideo} falando={n > 1 && falando === p.session_id} />
      ))}
    </div>
  );
}

const CORES: Record<Rede, string> = { boa: '#5FD37F', fraca: '#E8B44C', ruim: '#F2A7A7' };
const TEXTO: Record<Rede, string> = { boa: 'Conexão boa', fraca: 'Conexão instável', ruim: 'Conexão ruim' };

export function SeloDaRede({ rede, reconectando }: { rede: Rede | null; reconectando: boolean }) {
  if (reconectando)
    return (
      <span role="status" className="flex items-center gap-1.5 rounded-full bg-[#E8B44C]/15 px-3 py-1 text-[12px] text-[#F1D08A]">
        <WifiOff size={13} /> Reconectando…
      </span>
    );
  if (!rede) return null;
  return (
    <span title={TEXTO[rede]} className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-[#D7DAE0]">
      <Wifi size={13} style={{ color: CORES[rede] }} />
      <span className="hidden sm:inline">{TEXTO[rede]}</span>
    </span>
  );
}

const botao = 'grid h-11 w-11 place-items-center rounded-full border border-white/[0.14] bg-[#08080A]/70 text-[#ECEEF1] transition-colors duration-150 hover:border-white/[0.24]';
const ativo = 'border-[#81AAF7]/60 bg-[#81AAF7]/15 text-[#B1D2FF]';

/** Barra de controles: microfone, câmera, tela, desfoque, aparelhos e chat. */
export function Barra({ c, chatAberto, aoChat, naoLidas, extra }: { c: Chamada; chatAberto: boolean; aoChat: () => void; naoLidas: number; extra?: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="relative flex flex-wrap items-center justify-center gap-2">
      <button onClick={c.alternarMic} aria-label={c.mic ? 'Desligar microfone' : 'Ligar microfone'} className={`${botao} ${c.mic ? '' : 'bg-[#C2413B]/25 text-[#F2A7A7]'}`}>
        {c.mic ? <Mic size={18} /> : <MicOff size={18} />}
      </button>
      <button onClick={c.alternarCam} aria-label={c.cam ? 'Desligar câmera' : 'Ligar câmera'} className={`${botao} ${c.cam ? '' : 'bg-[#C2413B]/25 text-[#F2A7A7]'}`}>
        {c.cam ? <Video size={18} /> : <VideoOff size={18} />}
      </button>
      {c.suporte.celular && (
        <button onClick={() => void c.virarCamera()} aria-label="Virar a câmera" className={botao}>
          <SwitchCamera size={18} />
        </button>
      )}
      {c.suporte.tela && (
        <button onClick={c.alternarTela} aria-label={c.compartilhando ? 'Parar de compartilhar a tela' : 'Compartilhar a tela'} title={c.compartilhando ? 'Parar de compartilhar' : 'Compartilhar a tela'} className={`${botao} ${c.compartilhando ? ativo : ''}`}>
          {c.compartilhando ? <MonitorX size={18} /> : <MonitorUp size={18} />}
        </button>
      )}
      {c.suporte.desfoque && (
        <button onClick={() => void c.alternarDesfoque()} aria-label={c.desfoque ? 'Tirar o desfoque do fundo' : 'Desfocar o fundo'} title="Desfocar o fundo" className={`${botao} ${c.desfoque ? ativo : ''}`}>
          <Wand2 size={18} />
        </button>
      )}
      <button onClick={() => setMenu((m) => !m)} aria-label="Câmera e microfone" title="Câmera e microfone" className={`${botao} ${menu ? ativo : ''}`}>
        <Settings2 size={18} />
      </button>
      <button onClick={aoChat} aria-label="Chat da reunião" title="Chat" className={`relative ${botao} ${chatAberto ? ativo : ''}`}>
        <MessageSquare size={18} />
        {naoLidas > 0 && !chatAberto && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#81AAF7] px-1 text-[11px] font-semibold text-[#08080A]">{naoLidas}</span>
        )}
      </button>
      {extra}
      {menu && <MenuDeAparelhos c={c} fechar={() => setMenu(false)} />}
    </div>
  );
}

function MenuDeAparelhos({ c, fechar }: { c: Chamada; fechar: () => void }) {
  const [lista, setLista] = useState<{ cameras: Aparelho[]; mics: Aparelho[]; atuais: { camera: string | null; mic: string | null } } | null>(null);
  const { aparelhos } = c;
  useEffect(() => {
    void aparelhos().then(setLista);
  }, [aparelhos]);
  const escolha = (tipo: 'camera' | 'mic', itens: Aparelho[], atual: string | null) => (
    <label className="grid gap-1">
      <span className="flex items-center gap-1.5 text-[12px] text-[#A3A8B2]">
        {tipo === 'camera' ? <Camera size={13} /> : <Mic size={13} />} {tipo === 'camera' ? 'Câmera' : 'Microfone'}
      </span>
      <select
        defaultValue={atual ?? ''}
        onChange={(e) => void c.trocarAparelho(tipo, e.target.value)}
        className="h-11 w-full rounded-[14px] border border-white/[0.14] bg-[#12141A] px-3 text-[14px] text-[#F4F5F7] outline-none focus:border-[#81AAF7]"
      >
        {itens.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 grid w-[min(340px,calc(100vw-32px))] -translate-x-1/2 gap-3 rounded-[20px] border border-white/[0.14] bg-[#12141A] p-4 shadow-[0_40px_120px_rgba(0,0,0,.55)]">
      <div className="flex items-center justify-between">
        <b className="text-[14px] text-[#F4F5F7]">Câmera e microfone</b>
        <button onClick={fechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full text-[#A3A8B2]">
          <X size={16} />
        </button>
      </div>
      {!lista ? (
        <p className="text-[13px] text-[#A3A8B2]">Procurando os aparelhos…</p>
      ) : (
        <>
          {lista.cameras.length > 0 && escolha('camera', lista.cameras, lista.atuais.camera)}
          {lista.mics.length > 0 && escolha('mic', lista.mics, lista.atuais.mic)}
        </>
      )}
    </div>
  );
}

const URL_NO_TEXTO = /(https?:\/\/[^\s<>"']+)/g;

/** Texto com os links clicáveis (abre em outra aba; nada de HTML vindo de fora). */
function ComLinks({ texto }: { texto: string }) {
  const partes = texto.split(URL_NO_TEXTO);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-[#91B7FE] underline underline-offset-2">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function Chat({ mensagens, enviar, fechar, vazio }: { mensagens: MensagemDoChat[]; enviar: (t: string) => void; fechar?: () => void; vazio: string }) {
  const [texto, setTexto] = useState('');
  const fim = useRef<HTMLDivElement | null>(null);
  useEffect(() => fim.current?.scrollIntoView({ block: 'end' }), [mensagens.length]);
  return (
    <div className="flex h-full min-h-0 flex-col rounded-[20px] border border-white/[0.09] bg-[#0D0E13]">
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <b className="font-mono text-[11px] font-medium uppercase tracking-[.24em] text-[#81AAF7]">Chat</b>
        {fechar && (
          <button onClick={fechar} aria-label="Fechar o chat" className="grid h-10 w-10 place-items-center rounded-full text-[#A3A8B2]">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {mensagens.length === 0 ? (
          <p className="py-4 text-[13px] text-[#8B919B]">{vazio}</p>
        ) : (
          mensagens.map((m) => (
            <div key={m.id} className={`my-1.5 flex ${m.minha ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-[14px] px-3 py-2 text-[14px] leading-snug ${m.minha ? 'bg-[#81AAF7]/15 text-[#ECEEF1]' : 'bg-white/[0.05] text-[#ECEEF1]'}`}>
                {!m.minha && <div className="mb-0.5 text-[11.5px] text-[#9BA1AB]">{m.de}</div>}
                <div className="whitespace-pre-wrap break-words">
                  <ComLinks texto={m.texto} />
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={fim} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
          setTexto('');
        }}
        className="flex gap-2 border-t border-white/[0.06] p-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={1000}
          placeholder="Escreva uma mensagem ou cole um link"
          aria-label="Mensagem"
          className="h-11 min-w-0 flex-1 rounded-[14px] border border-white/[0.14] bg-white/[0.03] px-3 text-[16px] text-[#F4F5F7] outline-none focus:border-[#81AAF7] sm:text-[14px]"
        />
        <button type="submit" aria-label="Enviar" disabled={!texto.trim()} className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-[#F2F3F5] text-[#08080A] disabled:opacity-40">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
