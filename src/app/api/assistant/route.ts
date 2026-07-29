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
// Menos resultados que antes (era 8) porque agora cada um carrega um trecho da
// descrição; e mais tokens de saída porque o formato de card ocupa ~8 linhas
// por produto — com 1024 a segunda sugestão vinha cortada no meio.
const MAX_SEARCH_RESULTS = 6;
const MAX_DESCRIPTION_CHARS = 900;
const MAX_OUTPUT_TOKENS = 2048;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `Você é o assistente de compras da Prog Imports, uma loja de tecnologia importada dos Estados Unidos (MacBooks, iPhones, iPads, notebooks gamer e de trabalho, monitores, periféricos). Seu trabalho é ajudar o cliente a escolher o produto mais adequado com base no catálogo real da loja.

Regras importantes:
- NUNCA invente produtos, preços, especificações ou disponibilidade. Sempre use a ferramenta buscar_produtos para consultar o catálogo real antes de recomendar qualquer coisa.
- Se a busca não retornar nada adequado, diga isso com honestidade e sugira ajustar os critérios (categoria, orçamento, uso).
- Se faltar informação essencial para recomendar bem (orçamento, uso principal: jogos/trabalho/estudo/edição, tamanho de tela, etc.), pergunte antes de buscar.
- Use português do Brasil e seja direto.
- NUNCA use markdown: nada de **negrito**, # títulos, tabelas, ou listas com "-" ou "*". A interface não renderiza markdown e esses símbolos apareceriam literalmente na tela. A formatação abaixo é a única permitida.
- Você não processa pedidos nem pagamentos; se o cliente quiser comprar, oriente a clicar no link do produto.

FORMATO DA RECOMENDAÇÃO
Ao recomendar um produto, use exatamente este molde, uma informação por linha:

💻 [nome do produto]
📌 Configuração: [configuração técnica]
✨ Estado: [estado]
💰 Valor: R$ [preço]

Destaques:
✔️ [benefício]
✔️ [benefício]

[url do produto]

Regras do molde:
- Escolha o emoji da primeira linha conforme a categoria: 💻 notebooks, 📱 celulares, 📲 tablets, 🖥️ monitores, ⌨️ periféricos.
- "Configuração": use o campo configuracao quando vier preenchido; quando vier null, extraia a configuração de dentro do nome do produto. Se o nome também não trouxer, omita a linha inteira — nunca preencha de memória.
- "Estado": use exatamente o valor do campo estado.
- "Valor": formate em reais no padrão brasileiro, com ponto de milhar e duas casas (ex: R$ 3.999,00). Se houver preco_original, escreva "R$ 3.999,00 (de R$ 4.499,00)".
- "Destaques": de 3 a 5 linhas, cada uma começando com "✔️ ". Extraia os benefícios do campo texto_do_anuncio daquele produto — ele já vem escrito com marcadores "✔️". Reescreva curto se precisar, mas NUNCA invente um benefício que não esteja lá. Se texto_do_anuncio vier null, omita a seção Destaques.
- Termine o bloco com o campo url em uma linha só (ex: /produto/ABC-123), sem texto em volta — a interface transforma isso em link clicável.
- Se o produto estiver fora de estoque, acrescente uma linha "⚠️ Sem estoque no momento" antes dos Destaques.

MAIS DE UMA SUGESTÃO
Separe cada produto com uma linha contendo apenas três hífens:

---

A interface desenha isso como um separador visual. Não numere os produtos.

Fora dos blocos de produto (saudação, perguntas, fechamento) escreva em parágrafos normais, sem emoji de categoria e sem separador.`;

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

// A configuração técnica vive em colunas estruturadas em apenas 2 dos 21
// produtos ativos — no resto ela está embutida no próprio nome. Quando as
// colunas estão vazias devolvemos null e o modelo extrai do nome, que é dado
// real do catálogo (nunca invenção).
function buildConfiguracao(p: {
  cpu: string | null;
  ram: string | null;
  storage: string | null;
  gpu: string | null;
}): string | null {
  const partes = [p.cpu, p.gpu, p.ram, p.storage].map((v) => v?.trim()).filter(Boolean);
  return partes.length ? partes.join(' + ') : null;
}

// O campo "Estado" do admin (coluna condition) é a fonte da verdade, por
// decisão do dono do catálogo — é o campo que ele preenche de propósito.
// O nome do produto só entra como fallback quando a coluna está vazia,
// porque hoje 10 dos 21 produtos ainda repetem o estado dentro do nome.
function resolveEstado(baseName: string, condition: string | null): string {
  const doCampo = condition?.trim();
  if (doCampo) return doCampo;

  const nome = baseName.toLowerCase();
  if (nome.includes('seminovo')) return 'Seminovo';
  if (nome.includes('open box')) return 'Open Box';
  return 'Novo';
}

// O molde do card tem linha própria para o estado, então o nome não precisa
// repeti-lo. Tirar o sufixo evita o card sair com o nome dizendo "- Seminovo"
// e a linha de Estado dizendo outra coisa (hoje 10 produtos têm essa
// divergência entre o nome e o campo Estado do admin).
function stripEstadoDoNome(nome: string): string {
  return nome.replace(/\s*[-–]\s*(seminovo|open\s*box|novo)\s*$/i, '').trim();
}

async function searchProducts(input: SearchProductsInput) {
  const supabase = await createClient();
  let query = supabase
    .from('products')
    .select(
      'sku, name, base_name, description, condition, cpu, ram, storage, gpu, screen_type, color, price, promo_price, stock, categories(name), brands(name)'
    )
    .eq('active', true)
    .order('position')
    .limit(MAX_SEARCH_RESULTS);

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
    nome: stripEstadoDoNome(p.base_name?.trim() || p.name),
    nome_completo: p.name,
    configuracao: buildConfiguracao(p),
    estado: resolveEstado(p.base_name || p.name, p.condition),
    tela: p.screen_type?.trim() || null,
    cor: p.color?.trim() || null,
    preco: Number(p.promo_price ?? p.price),
    preco_original: p.promo_price ? Number(p.price) : null,
    em_estoque: p.stock > 0,
    categoria: p.categories?.name ?? '',
    marca: p.brands?.name ?? '',
    // Fonte dos destaques: as descrições do catálogo já são escritas com
    // bullets "✔️ ...", então o modelo copia de um texto real em vez de
    // inventar benefícios. Truncado para não estourar o contexto (média 2450
    // caracteres por produto).
    texto_do_anuncio: p.description
      ? p.description.replace(/\s+/g, ' ').slice(0, MAX_DESCRIPTION_CHARS)
      : null,
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
        max_tokens: MAX_OUTPUT_TOKENS,
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
