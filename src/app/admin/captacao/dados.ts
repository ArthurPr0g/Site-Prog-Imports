import { listLeads, listLeadTemplates, listSearchRequests, leadsQueJaSaoClientes, listKits } from '@/lib/data/leads';
import { listInternalServices } from '@/lib/data/internal-services';
import { SITE_URL } from '@/lib/seo';
import { buscarCotacaoMercado } from '@/lib/usd-rate';

/**
 * Dados do painel da Captação, usados pelas páginas da Prog Soluções que mostram partes dele (menu novo de
 * 30/10/2026): Captação, Dashboards, Atendimento, Vendedores e Lia.
 */
export async function dadosDaCaptacao() {
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
  return { leads, catalogo, servicos: catalogoCompleto, cotacoes, modelos, origem: SITE_URL, pedidos, clientes, kits };
}
