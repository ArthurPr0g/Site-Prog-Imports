import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { buscarIlustracoes } from '@/lib/estudio/ilustracao';

// Ilustração de fora: buscar e adotar.
//
// Duas operações na mesma rota porque são dois tempos do mesmo gesto. `GET`
// procura; `POST` adota a escolhida.
//
// Adotar é copiar para o nosso storage, e não guardar o link. Três motivos,
// todos descobertos antes de doer:
//
// O canvas carrega as imagens com `crossOrigin`, e servidor que não manda o
// cabeçalho de CORS faz a imagem simplesmente não aparecer — falha silenciosa,
// do tipo que só se descobre com a peça pronta.
//
// Link de terceiro sai do ar. Se a foto some depois de a peça estar salva, a
// peça antiga passa a desenhar sem fundo, e ninguém vai saber por quê.
//
// E publicar apontando para o servidor dos outros é consumir banda alheia
// sem pedir. Copiar uma vez é mais honesto que servir mil vezes da casa deles.

const MAX_BYTES = 12 * 1024 * 1024;
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKET = 'studio-art';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const dono = await requireAdmin();
  if (!dono) return NextResponse.json({ erro: 'Só o gerenciamento usa o Estúdio.' }, { status: 403 });

  const termo = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (termo.length < 2) return NextResponse.json({ erro: 'Escreva o que procurar.' }, { status: 400 });

  const achadas = await buscarIlustracoes(termo);
  return NextResponse.json({ ilustracoes: achadas });
}

export async function POST(req: NextRequest) {
  const dono = await requireAdmin();
  if (!dono) return NextResponse.json({ erro: 'Só o gerenciamento usa o Estúdio.' }, { status: 403 });

  let corpo: { url?: string; credito?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const origem = String(corpo.url ?? '').trim();
  // Só https, e só o que o próprio acervo serve. A URL chega do navegador, e
  // aceitar qualquer endereço aqui transformaria esta rota num buscador que
  // alcança a rede interna em nome do servidor.
  let endereco: URL;
  try {
    endereco = new URL(origem);
  } catch {
    return NextResponse.json({ erro: 'Endereço inválido.' }, { status: 400 });
  }
  if (endereco.protocol !== 'https:') {
    return NextResponse.json({ erro: 'Só aceito endereço https.' }, { status: 400 });
  }

  try {
    const baixada = await fetch(endereco.toString(), {
      headers: { accept: 'image/*' },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    if (!baixada.ok) {
      return NextResponse.json({ erro: 'A imagem não respondeu. Escolha outra.' }, { status: 502 });
    }

    const tipo = (baixada.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!TIPOS.has(tipo)) {
      return NextResponse.json({ erro: `O acervo devolveu ${tipo || 'um tipo desconhecido'}. Escolha outra.` }, { status: 415 });
    }

    const bytes = await baixada.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ erro: 'A imagem passa de 12MB. Escolha outra.' }, { status: 413 });
    }

    const extensao = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
    const caminho = `web/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;

    const supabase = await createClient();
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, bytes, {
      contentType: tipo,
      upsert: false,
    });
    if (error) return NextResponse.json({ erro: 'Não consegui guardar a imagem.' }, { status: 500 });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
    return NextResponse.json({ url: data.publicUrl, credito: String(corpo.credito ?? '').slice(0, 300) });
  } catch {
    return NextResponse.json({ erro: 'Não consegui baixar a imagem. Escolha outra.' }, { status: 502 });
  }
}
