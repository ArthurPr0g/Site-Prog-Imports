// Combos e mensalidades aplicados automaticamente no orçamento de serviço.
// Puro, sem servidor: a tela chama ao escolher um serviço do catálogo.
//
// - **Combo:** site ou loja + sistema de gestão viram uma linha só, com o
//   desconto da tabela da página de planos (portfolio-arthur-prog.vercel.app/#/planos):
//   15% / 15% / 20% no mesmo nível (Essencial/Básico, Profissional/Intermediário,
//   Premium/Avançado) e 15% em níveis diferentes, arredondado para baixo até um
//   valor terminado em 97. No mesmo nível o resultado é exatamente o preço do
//   combo do catálogo, e a linha usa o item de catálogo dele.
// - **Marca:** Logo Essencial + Identidade a partir do Logo viram a Identidade
//   Visual Completa do catálogo, que é o combo dos dois.
// - **Mensalidade:** com mais de uma mensalidade, fica só a mais cara (decisão
//   do dono: um cliente paga uma mensalidade só).
//
// O desconto manual do orçamento continua independente e incide por cima.

import type { InternalService, ServiceOrderItem } from '@/lib/services';

type Produto = 'site' | 'loja' | 'erp';

const NIVEIS: Record<Produto, string[]> = {
  site: ['Site Essencial', 'Site Profissional', 'Site Premium'],
  loja: ['Loja Essencial', 'Loja Profissional', 'Loja Premium'],
  erp: ['Sistema de Gestão Básico', 'Sistema de Gestão Intermediário', 'Sistema de Gestão Avançado'],
};

/** Nome do combo do catálogo no mesmo nível (o item é "Nome (A + B)"). */
const COMBOS: Record<'site' | 'loja', string[]> = {
  site: ['Combo Start', 'Combo Business', 'Combo Enterprise'],
  loja: ['Combo Loja Start', 'Combo Loja Growth', 'Combo Loja Enterprise'],
};

const DESCONTO_MESMO_NIVEL = [0.15, 0.15, 0.2];
const DESCONTO_NIVEIS_DIFERENTES = 0.15;

/** Arredonda para baixo até um valor terminado em 97 (ex.: 4.494,60 → 4.397). */
export function terminadoEm97(v: number): number {
  return Math.floor((v - 97) / 100) * 100 + 97;
}

function produtoENivel(nome: string): { produto: Produto; nivel: number } | null {
  for (const produto of Object.keys(NIVEIS) as Produto[]) {
    const nivel = NIVEIS[produto].indexOf(nome);
    if (nivel >= 0) return { produto, nivel };
  }
  return null;
}

export type AjusteAutomatico = {
  items: ServiceOrderItem[];
  /** Combo montado, para o aviso na tela. */
  combo: { nome: string; separados: number; valor: number } | null;
  /** Mensalidades retiradas por haver uma mais cara. */
  mensalidadesRemovidas: string[];
};

/** Aplica combo e mensalidade única. Devolve null quando não há nada a mudar. */
export function ajustarCombosEMensalidades(
  itens: ServiceOrderItem[],
  catalogo: InternalService[]
): AjusteAutomatico | null {
  let items = itens;
  let combo: AjusteAutomatico['combo'] = null;

  // Só itens escolhidos do catálogo e sem valor zerado entram no combo: um
  // avulso com o mesmo nome pode ter escopo diferente.
  const doCatalogo = (i: ServiceOrderItem) =>
    i.internalServiceId && i.billingType === 'unico'
      ? produtoENivel(catalogo.find((s) => s.id === i.internalServiceId)?.name ?? '')
      : null;

  const iPrincipal = items.findIndex((i) => {
    const p = doCatalogo(i);
    return p && p.produto !== 'erp';
  });
  const iGestao = items.findIndex((i) => doCatalogo(i)?.produto === 'erp');

  if (iPrincipal >= 0 && iGestao >= 0) {
    const a = items[iPrincipal];
    const b = items[iGestao];
    const pa = doCatalogo(a)!;
    const pb = doCatalogo(b)!;
    const produto = pa.produto as 'site' | 'loja';
    const separados = a.amount + b.amount;
    const mesmoNivel = pa.nivel === pb.nivel;
    const pct = mesmoNivel ? DESCONTO_MESMO_NIVEL[pa.nivel] : DESCONTO_NIVEIS_DIFERENTES;
    const valor = terminadoEm97(separados * (1 - pct));

    const doCatalogoCombo = mesmoNivel
      ? catalogo.find((s) => s.active && s.name.startsWith(`${COMBOS[produto][pa.nivel]} (`))
      : undefined;

    const integracao =
      produto === 'loja'
        ? 'integrados: cada pedido da loja vira venda no sistema, baixa o estoque e lança o valor no financeiro. Mesmo login, botão Site ⇄ Gestão só para administradores.'
        : 'integrados no mesmo site e no mesmo login; só administradores veem o botão Site ⇄ Gestão.';
    const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const linha: ServiceOrderItem = doCatalogoCombo
      ? {
          internalServiceId: doCatalogoCombo.id,
          name: doCatalogoCombo.name,
          description: doCatalogoCombo.description,
          amount: valor,
          billingType: 'unico',
          leadTimeDays: doCatalogoCombo.leadTimeDays,
        }
      : {
          internalServiceId: null,
          name: `Combo ${a.name} + ${b.name}`,
          description: `${a.name} + ${b.name} ${integracao} Desconto de combo já aplicado (separados: ${reais(separados)}). Domínio .com.br grátis no 1º ano.`,
          amount: valor,
          billingType: 'unico',
          leadTimeDays: a.leadTimeDays + b.leadTimeDays,
        };

    const primeiro = Math.min(iPrincipal, iGestao);
    const segundo = Math.max(iPrincipal, iGestao);
    items = items.flatMap((it, i) => (i === primeiro ? [linha] : i === segundo ? [] : [it]));
    combo = { nome: linha.name, separados, valor };
  }

  // Marca: logo + identidade a partir do logo = identidade completa.
  const nomeDoCatalogo = (i: ServiceOrderItem) =>
    i.internalServiceId ? catalogo.find((s) => s.id === i.internalServiceId)?.name : undefined;
  const iLogo = items.findIndex((i) => nomeDoCatalogo(i) === 'Logo Essencial');
  const iIdentidade = items.findIndex((i) => nomeDoCatalogo(i) === 'Identidade a partir do Logo');
  const completa = catalogo.find((s) => s.active && s.name === 'Identidade Visual Completa');
  if (iLogo >= 0 && iIdentidade >= 0 && completa) {
    const separados = items[iLogo].amount + items[iIdentidade].amount;
    const linha: ServiceOrderItem = {
      internalServiceId: completa.id,
      name: completa.name,
      description: completa.description,
      amount: completa.price,
      billingType: 'unico',
      leadTimeDays: completa.leadTimeDays,
    };
    const primeiro = Math.min(iLogo, iIdentidade);
    const segundo = Math.max(iLogo, iIdentidade);
    items = items.flatMap((it, i) => (i === primeiro ? [linha] : i === segundo ? [] : [it]));
    // Só a marca virou combo: mostra ela no aviso. Se site + gestão também
    // viraram, o aviso fica com o maior desconto, que é o deles.
    combo ??= { nome: linha.name, separados, valor: linha.amount };
  }

  // Mensalidade única: fica a mais cara, na posição da primeira.
  const mensais = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.billingType === 'mensal' && it.name.trim());
  let mensalidadesRemovidas: string[] = [];
  if (mensais.length > 1) {
    const maisCara = mensais.reduce((m, x) => (x.it.amount > m.it.amount ? x : m));
    const removidas = new Set(mensais.filter((x) => x !== maisCara).map((x) => x.i));
    mensalidadesRemovidas = mensais.filter((x) => x !== maisCara).map((x) => x.it.name);
    const posicao = mensais[0].i;
    items = items.flatMap((it, i) =>
      i === posicao ? [maisCara.it] : removidas.has(i) || i === maisCara.i ? [] : [it]
    );
  }

  if (!combo && mensalidadesRemovidas.length === 0) return null;
  return { items, combo, mensalidadesRemovidas };
}
