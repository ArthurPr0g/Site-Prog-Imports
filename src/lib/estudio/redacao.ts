// Escrever a peça a partir de um assunto.
//
// É a metade do Estúdio que faltava. O preenchimento automático que já existia
// sai do **cadastro do produto** — resolve peça de venda, onde título, specs e
// preço têm fonte, e não resolve peça de conteúdo: prova social, carrossel de
// guia, enquete e caixinha de perguntas não têm produto de onde puxar, e vinham
// sendo digitadas na mão.
//
// Aqui o ponto de partida é um assunto em uma linha ("por que importar sai mais
// barato", "enquete entre o Legion e o ROG") e o que volta são os campos daquele
// modelo, preenchidos no tom da marca.
//
// O contrato sai dos próprios campos do modelo, e não de uma lista escrita à
// mão: `modelos.ts` já declara chave, rótulo, ajuda e limite de palavras de cada
// campo. Modelo novo passa a ser redigível no dia em que é cadastrado, sem
// ninguém lembrar de atualizar um segundo lugar.

import type { Modelo, Campo } from '@/lib/estudio/modelos';

/** Tipos de campo que se escrevem. Fora daqui ficam `produto`, `imagem` e
 *  `halo`, que são escolhas na tela, e `preco`, que é o motivo da regra abaixo. */
const TIPOS_REDIGIVEIS = new Set(['texto', 'textoLongo', 'rotulo', 'numero']);

export function camposRedigiveis(modelo: Modelo): Campo[] {
  return modelo.campos.filter((c) => TIPOS_REDIGIVEIS.has(c.tipo));
}

/** O tom da marca, em regras verificáveis.
 *
 *  Vem do playbook e da skill `direcao-de-arte`. São regras e não adjetivos de
 *  propósito: "seja premium" não dá para conferir, "no máximo 6 palavras" dá. */
export const VOZ = `Você escreve as artes de Instagram da Prog Imports, uma loja brasileira que importa tecnologia dos Estados Unidos — MacBooks, iPhones, iPads, notebooks gamer e de trabalho, monitores e periféricos.

O TOM
- Português do Brasil, direto, adulto. A marca vende máquina cara: fala com quem já sabe o que quer.
- Frase curta. Nada de "incrível", "imperdível", "corra", "não perca". Entusiasmo em maiúscula e exclamação é o oposto do que a marca comunica.
- Zero emoji, zero hashtag, zero markdown. O texto vai ser desenhado num canvas: asterisco e cerquilha aparecem literalmente na arte.
- Nunca prometa prazo, frete, garantia ou condição que não esteja no assunto que o dono mandou.

O QUE NÃO INVENTAR
- NUNCA escreva preço, parcela, porcentagem de desconto ou especificação técnica que não venha no assunto. Esses campos saem do cadastro do produto, não da sua cabeça. Se um campo pede preço e o assunto não traz, devolva string vazia.
- Nome de produto só se o assunto citar. Não suponha modelo, geração nem configuração.

COMO ESCREVER CADA CAMPO
- Respeite o limite de palavras quando ele vier. Limite é teto, não meta: título bom costuma ser mais curto que o teto.
- Rótulo e etiqueta são de uma linha, sem ponto final.
- Título carrega a ideia inteira; subtítulo explica, não repete.
- Chamada para ação é verbo: "Fale no WhatsApp", "Veja no site". Não "clique aqui".
- Campo que não faz sentido para o assunto volta como string vazia. Vazio é melhor que enchimento — o dono prefere preencher um campo a apagar uma frase inventada.`;

/** A instrução daquela peça, montada a partir dos campos declarados. */
export function instrucaoDoModelo(modelo: Modelo, assunto: string): string {
  const campos = camposRedigiveis(modelo);
  const lista = campos
    .map((c) => {
      const partes = [`- "${c.chave}" (${c.rotulo})`];
      if (c.maxPalavras) partes.push(`no máximo ${c.maxPalavras} palavras`);
      if (c.slide) partes.push(`slide ${c.slide}`);
      if (c.ajuda) partes.push(c.ajuda);
      return partes.join(' — ');
    })
    .join('\n');

  return `PEÇA: ${modelo.nome} (${modelo.descricao})
FORMATO: ${modelo.formato}${modelo.slides > 1 ? `, ${modelo.slides} slides` : ''}
SUPERFÍCIE: ${modelo.superficie === 'claro' ? 'clara (marfim)' : 'escura (ônix)'}

ASSUNTO QUE O DONO MANDOU:
${assunto}

CAMPOS A PREENCHER:
${lista}

Responda SOMENTE com um objeto JSON cujas chaves são exatamente as chaves acima e os valores são strings. Sem comentário, sem cerca de código, sem nenhum texto fora do JSON.`;
}

/** Fica só com as chaves que o modelo declarou, e só com strings.
 *
 *  O que volta de um modelo de linguagem é texto, não contrato: chave inventada,
 *  número no lugar de string e objeto aninhado são todos possíveis. Peneirar
 *  aqui é o que impede uma resposta torta de virar campo fantasma no formulário
 *  ou `[object Object]` desenhado na arte. */
export function peneirar(bruto: unknown, modelo: Modelo): Record<string, string> {
  if (!bruto || typeof bruto !== 'object') return {};
  const permitidas = new Set(camposRedigiveis(modelo).map((c) => c.chave));
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(bruto as Record<string, unknown>)) {
    if (!permitidas.has(chave)) continue;
    if (typeof valor !== 'string') continue;
    const limpo = valor.trim();
    if (limpo) saida[chave] = limpo;
  }
  return saida;
}

/** Extrai o JSON da resposta.
 *
 *  Pede-se JSON puro e quase sempre é o que vem; o recorte entre a primeira
 *  chave e a última existe para a vez em que vier embrulhado em cerca de código,
 *  que é a forma mais comum de desobediência e a mais fácil de perdoar. */
export function lerJson(texto: string): unknown {
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}
