'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, Link2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { configurarInstagramAction } from '@/app/actions/instagram';
import type { ContaEncontrada } from '@/lib/instagram/api';

/** A tela que liga a conta.
 *
 *  O token longo aparece aqui uma vez e não é gravado em lugar nenhum: ele
 *  mora como variável de ambiente na Vercel, e guardá-lo também no banco só
 *  criaria um segundo lugar de onde ele pode vazar. Por isso a tela é um
 *  passo de configuração manual e não um botão de "conectar" — o segredo passa
 *  da Meta para a Vercel pelas suas mãos, sem parada intermediária. */
export function LigarInstagram({
  configurado,
  temApp,
  presentes,
}: {
  configurado: boolean;
  temApp: boolean;
  /** Quais variáveis existem no ambiente. Só a presença, nunca o valor. */
  presentes: Record<string, boolean>;
}) {
  const toast = useToast();
  const [curto, setCurto] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [validade, setValidade] = useState<string | null>(null);
  const [contas, setContas] = useState<ContaEncontrada[]>([]);

  async function trocar() {
    if (trocando || curto.trim().length < 20) return;
    setTrocando(true);
    const r = await configurarInstagramAction(curto);
    setTrocando(false);
    toast(r);
    if (r.token) setToken(r.token);
    if (r.expiraEm) setValidade(r.expiraEm);
    if (r.contas) setContas(r.contas);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="rounded-[18px] border border-border bg-card p-6">
        <div className="mb-1 font-display text-lg font-bold">Situação</div>
        <div className="mb-3 text-[13px] text-fg-tertiary">
          {configurado
            ? 'Tudo no lugar — o botão de publicar já aparece nas peças.'
            : 'O que falta está marcado abaixo. Variável nova só vale depois de um novo deploy.'}
        </div>
        <Linha
          pronto={presentes.META_APP_ID}
          titulo="META_APP_ID"
          detalhe="O número do app, em developers.facebook.com → Configurações → Informação básica. Não é segredo."
        />
        <Linha
          pronto={presentes.META_APP_SECRET}
          titulo="META_APP_SECRET"
          detalhe="Na mesma tela, em Chave Secreta do App. É segredo: vai direto para a Vercel, sem passar por mais lugar nenhum."
        />
        <Linha
          pronto={presentes.INSTAGRAM_CONTA_ID}
          titulo="INSTAGRAM_CONTA_ID"
          detalhe="O número da conta do Instagram. Sai pronto no passo abaixo."
        />
        <Linha
          pronto={presentes.INSTAGRAM_TOKEN}
          titulo="INSTAGRAM_TOKEN"
          detalhe="O token de 60 dias. Sai pronto no passo abaixo."
        />
      </div>

      <div className="rounded-[18px] border border-border bg-card p-6">
        <div className="mb-1 font-display text-lg font-bold">Trocar o token</div>
        <div className="mb-4 text-[13px] leading-relaxed text-fg-tertiary">
          O token que sai do Graph API Explorer vale <b>uma hora</b>. Cole ele aqui e o sistema
          troca por um de <b>60 dias</b> e descobre o número da conta do Instagram. Nada disso fica
          gravado — você copia e cadastra na Vercel.
        </div>

        <div className="mb-2 text-[12.5px] font-bold">Token curto</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={curto}
            onChange={(e) => setCurto(e.target.value)}
            placeholder="Cole aqui o token do Explorer"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 font-mono text-[12.5px]"
          />
          <button
            onClick={() => void trocar()}
            disabled={trocando || curto.trim().length < 20 || !temApp}
            className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:cursor-not-allowed disabled:opacity-50"
          >
            {trocando ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            Trocar
          </button>
        </div>
        <div className="mt-2 text-[12px] text-fg-muted">
          O campo é de senha de propósito: token de publicação é segredo, e segredo não fica legível
          na tela enquanto alguém passa atrás de você.
        </div>
        {!temApp && (
          <div className="mt-3 rounded-control border border-dashed border-border-strong px-3.5 py-2.5 text-[12px] leading-relaxed text-fg-tertiary">
            O botão só liga depois que META_APP_ID e META_APP_SECRET estiverem no ambiente — a troca
            do token é assinada com os dois.
          </div>
        )}
      </div>

      {token && (
        <div className="rounded-[18px] border border-ouro/40 bg-card p-6">
          <div className="mb-1 font-display text-lg font-bold">Cadastre na Vercel</div>
          <div className="mb-4 text-[13px] leading-relaxed text-fg-tertiary">
            Projeto <span className="font-mono">site-prog-imports</span> → Settings → Environment
            Variables. Depois de salvar, é preciso um novo deploy para o site enxergar os valores.
          </div>

          <Segredo
            nome="INSTAGRAM_TOKEN"
            valor={token}
            nota={validade ? `Vence em ${validade}. Volte aqui antes disso e repita o passo.` : undefined}
          />

          {contas.map((c) => (
            <Segredo
              key={c.contaId}
              nome="INSTAGRAM_CONTA_ID"
              valor={c.contaId}
              nota={`Conta @${c.usuario || 'sem nome'} — pela Página "${c.pagina}".`}
            />
          ))}
        </div>
      )}

      <div className="rounded-[18px] border border-border bg-card p-6 text-[13px] leading-relaxed text-fg-tertiary">
        <div className="mb-3 font-display text-lg font-bold text-fg">O que a API deixa e não deixa</div>
        <p className="mb-2.5">
          <b className="text-fg-secondary">Não existe prévia da publicação montada.</b> O Instagram
          publica como foi configurado; não há rascunho pela API. Por isso a confirmação na peça
          mostra a arte e a legenda inteiras antes de enviar.
        </p>
        <p className="mb-2.5">
          <b className="text-fg-secondary">Imagem é JPEG.</b> PNG é recusado. A arte é convertida no
          navegador, antes de subir.
        </p>
        <p className="mb-2.5">
          <b className="text-fg-secondary">Música só em Reels, e com acervo menor.</b> Entra apenas
          faixa liberada para uso por terceiros — bem menos do que o aplicativo oferece. E só
          funciona com o app configurado em Login do Facebook; no Login do Instagram a chamada
          responde erro 514, sem configuração que resolva.
        </p>
        <p>
          <b className="text-fg-secondary">Cinquenta publicações por dia.</b> Longe do que a loja
          usa, mas é o teto da conta.
        </p>
      </div>
    </div>
  );
}

function Linha({ pronto, titulo, detalhe }: { pronto: boolean; titulo: string; detalhe: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-divider py-3 last:border-0">
      <span
        className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          pronto ? 'bg-ouro text-ink' : 'border border-border-strong text-fg-muted'
        }`}
      >
        {pronto ? <Check size={12} /> : '!'}
      </span>
      <div>
        <div className="text-[13.5px] font-extrabold">{titulo}</div>
        <div className="text-[12.5px] leading-relaxed text-fg-tertiary">{detalhe}</div>
      </div>
    </div>
  );
}

function Segredo({ nome, valor, nota }: { nome: string; valor: string; nota?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="font-mono text-[12px] font-bold text-ouro">{nome}</span>
        <button
          onClick={() => void copiar()}
          className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-2.5 py-1 text-[11.5px] font-bold text-fg-secondary hover:border-accent hover:text-accent"
        >
          {copiado ? <Check size={12} /> : <Copy size={12} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div className="break-all rounded-[6px] border border-border bg-input px-3 py-2 font-mono text-[11.5px] text-fg-tertiary">
        {valor}
      </div>
      {nota && <div className="mt-1 text-[12px] text-fg-muted">{nota}</div>}
    </div>
  );
}
