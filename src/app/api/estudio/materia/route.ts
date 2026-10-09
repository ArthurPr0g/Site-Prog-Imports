import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { imagensDaMateria } from '@/lib/estudio/materia';

// As imagens da matéria de uma notícia da pauta.
//
// Recebe o id da notícia, e não o endereço dela. O endereço sai do banco: uma
// rota que busca qualquer URL que o navegador mande é uma rota que alcança o que
// não devia, em nome do servidor. Aqui o navegador só aponta para uma linha
// que já existe.

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const dono = await requireAdmin();
  if (!dono) return NextResponse.json({ erro: 'Só o gerenciamento usa o Estúdio.' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('noticia')?.trim() ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'Notícia inválida.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: noticia } = await supabase
    .from('studio_topics')
    .select('url, fonte')
    .eq('id', id)
    .maybeSingle();

  if (!noticia) return NextResponse.json({ erro: 'Essa notícia não está mais na pauta.' }, { status: 404 });

  const { lista, erro } = await imagensDaMateria(noticia.url);
  // Falha e lista vazia voltam diferentes: "o site bloqueou" e "a matéria não
  // tem imagem" pedem mensagens diferentes na tela.
  if (erro) return NextResponse.json({ erro, imagens: [], fonte: noticia.fonte }, { status: 502 });
  return NextResponse.json({ imagens: lista, fonte: noticia.fonte });
}
