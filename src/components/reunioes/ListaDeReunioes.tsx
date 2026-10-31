'use client';

// Lista das reuniões (Fase 1 da sala, 31/10/2026): próximas e passadas, com o botão "Nova reunião" (escolhe o lead).

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, Copy, Plus, Search, Video, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { AppLoader } from '@/brand/loaders/AppLoader';
import { buscarLeadsAction, listarReunioesAction, novaReuniaoAction, type ReuniaoDaLista } from '@/app/actions/reunioes';

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Selo({ r }: { r: ReuniaoDaLista }) {
  const [txt, cor] =
    r.status === 'cancelada'
      ? ['cancelada', 'text-[#8B919B]']
      : r.salaStatus === 'ao_vivo'
        ? ['ao vivo', 'text-[#5FD37F]']
        : r.salaStatus === 'encerrada' || r.status === 'realizada'
          ? ['encerrada', 'text-[#A3A8B2]']
          : ['agendada', 'text-[#B1D2FF]'];
  return <span className={`rounded-[6px] bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] uppercase tracking-[.08em] ${cor}`}>{txt}</span>;
}

function Item({ r }: { r: ReuniaoDaLista }) {
  const toast = useToast();
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[20px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015))] p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="truncate text-[15px] text-[#F4F5F7]">{r.lead ?? r.titulo}</b>
          <Selo r={r} />
          {r.meio === 'meet' && <span className="text-[11.5px] text-[#8B919B]">pelo Meet</span>}
        </div>
        <div className="mt-0.5 text-[12.5px] text-[#8B919B]">
          {quando(r.inicio)}
          {r.minutos !== null ? ` · ${Math.round(r.minutos)} min de participante` : ''}
          {r.custoUsd > 0 ? ` · US$ ${r.custoUsd.toFixed(3)}` : ''}
          {r.temResumo ? ' · com resumo' : ''}
        </div>
      </div>
      {r.linkCliente && r.salaStatus !== 'encerrada' && r.status === 'marcada' && (
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(r.linkCliente!).catch(() => undefined);
            toast({ ok: true, message: 'Link do cliente copiado.' });
          }}
          className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px]"
        >
          <Copy size={13} /> Link do cliente
        </button>
      )}
      <Link href={`/admin/reunioes/${r.id}`} className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px]">
        <Video size={14} /> {r.salaStatus === 'encerrada' ? 'Ver registro' : 'Abrir sala'}
      </Link>
    </li>
  );
}

function NovaReuniao({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const [leads, setLeads] = useState<Awaited<ReturnType<typeof buscarLeadsAction>>>([]);
  const [lead, setLead] = useState<string | null>(null);
  const [agora, setAgora] = useState(true);
  const [data, setData] = useState('');
  const [assunto, setAssunto] = useState('');
  const [criando, startCriar] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => void buscarLeadsAction(busca).then(setLeads), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const criar = () =>
    startCriar(async () => {
      if (!lead) return void toast({ ok: false, message: 'Escolha o lead.' });
      // datetime-local vem sem fuso: é horário de Brasília.
      const iso = agora ? null : data ? new Date(`${data}:00-03:00`).toISOString() : null;
      if (!agora && !iso) return void toast({ ok: false, message: 'Escolha o dia e a hora.' });
      const r = await novaReuniaoAction(lead, iso, assunto);
      toast(r);
      if (r.ok && r.id) router.push(`/admin/reunioes/${r.id}`);
    });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#08080A]/70 p-4" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] rounded-[32px] border border-white/[0.14] bg-[#12141A] p-6 shadow-[0_40px_120px_rgba(0,0,0,.55)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Nova reunião</h2>
          <button onClick={onFechar} aria-label="Fechar" className="text-[#8B919B] hover:text-[#F4F5F7]">
            <X size={20} />
          </button>
        </div>
        <label className="mb-2 flex items-center gap-2 rounded-[14px] border border-white/[0.14] bg-white/[0.03] px-3">
          <Search size={16} className="text-[#8B919B]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lead pelo nome" className="h-11 flex-1 bg-transparent text-[14px] outline-none" autoFocus />
        </label>
        <ul className="mb-4 max-h-[220px] overflow-y-auto">
          {leads.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => setLead(l.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] ${lead === l.id ? 'bg-[oklch(72%_.1_262/.14)] text-[#B1D2FF]' : 'hover:bg-white/[0.04]'}`}
              >
                <span className="truncate">{l.nome}</span>
                <span className="flex-shrink-0 text-[11.5px] text-[#8B919B]">{l.cidade ?? ''}</span>
              </button>
            </li>
          ))}
          {!leads.length && <li className="px-3 py-2 text-[13px] text-[#8B919B]">Nenhum lead com esse nome.</li>}
        </ul>
        <div className="mb-3 flex gap-2 text-[13px]">
          <button onClick={() => setAgora(true)} className={`h-9 rounded-full border px-4 ${agora ? 'border-[#81AAF7]! text-[#B1D2FF]!' : ''}`}>
            Agora
          </button>
          <button onClick={() => setAgora(false)} className={`h-9 rounded-full border px-4 ${!agora ? 'border-[#81AAF7]! text-[#B1D2FF]!' : ''}`}>
            Marcar horário
          </button>
        </div>
        {!agora && (
          <input
            type="datetime-local"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mb-3 h-11 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.03] px-3 text-[14px]"
          />
        )}
        <input
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          maxLength={80}
          placeholder="Assunto (opcional): site novo, loja, sistema…"
          className="mb-5 h-11 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.03] px-3 text-[14px] outline-none"
        />
        <button onClick={criar} disabled={criando || !lead} className="bg-accent flex h-[52px] w-full items-center justify-center rounded-full text-[15px] font-semibold disabled:opacity-50">
          {criando ? 'Criando a sala…' : agora ? 'Criar e abrir a sala' : 'Criar reunião'}
        </button>
        <p className="mt-3 text-[12px] text-[#8B919B]">Nada é enviado ao cliente: copie o link da sala e mande você.</p>
      </div>
    </div>
  );
}

export function ListaDeReunioes() {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof listarReunioesAction>>>(null);
  const [nova, setNova] = useState(false);
  useEffect(() => {
    void listarReunioesAction().then(setDados);
  }, []);

  return (
    <div className="tema-apple relative z-[1] space-y-6 [color-scheme:dark]">
      <div className="flex justify-end">
        <button onClick={() => setNova(true)} className="bg-accent flex h-10 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold">
          <Plus size={16} /> Nova reunião
        </button>
      </div>
      {!dados ? (
        <AppLoader rotulo="Buscando as reuniões" />
      ) : (
        <>
          <section>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[.24em] text-[#81AAF7]">Próximas</h2>
            {dados.proximas.length ? (
              <ul className="grid gap-2">
                {dados.proximas.map((r) => (
                  <Item key={r.id} r={r} />
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-[13.5px] text-[#8B919B]">
                <CalendarClock size={16} /> Nenhuma reunião marcada. As que a Lia marcar aparecem aqui com a sala pronta.
              </p>
            )}
          </section>
          <section>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[.24em] text-[#81AAF7]">Passadas</h2>
            {dados.passadas.length ? (
              <ul className="grid gap-2">
                {dados.passadas.map((r) => (
                  <Item key={r.id} r={r} />
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-[#8B919B]">Nenhuma ainda.</p>
            )}
          </section>
        </>
      )}
      {nova && <NovaReuniao onFechar={() => setNova(false)} />}
    </div>
  );
}
