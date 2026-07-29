'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, X, Send } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const GREETING: Message = {
  role: 'assistant',
  content:
    'Oi! Eu posso te ajudar a escolher o produto ideal no nosso catálogo — me conta o que você procura (categoria, orçamento, uso) que eu busco as melhores opções.',
};

const PRODUCT_LINK = /(\/produto\/[A-Za-z0-9-]+)/g;
const BULLET_PREFIX = '✔️';
const SEPARATOR = /^-{3,}$/;

// Detecta um link de produto tipo /produto/SKU-123 dentro do texto do
// assistente e transforma em link clicável, já que ele referencia produtos
// reais retornados pela busca.
function renderInlineLinks(line: string) {
  return line.split(PRODUCT_LINK).map((part, i) =>
    part.startsWith('/produto/') ? (
      <Link key={i} href={part} className="font-bold text-accent underline underline-offset-2">
        {part}
      </Link>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// O modelo responde num micro-formato combinado no system prompt: linhas de
// ficha do produto, bullets começando com "✔️", e "---" separando sugestões.
// HTML colapsa "\n", então sem agrupar aqui tudo viraria um bloco corrido —
// e os marcadores apareceriam como texto solto em vez de lista.
function renderMessageContent(content: string) {
  const lines = content.split('\n').map((l) => l.trim());
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let textLines: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden className="flex-shrink-0">
              {BULLET_PREFIX}
            </span>
            <span>{renderInlineLinks(b)}</span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  // Linhas seguidas viram um grupo compacto (a ficha do produto: nome,
  // configuração, estado, valor). A separação maior entre grupos vem do
  // space-y do balão, então aqui o espaçamento interno é curto de propósito.
  const flushText = () => {
    if (!textLines.length) return;
    blocks.push(
      <div key={`t-${blocks.length}`} className="space-y-0.5">
        {textLines.map((line, i) => (
          <p key={i}>{renderInlineLinks(line)}</p>
        ))}
      </div>
    );
    textLines = [];
  };

  const flushAll = () => {
    flushBullets();
    flushText();
  };

  for (const line of lines) {
    // Linha vazia é fronteira de grupo: é o que separa a ficha do produto da
    // seção de destaques e do texto de fechamento.
    if (!line) {
      flushAll();
      continue;
    }

    if (line.startsWith(BULLET_PREFIX)) {
      flushText();
      // Guarda só o texto: o marcador é desenhado pelo <li>, senão ele
      // apareceria duplicado.
      bullets.push(line.slice(BULLET_PREFIX.length).trim());
      continue;
    }

    flushBullets();

    if (SEPARATOR.test(line)) {
      flushText();
      blocks.push(<hr key={`hr-${blocks.length}`} className="border-border" />);
      continue;
    }

    textLines.push(line);
  }

  flushAll();
  return blocks;
}

export function FloatingAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  if (pathname?.startsWith('/admin')) return null;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setError('');
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.filter((m) => m !== GREETING) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível processar sua mensagem agora.');
        return;
      }
      setMessages((msgs) => [...msgs, { role: 'assistant', content: data.reply }]);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-100 flex h-[min(560px,calc(100vh-140px))] w-[min(380px,calc(100vw-40px))] flex-col overflow-hidden rounded-[22px] border border-border-strong bg-card shadow-[0_24px_64px_rgba(0,0,0,.55)]">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-card-dark px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="text-[13.5px] font-extrabold">Assistente Prog Imports</div>
                <div className="text-[11px] text-fg-tertiary">Recomendações com base no catálogo</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-border-strong text-fg-secondary hover:border-accent hover:text-accent"
              aria-label="Fechar assistente"
            >
              <X size={15} />
            </button>
          </div>

          <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-[13.5px] leading-snug ${
                  m.role === 'user'
                    ? 'ml-auto rounded-br-sm bg-accent text-page'
                    : 'mr-auto rounded-bl-sm border border-border bg-card-dark text-fg-secondary'
                }`}
              >
                {renderMessageContent(m.content)}
              </div>
            ))}
            {loading && (
              <div className="mr-auto flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-card-dark px-4 py-2.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-faded [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-faded [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-faded" />
              </div>
            )}
            {error && <div className="mr-auto text-[12.5px] font-semibold text-error">{error}</div>}
          </div>

          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ex: notebook pra jogos até R$ 8000"
              disabled={loading}
              className="flex-1 rounded-full border border-border-strong bg-input px-4 py-2.5 text-[13.5px] outline-none focus:border-accent disabled:opacity-60"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Enviar mensagem"
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent text-page transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente de compras'}
        className="fixed bottom-5 right-5 z-100 grid h-14 w-14 place-items-center rounded-full bg-accent text-page shadow-[0_8px_28px_rgba(242,135,5,.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(242,135,5,.55)]"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>
    </>
  );
}
