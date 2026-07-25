import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_OPTIONS } from '@/lib/constants';

// Assistente de compras: ajuda o visitante a escolher um produto com base no
// catálogo real da loja. Roda no servidor pra não expor a chave da Anthropic,
// e usa tool calling (buscar_produtos) pra nunca "alucinar" produto ou preço —
// toda recomendação precisa vir de uma consulta real ao Supabase.

const MODEL = 'claude-sonnet-5';
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 3;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `Você é o assistente de compras da Prog Imports, uma loja de tecnologia importada dos Estados Unidos (MacBooks, iPhones, iPads, notebooks gamer e de trabalho, monitores, periféricos). Seu trabalho é ajudar o cliente a escolher o produto mais adequado com base no catálogo real da loja.

Regras importantes:
- NUNCA invente produtos, preços, especificações ou disponibilidade. Sempre use a ferramenta buscar_produtos para consultar o catálogo real antes de recomendar qualquer coisa.
- Se a busca não retornar nada adequado, diga isso com honestidade e sugira ajustar os critérios (categoria, orçamento, uso).
- Se faltar informação essencial para recomendar bem (orçamento, uso principal: jogos/trabalho/estudo/edição, tamanho de tela, etc.), pergunte antes de buscar.
- Ao recomendar, cite o nome exato e o preço retornados pela ferramenta, e explique brevemente por que aquele produto se encaixa no pedido.
- Seja direto, use português do Brasil, e responda em texto simples (sem markdown pesado como títulos ou tabelas) — poucas frases por parágrafo.
- Você não processa pedidos nem pagamentos; se o cliente quiser comprar, oriente a clicar no produto ou usar o carrinho no site.`;

const tools: Anthropic.Tool[] = [
  {
    name: 'buscar_produtos',
    description:
      'Busca produtos reais e ativos no catálogo da Prog Imports, com filtros opcionais de categoria, preço e palavras-chave. Use sempre antes de recomendar um produto — nunca invente.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: [...CATEGORY_OPTIONS],
          description: 'Categoria do produto',
        },
        palavras_chave: {
          type: 'string',
          description: 'Termos livres para buscar no nome do produto (ex: "gamer", "leve", "M3", "128GB")',
        },
        preco_maximo: { type: 'number', description: 'Preço máximo em reais' },
        preco_minimo: { type: 'number', description: 'Preço mínimo em reais' },
      },
    },
  },
];

type SearchProductsInput = {
  categoria?: string;
  palavras_chave?: string;
  preco_maximo?: number;
  preco_minimo?: number;
};

async function searchProducts(input: SearchProductsInput) {
  const supabase = await createClient();
  let query = supabase
    .from('products')
    .select('sku, name, price, promo_price, stock, categories(name), brands(name)')
    .eq('active', true)
    .order('position')
    .limit(8);

  if (input.categoria) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('name', input.categoria)
      .maybeSingle();
    if (category) query = query.eq('category_id', category.id);
  }
  if (input.palavras_chave?.trim()) {
    query = query.ilike('name', `%${input.palavras_chave.trim()}%`);
  }
  if (typeof input.preco_maximo === 'number' && Number.isFinite(input.preco_maximo)) {
    query = query.lte('price', input.preco_maximo);
  }
  if (typeof input.preco_minimo === 'number' && Number.isFinite(input.preco_minimo)) {
    query = query.gte('price', input.preco_minimo);
  }

  const { data } = await query;
  return (data ?? []).map((p) => ({
    sku: p.sku,
    nome: p.name,
    preco: Number(p.promo_price ?? p.price),
    preco_original: p.promo_price ? Number(p.price) : null,
    em_estoque: p.stock > 0,
    categoria: p.categories?.name ?? '',
    marca: p.brands?.name ?? '',
    url: `/produto/${p.sku}`,
  }));
}

function getClientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Assistente indisponível no momento.' }, { status: 503 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const history = incoming
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Envie uma mensagem.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: allowed, error: rateLimitError } = await supabase.rpc('check_assistant_rate_limit', {
    p_key: getClientKey(req),
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_limit: RATE_LIMIT_MAX_MESSAGES,
  });

  if (rateLimitError) {
    return NextResponse.json({ error: 'Não foi possível processar sua mensagem agora.' }, { status: 500 });
  }
  if (!allowed) {
    return NextResponse.json(
      { error: 'Você atingiu o limite de mensagens por hora. Tente novamente daqui a pouco.' },
      { status: 429 }
    );
  }

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  try {
    let finalText = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break;

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        if (toolUse.name === 'buscar_produtos') {
          const results = await searchProducts(toolUse.input as SearchProductsInput);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(
              results.length ? results : { aviso: 'Nenhum produto encontrado com esses filtros.' }
            ),
          });
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: 'Ferramenta desconhecida.',
            is_error: true,
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }

    if (!finalText) {
      finalText = 'Desculpe, não consegui gerar uma resposta agora. Pode tentar reformular sua pergunta?';
    }

    return NextResponse.json({ reply: finalText });
  } catch (err) {
    console.error('assistant error', err);
    return NextResponse.json({ error: 'Não foi possível processar sua mensagem agora.' }, { status: 500 });
  }
}
