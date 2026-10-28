import { listLeads, listLeadTemplates, listSearchRequests, leadsQueJaSaoClientes, listKits } from '@/lib/data/leads';
import { listInternalServices } from '@/lib/data/internal-services';
import { SITE_URL } from '@/lib/seo';
import { buscarCotacaoMercado } from '@/lib/usd-rate';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CaptacaoPanel } from '@/components/admin/CaptacaoPanel';

export default async function AdminCaptacaoPage() {
  const [leads, servicos, modelos, cotacao, pedidos] = await Promise.all([
    listLeads(),
    listInternalServices(),
    listLeadTemplates(),
    buscarCotacaoMercado(),
    listSearchRequests(),
  ]);
  const kits = await listKits();
  const clientes = await leadsQueJaSaoClientes(leads);
  // Preço por nome (trabalhos e mensalidades): base do valor dos leads do Brasil.
  const catalogo = servicos.filter((s) => s.active).map((s) => [s.name, s.price] as [string, number]);
  // Serviços com descrição e prazo: a aba Oportunidade da ficha do lead.
  const catalogoCompleto = servicos
    .filter((s) => s.active)
    .map((s) => ({ name: s.name, description: s.description, price: s.price, billingType: s.billingType, leadTimeDays: s.leadTimeDays }));
  // Cotação de mercado, sem a taxa da Prog: é estimativa de quanto entra, não preço de compra.
  const cotacoes = cotacao.ok
    ? { USD: cotacao.cotacao.valor, atualizadaEm: cotacao.cotacao.atualizadaEm }
    : { USD: null, atualizadaEm: null };

  return (
    <div>
      <AdminPageHeader
        title="Captação"
        subtitle="Empresas do Google Maps (Brasil e EUA) com chance de fechar site, loja, sistema ou marca."
      />
      <CaptacaoPanel
        leads={leads}
        catalogo={catalogo}
        servicos={catalogoCompleto}
        cotacoes={cotacoes}
        modelos={modelos}
        origem={SITE_URL}
        pedidos={pedidos}
        clientes={clientes}
        kits={kits}
      />
    </div>
  );
}
