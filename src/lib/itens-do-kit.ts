// Item do link do vendedor: valor (implantação + mensalidade, com combo) e os
// serviços com descrição e preço do catálogo. Usado ao gerar o link
// (src/app/actions/leads.ts) e ao reavaliar a base (scripts/captacao/reavaliar-base.ts).

import { TABELA_USD, estimar, type TabelaPrecos } from '@/lib/precos-captacao';

/** Mensalidade que acompanha cada serviço do catálogo (site, loja, gestão). */
export function mensalidadeDoServico(nome: string): string | null {
  if (nome.startsWith('Site ')) return 'Mensalidade Site';
  if (nome.startsWith('Loja ')) return 'Mensalidade Loja';
  const gestao = nome.match(/^Sistema de Gestão (Básico|Intermediário|Avançado)$/);
  return gestao ? `Mensalidade Gestão ${gestao[1]}` : null;
}

export type ServicoDoCatalogo = {
  name: string;
  description: string | null;
  price: number;
  billingType: string;
  leadTimeDays: number;
};

export function valoresDoItem(
  lead: { country: string; suggested_services: string[] },
  porNome: Map<string, ServicoDoCatalogo>,
  tabBRL: TabelaPrecos
) {
  const e = estimar(lead.suggested_services, lead.country === 'US' ? TABELA_USD : tabBRL);
  const nomes = [...lead.suggested_services];
  for (const n of lead.suggested_services) {
    const m = mensalidadeDoServico(n);
    if (m && !nomes.includes(m)) nomes.push(m);
  }
  return {
    currency: e.moeda,
    one_time: e.unico,
    monthly: e.mensal,
    combo: e.combo,
    services: nomes
      .map((n) => porNome.get(n))
      .filter((s): s is ServicoDoCatalogo => !!s)
      .map((s) => ({
        nome: s.name,
        descricao: s.description,
        preco: s.price,
        mensal: s.billingType === 'mensal',
        prazoDias: s.leadTimeDays,
      })),
  };
}
