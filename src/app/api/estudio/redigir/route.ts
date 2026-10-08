import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAdmin } from '@/lib/auth';
import { modeloPorCodigo } from '@/lib/estudio/modelos';
import { VOZ, instrucaoDoModelo, lerJson, peneirar } from '@/lib/estudio/redacao';

// Escreve os campos de uma peça a partir de um assunto.
//
// Roda no servidor pela mesma razão do assistente de compras: a chave da
// Anthropic não pode chegar ao navegador. A diferença é quem pode chamar —
// aqui é só o dono, porque isto gasta tokens e não tem nada a ver com o
// visitante da loja.

// O mesmo modelo que o assistente de compras usa. Vale a consistência: é o que
// já se sabe funcionar com esta chave, e trocar aqui sem trocar lá deixaria o
// projeto dependendo de dois acessos diferentes sem motivo.
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

  let corpo: { modelo?: string; assunto?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const modelo = modeloPorCodigo(String(corpo.modelo ?? ''));
  if (!modelo) return NextResponse.json({ erro: 'Modelo desconhecido.' }, { status: 400 });

  const assunto = String(corpo.assunto ?? '').trim().slice(0, MAX_ASSUNTO);
  if (assunto.length < 3) {
    return NextResponse.json({ erro: 'Escreva o assunto da peça.' }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      system: VOZ,
      messages: [
        { role: 'user', content: instrucaoDoModelo(modelo, assunto) },
        // A resposta já começa com a chave aberta: é o jeito mais barato de
        // impedir o "Claro! Aqui está:" que estragaria o JSON.
        { role: 'assistant', content: '{' },
      ],
    });

    const texto = resposta.content
      .map((bloco) => (bloco.type === 'text' ? bloco.text : ''))
      .join('');
    const campos = peneirar(lerJson('{' + texto), modelo);

    if (Object.keys(campos).length === 0) {
      return NextResponse.json(
        { erro: 'A resposta veio vazia ou fora do formato. Tente descrever o assunto com mais detalhe.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ campos });
  } catch (e) {
    // A mensagem da biblioteca pode trazer detalhe de conta e cobrança; o que
    // interessa na tela é que falhou e que dá para tentar de novo.
    console.error('[estudio/redigir]', e);
    return NextResponse.json({ erro: 'Não consegui redigir agora. Tente de novo.' }, { status: 502 });
  }
}
