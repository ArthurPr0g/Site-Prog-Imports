// Dados da pré-proposta em PDF a partir da escolha do pacote: o mesmo cálculo da
// Lia (calcularProposta) e o "o que inclui" do guia dos pacotes. Usado pelo
// simulador do vendedor (V6) e pela Lia, que manda o PDF no WhatsApp (modo rápido).

import { calcularProposta, type Proposta } from '@/lib/atendente/regras';
import type { Moeda, TabelaPrecos } from '@/lib/precos-captacao';
import { idiomaDaMoeda, dinheiroDoPais, INCLUI_EN } from '@/lib/idioma-do-lead';
import { parcela, NOMES, type Escolha } from '@/lib/simulador';
import { GUIA_DO_PRODUTO, GUIA_DA_MARCA } from '@/lib/guia-dos-pacotes';
import type { DadosDaPreProposta } from '@/lib/pdf/pre-proposta';

export function montarPreProposta(
  e: Escolha,
  tabela: TabelaPrecos,
  prazos: Map<string, number>,
  o: { cliente: string | null; vendedor: string; descontoExtraPct?: number }
): { dados: DadosDaPreProposta; proposta: Proposta; nomeDoArquivo: string } | null {
  const moeda: Moeda = tabela.moeda;
  const r = calcularProposta(e, tabela, o.descontoExtraPct ?? 0, prazos);
  if (r.total <= 0) return null;
  // Lead dos EUA: tudo em inglês e no padrão americano ($1,790), com o "o que inclui" oficial do portfólio.
  const idioma = idiomaDaMoeda(moeda);
  const en = idioma === 'en';
  const m = (v: number) => dinheiroDoPais(v, moeda);
  const total = r.totalComExtra;
  // O que cada item inclui, na mesma ordem das linhas (projeto, gestão no combo, marca).
  const combo = e.comGestao && e.produto !== 'erp';
  const inclui: string[][] = en
    ? [INCLUI_EN[e.produto][e.nivel], ...(combo ? [INCLUI_EN.erp[e.nivelGestao]] : []), ...(e.marca ? [INCLUI_EN.marca[e.marca - 1]] : [])]
    : [
        GUIA_DO_PRODUTO[e.produto].niveis[e.nivel].inclui,
        ...(combo ? [GUIA_DO_PRODUTO.erp.niveis[e.nivelGestao].inclui] : []),
        ...(e.marca ? [GUIA_DA_MARCA[e.marca - 1].inclui] : []),
      ];
  const dados: DadosDaPreProposta = {
    cliente: o.cliente,
    vendedor: o.vendedor,
    emitidaEm: new Date(),
    validadeDias: 7,
    idioma,
    itens: r.linhas.map((l, i) => ({ nome: l.nome, valor: m(l.valor), inclui: inclui[i] ?? [] })),
    desconto: r.desconto > 0 ? m(r.desconto) : null,
    condicaoEspecial: r.descontoExtraPct > 0 ? m(r.total - total) : null,
    total: m(total),
    aPartirDe: r.aPartirDe,
    mensal: m(r.mensal),
    economiaMensal: r.mensalSeparadas
      ? en
        ? `You save ${m(r.mensalSeparadas - r.mensal)}/month by bundling (separately: ${m(r.mensalSeparadas)}/month).`
        : `Economia de ${m(r.mensalSeparadas - r.mensal)}/mês por contratar junto (separados: ${m(r.mensalSeparadas)}/mês).`
      : null,
    prazoDias: r.prazoDias,
    pagamento:
      en
        ? [`50% to start: ${m(total / 2)}`, `50% on delivery, after your approval: ${m(total / 2)}`]
        : [
            `Pix ou boleto: ${m(total / 2)} no fechamento + ${m(total / 2)} na entrega`,
            `Cartão 2x sem juros: 2x de ${m(total / 2)}`,
            `Cartão em 12x: 12x de ${m(parcela(total, 12))} (com a taxa da operadora)`,
          ],
  };
  const nomeDoArquivo = en
    ? `Proposal Prog Soluções${o.cliente ? ` - ${o.cliente}` : ''} - ${NOMES.USD[e.produto][e.nivel]}`
    : `Pré-proposta Prog Soluções${o.cliente ? ` - ${o.cliente}` : ''} - ${NOMES.BRL[e.produto][e.nivel]}`;
  return { dados, proposta: r, nomeDoArquivo };
}
