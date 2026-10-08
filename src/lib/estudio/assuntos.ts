// A pauta: de onde vêm os assuntos.
//
// Busca RSS das publicações do setor, pontua cada item pelo que a loja vende e
// devolve o que vale ler. Só roda no servidor.
//
// RSS e não uma API de notícias: é de graça, não pede chave, não tem cota e as
// publicações mantêm o formato há vinte anos. Uma API seria mais limpa e
// cobraria por uma busca que o leitor de feed faz igual.

/** As fontes. Todas conferidas respondendo antes de entrarem aqui.
 *
 *  A Notebookcheck ficou de fora: o feed dela devolve 403 para quem não é
 *  navegador, e insistir pediria disfarçar o pedido — não vale enganar um
 *  servidor para ganhar uma sexta fonte. */
const FONTES = [
  { nome: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { nome: '9to5Mac', url: 'https://9to5mac.com/feed/' },
  { nome: "Tom's Hardware", url: 'https://www.tomshardware.com/feeds/all' },
  { nome: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
  { nome: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
] as const;

/** O que a loja vende, em sinais de texto.
 *
 *  O peso separa marca de componente: uma notícia que cita "Alienware" é sobre
 *  um produto que está na vitrine; uma que cita "RTX" pode ser sobre
 *  mineração. Os dois contam, com pesos diferentes. */
const SINAIS: { termo: RegExp; marca: string; peso: number }[] = [
  { termo: /\balienware\b/i, marca: 'Alienware', peso: 3 },
  { termo: /\b(macbook|mac mini|mac studio)\b/i, marca: 'MacBook', peso: 3 },
  { termo: /\biphone\b/i, marca: 'iPhone', peso: 3 },
  { termo: /\bipad\b/i, marca: 'iPad', peso: 3 },
  { termo: /\b(rog|republic of gamers)\b/i, marca: 'ASUS ROG', peso: 3 },
  { termo: /\b(legion|lenovo)\b/i, marca: 'Lenovo', peso: 3 },
  { termo: /\b(predator|nitro|acer)\b/i, marca: 'Acer', peso: 3 },
  { termo: /\b(galaxy book|samsung)\b/i, marca: 'Samsung', peso: 2 },
  { termo: /\b(dell|xps)\b/i, marca: 'Dell', peso: 2 },
  { termo: /\blogitech\b/i, marca: 'Logitech', peso: 2 },
  { termo: /\bapple\b/i, marca: 'Apple', peso: 2 },
  { termo: /\b(rtx|geforce|nvidia)\b/i, marca: 'NVIDIA', peso: 2 },
  { termo: /\b(core ultra|intel)\b/i, marca: 'Intel', peso: 1 },
  { termo: /\b(ryzen|radeon|amd)\b/i, marca: 'AMD', peso: 1 },
  { termo: /\b(laptop|notebook|gaming laptop)\b/i, marca: 'Notebook', peso: 1 },
  { termo: /\b(monitor|oled|display)\b/i, marca: 'Monitor', peso: 1 },
];

/** Palavras que indicam que a notícia é sobre algo novo — o que mais rende
 *  post numa loja de importação. */
const NOVIDADE = /\b(launch|launches|announce|announced|unveil|unveils|new|release|released|hands-on|review)\b/i;

export type Assunto = {
  titulo: string;
  resumo: string;
  fonte: string;
  url: string;
  publicado_em: string | null;
  relevancia: number;
  marcas: string[];
};

/* ------------------------------------------------------------------ leitura */

function tag(bloco: string, nome: string): string {
  // `[^>]*` cobre o atributo que alguns feeds põem na tag (type="html").
  const m = bloco.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, 'i'));
  return m ? m[1] : '';
}

function limpar(bruto: string): string {
  return bruto
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** O endereço do item. RSS põe em `<link>texto</link>`; Atom, em
 *  `<link href="...">`, e aí a tag vem vazia. */
function endereco(bloco: string): string {
  const atom = bloco.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
    ?? bloco.match(/<link[^>]*href=["']([^"']+)["']/i);
  const rss = limpar(tag(bloco, 'link'));
  return rss || (atom ? atom[1] : '');
}

function pontuar(texto: string): { relevancia: number; marcas: string[] } {
  const marcas = new Set<string>();
  let relevancia = 0;
  for (const s of SINAIS) {
    if (s.termo.test(texto)) {
      marcas.add(s.marca);
      relevancia += s.peso;
    }
  }
  if (relevancia > 0 && NOVIDADE.test(texto)) relevancia += 2;
  return { relevancia, marcas: [...marcas] };
}

/** Quebra o feed em itens, seja RSS (`item`) ou Atom (`entry`). */
function blocos(xml: string): string[] {
  const itens = xml.match(/<item[\s>][\s\S]*?<\/item>/gi);
  if (itens?.length) return itens;
  return xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
}

async function lerFonte(fonte: (typeof FONTES)[number]): Promise<Assunto[]> {
  const resposta = await fetch(fonte.url, {
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
    // A pauta é atualizada por clique; cachear esconderia notícia nova.
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!resposta.ok) return [];
  const xml = await resposta.text();

  return blocos(xml)
    .map((bloco): Assunto | null => {
      const titulo = limpar(tag(bloco, 'title'));
      const resumo = limpar(tag(bloco, 'description') || tag(bloco, 'summary') || tag(bloco, 'content'));
      const url = endereco(bloco);
      if (!titulo || !url) return null;

      const data = limpar(tag(bloco, 'pubDate') || tag(bloco, 'published') || tag(bloco, 'updated'));
      const quando = data ? new Date(data) : null;
      const { relevancia, marcas } = pontuar(`${titulo} ${resumo}`);

      return {
        titulo: titulo.slice(0, 300),
        // O resumo é para ler na lista, não para reproduzir a matéria.
        resumo: resumo.slice(0, 400),
        fonte: fonte.nome,
        url,
        publicado_em: quando && !Number.isNaN(quando.getTime()) ? quando.toISOString() : null,
        relevancia,
        marcas,
      };
    })
    .filter((a): a is Assunto => a !== null);
}

/** Relevância mínima para entrar na pauta.
 *
 *  Abaixo disso é notícia de tecnologia que não é sobre o que a loja vende —
 *  rede social, carro elétrico, streaming. Deixar entrar enche a lista e faz o
 *  dono parar de ler, que é o único jeito desta tela falhar. */
const CORTE = 3;

export async function buscarAssuntos(): Promise<Assunto[]> {
  const resultados = await Promise.allSettled(FONTES.map(lerFonte));
  const todos = resultados.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  // Mesma notícia sai em mais de uma publicação; fica a de maior relevância.
  const porUrl = new Map<string, Assunto>();
  for (const a of todos) {
    if (a.relevancia < CORTE) continue;
    const existente = porUrl.get(a.url);
    if (!existente || a.relevancia > existente.relevancia) porUrl.set(a.url, a);
  }

  return [...porUrl.values()].sort(
    (x, y) =>
      y.relevancia - x.relevancia ||
      (y.publicado_em ?? '').localeCompare(x.publicado_em ?? '')
  );
}

export { FONTES };
