'use client';

// Atendimento › Custo da IA por venda (30/10/2026): o gasto real (ia_usage), onde e com o quê, e quanto
// custou cada venda. A projeção é uma estimativa separada, a partir do custo médio por resposta medido.

import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { custoDaIaAction, type CustoDaIa as Dados } from '@/app/actions/custo-ia';

const usd = (v: number) => `US$ ${v.toFixed(v < 1 ? 3 : 2).replace('.', ',')}`;

function Barras({ itens }: { itens: { nome: string; usd: number }[] }) {
  const max = Math.max(...itens.map((i) => i.usd), 0.0001);
  return (
    <div className="grid gap-1">
      {itens.map((i) => (
        <div key={i.nome} className="grid grid-cols-[150px_1fr_70px] items-center gap-2 text-[12px]">
          <span className="truncate">{i.nome}</span>
          <span className="h-2 rounded-full bg-accent/70" style={{ width: `${Math.max(2, (i.usd / max) * 100)}%` }} />
          <span className="text-right tabular-nums">{usd(i.usd)}</span>
        </div>
      ))}
    </div>
  );
}

export function CustoDaIa() {
  const [d, setD] = useState<Dados | null>(null);
  useEffect(() => {
    let vivo = true;
    custoDaIaAction().then((r) => vivo && setD(r));
    return () => {
      vivo = false;
    };
  }, []);
  if (!d) return null;
  // Estimativa de um projeto indicado: ~40 respostas na descoberta + 2 pesquisas do lead.
  const pesquisa = d.porFinalidade.find((f) => f.nome.startsWith('Pesquisa'))?.usd;
  const estimativa = d.custoPorResposta * 40 + 0.3;

  return (
    <details className="rounded-[14px] border border-border bg-card p-4 sm:col-span-4">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <Coins size={15} className="text-accent" />
        <b className="text-[14px]">Custo da IA</b>
        <span className="text-[12px] text-fg-tertiary">
          {usd(d.mes)} neste mês · {d.vendas} venda(s) fechada(s){d.vendas ? ` · ${usd(d.total / d.vendas)} por venda (gasto total ÷ vendas)` : ''}
        </span>
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1 text-[12.5px]">
          <b>Números reais</b>
          <span>Total desde {d.desde ? new Date(d.desde).toLocaleDateString('pt-BR') : '-'}: {usd(d.total)}</span>
          <span>Conversas reais com custo: {d.conversasReais} · média {usd(d.custoMedioConversa)} por conversa</span>
          <span>Custo médio por resposta da Lia: {usd(d.custoPorResposta)}</span>
          <span>
            Vendas fechadas: {d.vendas} · IA gasta nas conversas que fecharam: {usd(d.custoDasVendas)}
            {d.vendas ? ` (${usd(d.custoDasVendas / d.vendas)} cada)` : ''}
          </span>
          <span className="mt-1 text-fg-tertiary">
            Estimativa para um projeto indicado (≈40 respostas na descoberta + pesquisa do lead{pesquisa ? '' : ', ainda sem medição'}): ~{usd(estimativa)}. Vai
            sendo trocada pelos números reais conforme as vendas fecham.
          </span>
        </div>
        <div className="grid gap-3">
          <div>
            <b className="text-[12.5px]">Onde se gasta</b>
            <Barras itens={d.porFinalidade} />
          </div>
          <div>
            <b className="text-[12.5px]">Com qual modelo</b>
            <Barras itens={d.porModelo} />
          </div>
        </div>
        <div>
          <b className="text-[12.5px]">Por dia (últimos 30)</b>
          <Barras itens={d.porDia.map((x) => ({ nome: x.dia.split('-').reverse().slice(0, 2).join('/'), usd: x.usd }))} />
        </div>
        <div>
          <b className="text-[12.5px]">Leads que mais gastaram</b>
          <Barras itens={d.maisCaros.map((l) => ({ nome: `${l.nome} (${l.status})`, usd: l.usd }))} />
        </div>
      </div>
    </details>
  );
}
