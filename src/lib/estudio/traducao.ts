// Traduzir a pauta.
//
// As cinco fontes publicam em inglês. Ler manchete em inglês para decidir o
// que vira post em português é um pedágio em cada linha — e o pedágio
// desestimula ler, o que é o único jeito desta tela falhar.
//
// Uma chamada só para a lista inteira, e não uma por notícia: vinte chamadas
// para vinte manchetes custariam vinte vezes mais e demorariam vinte vezes
// mais, para um trabalho que o modelo faz de uma vez.
//
// Só no servidor.

import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-sonnet-5';
/** Teto por chamada. Vinte manchetes com resumo cabem folgado; o limite
 *  existe para uma fonte que resolva publicar cem itens de uma vez não virar
 *  uma chamada gigante. */
const MAX_ITENS = 40;
const MAX_TOKENS = 8000;

export type ParaTraduzir = { id: string; titulo: string; resumo: string };
export type Traduzido = { id: string; titulo_pt: string; resumo_pt: string };

const INSTRUCAO = `Você traduz manchetes e resumos de notícias de tecnologia para o português do Brasil.

REGRAS
- Traduza como um editor brasileiro de tecnologia escreveria, não ao pé da letra. "Apple is set to launch" vira "A Apple vai lançar", não "A Apple está definida para lançar".
- Nomes de produto, empresa e modelo ficam como estão: MacBook Pro, RTX 5090, Core Ultra 9, Galaxy Book. Não traduza nem aportuguese.
- Termos técnicos consagrados em inglês ficam em inglês: chip, display, gaming, benchmark.
- Preços em dólar ficam em dólar, com o símbolo: US$ 1.299. Não converta para real — a cotação muda e a notícia não é sobre isso.
- Mantenha o tom de notícia. Não adicione opinião, não resuma mais do que já está resumido, não corte informação.
- O resumo às vezes vem cortado no meio de uma frase, porque é o começo da matéria. Traduza do jeito que está, cortado. Não complete o que falta.
- Devolva exatamente um item para cada id recebido, com o mesmo id.`;

const FERRAMENTA = {
  name: 'devolver_traducao',
  description: 'Devolve cada notícia traduzida para o português do Brasil.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itens: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const, description: 'O mesmo id que veio.' },
            titulo: { type: 'string' as const, description: 'A manchete em português.' },
            resumo: { type: 'string' as const, description: 'O resumo em português.' },
          },
          required: ['id', 'titulo', 'resumo'],
        },
      },
    },
    required: ['itens'],
  },
};

/** Traduz o lote. Devolve lista vazia quando não dá — nunca lança.
 *
 *  Não lança de propósito: a tradução é um conforto sobre a pauta, e a pauta
 *  funciona sem ela. Deixar a falta de chave ou um erro da API derrubar a
 *  atualização inteira trocaria um incômodo por um defeito. */
export async function traduzirAssuntos(itens: ParaTraduzir[]): Promise<Traduzido[]> {
  if (itens.length === 0 || !process.env.ANTHROPIC_API_KEY) return [];

  const lote = itens.slice(0, MAX_ITENS);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      system: INSTRUCAO,
      tools: [FERRAMENTA],
      tool_choice: { type: 'tool', name: FERRAMENTA.name },
      messages: [
        {
          role: 'user',
          content: `Traduza estas ${lote.length} notícias:\n\n${JSON.stringify(
            lote.map((i) => ({ id: i.id, titulo: i.titulo, resumo: i.resumo })),
            null,
            1
          )}`,
        },
      ],
    });

    const uso = resposta.content.find((b) => b.type === 'tool_use');
    if (uso?.type !== 'tool_use') return [];

    const bruto = (uso.input as { itens?: unknown }).itens;
    if (!Array.isArray(bruto)) return [];

    // Peneira pelos ids que realmente foram enviados: o esquema garante o
    // formato, não o conteúdo, e um id inventado viraria update em nada — ou,
    // pior, em outra linha.
    const esperados = new Map(lote.map((i) => [i.id, i]));
    const saida: Traduzido[] = [];

    for (const item of bruto) {
      if (!item || typeof item !== 'object') continue;
      const { id, titulo, resumo } = item as Record<string, unknown>;
      if (typeof id !== 'string' || !esperados.has(id)) continue;
      if (typeof titulo !== 'string' || !titulo.trim()) continue;
      saida.push({
        id,
        titulo_pt: titulo.trim().slice(0, 300),
        resumo_pt: typeof resumo === 'string' ? resumo.trim().slice(0, 400) : '',
      });
    }

    return saida;
  } catch (e) {
    console.error('[estudio/traducao]', e);
    return [];
  }
}
