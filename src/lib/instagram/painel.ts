// O painel de acompanhamento: o que cada post rendeu e quem pediu o direct.
//
// A API do Instagram responde o agora — quantos seguidores, quantas curtidas —
// e esquece o resto. O que o dono precisa controlar é justamente o que ela não
// guarda: quem comentou a palavra, se já recebeu a mensagem, qual mensagem é.
// Então cada abertura do painel faz duas coisas: lê o Instagram e anota no
// banco o que precisa durar (um ponto de seguidores por dia, cada pedido novo).
//
// Só no servidor: usa o token.

import type { createClient } from '@/lib/supabase/server';
import { credenciais, ErroDoInstagram } from '@/lib/instagram/api';
import { comentariosDe, estadoDoToken, midias, perfil, type Midia, type Perfil } from '@/lib/instagram/leitura';
import { comentarioPede, mensagemPadrao, palavraChaveDa } from '@/lib/estudio/direct';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type FormatoDoPost = 'Carrossel' | 'Reels' | 'Foto' | 'Vídeo';

export type PostDoPainel = {
  id: string;
  legenda: string;
  formato: FormatoDoPost;
  quando: string;
  /** 0 = domingo, no fuso da loja. */
  diaDaSemana: number;
  link: string;
  miniatura: string | null;
  curtidas: number;
  comentarios: number;
  alcance: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  palavra: string;
  /** De onde veio a palavra: escrita no painel, achada na peça ou na legenda. */
  origemDaPalavra: 'painel' | 'peca' | 'legenda' | null;
  resposta: string;
  /** De onde veio a mensagem: escrita no painel, a da peça ou a genérica. */
  origemDaResposta: 'painel' | 'peca' | 'padrao';
  peca: { id: string; titulo: string } | null;
};

export type PedidoDoPainel = {
  id: string;
  mediaId: string;
  usuario: string;
  texto: string;
  palavra: string;
  comentadoEm: string;
  respondidoEm: string | null;
};

export type Painel = {
  configurado: boolean;
  /** Falha de leitura do Instagram — o painel ainda mostra o que está no banco. */
  erro: string | null;
  perfil: Perfil | null;
  token: { valido: boolean; diasParaVencer: number | null; permissoes: string[] } | null;
  temInsights: boolean;
  posts: PostDoPainel[];
  pedidos: PedidoDoPainel[];
  historico: { dia: string; seguidores: number }[];
  pecas: { id: string; titulo: string }[];
  /** Pedidos novos achados nesta leitura. */
  novos: number;
  atualizadoEm: string;
};

const FUSO = 'America/Sao_Paulo';
const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hojeNaLoja(): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
}

function diaDaSemana(iso: string): number {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'short' }).format(new Date(iso));
  return Math.max(0, DIAS.indexOf(nome));
}

function formatoDe(m: Midia): FormatoDoPost {
  if (m.produto === 'REELS') return 'Reels';
  if (m.tipo === 'CAROUSEL_ALBUM') return 'Carrossel';
  if (m.tipo === 'VIDEO') return 'Vídeo';
  return 'Foto';
}

function textosDa(conteudo: unknown): Record<string, string> {
  if (!conteudo || typeof conteudo !== 'object') return {};
  return Object.fromEntries(
    Object.entries(conteudo as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === 'string'
    )
  );
}

/** Roda `tarefa` em cada item, `de` em `de` — sem cem chamadas de uma vez. */
async function emLotes<T>(itens: T[], de: number, tarefa: (item: T) => Promise<void>) {
  for (let i = 0; i < itens.length; i += de) {
    await Promise.all(itens.slice(i, i + de).map(tarefa));
  }
}

export async function carregarPainel(supabase: Supabase): Promise<Painel> {
  const c = credenciais();
  const agora = new Date().toISOString();

  const [{ data: config }, { data: publicacoes }, { data: pecasRecentes }] = await Promise.all([
    supabase.from('studio_posts').select('media_id, piece_id, palavra, resposta, comentarios_lidos'),
    supabase.from('studio_publications').select('media_id, piece_id').not('media_id', 'is', null),
    supabase.from('studio_pieces').select('id, titulo').order('created_at', { ascending: false }).limit(80),
  ]);

  const configDo = new Map((config ?? []).map((r) => [r.media_id, r]));
  const pecaPublicada = new Map(
    (publicacoes ?? []).filter((p) => p.media_id).map((p) => [p.media_id as string, p.piece_id])
  );

  let erro: string | null = null;
  let p: Perfil | null = null;
  let lista: Midia[] = [];
  let token: Painel['token'] = null;
  let novos = 0;

  if (c) {
    const estado = await estadoDoToken();
    token = estado
      ? {
          valido: estado.valido,
          permissoes: estado.permissoes,
          diasParaVencer: estado.expiraEm ? Math.floor((estado.expiraEm * 1000 - Date.now()) / 86400000) : null,
        }
      : null;

    try {
      [p, lista] = await Promise.all([
        perfil(c),
        midias(c, 100, (estado?.permissoes ?? []).includes('instagram_manage_insights')),
      ]);
    } catch (e) {
      erro = e instanceof ErroDoInstagram ? e.message : 'Não consegui ler o Instagram agora.';
    }

    if (p) {
      // Um ponto por dia; abrir de novo no mesmo dia só atualiza o número.
      await supabase.from('studio_perfil_diario').upsert({
        dia: hojeNaLoja(),
        seguidores: p.seguidores,
        seguindo: p.seguindo,
        posts: p.posts,
        atualizado_em: agora,
      });
    }
  }

  // As peças vinculadas a algum post, com o que é preciso para achar a palavra
  // e a mensagem delas.
  const idsDePeca = new Set<string>();
  for (const m of lista) {
    const id = configDo.get(m.id)?.piece_id ?? pecaPublicada.get(m.id);
    if (id) idsDePeca.add(id);
  }
  const { data: pecasVinculadas } = idsDePeca.size
    ? await supabase
        .from('studio_pieces')
        .select('id, titulo, conteudo, legenda, resposta_direta')
        .in('id', [...idsDePeca])
    : { data: [] };
  const pecaPorId = new Map((pecasVinculadas ?? []).map((x) => [x.id, x]));

  const posts: PostDoPainel[] = lista.map((m) => {
    const cfg = configDo.get(m.id);
    const peca = pecaPorId.get(cfg?.piece_id ?? pecaPublicada.get(m.id) ?? '') ?? null;

    let palavra = cfg?.palavra.trim() ?? '';
    let origemDaPalavra: PostDoPainel['origemDaPalavra'] = palavra ? 'painel' : null;
    if (!palavra && peca) {
      palavra = palavraChaveDa(textosDa(peca.conteudo), peca.legenda);
      if (palavra) origemDaPalavra = 'peca';
    }
    if (!palavra) {
      palavra = palavraChaveDa({}, m.legenda);
      if (palavra) origemDaPalavra = 'legenda';
    }

    let resposta = cfg?.resposta.trim() ?? '';
    let origemDaResposta: PostDoPainel['origemDaResposta'] = 'painel';
    if (!resposta && peca?.resposta_direta.trim()) {
      resposta = peca.resposta_direta.trim();
      origemDaResposta = 'peca';
    }
    if (!resposta) {
      resposta = mensagemPadrao({ palavra, produto: null });
      origemDaResposta = 'padrao';
    }

    return {
      id: m.id,
      legenda: m.legenda,
      formato: formatoDe(m),
      quando: m.quando,
      diaDaSemana: diaDaSemana(m.quando),
      link: m.link,
      miniatura: m.miniatura,
      curtidas: m.curtidas,
      comentarios: m.comentarios,
      alcance: m.alcance ?? null,
      salvamentos: m.salvamentos ?? null,
      compartilhamentos: m.compartilhamentos ?? null,
      palavra,
      origemDaPalavra,
      resposta,
      origemDaResposta,
      peca: peca ? { id: peca.id, titulo: peca.titulo } : null,
    };
  });

  // Os pedidos. Só relê o post cujo número de comentários mudou desde a última
  // leitura, ou cuja palavra mudou (a configuração zera o contador).
  if (c && p) {
    const usuarioDaLoja = p.usuario.toLowerCase();
    const paraLer = posts.filter(
      (post) => post.palavra && post.comentarios > 0 && configDo.get(post.id)?.comentarios_lidos !== post.comentarios
    );

    await emLotes(paraLer, 4, async (post) => {
      try {
        const comentarios = await comentariosDe(c, post.id, 500);
        // Comentário sem autor (a API o esconde sem instagram_manage_comments)
        // entra na fila do mesmo jeito; só o da própria loja fica de fora.
        //
        // E comentário que repete a própria chamada ("Comente QUERO…") não é
        // pedido, é eco da legenda: o primeiro post com palavra tinha um
        // comentário que copiava a legenda inteira, e ele entrava na fila.
        const pedidos = comentarios
          .filter((k) => k.usuario.toLowerCase() !== usuarioDaLoja)
          .filter((k) => comentarioPede(k.texto, post.palavra))
          .filter((k) => !palavraChaveDa({}, k.texto));

        // O que estava na fila e deixou de valer (palavra trocada, regra nova)
        // sai dela. O que já foi respondido fica, é histórico.
        const validos = new Set(pedidos.map((k) => k.id));
        const { data: pendentesDoPost } = await supabase
          .from('studio_respostas')
          .select('id, comment_id')
          .eq('media_id', post.id)
          .is('respondido_em', null);
        const sobra = (pendentesDoPost ?? []).filter((r) => !validos.has(r.comment_id)).map((r) => r.id);
        if (sobra.length) {
          await supabase.from('studio_respostas').delete().in('id', sobra).is('respondido_em', null);
        }

        if (pedidos.length) {
          const { data: existentes } = await supabase
            .from('studio_respostas')
            .select('comment_id')
            .eq('media_id', post.id);
          const ja = new Set((existentes ?? []).map((r) => r.comment_id));
          novos += pedidos.filter((k) => !ja.has(k.id)).length;

          // Atualiza os que já existiam em vez de ignorá-los: o autor que vinha
          // oculto aparece quando o token ganha a permissão de comentários.
          // `respondido_em` não vai no corpo, então a marcação não se perde.
          await supabase.from('studio_respostas').upsert(
            pedidos.map((k) => ({
              media_id: post.id,
              comment_id: k.id,
              usuario: k.usuario,
              texto: k.texto.slice(0, 500),
              palavra: post.palavra,
              comentado_em: k.quando || agora,
            })),
            { onConflict: 'comment_id' }
          );
        }

        await supabase.from('studio_posts').upsert(
          {
            media_id: post.id,
            comentarios_lidos: post.comentarios,
            // O upsert reescreve a linha inteira: o que já estava configurado
            // vai junto, senão ler os comentários apagaria a palavra.
            piece_id: configDo.get(post.id)?.piece_id ?? pecaPublicada.get(post.id) ?? null,
            palavra: configDo.get(post.id)?.palavra ?? '',
            resposta: configDo.get(post.id)?.resposta ?? '',
          },
          { onConflict: 'media_id' }
        );
      } catch {
        // Um post que falha (apagado, por exemplo) não derruba o painel.
      }
    });
  }

  const [{ data: pedidos }, { data: historico }] = await Promise.all([
    supabase
      .from('studio_respostas')
      .select('id, media_id, usuario, texto, palavra, comentado_em, respondido_em')
      .order('comentado_em', { ascending: false })
      .limit(3000),
    supabase.from('studio_perfil_diario').select('dia, seguidores').order('dia', { ascending: true }),
  ]);

  return {
    configurado: Boolean(c),
    erro,
    perfil: p,
    token,
    temInsights: (token?.permissoes ?? []).includes('instagram_manage_insights'),
    posts,
    pedidos: (pedidos ?? []).map((r) => ({
      id: r.id,
      mediaId: r.media_id,
      usuario: r.usuario,
      texto: r.texto,
      palavra: r.palavra,
      comentadoEm: r.comentado_em,
      respondidoEm: r.respondido_em,
    })),
    historico: historico ?? [],
    pecas: (pecasRecentes ?? []).map((x) => ({ id: x.id, titulo: x.titulo })),
    novos,
    atualizadoEm: agora,
  };
}
