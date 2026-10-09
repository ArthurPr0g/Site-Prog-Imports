// Publicar no Instagram da loja pela API do Meta.
//
// Só roda no servidor: o token publica em nome da conta, então ele não pode
// chegar ao navegador em hipótese alguma. Nenhum componente de cliente importa
// este arquivo — quem fala com ele é `src/app/actions/instagram.ts`.
//
// O desenho da API tem uma consequência que decide o resto do código: o
// Instagram não aceita o arquivo da imagem. Ele aceita uma URL pública e vai
// buscar a imagem sozinho, de um servidor dele. Por isso publicar é sempre em
// dois tempos — cria-se um "contêiner" apontando para a URL, espera-se o
// Instagram baixar, e só então se publica o contêiner.

/** Versão da Graph API. Fixa de propósito: a Meta muda o comportamento entre
 *  versões sem avisar quem usa "a mais recente", e uma publicação que some ou
 *  sai errada é o tipo de erro que só se descobre olhando o perfil. */
const VERSAO = 'v23.0';
const BASE = `https://graph.facebook.com/${VERSAO}`;

export type Credenciais = { conta: string; token: string };

/** As credenciais, ou nulo se o ambiente ainda não foi configurado.
 *
 *  Devolve nulo em vez de lançar porque a tela precisa saber a diferença entre
 *  "não configurado ainda" (mostra instrução) e "falhou" (mostra erro). */
export function credenciais(): Credenciais | null {
  const conta = process.env.INSTAGRAM_CONTA_ID?.trim();
  const token = process.env.INSTAGRAM_TOKEN?.trim();
  if (!conta || !token) return null;
  return { conta, token };
}

export class ErroDoInstagram extends Error {
  constructor(
    message: string,
    readonly codigo?: number,
    readonly subcodigo?: number
  ) {
    super(message);
    this.name = 'ErroDoInstagram';
  }
}

type RespostaDeErro = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_user_msg?: string;
  };
};

/** Exportada para a leitura de métricas (`leitura.ts`), que fala com a mesma
 *  API, com o mesmo token e precisa do mesmo tratamento de erro. */
export async function chamar<T>(
  caminho: string,
  opcoes: { metodo?: 'GET' | 'POST'; token: string; parametros?: Record<string, string> }
): Promise<T> {
  const { metodo = 'GET', token, parametros = {} } = opcoes;
  const campos = new URLSearchParams({ ...parametros, access_token: token });

  const url = metodo === 'GET' ? `${BASE}${caminho}?${campos}` : `${BASE}${caminho}`;
  const resposta = await fetch(url, {
    method: metodo,
    body: metodo === 'POST' ? campos : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });

  const corpo = (await resposta.json().catch(() => ({}))) as T & RespostaDeErro;

  if (!resposta.ok || corpo.error) {
    const e = corpo.error ?? {};
    // `error_user_msg` é o texto que a Meta escreveu para o usuário final e
    // quase sempre diz o que fazer; `message` é para desenvolvedor. Quando os
    // dois existem, o primeiro ajuda mais quem está olhando a tela.
    throw new ErroDoInstagram(
      e.error_user_msg || e.message || `A API respondeu ${resposta.status}.`,
      e.code,
      e.error_subcode
    );
  }

  return corpo;
}

/* ------------------------------------------------------------ descoberta */

export type ContaEncontrada = {
  pagina: string;
  paginaId: string;
  contaId: string;
  usuario: string;
};

/** Acha a conta do Instagram que o token pode publicar.
 *
 *  Procura por dois caminhos, e os dois são necessários.
 *
 *  O primeiro é `/me/accounts`, a lista das Páginas do usuário — o caminho de
 *  sempre, e o que funciona quando a Página tem um cargo atribuído direto à
 *  pessoa.
 *
 *  O segundo existe porque o Login do Facebook para Empresas não registra
 *  acesso a "tudo que a pessoa administra": ele registra **alvos** por
 *  permissão. Nesse desenho, `/me/accounts` pode voltar `{"data":[]}` com a
 *  autorização inteiramente correta — a Página está liberada, só não está
 *  listada. Conferido na própria conta da loja: a lista vinha vazia enquanto
 *  a Página respondia normalmente quando consultada pelo id. Quem sabe os ids
 *  é o `debug_token`, no campo `granular_scopes`.
 *
 *  Por isso a função não falha quando o primeiro caminho vem vazio: ela
 *  pergunta ao segundo. Tratar a lista vazia como "não tem conta conectada"
 *  mandaria o dono reconfigurar uma coisa que já estava certa. */
export async function contasDisponiveis(
  token: string,
  /** `{app-id}|{app-secret}`. Sem ele, o debug roda com o próprio token do
   *  usuário, o que só funciona para quem é administrador do app. */
  tokenDoApp?: string
): Promise<ContaEncontrada[]> {
  const achadas = new Map<string, ContaEncontrada>();

  try {
    const dados = await chamar<{
      data?: {
        id: string;
        name: string;
        instagram_business_account?: { id: string; username?: string };
      }[];
    }>('/me/accounts', {
      token,
      parametros: { fields: 'id,name,instagram_business_account{id,username}', limit: '50' },
    });

    for (const p of dados.data ?? []) {
      const conta = p.instagram_business_account;
      if (!conta?.id) continue;
      achadas.set(conta.id, {
        pagina: p.name,
        paginaId: p.id,
        contaId: conta.id,
        usuario: conta.username ?? '',
      });
    }
  } catch {
    // Seguir para o segundo caminho: ele cobre justamente os casos em que
    // este falha.
  }

  try {
    const debug = await chamar<{
      data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] };
    }>('/debug_token', {
      token: tokenDoApp ?? token,
      parametros: { input_token: token },
    });

    const escopos = debug.data?.granular_scopes ?? [];
    const alvo = (nome: string) => escopos.find((e) => e.scope === nome)?.target_ids ?? [];
    const contas = new Set([...alvo('instagram_content_publish'), ...alvo('instagram_basic')]);
    const paginaId = alvo('pages_show_list')[0] ?? alvo('pages_read_engagement')[0] ?? '';

    let pagina = '';
    if (paginaId) {
      try {
        pagina = (await chamar<{ name?: string }>(`/${paginaId}`, { token, parametros: { fields: 'name' } })).name ?? '';
      } catch {
        pagina = '';
      }
    }

    for (const contaId of contas) {
      if (achadas.has(contaId)) continue;
      let usuario = '';
      try {
        usuario =
          (await chamar<{ username?: string }>(`/${contaId}`, { token, parametros: { fields: 'username' } }))
            .username ?? '';
      } catch {
        usuario = '';
      }
      achadas.set(contaId, { pagina, paginaId, contaId, usuario });
    }
  } catch {
    // Os dois caminhos falharam: a lista vazia vira o erro na tela.
  }

  return [...achadas.values()];
}

/** Troca um token de hora por um de sessenta dias.
 *
 *  O token que sai do Explorer vale uma hora. Publicar com ele funciona hoje e
 *  falha amanhã, que é a pior forma de falhar: ninguém associa o erro ao token
 *  dois meses depois. */
export async function tokenLongo(
  curto: string,
  appId: string,
  appSecret: string
): Promise<{ token: string; expiraEm: number | null }> {
  const dados = await chamar<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
    token: curto,
    parametros: {
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: curto,
    },
  });
  return { token: dados.access_token, expiraEm: dados.expires_in ?? null };
}

/** Quantas publicações ainda cabem nas próximas 24 horas.
 *
 *  O teto vem da API e não está cravado aqui: a documentação diz 50, e a conta
 *  da loja respondeu 100. Número de terceiro que muda sem aviso é número para
 *  perguntar, não para repetir — o 50 abaixo só serve se a resposta vier sem o
 *  campo.
 *
 *  Vale a chamada porque é o que distingue "a API recusou" de "você já postou
 *  demais hoje", que são dois problemas com soluções opostas. */
export async function cotaRestante({ conta, token }: Credenciais): Promise<number | null> {
  try {
    const dados = await chamar<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>(
      `/${conta}/content_publishing_limit`,
      { token, parametros: { fields: 'config,quota_usage' } }
    );
    const linha = dados.data?.[0];
    const total = linha?.config?.quota_total ?? 50;
    const usado = linha?.quota_usage ?? 0;
    return Math.max(0, total - usado);
  } catch {
    // A cota é informação de conforto. Falhar aqui não pode impedir a
    // publicação, que é o que o dono pediu.
    return null;
  }
}

/* ------------------------------------------------------------ publicação */

/** Quanto esperar o Instagram terminar de baixar e processar a mídia.
 *
 *  Imagem costuma ficar pronta na primeira checagem; vídeo leva dezenas de
 *  segundos. O teto existe para a ação não ficar pendurada: estourou, a
 *  publicação fica registrada como falha com motivo, em vez de o dono ficar
 *  olhando um botão girando. */
const ESPERA = { intervaloMs: 2500, tentativas: 40 };

async function esperarPronto(containerId: string, { token }: Credenciais): Promise<void> {
  for (let i = 0; i < ESPERA.tentativas; i++) {
    const { status_code, status } = await chamar<{ status_code?: string; status?: string }>(
      `/${containerId}`,
      { token, parametros: { fields: 'status_code,status' } }
    );

    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new ErroDoInstagram(
        status || 'O Instagram recusou a mídia. Confira se a imagem é JPEG ou PNG e cabe nos limites.'
      );
    }
    await new Promise((r) => setTimeout(r, ESPERA.intervaloMs));
  }
  throw new ErroDoInstagram('O Instagram não terminou de processar a mídia a tempo.');
}

async function criarContainer(
  credencial: Credenciais,
  parametros: Record<string, string>
): Promise<string> {
  const { id } = await chamar<{ id: string }>(`/${credencial.conta}/media`, {
    metodo: 'POST',
    token: credencial.token,
    parametros,
  });
  return id;
}

async function publicarContainer(credencial: Credenciais, containerId: string) {
  const { id } = await chamar<{ id: string }>(`/${credencial.conta}/media_publish`, {
    metodo: 'POST',
    token: credencial.token,
    parametros: { creation_id: containerId },
  });

  // O permalink não vem na publicação; é uma segunda leitura. Vale a chamada
  // extra: é o que transforma "publicado" numa afirmação conferível, com link
  // para o post de verdade.
  let permalink: string | null = null;
  try {
    const m = await chamar<{ permalink?: string }>(`/${id}`, {
      token: credencial.token,
      parametros: { fields: 'permalink' },
    });
    permalink = m.permalink ?? null;
  } catch {
    permalink = null;
  }

  return { mediaId: id, permalink };
}

export type Publicacao = { mediaId: string; permalink: string | null };

/** Post simples de imagem no feed. */
export async function publicarFoto(
  credencial: Credenciais,
  imagem: string,
  legenda: string
): Promise<Publicacao> {
  const container = await criarContainer(credencial, { image_url: imagem, caption: legenda });
  await esperarPronto(container, credencial);
  return publicarContainer(credencial, container);
}

/** Story de imagem. Story não tem legenda — a API ignora `caption` aqui. */
export async function publicarStory(credencial: Credenciais, imagem: string): Promise<Publicacao> {
  const container = await criarContainer(credencial, { image_url: imagem, media_type: 'STORIES' });
  await esperarPronto(container, credencial);
  return publicarContainer(credencial, container);
}

/** Carrossel: um contêiner por slide, depois um contêiner que os agrupa. */
export async function publicarCarrossel(
  credencial: Credenciais,
  imagens: string[],
  legenda: string
): Promise<Publicacao> {
  if (imagens.length < 2 || imagens.length > 10) {
    throw new ErroDoInstagram('Um carrossel do Instagram tem de 2 a 10 imagens.');
  }

  // Em sequência, não em paralelo: dez downloads simultâneos de uma mesma
  // origem é o tipo de rajada que faz o Instagram desistir de uma das
  // imagens, e aí o carrossel sai com um slide faltando sem erro nenhum.
  const filhos: string[] = [];
  for (const imagem of imagens) {
    const filho = await criarContainer(credencial, {
      image_url: imagem,
      is_carousel_item: 'true',
    });
    await esperarPronto(filho, credencial);
    filhos.push(filho);
  }

  const pai = await criarContainer(credencial, {
    media_type: 'CAROUSEL',
    children: filhos.join(','),
    caption: legenda,
  });
  await esperarPronto(pai, credencial);
  return publicarContainer(credencial, pai);
}

/** Reels, com música opcional.
 *
 *  Sobre a música: só entra faixa que o detentor autorizou para uso por
 *  terceiros, e o acervo da API é bem menor que o do aplicativo. Além disso,
 *  isto só funciona com o app configurado em Login do Facebook — no Login do
 *  Instagram a chamada volta com erro 514 e não há configuração que resolva.
 *  Quando o nome não existir no acervo, a Meta recusa o contêiner inteiro;
 *  por isso a mensagem de erro aponta a música, que é a causa quase certa. */
export async function publicarReels(
  credencial: Credenciais,
  video: string,
  legenda: string,
  opcoes: { capa?: string; musica?: string; tambemNoFeed?: boolean } = {}
): Promise<Publicacao> {
  const parametros: Record<string, string> = {
    media_type: 'REELS',
    video_url: video,
    caption: legenda,
    share_to_feed: opcoes.tambemNoFeed === false ? 'false' : 'true',
  };
  if (opcoes.capa) parametros.cover_url = opcoes.capa;
  if (opcoes.musica) parametros.audio_name = opcoes.musica;

  let container: string;
  try {
    container = await criarContainer(credencial, parametros);
  } catch (e) {
    if (opcoes.musica && e instanceof ErroDoInstagram) {
      throw new ErroDoInstagram(
        `${e.message} — a causa mais provável é a música "${opcoes.musica}": a API só aceita faixas liberadas para terceiros. Tente publicar sem música.`,
        e.codigo,
        e.subcodigo
      );
    }
    throw e;
  }

  await esperarPronto(container, credencial);
  return publicarContainer(credencial, container);
}
