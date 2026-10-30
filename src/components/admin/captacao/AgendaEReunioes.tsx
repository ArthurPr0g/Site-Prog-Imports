'use client';

// Atendimento › Agenda e reuniões (migration 0092): o Arthur escolhe em que dias e faixas de horário a Lia
// pode oferecer reunião (descoberta, alinhamento do projeto, entrega/fechamento) e controla as marcadas.
// O cancelamento aqui libera o horário para a Lia; o evento no Google Agenda, se houver, cancela-se lá.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { CalendarClock, Plus, Trash2, Video } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { AgendaConfig } from '@/lib/google-agenda';
import { agendaEReunioesAction, mudarReuniaoAction, salvarAgendaAction, type ReuniaoDoPainel } from '@/app/actions/agenda';
import { inputClass } from './comum';

const DIAS = [
  ['1', 'Segunda'],
  ['2', 'Terça'],
  ['3', 'Quarta'],
  ['4', 'Quinta'],
  ['5', 'Sexta'],
  ['6', 'Sábado'],
  ['0', 'Domingo'],
] as const;

const TIPO: Record<string, string> = {
  descoberta: 'Conversa de venda',
  alinhamento: 'Alinhamento do projeto',
  fechamento: 'Entrega / fechamento',
  rodada: 'Rodada de ajustes',
  outra: 'Outra',
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function AgendaEReunioes() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [agenda, setAgenda] = useState<AgendaConfig | null>(null);
  const [reunioes, setReunioes] = useState<ReuniaoDoPainel[]>([]);
  const [mudou, setMudou] = useState(false);
  const [novoBloqueio, setNovoBloqueio] = useState('');
  // Hora da última leitura: separa "próximas" de "últimas" sem chamar Date.now() durante a renderização.
  const [agora, setAgora] = useState(0);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof agendaEReunioesAction>>) => {
    if (!r) return;
    setAgenda(r.agenda);
    setReunioes(r.reunioes);
    setMudou(false);
    setAgora(Date.now());
  }, []);
  const carregar = useCallback(async () => aplicar(await agendaEReunioesAction()), [aplicar]);
  useEffect(() => {
    let vivo = true;
    agendaEReunioesAction().then((r) => vivo && aplicar(r));
    return () => {
      vivo = false;
    };
  }, [aplicar]);

  if (!agenda) return null;

  const alterar = (a: AgendaConfig) => {
    setAgenda(a);
    setMudou(true);
  };
  const faixas = (dia: string) => agenda.dias[dia] ?? [];
  const setFaixas = (dia: string, f: [string, string][]) => {
    const dias = { ...agenda.dias };
    if (f.length) dias[dia] = f;
    else delete dias[dia];
    alterar({ ...agenda, dias });
  };
  const salvar = () =>
    start(async () => {
      const r = await salvarAgendaAction(agenda);
      toast(r);
      if (r.ok) carregar();
    });
  const mudar = (id: string, status: 'marcada' | 'cancelada' | 'realizada') =>
    start(async () => {
      toast(await mudarReuniaoAction(id, status));
      carregar();
    });

  const proximas = reunioes.filter((r) => r.status === 'marcada' && new Date(r.fim).getTime() >= agora);
  const passadas = reunioes.filter((r) => !(r.status === 'marcada' && new Date(r.fim).getTime() >= agora)).reverse().slice(0, 8);
  const numero = 'w-[64px] rounded-control border border-border-strong bg-input px-2 py-1.5 text-[13px] outline-none focus:border-accent';

  return (
    <div className="grid gap-4 rounded-[14px] border border-border bg-card p-4 sm:col-span-4">
      <div className="flex items-center gap-2">
        <CalendarClock size={15} className="text-accent" />
        <b className="text-[14px]">Agenda e reuniões</b>
        <span className="text-[12px] text-fg-tertiary">
          A Lia só oferece horários dentro destas faixas (horário de Brasília), sem bater com reuniões marcadas nem com o Google Agenda.
        </span>
      </div>

      <div className="grid gap-2">
        {DIAS.map(([dia, nome]) => {
          const f = faixas(dia);
          return (
            <div key={dia} className="flex flex-wrap items-center gap-2 text-[13px]">
              <label className="flex w-[110px] items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={f.length > 0}
                  onChange={(ev) => setFaixas(dia, ev.target.checked ? [['09:00', '12:00']] : [])}
                />
                {nome}
              </label>
              {f.length === 0 && <span className="text-fg-faded">sem reuniões</span>}
              {f.map(([de, ate], k) => (
                <span key={k} className="flex items-center gap-1 rounded-full border border-border px-2 py-1">
                  <input
                    type="time"
                    value={de}
                    onChange={(ev) => setFaixas(dia, f.map((x, i) => (i === k ? [ev.target.value, x[1]] : x)))}
                    className="bg-transparent text-[13px] outline-none"
                    aria-label={`${nome}: início da faixa ${k + 1}`}
                  />
                  às
                  <input
                    type="time"
                    value={ate}
                    onChange={(ev) => setFaixas(dia, f.map((x, i) => (i === k ? [x[0], ev.target.value] : x)))}
                    className="bg-transparent text-[13px] outline-none"
                    aria-label={`${nome}: fim da faixa ${k + 1}`}
                  />
                  <button onClick={() => setFaixas(dia, f.filter((_, i) => i !== k))} title="Tirar esta faixa" className="text-fg-faded hover:text-error">
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
              {f.length > 0 && (
                <button
                  onClick={() => setFaixas(dia, [...f, ['14:00', '18:00']])}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12px] font-bold text-accent"
                >
                  <Plus size={12} /> faixa
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-4 text-[12.5px]">
        <label className="grid gap-1">
          <span className="font-bold text-fg-tertiary">Duração (min)</span>
          <input type="number" min={15} max={180} step={15} value={agenda.duracao_min} onChange={(e) => alterar({ ...agenda, duracao_min: Number(e.target.value) })} className={numero} />
        </label>
        <label className="grid gap-1">
          <span className="font-bold text-fg-tertiary">Antecedência mínima (h)</span>
          <input type="number" min={0} max={72} value={agenda.antecedencia_h} onChange={(e) => alterar({ ...agenda, antecedencia_h: Number(e.target.value) })} className={numero} />
        </label>
        <label className="grid gap-1">
          <span className="font-bold text-fg-tertiary">Máximo por dia</span>
          <input type="number" min={1} max={12} value={agenda.max_por_dia} onChange={(e) => alterar({ ...agenda, max_por_dia: Number(e.target.value) })} className={numero} />
        </label>
        <label className="grid gap-1">
          <span className="font-bold text-fg-tertiary">Até quantos dias à frente</span>
          <input type="number" min={1} max={60} value={agenda.horizonte_dias} onChange={(e) => alterar({ ...agenda, horizonte_dias: Number(e.target.value) })} className={numero} />
        </label>
        <div className="grid gap-1">
          <span className="font-bold text-fg-tertiary">Dias bloqueados (feriado, viagem)</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {agenda.bloqueios.map((d) => (
              <button
                key={d}
                onClick={() => alterar({ ...agenda, bloqueios: agenda.bloqueios.filter((x) => x !== d) })}
                className="rounded-full border border-border px-2.5 py-1 text-[12px]"
                title="Tirar o bloqueio"
              >
                {d.split('-').reverse().join('/')} ×
              </button>
            ))}
            <input type="date" value={novoBloqueio} onChange={(e) => setNovoBloqueio(e.target.value)} className={inputClass + ' py-1.5'} aria-label="Data para bloquear" />
            <button
              disabled={!novoBloqueio}
              onClick={() => {
                if (!agenda.bloqueios.includes(novoBloqueio)) alterar({ ...agenda, bloqueios: [...agenda.bloqueios, novoBloqueio].sort() });
                setNovoBloqueio('');
              }}
              className="rounded-full border border-border px-2.5 py-1 text-[12px] font-bold text-accent disabled:opacity-50"
            >
              bloquear
            </button>
          </div>
        </div>
        <button
          onClick={salvar}
          disabled={!mudou || pending}
          className="ml-auto rounded-full bg-accent px-4 py-2 text-[13px] font-extrabold text-page disabled:opacity-50"
        >
          {pending ? 'Salvando…' : mudou ? 'Salvar agenda' : 'Agenda salva'}
        </button>
      </div>

      <div className="grid gap-2">
        <b className="text-[13px]">Próximas reuniões ({proximas.length})</b>
        {proximas.length === 0 && <p className="text-[12.5px] text-fg-faded">Nenhuma reunião marcada.</p>}
        {proximas.map((r) => (
          <LinhaDaReuniao key={r.id} r={r} agora={agora} pending={pending} mudar={mudar} />
        ))}
        {passadas.length > 0 && (
          <details className="text-[12.5px]">
            <summary className="cursor-pointer font-bold text-fg-tertiary">Últimas reuniões</summary>
            <div className="mt-2 grid gap-2">
              {passadas.map((r) => (
                <LinhaDaReuniao key={r.id} r={r} agora={agora} pending={pending} mudar={mudar} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function LinhaDaReuniao({
  r,
  agora,
  pending,
  mudar,
}: {
  r: ReuniaoDoPainel;
  agora: number;
  pending: boolean;
  mudar: (id: string, s: 'marcada' | 'cancelada' | 'realizada') => void;
}) {
  const futura = new Date(r.fim).getTime() >= agora;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-border px-3 py-2 text-[12.5px]">
      <b className="tabular-nums">{quando(r.inicio)}</b>
      <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] font-bold">{TIPO[r.tipo] ?? r.tipo}</span>
      <span className="min-w-0 flex-1 truncate">{r.titulo}</span>
      {r.status !== 'marcada' && <span className={r.status === 'cancelada' ? 'text-error' : 'text-success'}>{r.status}</span>}
      {r.meetLink && (
        <a href={r.meetLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-accent">
          <Video size={13} /> Meet
        </a>
      )}
      {r.conversaId && (
        <a href={`/admin/captacao?aba=atendimento&conversa=${r.conversaId}`} className="font-bold text-accent">
          Conversa
        </a>
      )}
      {r.status === 'marcada' && futura && (
        <button disabled={pending} onClick={() => mudar(r.id, 'cancelada')} className="font-bold text-error disabled:opacity-50">
          Cancelar
        </button>
      )}
      {r.status === 'marcada' && !futura && (
        <button disabled={pending} onClick={() => mudar(r.id, 'realizada')} className="font-bold text-success disabled:opacity-50">
          Foi realizada
        </button>
      )}
      {r.status === 'cancelada' && futura && (
        <button disabled={pending} onClick={() => mudar(r.id, 'marcada')} className="font-bold text-accent disabled:opacity-50">
          Reativar
        </button>
      )}
    </div>
  );
}
