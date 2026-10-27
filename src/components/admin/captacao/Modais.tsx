'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/Toast';
import { NOME_DA_ETAPA, type Lead } from '@/lib/captacao';
import { importLeadsAction, updateLeadAction, saveLeadTemplatesAction } from '@/app/actions/leads';
import {
  VARIAVEIS,
  variaveisDoLead,
  preencher,
  type ModeloMensagem,
  type Canal,
  type Idioma,
  type Variante,
} from '@/lib/mensagens-lead';
import { inputClass, Modal } from './comum';

const botaoSecundario = 'rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-bold text-fg-secondary';
const botaoPrimario = 'rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60';

export function ImportarModal({ onFechar }: { onFechar: () => void }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await importLeadsAction(formData);
      toast(r);
      if (r.ok) onFechar();
    });
  }

  return (
    <Modal titulo="Importar leads do Google Maps" onFechar={onFechar}>
      <form action={enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <div className="mb-1.5 text-[11px] text-fg-faded">CSVs do captar.ps1 (pode escolher vários) *</div>
          <input name="arquivo" type="file" accept=".csv,text/csv" multiple required className={`w-full ${inputClass}`} />
          <div className="mt-1.5 text-[11.5px] leading-relaxed text-fg-tertiary">
            O captar.ps1 grava ramo, cidade e país dentro de cada arquivo: os campos abaixo só valem para CSV que não veio dele.
            Com o programa do PC ligado (aba Buscas), nem precisa importar.
          </div>
        </label>
        <label>
          <div className="mb-1.5 text-[11px] text-fg-faded">País</div>
          <select name="pais" defaultValue="BR" className={`w-full ${inputClass}`}>
            <option value="BR">Brasil</option>
            <option value="US">EUA</option>
          </select>
        </label>
        <label>
          <div className="mb-1.5 text-[11px] text-fg-faded">Ramo buscado</div>
          <input name="nicho" placeholder="Ex: clínica odontológica" className={`w-full ${inputClass}`} />
        </label>
        <label>
          <div className="mb-1.5 text-[11px] text-fg-faded">Cidade</div>
          <input name="cidade" placeholder="Ex: Brasília" className={`w-full ${inputClass}`} />
        </label>
        <label>
          <div className="mb-1.5 text-[11px] text-fg-faded">Estado (sigla)</div>
          <input name="estado" placeholder="Ex: DF ou FL" maxLength={2} className={`w-full uppercase ${inputClass}`} />
        </label>
        <div className="text-[12px] leading-relaxed text-fg-tertiary sm:col-span-2">
          Reimportar a mesma busca atualiza os dados e a nota, sem mexer na etapa, no retorno nem nas anotações.
        </div>
        <div className="flex justify-end gap-2.5 sm:col-span-2">
          <button type="button" onClick={onFechar} className={botaoSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={botaoPrimario}>
            {pending ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function NotasModal({ lead, onFechar }: { lead: Lead; onFechar: () => void }) {
  const [texto, setTexto] = useState(lead.notes ?? '');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function salvar() {
    startTransition(async () => {
      const r = await updateLeadAction(lead.id, { notes: texto });
      toast(r);
      if (r.ok) onFechar();
    });
  }

  return (
    <Modal titulo={`Anotações: ${lead.name}`} onFechar={onFechar}>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        placeholder="O que conversaram, quem decide, objeções, próximo passo…"
        className={`mb-4 w-full resize-none ${inputClass}`}
      />
      <div className="flex justify-end gap-2.5">
        <button onClick={onFechar} className={botaoSecundario}>
          Cancelar
        </button>
        <button onClick={salvar} disabled={pending} className={botaoPrimario}>
          Salvar
        </button>
      </div>
    </Modal>
  );
}

function Pilula<T extends string | number>({
  valor,
  atual,
  onClick,
  children,
}: {
  valor: T;
  atual: T;
  onClick: (v: T) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(valor)}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${valor === atual ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong text-fg-secondary'}`}
    >
      {children}
    </button>
  );
}

const chave = (m: Pick<ModeloMensagem, 'channel' | 'lang' | 'step' | 'variant'>) =>
  `${m.channel}-${m.lang}-${m.step}-${m.variant}`;

/**
 * Editor dos modelos: idioma × etapa da sequência × canal × variante A/B.
 * Variante B vazia = sem teste A/B naquela mensagem (todo mundo recebe A).
 */
export function ModelosModal({
  modelos,
  exemplo,
  origem,
  onFechar,
}: {
  modelos: ModeloMensagem[];
  exemplo: Lead | null;
  origem: string;
  onFechar: () => void;
}) {
  const [form, setForm] = useState<Map<string, ModeloMensagem>>(() => new Map(modelos.map((m) => [chave(m), m])));
  const [lang, setLang] = useState<Idioma>('pt');
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Canal>('whatsapp');
  const [variant, setVariant] = useState<Variante>('A');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const k = chave({ channel, lang, step, variant });
  const atual: ModeloMensagem = form.get(k) ?? {
    channel,
    lang,
    step,
    variant,
    subject: channel === 'email' ? '' : null,
    body: '',
  };
  const set = (campo: 'subject' | 'body', valor: string) => setForm((f) => new Map(f).set(k, { ...atual, [campo]: valor }));
  const vars = exemplo ? variaveisDoLead(exemplo, lang, origem) : null;

  function salvar() {
    startTransition(async () => {
      const r = await saveLeadTemplatesAction([...form.values()]);
      toast(r);
      if (r.ok) onFechar();
    });
  }

  return (
    <Modal titulo="Mensagens prontas" onFechar={onFechar} largo>
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Pilula valor="pt" atual={lang} onClick={setLang}>
            Português (Brasil)
          </Pilula>
          <Pilula valor="en" atual={lang} onClick={setLang}>
            Inglês (EUA)
          </Pilula>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {NOME_DA_ETAPA.map((nome, i) => (
            <Pilula key={nome} valor={i} atual={step} onClick={setStep}>
              {nome}
            </Pilula>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pilula valor="whatsapp" atual={channel} onClick={setChannel}>
            WhatsApp
          </Pilula>
          <Pilula valor="email" atual={channel} onClick={setChannel}>
            E-mail
          </Pilula>
          <span className="mx-1 self-center text-fg-faded">·</span>
          <Pilula valor="A" atual={variant} onClick={setVariant}>
            Variante A
          </Pilula>
          <Pilula valor="B" atual={variant} onClick={setVariant}>
            Variante B (teste)
          </Pilula>
        </div>
      </div>

      {channel === 'email' && (
        <input
          value={atual.subject ?? ''}
          onChange={(e) => set('subject', e.target.value)}
          placeholder="Assunto"
          className={`mb-2.5 w-full ${inputClass}`}
        />
      )}
      <textarea
        value={atual.body}
        onChange={(e) => set('body', e.target.value)}
        rows={10}
        placeholder={variant === 'B' ? 'Deixe vazio para não testar esta mensagem (todos recebem a A).' : ''}
        className={`w-full resize-y ${inputClass}`}
      />
      <div className="mt-2 text-[11.5px] leading-relaxed text-fg-tertiary">
        Variáveis: {VARIAVEIS.map((v) => `{${v}}`).join(' ')}. O {'{problema}'} muda conforme o lead (sem site, site fora do ar,
        não abre bem no celular…) e o {'{elogio}'} só aparece com 30+ avaliações e nota 4,3+. A variante B só é usada quando
        existe no primeiro contato; cada lead fica com a mesma variante na sequência toda.
      </div>

      {exemplo && vars && atual.body.trim() && (
        <div className="mt-4 rounded-[14px] border border-border bg-page/40 p-4">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Como fica para {exemplo.name}
          </div>
          {channel === 'email' && <div className="mb-2 text-[13px] font-bold">{preencher(atual.subject ?? '', vars)}</div>}
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-secondary">{preencher(atual.body, vars)}</div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2.5">
        <button onClick={onFechar} className={botaoSecundario}>
          Cancelar
        </button>
        <button onClick={salvar} disabled={pending} className={botaoPrimario}>
          Salvar mensagens
        </button>
      </div>
    </Modal>
  );
}
