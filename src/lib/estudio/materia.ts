// As imagens de uma matéria.
//
// Clicar no título de uma notícia da pauta leva à matéria, e ela costuma ter as
// melhores imagens do assunto: fotos de imprensa do fabricante, no tamanho
// certo, escolhidas por quem cobriu o lançamento. A pauta já guarda o endereço.
//
// O que isto NÃO é: licença. Essas imagens pertencem ao veículo ou ao
// fabricante e não têm licença aberta, ao contrário do acervo do Openverse. A
// tela diz isso em cada uma, e o crédito do veículo entra na legenda. Usar é
// decisão do dono, com o risco à vista — notificação de direitos autorais num
// perfil comercial derruba o post.
//
// Só no servidor. O endereço da matéria sai do banco, nunca do navegador: uma
// rota que busca qualquer URL que lhe passem é uma rota que alcança o que não
// deveria.

const AGENTE = 'Mozilla/5.0 (compatible; ProgImportsEstudio/1.0; +https://www.prog-imports.com)';

export type ImagemDaMateria = {
  id: string;
  url: string;
  /** `principal` é a que o veículo escolheu para a matéria (og:image). */
  origem: 'principal' | 'artigo';
  alt: string;
};

/** https, com nome de domínio de verdade.
 *
 *  Sem IP literal, sem localhost e sem usuário na URL. Na Vercel a rede interna
 *  não é alcançável, mas isso é detalhe de hospedagem — a regra vale para o
 *  código, que pode mudar de hospedagem. */
export function urlSegura(texto: string): URL | null {
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return null;
  return u;
}

export { AGENTE as AGENTE_DO_ESTUDIO };

function atributos(tag: string): Record<string, string> {
  const a: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    a[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return a;
}

function decodificar(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#0?38;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

/** O maior candidato de um srcset.
 *
 *  URLs de CDN de imagem trazem vírgula (`?resize=1024,683`), então separar o
 *  srcset por vírgula quebraria a URL no meio. Cada candidato é "URL NNNw", e é
 *  isso que se procura. */
function maiorDoSrcset(srcset: string): string {
  let melhor = '';
  let maior = -1;
  for (const m of srcset.matchAll(/(\S+)\s+(\d+)w/g)) {
    const largura = Number(m[2]);
    if (largura > maior) {
      maior = largura;
      melhor = m[1].replace(/^,/, '');
    }
  }
  return melhor;
}

/** O que nunca é imagem de conteúdo, pelo nome do arquivo. */
const NAO_E_CONTEUDO =
  /(logo|avatar|gravatar|sprite|icon|badge|emoji|pixel|spacer|1x1|\/ads?\/|banner|promo|author|profile|placeholder|loading|blank|newsletter|subscribe)/i;

function normalizar(u: URL): string {
  // Sem o sufixo de tamanho do WordPress (-1024x683) e sem a query: é a mesma
  // foto em tamanhos diferentes, e mostrar quatro vezes não ajuda ninguém.
  return `${u.hostname}${u.pathname.replace(/-\d+x\d+(?=\.\w+$)/, '')}`.toLowerCase();
}

/** Lê o HTML da matéria e devolve as imagens que servem a um post. */
export async function imagensDaMateria(endereco: string): Promise<{ lista: ImagemDaMateria[]; erro?: string }> {
  const base = urlSegura(endereco);
  if (!base) return { lista: [], erro: 'O endereço da matéria não é um https válido.' };

  let html: string;
  try {
    const r = await fetch(base.toString(), {
      headers: {
        'user-agent': AGENTE,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    // Depois de seguir os redirecionamentos, o destino também precisa ser seguro.
    if (!urlSegura(r.url)) return { lista: [], erro: 'A matéria redirecionou para um endereço não permitido.' };
    if (!r.ok) return { lista: [], erro: `A matéria respondeu ${r.status}. O site pode bloquear leitura automática.` };
    html = (await r.text()).slice(0, 3_000_000);
  } catch {
    return { lista: [], erro: 'Não consegui abrir a matéria agora.' };
  }

  const vistos = new Set<string>();
  const saida: ImagemDaMateria[] = [];

  function aceitar(bruto: string, origem: ImagemDaMateria['origem'], alt: string, largura = 0, altura = 0) {
    if (!bruto) return;
    let u: URL | null;
    try {
      u = urlSegura(new URL(decodificar(bruto.trim()), base!).toString());
    } catch {
      return;
    }
    if (!u) return;
    if (/\.(svg|gif|ico)$/i.test(u.pathname)) return;
    if (NAO_E_CONTEUDO.test(u.pathname)) return;
    // Só descarta pelo tamanho quando a página o declara; imagem sem tamanho
    // declarado tem de ser julgada depois de carregada, na tela.
    if (largura && largura < 480) return;
    if (altura && altura < 270) return;

    const chave = normalizar(u);
    if (vistos.has(chave)) return;
    vistos.add(chave);
    saida.push({ id: chave, url: u.toString(), origem, alt: decodificar(alt).slice(0, 140) });
  }

  // 1) A que o veículo escolheu para a matéria.
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = atributos(m[0]);
    const chave = (a.property || a.name || '').toLowerCase();
    if (['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(chave)) {
      aceitar(a.content ?? '', 'principal', '');
    }
  }

  // 2) As do corpo. Só dentro de <article> quando ele existe: o resto da página
  // são relacionadas, barra lateral e publicidade, que não são desta notícia.
  const ini = html.search(/<article\b/i);
  const fim = html.toLowerCase().lastIndexOf('</article>');
  const corpo = ini >= 0 && fim > ini ? html.slice(ini, fim) : html;

  for (const m of corpo.matchAll(/<(img|source)\b[^>]*>/gi)) {
    const a = atributos(m[0]);
    const srcset = a.srcset || a['data-srcset'] || '';
    const fonte = (srcset && maiorDoSrcset(srcset)) || a['data-src'] || a['data-lazy-src'] || a.src || '';
    aceitar(fonte, 'artigo', a.alt ?? '', Number(a.width) || 0, Number(a.height) || 0);
    if (saida.length >= 12) break;
  }

  return { lista: saida.slice(0, 12) };
}
