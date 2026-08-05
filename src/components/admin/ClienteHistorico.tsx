'use client';

import { useState } from 'react';
import { formatBRL, formatDateBR } from '@/lib/format';
import { statusExibido, rotuloDaParcela, type Installment } from '@/lib/installments';
import type { HistoricoDoCliente, ResumoFinanceiroDoCliente } from '@/lib/customer-history';
import { SeloAdimplencia } from '@/components/admin/SeloAdimplencia';

const VERDE = '#4ade80';
const VERMELHO = '#e05555';
const AMARELO = '#d9a441';
const CINZA = '#7a7a84';

const COR_PARCELA: Record<string, string> = {
  Pendente: AMARELO,
  Recebida: VERDE,
  Atrasada: VERMELHO,
  Cancelada: CINZA,
};

const ABAS = ['Financeiro', 'Compras', 'Serviços', 'Orçamentos'] as const;
type Aba = (typeof ABAS)[number];

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ClienteHistorico({
  historico,
  resumo,
}: {
  historico: HistoricoDoCliente;
  resumo: ResumoFinanceiroDoCliente;
}) {
  const [aba, setAba] = useState<Aba>('Financeiro');
  const hoje = hojeISO();

  const contagem: Record<Aba, number> = {
    Financeiro: resumo.qtdParcelas,
    Compras: historico.compras.length,
    Serviços: historico.servicos.length,
    Orçamentos: historico.orcamentos.length,
  };

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card rotulo="Total comprado" valor={formatBRL(resumo.totalComprado)} nota="compras + serviços" />
        <Card rotulo="Já pago" valor={formatBRL(resumo.totalPago)} nota="entrou no caixa" cor={VERDE} />
        <Card
          rotulo="Em aberto"
          valor={formatBRL(resumo.emAberto)}
          nota={`${resumo.qtdPendentes + resumo.qtdAtrasadas} parcela(s)`}
        />
        <Card
          rotulo="Atrasado"
          valor={formatBRL(resumo.atrasado)}
          nota={resumo.qtdAtrasadas > 0 ? `${resumo.qtdAtrasadas} parcela(s) vencida(s)` : 'nada vencido'}
          cor={resumo.atrasado > 0 ? VERMELHO : undefined}
        />
      </div>

      {historico.emTransporte.length > 0 && (
        <div className="mb-3.5 rounded-control border border-accent/40 bg-[rgb(var(--brand-accent-rgb)/.05)] px-4 py-3">
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">
            {historico.emTransporte.length} produto(s) a caminho
          </div>
          {historico.emTransporte.map((i) => (
            <div key={i.id} className="text-[12.5px] text-fg-secondary">
              {i.nome} — <span className="text-fg-tertiary">{i.status}</span>
              {i.entrada && <span className="text-fg-faded"> · entrada em {formatDateBR(i.entrada + 'T12:00:00')}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="mb-3.5 flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`rounded-control border px-4 py-2 text-[13px] font-bold transition-colors ${
              aba === a
                ? 'border-accent bg-[rgb(var(--brand-accent-rgb)/.1)] text-accent'
                : 'border-border-strong text-fg-secondary hover:border-accent hover:text-accent'
            }`}
          >
            {a} <span className="text-[11px] opacity-70">({contagem[a]})</span>
          </button>
        ))}
      </div>

      <div className="rounded-[18px] border border-border bg-card p-6">
        {aba === 'Financeiro' && <AbaFinanceiro resumo={resumo} historico={historico} hoje={hoje} />}
        {aba === 'Compras' && <AbaCompras historico={historico} hoje={hoje} />}
        {aba === 'Serviços' && <AbaServicos historico={historico} />}
        {aba === 'Orçamentos' && <AbaOrcamentos historico={historico} />}
      </div>
    </div>
  );
}

function Card({ rotulo, valor, nota, cor }: { rotulo: string; valor: string; nota: string; cor?: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-5 py-4">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{rotulo}</span>
        <span className="text-[10.5px] text-fg-faded/70">{nota}</span>
      </div>
      <div className="text-[20px] font-extrabold" style={cor ? { color: cor } : undefined}>{valor}</div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="py-4 text-[13px] text-fg-tertiary">{texto}</div>;
}

function AbaFinanceiro({
  resumo,
  historico,
  hoje,
}: {
  resumo: ResumoFinanceiroDoCliente;
  historico: HistoricoDoCliente;
  hoje: string;
}) {
  /** Descobre de qual compra ou serviço cada parcela veio, para a lista dizer
   *  o nome da venda como pedido — parcela solta não diz de onde saiu. */
  const origemDaParcela = new Map<Installment, string>();
  for (const c of historico.compras) {
    for (const p of c.parcelas) origemDaParcela.set(p, `Venda #${c.orderNumber}`);
  }
  for (const s of historico.servicos) {
    for (const p of s.parcelas) origemDaParcela.set(p, s.titulo);
  }

  const ordenadas = [...resumo.parcelas].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="text-[15px] font-extrabold">Parcelas</div>
        <SeloAdimplencia situacao={resumo.adimplencia} atrasadas={resumo.qtdAtrasadas} />
        <div className="text-[12px] text-fg-tertiary">
          {resumo.qtdPagas} paga(s) · {resumo.qtdPendentes} pendente(s) · {resumo.qtdAtrasadas} atrasada(s)
        </div>
      </div>

      {ordenadas.length === 0 ? (
        <Vazio texto="Nenhuma parcela. As compras deste cliente foram à vista ou ainda não têm parcelamento." />
      ) : (
        <>
          <div className="grid grid-cols-[1.6fr_80px_110px_110px_110px] gap-2 border-b border-border pb-2 text-[10.5px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
            <div>Origem</div>
            <div>Parcela</div>
            <div className="text-right">Valor</div>
            <div>Vencimento</div>
            <div>Status</div>
          </div>
          {ordenadas.map((p, i) => {
            const s = statusExibido(p, hoje);
            const totalDoGrupo = ordenadas.filter((x) => origemDaParcela.get(x) === origemDaParcela.get(p) && x.number > 0).length;
            return (
              <div
                key={p.id ?? i}
                className="grid grid-cols-[1.6fr_80px_110px_110px_110px] items-center gap-2 border-b border-divider py-2 text-[12.5px] last:border-b-0"
              >
                <div className="min-w-0 truncate font-bold">{origemDaParcela.get(p) ?? '—'}</div>
                <div className="text-fg-secondary">{rotuloDaParcela(p, totalDoGrupo)}</div>
                <div className="text-right font-bold">{formatBRL(p.amount)}</div>
                <div className="text-fg-secondary">{formatDateBR(p.dueDate + 'T12:00:00')}</div>
                <div>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                    style={{ background: `${COR_PARCELA[s]}1f`, color: COR_PARCELA[s] }}
                  >
                    {s}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function AbaCompras({ historico, hoje }: { historico: HistoricoDoCliente; hoje: string }) {
  if (historico.compras.length === 0) return <Vazio texto="Nenhuma compra registrada." />;

  return (
    <div>
      <div className="grid grid-cols-[80px_1.6fr_110px_110px_130px] gap-2 border-b border-border pb-2 text-[10.5px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
        <div>Venda</div>
        <div>Itens</div>
        <div>Data</div>
        <div className="text-right">Total</div>
        <div>Status</div>
      </div>
      {historico.compras.map((c) => {
        const abertas = c.parcelas.filter((p) => statusExibido(p, hoje) !== 'Recebida' && p.status !== 'Cancelada');
        return (
          <div
            key={c.id}
            className={`grid grid-cols-[80px_1.6fr_110px_110px_130px] items-center gap-2 border-b border-divider py-2.5 text-[12.5px] last:border-b-0 ${
              c.status === 'Cancelado' ? 'opacity-55' : ''
            }`}
          >
            <div className="font-extrabold text-accent">#{c.orderNumber}</div>
            <div className="min-w-0">
              <div className="truncate">{c.itens}</div>
              <div className="text-[11px] text-fg-faded">
                {c.origem}
                {c.parcelas.length > 0 &&
                  ` · ${c.parcelas.filter((p) => p.number > 0).length}× · ${abertas.length} em aberto`}
              </div>
            </div>
            <div className="text-fg-secondary">{formatDateBR(c.data)}</div>
            <div className="text-right font-bold">{formatBRL(c.total)}</div>
            <div className="text-[11.5px] text-fg-tertiary">{c.status}</div>
          </div>
        );
      })}
    </div>
  );
}

function AbaServicos({ historico }: { historico: HistoricoDoCliente }) {
  if (historico.servicos.length === 0) return <Vazio texto="Nenhum serviço prestado a este cliente." />;

  return (
    <div>
      <div className="grid grid-cols-[1.6fr_110px_130px_120px_120px] gap-2 border-b border-border pb-2 text-[10.5px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
        <div>Serviço</div>
        <div className="text-right">Valor</div>
        <div>Entrega</div>
        <div>Execução</div>
        <div>Pagamento</div>
      </div>
      {historico.servicos.map((s) => (
        <div
          key={s.id}
          className={`grid grid-cols-[1.6fr_110px_130px_120px_120px] items-center gap-2 border-b border-divider py-2.5 text-[12.5px] last:border-b-0 ${
            s.status === 'Cancelada' ? 'opacity-55' : ''
          }`}
        >
          <div className="min-w-0">
            <div className="truncate font-bold">{s.titulo}</div>
            <div className="text-[11px] text-fg-faded">
              início em {formatDateBR(s.inicio + 'T12:00:00')}
              {s.planoMeses ? ` · plano de ${s.planoMeses} meses` : ''}
            </div>
          </div>
          <div className="text-right font-bold">
            {s.total > 0 && <div>{formatBRL(s.total)}</div>}
            {s.mensal > 0 && <div className="text-[11px] text-fg-secondary">{formatBRL(s.mensal)}/mês</div>}
          </div>
          <div className="text-fg-secondary">
            {s.entrega ? formatDateBR(s.entrega + 'T12:00:00') : '—'}
          </div>
          <div className="text-[11.5px] text-fg-tertiary">{s.status}</div>
          <div className="text-[11.5px] text-fg-tertiary">{s.pagamento}</div>
        </div>
      ))}
    </div>
  );
}

function AbaOrcamentos({ historico }: { historico: HistoricoDoCliente }) {
  if (historico.orcamentos.length === 0) return <Vazio texto="Nenhum orçamento para este cliente." />;

  return (
    <div>
      <div className="grid grid-cols-[100px_1.6fr_110px_110px_160px] gap-2 border-b border-border pb-2 text-[10.5px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
        <div>Tipo</div>
        <div>Orçamento</div>
        <div>Criado</div>
        <div className="text-right">Valor</div>
        <div>Status</div>
      </div>
      {historico.orcamentos.map((o) => (
        <div
          key={o.id}
          className={`grid grid-cols-[100px_1.6fr_110px_110px_160px] items-center gap-2 border-b border-divider py-2.5 text-[12.5px] last:border-b-0 ${
            o.status === 'Reprovado' ? 'opacity-55' : ''
          }`}
        >
          <div className="text-[11.5px] text-fg-tertiary">{o.tipo}</div>
          <div className="min-w-0 truncate font-bold">{o.titulo}</div>
          <div className="text-fg-secondary">{formatDateBR(o.criadoEm)}</div>
          <div className="text-right font-bold">{formatBRL(o.valor)}</div>
          <div className="text-[11.5px] text-fg-tertiary">{o.status}</div>
        </div>
      ))}
    </div>
  );
}
