import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAdmin } from '@/lib/auth';
import { modeloPorCodigo } from '@/lib/estudio/modelos';
import {
  VOZ_DA_LEGENDA,
  FERRAMENTA_DA_LEGENDA,
  instrucaoDaLegenda,
  montarLegenda,
} from '@/lib/estudio/redacao';

// Escreve a legenda do post.
//
// Rota separada da que escreve os campos da arte, e não um parâmetro nela: as
// duas têm voz oposta no ponto que mais importa. A arte proíbe hashtag e
// emoji porque o texto vai para um canvas; a legenda precisa de hashtag para
// ser encontrada. Um prompt só, com exceções, erraria nos dois sentidos.

const MODELO = 'claude-sonnet-5';
const MAX_TOKENS = 1024;
const MAX_ASSUNTO = 1200;

export async function POST(req: NextRequest) {
  const dono = await requireAdmin();
  if (!dono) return NextResponse.json({ erro: 'Só o gerenciamento usa o Estúdio.' }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { erro: 'A chave da Anthropic não está configurada neste ambiente.' },
      { status: 503 }
    );
  }

  let corpo: { modelo?: string; assunto?: string; conteudo?: unknown; produto?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const modelo = modeloPorCodigo(String(corpo.modelo ?? ''));
  if (!modelo) return NextResponse.json({ erro: 'Modelo desconhecido.' }, { status: 400 });

  // Só pares de string: o que chega daqui vai direto para o prompt, e objeto
  // aninhado viraria "[object Object]" descrito como dado conferido.
  const conteudo: Record<string, string> = {};
  if (corpo.conteudo && typeof corpo.conteudo === 'object') {
    for (const [chave, valor] of Object.entries(corpo.conteudo as Record<string, unknown>)) {
      if (typeof valor === 'string' && valor.trim()) conteudo[chave] = valor.trim().slice(0, 400);
    }
  }

  const assunto = String(corpo.assunto ?? '').trim().slice(0, MAX_ASSUNTO);
  // 600 e não 300: a descrição vem em linhas (nome, preço, ficha, condição),
  // e cortar no meio da ficha entregaria uma especificação pela metade — o
  // tipo de dado que vira legenda errada.
  const produto = String(corpo.produto ?? '').trim().slice(0, 600) || null;

  if (!assunto && Object.keys(conteudo).length === 0 && !produto) {
    return NextResponse.json(
      { erro: 'Preencha a peça, escolha um produto ou escreva um assunto antes de pedir a legenda.' },
      { status: 400 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      system: VOZ_DA_LEGENDA,
      tools: [FERRAMENTA_DA_LEGENDA],
      tool_choice: { type: 'tool', name: FERRAMENTA_DA_LEGENDA.name },
      messages: [
        { role: 'user', content: instrucaoDaLegenda(modelo, { assunto, conteudo, produto }) },
      ],
    });

    const uso = resposta.content.find((bloco) => bloco.type === 'tool_use');
    const legenda = montarLegenda(uso?.type === 'tool_use' ? uso.input : null);

    if (!legenda) {
      return NextResponse.json(
        { erro: 'A legenda veio vazia ou fora do formato. Tente descrever o assunto com mais detalhe.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ legenda });
  } catch (e) {
    console.error('[estudio/legenda]', e);
    return NextResponse.json({ erro: 'Não consegui escrever a legenda agora. Tente de novo.' }, { status: 502 });
  }
}
