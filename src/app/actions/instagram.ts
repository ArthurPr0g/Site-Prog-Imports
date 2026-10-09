'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import {
  credenciais,
  contasDisponiveis,
  cotaRestante,
  publicarCarrossel,
  publicarFoto,
  publicarStory,
  tokenLongo,
  ErroDoInstagram,
  type ContaEncontrada,
} from '@/lib/instagram/api';

const BUCKET = 'studio-art';
const MAX_BYTES = 8 * 1024 * 1024;

export type TipoDePublicacao = 'feed' | 'story' | 'carrossel';

async function admin() {
  const dono = await requireAdmin();
  if (!dono) return null;
  return createClient();
}

/* --------------------------------------------------------------- estado */

export type EstadoDoInstagram = {
  configurado: boolean;
  temApp: boolean;
  cota: number | null;
};

/** O que a tela precisa saber antes de mostrar o botão.
 *
 *  Nunca devolve valor de variável de ambiente, só a presença dela. Saber que
 *  o token existe é o que a tela precisa; o conteúdo não tem por que sair do
 *  servidor. */
export async function estadoDoInstagramAction(): Promise<EstadoDoInstagram> {
  const dono = await requireAdmin();
  const credencial = credenciais();
  if (!dono) return { configurado: false, temApp: false, cota: null };

  return {
    configurado: Boolean(credencial),
    temApp: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    cota: credencial ? await cotaRestante(credencial) : null,
  };
}

/* ---------------------------------------------------------- configuração */

export type ResultadoDaConfiguracao = ActionResult & {
  token?: string;
  expiraEm?: string;
  contas?: ContaEncontrada[];
};

/** Troca o token curto do Explorer por um de 60 dias e lista as contas.
 *
 *  O resultado volta para a tela e não é gravado em lugar nenhum: token de
 *  publicação é segredo de ambiente, e gravá-lo no banco só aumentaria o
 *  número de lugares de onde ele pode vazar. O dono copia e cola na Vercel. */
export async function configurarInstagramAction(
  tokenCurto: string
): Promise<ResultadoDaConfiguracao> {
  const dono = await requireAdmin();
  if (!dono) return errResult('Você não tem permissão para fazer isso.');

  const curto = tokenCurto.trim();
  if (curto.length < 20) return errResult('Cole o token gerado no Graph API Explorer.');

  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return errResult(
      'Faltam META_APP_ID e META_APP_SECRET no ambiente. Configure as duas na Vercel e publique de novo antes de trocar o token.'
    );
  }

  try {
    const { token, expiraEm } = await tokenLongo(curto, appId, appSecret);
    const contas = await contasDisponiveis(token);

    if (contas.length === 0) {
      return {
        ...errResult(
          'O token funcionou, mas nenhuma Página alcançada tem conta do Instagram conectada. Conecte o @progimports a uma Página no aplicativo do Instagram (Editar perfil → Página) e gere o token de novo.'
        ),
        token,
      };
    }

    const dias = expiraEm ? Math.round(expiraEm / 86400) : null;
    return {
      ...okResult(
        `Token trocado${dias ? ` — vale ${dias} dias` : ''}. ${contas.length} conta(s) encontrada(s).`
      ),
      token,
      expiraEm: dias ? `${dias} dias` : undefined,
      contas,
    };
  } catch (e) {
    return errResult(
      e instanceof ErroDoInstagram ? e.message : 'Não consegui falar com a API do Meta.'
    );
  }
}

/* ---------------------------------------------------------- publicação */

export type ResultadoDaPublicacao = ActionResult & { permalink?: string | null };

/** Publica a arte da peça no Instagram da loja.
 *
 *  Recebe FormData porque o que vem do navegador é arquivo: a arte é desenhada
 *  em canvas e exportada ali mesmo. Mandar como JSON em base64 engordaria o
 *  corpo em um terço sem ganho nenhum.
 *
 *  JPEG, e não PNG: a API de publicação do Instagram aceita só JPEG para
 *  imagem. Um PNG é recusado no contêiner, com uma mensagem que não diz isso
 *  com todas as letras — então a conversão acontece no navegador, antes de
 *  subir, e aqui o tipo é conferido. */
export async function publicarPecaAction(formData: FormData): Promise<ResultadoDaPublicacao> {
  const supabase = await admin();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const credencial = credenciais();
  if (!credencial) {
    return errResult(
      'O Instagram ainda não está configurado neste ambiente. Abra Estúdio → Instagram para ligar a conta.'
    );
  }

  const pecaId = String(formData.get('pecaId') ?? '');
  const tipo = String(formData.get('tipo') ?? 'feed') as TipoDePublicacao;
  const legenda = String(formData.get('legenda') ?? '').trim();

  if (!pecaId) return errResult('Salve a peça antes de publicar.');
  if (!['feed', 'story', 'carrossel'].includes(tipo)) return errResult('Tipo de publicação inválido.');

  const arquivos = formData.getAll('arquivo').filter((a): a is File => a instanceof File);
  if (arquivos.length === 0) return errResult('A arte não chegou. Tente de novo.');
  for (const a of arquivos) {
    if (a.type !== 'image/jpeg') return errResult('A arte precisa ser JPEG — é o único formato que o Instagram aceita.');
    if (a.size > MAX_BYTES) return errResult('Cada imagem precisa ter no máximo 8MB.');
  }
  if (tipo === 'carrossel' && arquivos.length < 2) {
    return errResult('Um carrossel precisa de pelo menos 2 slides.');
  }

  // Sobe a arte primeiro. O Instagram busca a imagem na URL, então ela tem de
  // estar no ar antes de o contêiner ser criado.
  const caminhos: string[] = [];
  const urls: string[] = [];
  const carimbo = Date.now();

  for (const [i, arquivo] of arquivos.entries()) {
    const caminho = `${pecaId}/${carimbo}-${i + 1}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) {
      await supabase.storage.from(BUCKET).remove(caminhos);
      return errResult('Não consegui subir a arte. Tente de novo.');
    }
    caminhos.push(caminho);
    urls.push(supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl);
  }

  // A linha nasce antes do envio. Se a publicação falhar no meio, o que foi
  // enviado fica registrado com o motivo — em vez de o dono ficar sem saber se
  // chegou a sair.
  const { data: registro, error: erroDoRegistro } = await supabase
    .from('studio_publications')
    .insert({ piece_id: pecaId, tipo, legenda, imagens: urls, status: 'enviando' })
    .select('id')
    .single();
  if (erroDoRegistro) {
    await supabase.storage.from(BUCKET).remove(caminhos);
    return errResult(friendlyDbError(erroDoRegistro, 'Não consegui registrar a publicação.'));
  }

  try {
    const publicacao =
      tipo === 'story'
        ? await publicarStory(credencial, urls[0])
        : tipo === 'carrossel'
          ? await publicarCarrossel(credencial, urls, legenda)
          : await publicarFoto(credencial, urls[0], legenda);

    await supabase
      .from('studio_publications')
      .update({
        status: 'publicada',
        media_id: publicacao.mediaId,
        permalink: publicacao.permalink,
      })
      .eq('id', registro.id);

    // Story não vira "Publicada": ele some em 24 horas, e marcar a peça como
    // publicada esconderia dela o fato de que ainda não foi ao feed.
    if (tipo !== 'story') {
      await supabase.from('studio_pieces').update({ status: 'Publicada' }).eq('id', pecaId);
    }

    revalidatePath('/admin/estudio');
    revalidatePath(`/admin/estudio/${pecaId}`);
    return { ...okResult('Publicado no Instagram.'), permalink: publicacao.permalink };
  } catch (e) {
    const motivo = e instanceof ErroDoInstagram ? e.message : 'Falhou ao publicar.';
    await supabase
      .from('studio_publications')
      .update({ status: 'falhou', erro: motivo })
      .eq('id', registro.id);
    return errResult(motivo);
  }
}
