'use client';

// Ficha do lead › o que a pesquisa achou na internet/Maps (a Lia confirma com o cliente), o briefing do
// projeto sob medida e o financeiro informado pelo Arthur (modo projeto, 0094-0097).

import { useEffect, useState } from 'react';
import { pesquisaEBriefingAction, type PesquisaDoPainel } from '@/app/actions/projeto';

const SITUACAO: Record<string, string> = { a_confirmar: '❔ a confirmar', confirmado: '✅ confirmado', corrigido: '✏️ corrigido', descartado: '❌ não é' };
const PAGAMENTO: Record<string, string> = {
  nada: 'Nada pago ainda',
  sinal: 'Sinal (50%) pago',
  total: 'Pago 100%',
  gratis: 'Projeto de graça',
  depois: 'Arthur informa depois',
};

export function PesquisaEBriefing({ leadId }: { leadId: string }) {
  const [d, setD] = useState<PesquisaDoPainel | null>(null);
  useEffect(() => {
    let vivo = true;
    pesquisaEBriefingAction(leadId).then((r) => vivo && setD(r));
    return () => {
      vivo = false;
    };
  }, [leadId]);
  if (!d || (!d.status && !d.itens.length && !Object.keys(d.briefing).length && !d.financeiro)) return null;

  return (
    <div className="space-y-2 rounded-[10px] border border-border px-3 py-2 text-[12.5px] leading-snug">
      {d.financeiro && (
        <div>
          <b>💰 Financeiro:</b> {d.financeiro.pagamento ? PAGAMENTO[d.financeiro.pagamento] : 'ainda não informado'}
          {d.financeiro.pagoOnde ? ` · ${d.financeiro.pagoOnde}` : ''}
          {d.financeiro.valorTotal ? ` · valor ${Number(d.financeiro.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
          {d.financeiro.asaas && <div className="mt-1 whitespace-pre-line text-fg-tertiary">{d.financeiro.asaas}</div>}
        </div>
      )}
      {(d.status || d.itens.length > 0) && (
        <details>
          <summary className="cursor-pointer font-bold">
            🔎 Pesquisa na internet {d.status === 'feita' ? `(${d.itens.length})` : `· ${d.status === 'erro' ? 'falhou' : 'em andamento'}`}
          </summary>
          {d.resumo && <p className="mt-1">{d.resumo}</p>}
          <ul className="mt-1 space-y-0.5">
            {d.itens.map((i, k) => (
              <li key={k}>
                <span className="text-fg-tertiary">{SITUACAO[i.situacao ?? 'a_confirmar'] ?? i.situacao}</span> <b>{i.campo}:</b> {i.correcao || i.valor}
                {i.fonte?.startsWith('http') && (
                  <a href={i.fonte} target="_blank" rel="noreferrer" className="ml-1 text-accent">
                    fonte
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {Object.keys(d.briefing).length > 0 && (
        <details open>
          <summary className="cursor-pointer font-bold">📋 Briefing do projeto (Lia)</summary>
          <ul className="mt-1 space-y-0.5">
            {Object.entries(d.briefing).map(([k, v]) => (
              <li key={k}>
                <b>{k.replace(/_/g, ' ')}:</b> {Array.isArray(v) ? v.join(' · ') : v}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
