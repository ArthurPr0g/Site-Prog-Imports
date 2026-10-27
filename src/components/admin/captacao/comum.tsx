'use client';

// Peças compartilhadas pelas abas da Captação (Lista, Foco, Quadro, Mapa...).

import { useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL } from '@/lib/format';
import { whatsappDoLead, proximaEtapa, NOME_DA_ETAPA, type Lead } from '@/lib/captacao';
import { emReais, formatMoeda, type Cotacoes, type Estimativa } from '@/lib/precos-captacao';
import {
  idiomaDoLead,
  variaveisDoLead,
  preencher,
  linkWhatsApp,
  linkGmail,
  escolherModelo,
  varianteDoLead,
  type ModeloMensagem,
} from '@/lib/mensagens-lead';
import { registrarEnvioAction, updateLeadAction } from '@/app/actions/leads';

export const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

export const DIA = 24 * 60 * 60 * 1000;

/* Preferência do dono guardada no navegador (aba aberta, meta diária). Sem
   armazenamento (janela anônima, bloqueio), vale só enquanto a tela estiver aberta. */
const memoria = new Map<string, string>();
const ouvintes = new Set<() => void>();
function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  window.addEventListener('storage', avisar);
  return () => {
    ouvintes.delete(avisar);
    window.removeEventListener('storage', avisar);
  };
}
export function usePreferencia(chave: string, padrao: string): [string, (v: string) => void] {
  const ler = () => {
    try {
      return localStorage.getItem(chave) ?? memoria.get(chave) ?? padrao;
    } catch {
      return memoria.get(chave) ?? padrao;
    }
  };
  const valor = useSyncExternalStore(assinar, ler, () => padrao);
  const gravar = (v: string) => {
    memoria.set(chave, v);
    try {
      localStorage.setItem(chave, v);
    } catch {
      /* sem armazenamento: fica na memória */
    }
    ouvintes.forEach((f) => f());
  };
  return [valor, gravar];
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Data local (AAAA-MM-DD) de um instante ISO. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const semCentavos = (v: number) => formatBRL(v).replace(/,00$/, '');

export function corDaNota(n: number): string {
  if (n >= 70) return 'bg-accent text-page';
  if (n >= 50) return 'bg-accent/20 text-accent';
  return 'bg-fg-faded/15 text-fg-tertiary';
}

/** "há 12 min", "há 3 h", "há 2 dias". */
export function haQuanto(iso: string, agora: number): string {
  const min = Math.max(1, Math.round((agora - Date.parse(iso)) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export function Modal({
  titulo,
  children,
  onFechar,
  largo,
}: {
  titulo: string;
  children: ReactNode;
  onFechar: () => void;
  largo?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div
        className={`max-h-[90vh] w-full ${largo ? 'max-w-[760px]' : 'max-w-[560px]'} overflow-y-auto rounded-[20px] border border-border-strong bg-card p-6 [color-scheme:dark] sm:p-7`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 text-[15px] font-extrabold">{titulo}</div>
        {children}
      </div>
    </div>
  );
}

export function BotaoContato({
  href,
  titulo,
  children,
  destaque,
  onClick,
  grande,
}: {
  href: string;
  titulo: string;
  children: ReactNode;
  destaque?: boolean;
  onClick?: () => void;
  grande?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={`grid ${grande ? 'h-11 w-11' : 'h-8 w-8'} place-items-center rounded-full border transition-colors ${
        destaque
          ? 'border-accent/50 text-accent hover:bg-accent/10'
          : 'border-border-strong text-fg-tertiary hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </a>
  );
}

/** "≈ US$ 2.880 (R$ 15.552) + US$ 99/mês"; em reais quando o lead é do Brasil. */
export function ValorDoLead({ e, cotacoes }: { e: Estimativa; cotacoes: Cotacoes }) {
  const brl = e.moeda === 'BRL' ? null : emReais(e.unico, e.moeda, cotacoes);
  return (
    <span
      className="text-[11.5px] font-bold text-fg-tertiary"
      title={`${e.combo ? 'Preço de combo. ' : ''}${
        e.moeda === 'USD'
          ? 'Tabela em dólar do portfólio; reais pela cotação de mercado do dia.'
          : 'Preços do catálogo de Serviços.'
      }`}
    >
      ≈ <span className="text-fg-secondary">{formatMoeda(e.unico, e.moeda)}</span>
      {brl !== null && <> ({formatMoeda(brl, 'BRL')})</>}
      {e.mensal > 0 && <> + {formatMoeda(e.mensal, e.moeda)}/mês</>}
      {e.combo && <span className="ml-1 text-accent">combo</span>}
    </span>
  );
}

export function Selo({
  children,
  tom = 'neutro',
  titulo,
}: {
  children: ReactNode;
  tom?: 'quente' | 'neutro' | 'alerta' | 'ok';
  titulo?: string;
}) {
  const cor = {
    quente: 'bg-[#ff6b3d]/15 text-[#ff8a5c]',
    neutro: 'bg-fg-faded/15 text-fg-secondary',
    alerta: 'bg-error/12 text-error',
    ok: 'bg-success/12 text-success',
  }[tom];
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${cor}`}
    >
      {children}
    </span>
  );
}

/**
 * Mensagens e envio de um lead: monta o WhatsApp/Gmail da etapa certa da
 * sequência (primeiro contato ou retorno) e, depois que o dono confirma
 * "Enviei", registra a etapa e agenda o próximo retorno. O clique sozinho
 * não conta como envio (o número pode nem ter WhatsApp).
 */
export function useContatoDoLead(l: Lead, modelos: ModeloMensagem[], origem: string) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [abriu, setAbriu] = useState<'whatsapp' | 'email' | null>(null);

  const prox = proximaEtapa(l);
  const etapa = prox?.etapa ?? null;
  const lang = idiomaDoLead(l);
  const variante = varianteDoLead(l, modelos);
  // O link do diagnóstico leva ?previa=1 só no painel; na mensagem vai limpo.
  const vars = variaveisDoLead(l, lang, origem);
  const wa = l.semWhatsapp ? null : whatsappDoLead(l.phone, l.country);
  const mWhats = etapa === null ? undefined : escolherModelo(modelos, 'whatsapp', lang, etapa, variante);
  const mEmail = etapa === null ? undefined : escolherModelo(modelos, 'email', lang, etapa, variante);

  const textoWhats = mWhats ? preencher(mWhats.body, vars) : '';
  const linkWhats = wa ? (textoWhats ? linkWhatsApp(wa.numero, textoWhats) : `https://wa.me/${wa.numero}`) : null;
  const assunto = mEmail ? preencher(mEmail.subject ?? '', vars) : '';
  const textoEmail = mEmail ? preencher(mEmail.body, vars) : '';
  const linkEmail = l.email ? (mEmail ? linkGmail(l.email, assunto, textoEmail) : `mailto:${l.email}`) : null;

  function executar(fn: () => Promise<{ ok: boolean; message: string }>, sempreAvisar = false, depois?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok || sempreAvisar) toast(r);
      if (r.ok) depois?.();
    });
  }

  function enviei(depois?: () => void) {
    setAbriu(null);
    if (etapa === null) return depois?.();
    executar(() => registrarEnvioAction(l.id, etapa, variante), false, depois);
  }

  function semWhatsApp() {
    setAbriu(null);
    executar(() => updateLeadAction(l.id, { semWhatsapp: true }));
  }

  return {
    pending,
    abriu,
    setAbriu,
    etapa,
    nomeDaEtapa: etapa === null ? null : NOME_DA_ETAPA[etapa],
    vence: prox?.vence ?? null,
    variante,
    wa,
    linkWhats,
    linkEmail,
    textoWhats,
    assunto,
    textoEmail,
    enviei,
    semWhatsApp,
    salvar: (input: Parameters<typeof updateLeadAction>[1], depois?: () => void) =>
      executar(() => updateLeadAction(l.id, input), false, depois),
    executar,
  };
}

/** Caixinha "A mensagem saiu? Enviei / Sem WhatsApp" depois de abrir o WhatsApp ou o Gmail. */
export function ConfirmarEnvio({ c, depois }: { c: ReturnType<typeof useContatoDoLead>; depois?: () => void }) {
  if (!c.abriu) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-accent/40 bg-accent/[.06] px-2.5 py-1.5 text-[12px]">
      <span className="text-fg-secondary">A mensagem saiu?</span>
      <button onClick={() => c.enviei(depois)} className="rounded-full bg-accent px-2.5 py-0.5 font-extrabold text-page">
        Enviei
      </button>
      {c.abriu === 'whatsapp' && (
        <button
          onClick={c.semWhatsApp}
          className="rounded-full border border-border-strong px-2.5 py-0.5 font-bold text-fg-secondary"
        >
          Sem WhatsApp
        </button>
      )}
      <button onClick={() => c.setAbriu(null)} className="px-1 font-bold text-fg-faded" aria-label="Fechar">
        ×
      </button>
    </div>
  );
}
