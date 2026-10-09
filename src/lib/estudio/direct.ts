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

/** Acha a palavra que a peça mandou comentar.
 *
 *  Procura no que está escrito na arte e na legenda, porque a chamada pode
 *  estar em qualquer um dos dois. Devolve vazio quando não acha — e aí a tela
 *  pergunta em vez de inventar uma palavra que o post não pediu. */
export function palavraChaveDa(conteudo: Record<string, string>, legenda: string): string {
  const textos = [...Object.values(conteudo), legenda].filter(Boolean);
  for (const texto of textos) {
    // Aceita com e sem aspas, retas ou curvas: a arte usa curvas, o formulário
    // costuma receber retas.
    const m = texto.match(/comente\s*[:\-]?\s*["“'']?([\p{Lu}][\p{Lu}\p{N}]{2,14})["”'']?/u);
    if (m) return m[1];
  }
  return '';
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
  const chave = palavra.trim() || 'QUERO';

  if (!produto) {
    return [
      `Oi! Vi seu "${chave}" no post.`,
      '',
      'Me diz qual modelo te interessou que eu te mando o link e as condições.',
    ].join('\n');
  }

  const preco = produto.promo_price ?? produto.price;
  const ficha = [produto.cpu, produto.gpu, produto.ram, produto.storage]
    .filter(Boolean)
    .join(' · ');

  const linhas = [`Oi! Vi seu "${chave}" no post.`, ''];
  linhas.push(produto.name);
  if (ficha) linhas.push(ficha);
  if (preco) linhas.push(`${formatBRL(preco)}${produto.condition ? ` · ${produto.condition}` : ''}`);
  linhas.push('', linkDoProduto(produto.sku, base), '', 'Qualquer dúvida é só responder por aqui.');

  return linhas.join('\n');
}
