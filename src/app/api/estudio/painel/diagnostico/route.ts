import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { credenciais } from '@/lib/instagram/api';
import { comentariosDe, estadoDoToken, faltaPermissao, midias, perfil } from '@/lib/instagram/leitura';

// O que o token consegue ler, em números — nunca o token.
//
// Serve à tela do painel para saber o que mostrar e o que pedir para liberar, e
// serve para conferir a integração sem abrir o Graph API Explorer.

export const maxDuration = 30;

export async function GET() {
  const dono = await requireAdmin();
  if (!dono) return NextResponse.json({ erro: 'Só o gerenciamento usa o Estúdio.' }, { status: 403 });

  const c = credenciais();
  if (!c) return NextResponse.json({ configurado: false });

  const token = await estadoDoToken();
  const saida: Record<string, unknown> = {
    configurado: true,
    tokenValido: token?.valido ?? false,
    permissoes: token?.permissoes ?? [],
    diasParaVencer: token?.expiraEm ? Math.floor((token.expiraEm * 1000 - Date.now()) / 86400000) : null,
  };

  try {
    const p = await perfil(c);
    saida.perfil = { usuario: p.usuario, seguidores: p.seguidores, posts: p.posts };
  } catch (e) {
    saida.perfil = { erro: e instanceof Error ? e.message : 'falhou' };
  }

  try {
    const lista = await midias(c, 100, (token?.permissoes ?? []).includes('instagram_manage_insights'));
    saida.midias = {
      total: lista.length,
      maisAntiga: lista.at(-1)?.quando ?? null,
      maisRecente: lista[0]?.quando ?? null,
      comMetricas: lista.some((m) => m.alcance !== undefined),
      formatos: lista.reduce<Record<string, number>>((acc, m) => {
        const chave = m.produto === 'REELS' ? 'REELS' : m.tipo;
        acc[chave] = (acc[chave] ?? 0) + 1;
        return acc;
      }, {}),
      comentariosTotais: lista.reduce((s, m) => s + m.comentarios, 0),
    };

    const comComentario = lista.find((m) => m.comentarios > 0);
    if (comComentario) {
      try {
        const ks = await comentariosDe(c, comComentario.id, 10);
        saida.comentarios = { podeLer: true, amostra: ks.length };
      } catch (e) {
        saida.comentarios = { podeLer: false, faltaPermissao: faltaPermissao(e), mensagem: e instanceof Error ? e.message.slice(0, 160) : '' };
      }
    } else {
      saida.comentarios = { podeLer: null, motivo: 'nenhum post com comentário' };
    }
  } catch (e) {
    saida.midias = { erro: e instanceof Error ? e.message : 'falhou' };
  }

  return NextResponse.json(saida);
}
