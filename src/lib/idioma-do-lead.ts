// Lead de fora do Brasil recebe tudo no idioma e no padrão do país dele (pedido do
// dono em 28/10/2026): PDF da proposta, valores, horários de reunião. O "o que
// inclui" em inglês é o texto oficial do portfólio (ArthurPr0g/Portfolio-Arthur-Prog,
// app/src/pages/planos/planos.en.js, campo f de cada plano). Mudou lá, mude aqui.

import type { Produto } from '@/lib/simulador';
import type { Moeda } from '@/lib/precos-captacao';

export type Idioma = 'pt' | 'en';
export const idiomaDaMoeda = (m: Moeda): Idioma => (m === 'USD' ? 'en' : 'pt');

/** Valor no padrão do país: R$ 1.497 (Brasil) ou $1,790 (EUA). */
export const dinheiroDoPais = (v: number, m: Moeda) =>
  m === 'USD' ? `$${Math.round(v).toLocaleString('en-US')}` : `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

export const INCLUI_EN: Record<Produto, string[][]> & { marca: string[][] } = {
  site: [
    ['Up to 5 pages or a single landing page', 'Professional template with your brand colors and logo', 'WhatsApp, contact form and map', 'Basic SEO and SSL security', '2 revision rounds · 30 days of support'],
    ['Up to 8 pages', 'Layout designed for your brand, not a template', 'Scroll animations and hover effects', 'Complete SEO', '2 revision rounds · 30 days of support'],
    ['Up to 15 pages with exclusive design and an approved preview', 'Advanced animations and page transitions', 'Dashboard to edit the whole site + copy review', 'Online booking or members area', 'Advanced SEO, very fast and accessible', '1 integration with another system', '3 revision rounds · 60 days of support'],
  ],
  loja: [
    ['Up to 50 products (no variants), 20 added for you', 'Cart with order requests by email or WhatsApp', 'Flat-rate shipping', 'Orders and products dashboard', '2 revision rounds · 30 days of support'],
    ['Up to 300 products with variants (size, color)', 'Online card payments and discount codes', 'Free shipping by order value or region, local pickup and calculated rates', 'Search, filters, reviews and animations', 'Customer accounts and automatic emails', 'Inventory control and sales reports', '2 revision rounds · 60 days of support'],
    ['Unlimited products with a full management page', 'Exclusive design and custom animated banners', 'Wishlist, cart and smart search', 'Subscriptions or recurring orders', 'Step-by-step order tracking', 'Sales dashboard and automations', '3 revision rounds · 90 days of support'],
  ],
  erp: [
    ['Up to 5 users (admin and staff)', 'Customers, suppliers and products/services', 'Quotes and orders as PDF', 'Inventory with low-stock alerts', 'Payables, receivables, cash flow and dashboard', 'Daily backups · 1h training · 30 days of support'],
    ['Up to 15 users with permissions', 'Professional invoices and receipts as PDF', 'Online payments and recurring billing (Stripe)', 'Purchasing, commissions and store integration', 'Excel/PDF reports and change history', '2 training sessions + manual · 60 days of support'],
    ['Unlimited users with detailed permissions', 'Inventory by batch, expiry date or unit', 'Memberships, PDF contracts, returns and P&L', 'Up to 3 custom modules (work orders, scheduling, fleet…)', 'Reports your way and full history', 'Training per team · 90 days of support'],
  ],
  marca: [
    ['2 logo concepts created from scratch', '2 revision rounds', 'Horizontal, vertical and icon versions', 'Brand color palette and fonts', 'PNG, SVG and PDF files (light and dark backgrounds)', 'Favicon and social media profile picture'],
    ['Your current logo reviewed and vectorized, if needed', 'Brand color palette and fonts', 'Brand guide in PDF (correct use, colors, fonts)', 'Business card and email signature', 'Social media kit: profile, cover and 5 post/story templates', 'Everything applied to your website or store'],
    ['Everything in Logo Design, with 3 concepts and 3 revision rounds', 'Brand guide in PDF (correct use, colors, fonts)', 'Business card and email signature', 'Social media kit: profile, cover and 5 post/story templates', 'Brand graphic elements and patterns', 'Everything applied to your website or store'],
  ],
};

/* ------------------------------------------------------------ fuso do cliente */

// Estados dos EUA pelo fuso (o do leste é o padrão: todos os leads de hoje são FL, MA e NJ).
const FUSO_DO_ESTADO: Record<string, string> = {
  ...Object.fromEntries(['TX', 'IL', 'MN', 'WI', 'MO', 'LA', 'AL', 'MS', 'TN', 'IA', 'KS', 'OK', 'NE', 'AR', 'SD', 'ND'].map((s) => [s, 'America/Chicago'])),
  ...Object.fromEntries(['CO', 'UT', 'NM', 'MT', 'WY', 'ID'].map((s) => [s, 'America/Denver'])),
  AZ: 'America/Phoenix',
  ...Object.fromEntries(['CA', 'WA', 'OR', 'NV'].map((s) => [s, 'America/Los_Angeles'])),
  AK: 'America/Anchorage',
  HI: 'Pacific/Honolulu',
};

/** Fuso IANA do cliente; null = Brasil (horário de Brasília). */
export function fusoDoCliente(pais: string | null | undefined, estado: string | null | undefined): string | null {
  if (pais !== 'US') return null;
  return FUSO_DO_ESTADO[(estado ?? '').toUpperCase()] ?? 'America/New_York';
}

/** "Thu, Oct 30, 9:00 AM EDT" no fuso do cliente. */
export function horarioNoFuso(d: Date, fuso: string): string {
  return d.toLocaleString('en-US', {
    timeZone: fuso,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
