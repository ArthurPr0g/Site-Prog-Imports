'use client';

// Lixeira de testes (31/10/2026): registros de teste com um botão "Apagar" em cada um. É o Arthur quem aperta;
// a ação confere de novo no servidor que o registro é de teste e apaga junto o que é do mesmo teste.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { FlaskConical, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { listarDadosDeTesteAction, apagarDadoDeTesteAction, type ItemDeTeste } from '@/app/actions/dados-de-teste';

const ROTULO: Record<ItemDeTeste['tipo'], string> = {
  lead: 'Lead',
  projeto: 'Projeto',
  conversa: 'Conversa',
  aviso: 'Aviso',
  reuniao: 'Reunião',
  negociacao: 'Negociação',
};

export function DadosDeTeste() {
  const toast = useToast();
  const [itens, setItens] = useState<ItemDeTeste[] | null>(null);
  const [apagar, setApagar] = useState<ItemDeTeste | null>(null);
  const [pendente, iniciar] = useTransition();

  const ler = useCallback(async () => setItens((await listarDadosDeTesteAction().catch(() => null)) ?? []), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura inicial pelo servidor
    void ler();
  }, [ler]);

  const confirmar = () => {
    if (!apagar) return;
    const alvo = apagar;
    iniciar(async () => {
      const r = await apagarDadoDeTesteAction(alvo.tipo, alvo.id);
      toast(r);
      setApagar(null);
      await ler();
    });
  };

  return (
    <section className="g-cartao mt-4 rounded-[18px] border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-accent">
          <FlaskConical size={14} />
        </span>
        <b className="text-[14px]">Dados de teste</b>
        <span className="text-[11.5px] text-fg-tertiary">só o que é claramente teste; cada um pede confirmação</span>
      </div>
      {itens === null ? (
        <p className="text-[12.5px] text-fg-faded">Procurando…</p>
      ) : itens.length === 0 ? (
        <p className="text-[12.5px] text-fg-faded">Nenhum registro de teste. Tudo limpo.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {itens.map((i) => {
            const bloqueado = !!i.confira?.startsWith('Tem ');
            return (
              <li key={`${i.tipo}-${i.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                <div className="min-w-0 flex-1">
                  <span className="mr-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.05em] text-fg-tertiary">{ROTULO[i.tipo]}</span>
                  <span className="text-fg">{i.nome}</span>
                  <span className="block text-[11px] text-fg-tertiary">
                    {i.detalhe}
                    {i.quando ? ` · ${new Date(i.quando).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}` : ''}
                  </span>
                  {i.confira && <span className="block text-[11px] font-bold text-warning">{i.confira}</span>}
                </div>
                <button
                  onClick={() => setApagar(i)}
                  disabled={bloqueado || pendente}
                  className="flex items-center gap-1 rounded-full border border-error/40 px-3 py-1 text-[12px] font-bold text-error hover:bg-error/10 disabled:opacity-40"
                >
                  <Trash2 size={12} /> Apagar
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        aberto={!!apagar}
        titulo={`Apagar ${apagar ? ROTULO[apagar.tipo].toLowerCase() : ''} de teste?`}
        descricao={apagar?.detalhe ?? ''}
        detalhe={apagar ? `${apagar.nome}${apagar.confira ? ` · ${apagar.confira}` : ''}` : undefined}
        confirmar="Apagar"
        pending={pendente}
        onConfirmar={confirmar}
        onCancelar={() => setApagar(null)}
      />
    </section>
  );
}
