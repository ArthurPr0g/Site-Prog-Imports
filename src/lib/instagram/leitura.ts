// Ler o Instagram da loja: perfil, posts, comentários e métricas.
//
// A publicação (`api.ts`) escreve; isto lê. Mesmo token, mesma API, mesmo
// tratamento de erro — por isso usa o `chamar` de lá.
//
// O que se consegue ler depende das permissões que o token carrega, e elas não
// são as mesmas para tudo:
//
//   instagram_basic            perfil, lista de posts, curtidas e nº de comentários
//   instagram_manage_comments  o texto e o autor de cada comentário — quem pediu "QUERO"
//   instagram_manage_insights  alcance, salvamentos, compartilhamentos
//
// O token é lido pelo `debug_token`, que devolve as permissões concedidas. Assim
// a tela sabe de antemão o que mostrar e o que pedir para liberar, em vez de
// descobrir por erro a cada carregamento.
//
// Só no servidor: o token não sai daqui.

import { chamar, credenciais, ErroDoInstagram, type Credenciais } from '@/lib/instagram/api';

export type EstadoDoToken = {
  valido: boolean;
  permissoes: string[];
  /** Segundos desde 1970, ou nulo quando o token não expira. */
  expiraEm: number | null;
};

export type Perfil = {
  usuario: string;
  seguidores: number;
  seguindo: number;
  posts: number;
  foto: string | null;
};

export type Midia = {
  id: string;
  legenda: string;
  /** IMAGE, VIDEO ou CAROUSEL_ALBUM. */
  tipo: string;
  /** FEED ou REELS. */
  produto: string;
  quando: string;
  link: string;
  miniatura: string | null;
  curtidas: number;
  comentarios: number;
  /** Só com `instagram_manage_insights`. */
  alcance?: number;
  salvamentos?: number;
  compartilhamentos?: number;
};

export type Comentario = {
  id: string;
  texto: string;
  usuario: string;
  quando: string;
};

/** O que o token pode, sem expor o token. */
export async function estadoDoToken(): Promise<EstadoDoToken | null> {
  const c = credenciais();
  if (!c) return null;
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();

  try {
    const r = await chamar<{
      data?: { is_valid?: boolean; scopes?: string[]; expires_at?: number };
    }>('/debug_token', {
      // Com o token do app quando há; senão o próprio token serve, porque quem o
      // gerou é administrador do app.
      token: appId && appSecret ? `${appId}|${appSecret}` : c.token,
      parametros: { input_token: c.token },
    });
    const d = r.data ?? {};
    return {
      valido: Boolean(d.is_valid),
      permissoes: d.scopes ?? [],
      // 0 significa "não expira" na resposta do debug_token.
      expiraEm: d.expires_at ? d.expires_at : null,
    };
  } catch {
    return { valido: false, permissoes: [], expiraEm: null };
  }
}

export async function perfil(c: Credenciais): Promise<Perfil> {
  const d = await chamar<{
    username?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    profile_picture_url?: string;
  }>(`/${c.conta}`, {
    token: c.token,
    parametros: { fields: 'username,followers_count,follows_count,media_count,profile_picture_url' },
  });
  return {
    usuario: d.username ?? '',
    seguidores: d.followers_count ?? 0,
    seguindo: d.follows_count ?? 0,
    posts: d.media_count ?? 0,
    foto: d.profile_picture_url ?? null,
  };
}

type MidiaDaApi = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
  insights?: { data?: { name: string; values?: { value?: number }[] }[] };
};

const CAMPOS_DA_MIDIA =
  'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count';

/** As métricas pedidas junto com a lista, quando há permissão.
 *
 *  Só as que existem para foto, carrossel e Reels ao mesmo tempo: pedir uma
 *  métrica que não existe para um dos formatos derruba a lista inteira, e um
 *  painel que some porque um Reels não tem "impressões" é pior que um painel
 *  sem essa coluna. */
const METRICAS = 'reach,saved,shares';

function converter(m: MidiaDaApi): Midia {
  const metrica = (nome: string) =>
    m.insights?.data?.find((d) => d.name === nome)?.values?.[0]?.value;
  return {
    id: m.id,
    legenda: m.caption ?? '',
    tipo: m.media_type ?? '',
    produto: m.media_product_type ?? 'FEED',
    quando: m.timestamp ?? '',
    link: m.permalink ?? '',
    // Vídeo tem miniatura própria; foto e carrossel usam a própria mídia.
    miniatura: m.thumbnail_url ?? m.media_url ?? null,
    curtidas: m.like_count ?? 0,
    comentarios: m.comments_count ?? 0,
    alcance: metrica('reach'),
    salvamentos: metrica('saved'),
    compartilhamentos: metrica('shares'),
  };
}

/** Os posts mais recentes, até `maximo`.
 *
 *  Com `comMetricas`, tenta trazer o alcance junto. Se a API recusar — falta de
 *  permissão, ou métrica que um post antigo não tem — refaz sem as métricas em
 *  vez de deixar o painel vazio. */
export async function midias(c: Credenciais, maximo = 100, comMetricas = false): Promise<Midia[]> {
  async function buscar(campos: string): Promise<Midia[]> {
    const saida: Midia[] = [];
    let depois: string | undefined;
    while (saida.length < maximo) {
      const pagina = await chamar<{ data?: MidiaDaApi[]; paging?: { cursors?: { after?: string }; next?: string } }>(
        `/${c.conta}/media`,
        {
          token: c.token,
          parametros: { fields: campos, limit: String(Math.min(50, maximo - saida.length)), ...(depois ? { after: depois } : {}) },
        }
      );
      saida.push(...(pagina.data ?? []).map(converter));
      depois = pagina.paging?.next ? pagina.paging.cursors?.after : undefined;
      if (!depois) break;
    }
    return saida;
  }

  if (comMetricas) {
    try {
      return await buscar(`${CAMPOS_DA_MIDIA},insights.metric(${METRICAS})`);
    } catch {
      // Cai para a lista sem métricas.
    }
  }
  return buscar(CAMPOS_DA_MIDIA);
}

/** Os comentários de um post. Precisa de `instagram_manage_comments`. */
export async function comentariosDe(c: Credenciais, mediaId: string, maximo = 300): Promise<Comentario[]> {
  const saida: Comentario[] = [];
  let depois: string | undefined;
  while (saida.length < maximo) {
    const pagina = await chamar<{
      data?: { id: string; text?: string; username?: string; from?: { username?: string }; timestamp?: string }[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(`/${mediaId}/comments`, {
      token: c.token,
      parametros: { fields: 'id,text,username,from,timestamp', limit: '50', ...(depois ? { after: depois } : {}) },
    });
    // Sem instagram_manage_comments a API devolve o texto e esconde o autor —
    // `username` e `from` vêm vazios. O comentário entra assim mesmo: saber
    // que alguém pediu já é metade do controle.
    for (const k of pagina.data ?? []) {
      saida.push({ id: k.id, texto: k.text ?? '', usuario: k.username ?? k.from?.username ?? '', quando: k.timestamp ?? '' });
    }
    depois = pagina.paging?.next ? pagina.paging.cursors?.after : undefined;
    if (!depois) break;
  }
  return saida;
}

/** O erro é de permissão (e não de rede, de token vencido ou de post apagado)? */
export function faltaPermissao(e: unknown): boolean {
  return e instanceof ErroDoInstagram && (e.codigo === 10 || e.codigo === 200 || (e.codigo ?? 0) >= 200 && (e.codigo ?? 0) < 300);
}
