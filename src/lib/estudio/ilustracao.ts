// Ilustração de fora, quando a loja não tem a foto.
//
// A regra do dono: catálogo primeiro, internet só quando não temos. Faz
// sentido — notícia de lançamento fala de máquina que a loja ainda não
// vende, e não existe foto nossa de um aparelho anunciado ontem.
//
// A busca é no Openverse, que indexa o acervo aberto da internet (Wikimedia,
// Flickr, museus) e, ao contrário de uma busca de imagens comum, **devolve a
// licença de cada resultado**. É o que permite filtrar para o que pode ser
// usado comercialmente antes de a foto chegar perto de um post da loja.
//
// Duas descobertas da conferência, que moldaram o código:
//
// Sem filtro de tamanho o acervo entrega foto amadora de 1024px de 2009 —
// inutilizável num fundo 1080×1920. Com `size=large` vêm fotos do Wikimedia
// em 4032×3024. O filtro não é refinamento, é o que separa servir de não
// servir.
//
// E a licença mais comum no que sobra é CC BY ou CC BY-SA: as duas **exigem
// crédito** na publicação. Por isso a atribuição viaja junto com a imagem e
// não é opcional em lugar nenhum deste fluxo.

const BASE = 'https://api.openverse.org/v1/images/';

export type Ilustracao = {
  id: string;
  titulo: string;
  url: string;
  miniatura: string;
  largura: number;
  altura: number;
  autor: string;
  licenca: string;
  fonte: string;
  pagina: string;
  /** O crédito pronto para entrar na legenda. */
  credito: string;
};

type RespostaDaBusca = {
  results?: {
    id?: string;
    title?: string;
    url?: string;
    thumbnail?: string;
    width?: number;
    height?: number;
    creator?: string;
    license?: string;
    license_version?: string;
    source?: string;
    foreign_landing_url?: string;
  }[];
};

/** O menor lado aceitável.
 *
 *  O story quer 1080×1920 e o feed 1080×1350. Abaixo de 1080 de largura a
 *  foto sobe esticada, e foto esticada numa loja que vende máquina de R$ 40
 *  mil custa mais caro que não publicar. */
const LARGURA_MINIMA = 1080;

/** O nome da licença como se escreve: "CC BY-SA 4.0", "CC0 1.0".
 *
 *  A API devolve só o sufixo (`by-sa`, `cc0`, `pdm`), e prefixar tudo com "CC"
 *  produzia "CC CC0 1.0" — o tipo de erro que, num crédito público, faz a
 *  atribuição parecer feita por quem não leu o que estava copiando. */
function nomeDaLicenca(licenca: string, versao?: string): string {
  const sigla = licenca.trim().toUpperCase();
  if (!sigla) return 'Licença não informada';
  const base = sigla.startsWith('CC') || sigla === 'PDM' ? sigla : `CC ${sigla}`;
  return `${base}${versao ? ` ${versao}` : ''}`;
}

function credito(autor: string, licenca: string, fonte: string): string {
  const quem = autor.trim() || 'autor não identificado';
  const onde = fonte === 'wikimedia' ? 'Wikimedia Commons' : fonte || 'internet';
  return `Foto: ${quem} (${licenca}) via ${onde}`;
}

/** O teto de resultados por página para quem não tem chave.
 *
 *  Passou de 20 e a API recusa com 401 -- "page_size may not exceed 20 for
 *  anonymous requests". A primeira versão pedia 24 e não achava nada, nem para
 *  "laptop". */
const TETO_ANONIMO = 20;

/** O que a busca devolve: a lista e, separado dela, o erro.
 *
 *  Separados de propósito. A primeira versão devolvia lista vazia quando a API
 *  recusava, e a tela dizia "nada licenciado nesse termo" -- uma afirmação
 *  sobre o acervo quando o que tinha acontecido era uma recusa de pedido. Lista
 *  vazia e busca que falhou são coisas diferentes e pedem mensagens diferentes. */
export type ResultadoDaBusca = { lista: Ilustracao[]; erro?: string };

/** Busca ilustrações licenciadas para uso comercial.
 *
 *  Nunca lança: ilustração é conforto sobre a peça, e a peça funciona sem
 *  ela. Mas também nunca engole a falha -- ela volta em erro. */
export async function buscarIlustracoes(termo: string, quantas = 12): Promise<ResultadoDaBusca> {
  const busca = termo.trim();
  if (busca.length < 2) return { lista: [] };

  const parametros = new URLSearchParams({
    q: busca,
    // As duas condições que importam: pode usar comercialmente e pode alterar.
    // Sem "modification" entram licenças ND, e recortar a foto para o
    // enquadramento da peça já é alteração.
    license_type: 'commercial,modification',
    size: 'large',
    mature: 'false',
    page_size: String(TETO_ANONIMO),
  });

  try {
    const resposta = await fetch(`${BASE}?${parametros}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok) {
      return { lista: [], erro: `O acervo recusou a busca (${resposta.status}). Tente de novo em instantes.` };
    }
    const dados = (await resposta.json()) as RespostaDaBusca;

    const lista = (dados.results ?? [])
      .filter((r) => r.url && (r.width ?? 0) >= LARGURA_MINIMA)
      .slice(0, quantas)
      .map((r) => {
        const licenca = nomeDaLicenca(r.license ?? '', r.license_version);
        const autor = r.creator ?? '';
        const fonte = r.source ?? '';
        return {
          id: r.id ?? r.url!,
          titulo: (r.title ?? 'Sem título').slice(0, 120),
          url: r.url!,
          miniatura: r.thumbnail || r.url!,
          largura: r.width ?? 0,
          altura: r.height ?? 0,
          autor,
          licenca,
          fonte,
          pagina: r.foreign_landing_url ?? '',
          credito: credito(autor, licenca, fonte),
        };
      });
    return { lista };
  } catch {
    return { lista: [], erro: 'Não consegui falar com o acervo agora.' };
  }
}

/** Busca e, se não achar nada, recua para um termo mais curto.
 *
 *  "Surface Laptop Ultra" é um aparelho novo e não tem foto livre; "Surface
 *  Laptop" tem. O recuo tira a última palavra por vez e para em duas: uma só
 *  ("laptop") traz qualquer coisa, e foto de qualquer coisa não ilustra
 *  notícia nenhuma. O termo realmente usado volta junto, porque a tela precisa
 *  dizer o que está mostrando — mostrar "Surface Laptop" como se fosse o que
 *  foi pedido seria enganar. */
export async function buscarComRecuo(
  termo: string,
  quantas = 12
): Promise<ResultadoDaBusca & { termoUsado: string }> {
  let palavras = termo.trim().split(/\s+/).filter(Boolean);
  let ultimo: ResultadoDaBusca = { lista: [] };

  while (palavras.length > 0) {
    const tentativa = palavras.join(' ');
    ultimo = await buscarIlustracoes(tentativa, quantas);
    if (ultimo.erro || ultimo.lista.length > 0) return { ...ultimo, termoUsado: tentativa };
    if (palavras.length <= 2) break;
    palavras = palavras.slice(0, -1);
  }
  return { ...ultimo, termoUsado: palavras.join(' ') };
}

/** Põe o crédito na legenda, tirando o da imagem anterior.
 *
 *  A ordem em que o dono faz as coisas não pode decidir se o crédito vai: ele
 *  pode escolher a foto antes ou depois de a legenda ser escrita, e trocar de
 *  ideia no meio. Por isso o crédito é sempre a última linha, e esta função é
 *  o único lugar que mexe nela — tira a antiga, se havia, e acrescenta a nova.
 *
 *  Crédito não é opcional: CC BY e CC BY-SA exigem atribuição na publicação. */
export function comCredito(legenda: string, novo: string, anterior: string): string {
  let base = legenda;
  if (anterior.trim()) {
    base = base.split(anterior.trim()).join('').replace(/\n{3,}/g, '\n\n').trimEnd();
  }
  const credito = novo.trim();
  return credito ? `${base.trimEnd()}${base.trim() ? '\n\n' : ''}${credito}` : base;
}

/** O termo de busca a partir do que a peça diz.
 *
 *  Em inglês porque o acervo é majoritariamente catalogado em inglês —
 *  "notebook gamer" devolve 45 resultados, "gaming laptop" devolve milhares.
 *  Os nomes próprios passam intactos: é por eles que se acha a máquina certa. */
export function termoDaPeca(conteudo: Record<string, string>, assunto: string): string {
  const fonte = [conteudo.titulo, conteudo.sobretitulo, conteudo.capaTitulo, assunto]
    .filter(Boolean)
    .join(' ');

  const traducoes: [RegExp, string][] = [
    [/\bnotebook(s)? gamer\b/gi, 'gaming laptop'],
    [/\bnotebook(s)?\b/gi, 'laptop'],
    [/\bcelular(es)?\b/gi, 'smartphone'],
    [/\bfone(s)?\b/gi, 'headphones'],
    [/\btela\b/gi, 'display'],
    [/\bteclado\b/gi, 'keyboard'],
  ];

  let termo = fonte;
  for (const [de, para] of traducoes) termo = termo.replace(de, para);

  return termo
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 6)
    .join(' ');
}
