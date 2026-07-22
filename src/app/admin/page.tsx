import { getDashboardData } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export default async function AdminDashboardPage() {
  const { kpis, topSellers, lowStock, recentOrders } = await getDashboardData();

  const kpiCards = [
    { label: 'Vendas do mês', value: kpis.monthSales },
    { label: 'Pedidos', value: String(kpis.ordersCount) },
    { label: 'Produtos ativos', value: String(kpis.activeProducts), sub: `${kpis.totalProducts} cadastrados` },
    { label: 'Clientes', value: String(kpis.clientsCount) },
  ];

  return (
    <div>
      <AdminPageHeader title="Dashboard" subtitle="Visão geral da loja" />

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-[18px] border border-border bg-card p-5.5 transition-all hover:border-accent/40">
            <div className="mb-2.5 text-xs font-bold uppercase tracking-[.08em] text-fg-tertiary">{k.label}</div>
            <div className="font-display text-[28px] font-bold">{k.value}</div>
            {k.sub && <div className="mt-1.5 text-[12.5px] font-bold text-fg-tertiary">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[18px] border border-border bg-card p-6">
          <div className="mb-4.5 text-[15px] font-extrabold">Mais vendidos do mês</div>
          {topSellers.length === 0 && <div className="text-sm text-fg-tertiary">Sem vendas registradas ainda.</div>}
          {topSellers.map((t) => (
            <div key={t.name} className="flex items-center gap-3.5 border-b border-divider py-2.5 last:border-b-0">
              <div className="w-6 font-display text-[13px] font-bold text-accent">{t.rank}</div>
              <div className="flex-1 text-[13.5px] font-bold">{t.name}</div>
              <div className="text-[13px] text-fg-tertiary">{t.sold} vendas</div>
              <div className="h-1.5 w-27.5 overflow-hidden rounded-full bg-divider-strong">
                <div className="h-full rounded-full bg-accent" style={{ width: t.pct }} />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-[18px] border border-border bg-card p-6">
          <div className="mb-4.5 flex items-center justify-between">
            <div className="text-[15px] font-extrabold">Estoque baixo</div>
            <span className="rounded-full border border-error/40 bg-error/12 px-2.5 py-1 text-[11px] font-extrabold text-error">
              {lowStock.length} itens
            </span>
          </div>
          {lowStock.length === 0 && <div className="text-sm text-fg-tertiary">Nenhum item com estoque baixo.</div>}
          {lowStock.map((l) => (
            <div key={l.name} className="flex items-center justify-between border-b border-divider py-2.5 last:border-b-0">
              <div className="text-[13.5px] font-bold">{l.name}</div>
              <div className="text-[13px] font-extrabold text-error">{l.stock} un.</div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="mb-4 text-[15px] font-extrabold">Pedidos recentes</div>
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[90px_1.4fr_1fr_120px_160px] gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <div>Pedido</div>
            <div>Cliente</div>
            <div>Itens</div>
            <div>Total</div>
            <div>Status</div>
          </div>
          {recentOrders.map((o) => (
            <div key={o.id} className="grid grid-cols-[90px_1.4fr_1fr_120px_160px] items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0">
              <div className="font-extrabold text-accent">{o.id}</div>
              <div className="font-bold">{o.client}</div>
              <div className="text-[13px] text-fg-secondary">{o.items}</div>
              <div className="font-bold">{o.total}</div>
              <span
                className="w-fit rounded-full border px-3 py-1.5 text-[11.5px] font-extrabold"
                style={{ background: o.stBg, borderColor: o.stBorder, color: o.stColor }}
              >
                {o.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
