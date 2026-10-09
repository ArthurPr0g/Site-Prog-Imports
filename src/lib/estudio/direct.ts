// A resposta de direct de quem comentou a palavra-chave.
//
// Enquanto o private reply da API depende de App Review, o envio é manual — e
// manual é onde a promessa da arte costuma morrer. A peça diz "Comente QUERO",
// chegam quinze comentários, e responder quinze direct escrevendo a mesma
// coisa quinze vezes é a tarefa que ninguém faz até o fim.
//
// Então a mensagem nasce com a peça: uma só, com o link certo, pronta para
// copiar e colar. Texto montado aqui e não pedido ao modelo de linguagem —
// esta mensagem é sempre a mesma, e variar o jeito de dizer "aqui está o
// link" só criaria chance de sair um preço errado.

import { formatBRL } from '@/lib/format';
import type { ProdutoDoEstudio } from '@/lib/estudio/produto';

/** O endereço público do produto. */
export function linkDoProduto(sku: string, base = 'https://www.prog-imports.com'): string {
  return `${base}/produto/${encodeURIComponent(sku)}`;
}

/** Os jeitos de pedir a palavra.
 *
 *  Começou só com "comente" e a primeira peça real do catálogo dizia
 *  **Responda "QUERO"** — no story a chamada é responder, não comentar, e a
 *  detecção passou direto. Daí a lista: o que varia é o verbo, a palavra vem
 *  logo depois em qualquer um deles. */
const VERBOS = ['comente', 'comenta', 'responda', 'responde', 'mande', 'manda', 'envie', 'escreva', 'escreve', 'digite', 'digita'];

/** O verbo em qualquer caixa — "comente", "Comente" (começo de frase, o caso
 *  mais comum na legenda) e "COMENTE" (na arte) — sem ligar o `i` na regex
 *  inteira, que faria a palavra-chave aceitar minúscula também. */
const PEDIDOS = VERBOS.flatMap((v) => [v, v[0].toUpperCase() + v.slice(1), v.toUpperCase()]).join('|');

/** Acha a palavra que a peça mandou comentar ou responder.
 *
 *  Procura no que está escrito na arte e na legenda, porque a chamada pode
 *  estar em qualquer um dos dois. Devolve vazio quando não acha — e aí a tela
 *  pergunta em vez de inventar uma palavra que o post não pediu. */
export function palavraChaveDa(conteudo: Record<string, string>, legenda: string): string {
  const textos = [...Object.values(conteudo), legenda].filter(Boolean);
  // Entre aspas, a palavra pode ser frase — "EU QUERO" é a chamada mais comum
  // dos posts antigos da loja, e a busca de uma palavra só parava no "EU". A
  // aspa é o que diz onde a frase termina; sem ela, só uma palavra, senão
  // "Comente QUERO E GARANTA" viraria a palavra inteira.
  const entreAspas = new RegExp(
    `(?:${PEDIDOS})\\s*[:\\-]?\\s*["“”'‘’]([\\p{Lu}\\p{N}][\\p{Lu}\\p{N} ]{1,24}?)["“”'‘’]`,
    'u'
  );
  // Aspas retas ou curvas, e com ou sem elas: a arte usa curvas, o formulário
  // costuma receber retas. Só maiúsculas, que é como palavra-chave é escrita
  // — assim "responda rápido" não vira palavra-chave "RÁPIDO".
  const solta = new RegExp(`(?:${PEDIDOS})\\s*[:\\-]?\\s*["“”'‘’]?([\\p{Lu}][\\p{Lu}\\p{N}]{2,14})`, 'u');
  // Sem aspas, frase só quando a primeira palavra é curta demais para ser a
  // chave sozinha: "Comente EU QUERO". Já "COMENTE QUERO PARA RECEBER", na
  // arte toda em maiúsculas, fica em "QUERO".
  const curta = new RegExp(`(?:${PEDIDOS})\\s*[:\\-]?\\s*([\\p{Lu}]{1,2}\\s[\\p{Lu}][\\p{Lu}\\p{N}]{2,14})`, 'u');
  for (const texto of textos) {
    const m = texto.match(entreAspas);
    if (m && m[1].trim().length >= 3) return m[1].trim().replace(/\s+/g, ' ');
    const s = texto.match(solta);
    if (s) return s[1];
    const c = texto.match(curta);
    if (c) return c[1];
  }
  return '';
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
}

/** O comentário pediu? Sem acento e sem caixa: "quero", "Quero!" e "QUERO 🔥"
 *  são o mesmo pedido.
 *
 *  Para frase, basta a palavra que carrega o pedido — a mais longa. Quem
 *  responde "quero" a um post que pede "EU QUERO" pediu do mesmo jeito, e
 *  deixá-lo fora da fila é exatamente o cliente esquecido que a fila evita. */
export function comentarioPede(comentario: string, palavra: string): boolean {
  const chave = normalizar(palavra).trim();
  if (!chave) return false;
  const nucleo = chave.split(/\s+/).sort((a, b) => b.length - a.length)[0];
  const texto = normalizar(comentario);
  const inteira = (alvo: string) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(texto);
  return inteira(chave) || inteira(nucleo);
}

/** A mensagem padrão.
 *
 *  Curta de propósito: o private reply, quando chegar, manda **uma** mensagem
 *  e não abre conversa — quem escrever hoje do jeito que a API vai exigir
 *  amanhã não precisa reescrever nada. Por isso o link vai já nesta, e não
 *  depois de um "oi, tudo bem?".
 *
 *  Sem parcela: parcelamento não é campo do cadastro, e a regra da loja é no
 *  máximo 3x sem juros. Número de parcela escrito aqui envelheceria sozinho. */
export function mensagemPadrao({
  palavra,
  produto,
  base,
}: {
  palavra: string;
  produto: ProdutoDoEstudio | null;
  base?: string;
}): string {
  // Sem palavra-chave na peça, a abertura não cita nenhuma. Antes o padrão era
  // "QUERO" — e a mensagem dizia "Vi seu QUERO no post" a quem comentou outra
  // coisa, num post que nunca pediu essa palavra. Dizer ao cliente que ele
  // escreveu o que não escreveu é o tipo de detalhe que denuncia automação.
  const chave = palavra.trim();
  const abertura = chave
    ? `Oi! Vi seu "${chave}" no post.`
    : 'Oi! Vi seu comentário no post.';

  if (!produto) {
    return [
      abertura,
      '',
      'Me diz qual modelo te interessou que eu te mando o link e as condições.',
    ].join('\n');
  }

  const preco = produto.promo_price ?? produto.price;

  // A ficha só entra com o que o nome ainda não disse. No catálogo da loja o
  // nome costuma trazer tudo — "Alienware Area-51 16" — RTX 5080 · Core Ultra
  // 9 · 32GB · 2TB" — e repetir embaixo faz a mensagem parecer automática,
  // que é justamente o que ela não pode parecer no direct de um cliente.
  const nomeNormalizado = produto.name.toLowerCase();
  const ficha = [produto.cpu, produto.gpu, produto.ram, produto.storage]
    .filter((item): item is string => Boolean(item))
    .filter((item) => !nomeNormalizado.includes(item.toLowerCase()))
    .join(' · ');

  const linhas = [abertura, ''];
  linhas.push(produto.name);
  if (ficha) linhas.push(ficha);
  if (preco) linhas.push(`${formatBRL(preco)}${produto.condition ? ` · ${produto.condition}` : ''}`);
  linhas.push('', linkDoProduto(produto.sku, base), '', 'Qualquer dúvida é só responder por aqui.');

  return linhas.join('\n');
}
