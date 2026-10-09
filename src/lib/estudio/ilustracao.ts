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

function credito(autor: string, licenca: string, fonte: string): string {
  const quem = autor.trim() || 'autor não identificado';
  const onde = fonte === 'wikimedia' ? 'Wikimedia Commons' : fonte || 'internet';
  return `Foto: ${quem} (${licenca}) via ${onde}`;
}

/** Busca ilustrações licenciadas para uso comercial.
 *
 *  Nunca lança: ilustração é conforto sobre a peça, e a peça funciona sem
 *  ela. Falhou, devolve lista vazia e a tela diz que não achou. */
export async function buscarIlustracoes(termo: string, quantas = 12): Promise<Ilustracao[]> {
  const busca = termo.trim();
  if (busca.length < 2) return [];

  const parametros = new URLSearchParams({
    q: busca,
    // As duas condições que importam: pode usar comercialmente e pode alterar.
    // Sem "modification" entram licenças ND, e recortar a foto para o
    // enquadramento da peça já é alteração.
    license_type: 'commercial,modification',
    size: 'large',
    mature: 'false',
    page_size: String(Math.min(quantas * 2, 40)),
  });

  try {
    const resposta = await fetch(`${BASE}?${parametros}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok) return [];
    const dados = (await resposta.json()) as RespostaDaBusca;

    return (dados.results ?? [])
      .filter((r) => r.url && (r.width ?? 0) >= LARGURA_MINIMA)
      .slice(0, quantas)
      .map((r) => {
        const licenca = `CC ${(r.license ?? '').toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`.trim();
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
  } catch {
    return [];
  }
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
