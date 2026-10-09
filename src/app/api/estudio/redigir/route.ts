import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAdmin } from '@/lib/auth';
import { modeloPorCodigo } from '@/lib/estudio/modelos';
import {
  VOZ,
  ferramentaDoModelo,
  instrucaoDoModelo,
  modeloEscolheOProduto,
  peneirar,
  produtoEscolhido,
  type ProdutoParaEscolha,
} from '@/lib/estudio/redacao';
import { listarProdutosDoEstudio } from '@/lib/estudio/catalogo';
import { precoDaArte, precoVigente, type ProdutoDoEstudio } from '@/lib/estudio/produto';

/** O produto reduzido ao que distingue uma máquina da outra.
 *
 *  Mandar o cadastro inteiro de oitenta produtos encheria o pedido de campo
 *  que não ajuda a escolher — e o que não ajuda a escolher atrapalha. */
function paraEscolha(p: ProdutoDoEstudio): ProdutoParaEscolha {
  return {
    id: p.id,
    nome: p.name.slice(0, 120),
    ficha: [p.cpu, p.gpu, p.ram, p.storage].filter(Boolean).join(' · ').slice(0, 120),
    preco: precoDaArte(precoVigente(p)),
    estoque: p.stock ?? 0,
  };
}

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

  let corpo: { modelo?: string; assunto?: string; produtoEscolhido?: string };
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

  // O catálogo só é lido quando a peça deixa a escolha para a redação. Em peça
  // de venda a máquina é decisão comercial do dono, e mandar a lista junto
  // seria convidar a resposta a opinar sobre o que não é dela.
  const escolhe = modeloEscolheOProduto(modelo);
  const catalogo = escolhe ? await listarProdutosDoEstudio() : [];
  const idsValidos = new Set(catalogo.map((p) => p.id));

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const ferramenta = ferramentaDoModelo(modelo);
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      system: VOZ,
      tools: [ferramenta],
      // Obriga a resposta a vir pela ferramenta: o formato passa a ser contrato
      // da API em vez de pedido em prosa.
      tool_choice: { type: 'tool', name: ferramenta.name },
      messages: [
        {
          role: 'user',
          content: instrucaoDoModelo(modelo, assunto, {
            produtos: escolhe ? catalogo.map(paraEscolha) : undefined,
            produtoEscolhido: String(corpo.produtoEscolhido ?? '').trim().slice(0, 400) || null,
          }),
        },
      ],
    });

    const uso = resposta.content.find((bloco) => bloco.type === 'tool_use');
    const entrada = uso?.type === 'tool_use' ? uso.input : null;
    const campos = peneirar(entrada, modelo);
    const produtoId = escolhe ? produtoEscolhido(entrada, idsValidos) : null;

    if (Object.keys(campos).length === 0) {
      return NextResponse.json(
        { erro: 'A resposta veio vazia ou fora do formato. Tente descrever o assunto com mais detalhe.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ campos, produtoId });
  } catch (e) {
    // A mensagem da biblioteca pode trazer detalhe de conta e cobrança; o que
    // interessa na tela é que falhou e que dá para tentar de novo.
    console.error('[estudio/redigir]', e);
    return NextResponse.json({ erro: 'Não consegui redigir agora. Tente de novo.' }, { status: 502 });
  }
}
