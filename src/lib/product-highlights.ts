// Destaques do produto, derivados da descrição.
//
// As descrições do catálogo já são escritas com marcadores "✔️", no formato
// "✔️ Título curto: explicação longa". O título curto é exatamente o que serve
// como destaque ao lado do preço — só não estava sendo aproveitado.
//
// Derivar na leitura, em vez de gravar numa coluna, é uma decisão deliberada:
// gravado, editar a descrição deixaria os destaques velhos e ninguém perceberia.
// Derivado, os dois nunca saem de sincronia. O custo é um regex por produto
// exibido, irrelevante perto de uma consulta ao banco.

const BULLET = /✔️\s*([^✔️\n]{4,160})/g;
const MAX_DERIVED = 5;

// Algumas descrições foram coladas de fontes em HTML e carregam entidades
// (o iPhone 17 Pro tem "&amp;" no meio de um destaque). Sem decodificar, o
// visitante lê "&amp;" na tela.
const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

function decodificarEntidades(texto: string): string {
  return texto.replace(/&(amp|nbsp|quot|#39|lt|gt);/g, (m) => ENTIDADES[m] ?? m);
}

/** Extrai os destaques de uma descrição escrita com marcadores "✔️".
 *  Pega o trecho antes dos dois-pontos quando ele existe — é o título curto —
 *  e cai para a frase inteira quando não existe. */
export function deriveHighlights(description: string | null | undefined): string[] {
  if (!description) return [];

  const found: string[] = [];
  for (const match of description.replace(/\s+/g, ' ').matchAll(BULLET)) {
    const bruto = match[1].trim();
    // "Versatilidade 2 em 1: Com sua dobradiça..." -> "Versatilidade 2 em 1"
    const antesDoDoisPontos = bruto.split(':')[0].trim();
    // Só usa o corte se ele ainda for uma frase, e não uma palavra solta
    // perdida de um "16:9" ou "USB-C: 3.2" no meio do texto.
    const texto = antesDoDoisPontos.length >= 8 ? antesDoDoisPontos : bruto;
    const limpo = decodificarEntidades(texto).replace(/[.;,]+$/, '').trim();

    if (limpo.length >= 8 && !found.some((f) => f.toLowerCase() === limpo.toLowerCase())) {
      found.push(limpo);
    }
    if (found.length >= MAX_DERIVED) break;
  }
  return found;
}

/** Destaques a exibir: o que o admin curou tem prioridade; sem curadoria,
 *  derivamos da descrição. Assim um produto novo já nasce com destaques
 *  próprios, sem ninguém preencher nada, e quem quiser ajustar ainda pode. */
export function resolveHighlights(
  stored: string[] | null | undefined,
  description: string | null | undefined
): string[] {
  const curados = (stored ?? []).map((h) => h.trim()).filter(Boolean);
  return curados.length > 0 ? curados : deriveHighlights(description);
}
