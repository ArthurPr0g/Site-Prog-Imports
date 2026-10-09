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
  // `naoRedigir` existe para o que tem fonte e não pode ser opinião da IA: a
  // fonte de uma notícia vem da pauta, e uma redação que a escrevesse estaria
  // inventando de onde a informação veio.
  return modelo.campos.filter((c) => TIPOS_REDIGIVEIS.has(c.tipo) && !c.naoRedigir);
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
- SÉRIE: a única série da marca é "Teste de Fogo" (reviews com benchmark). Não invente série, quadro, número de episódio nem temporada. Se o assunto não for um Teste de Fogo, o campo de série vai como string vazia.
- RUMOR NÃO É FATO. Se o assunto vem de relato, vazamento ou rumor — sinais: "diz relatório", "segundo", "rumor", "teria", "deve", "pode", "reportedly" —, escreva como relato: "deve chegar", "segundo relatos", "pode ganhar". Nunca como data ou recurso confirmado. Não cite o veículo se o assunto não citar. Prometer um lançamento que a fabricante não confirmou é a promessa que alguém cobra depois.

COMO ESCREVER CADA CAMPO
- Respeite o limite de palavras quando ele vier. Limite é teto, não meta: título bom costuma ser mais curto que o teto.
- Rótulo e etiqueta são de uma linha, sem ponto final.
- Título carrega a ideia inteira; subtítulo explica, não repete.
- Chamada para ação é verbo: "Fale no WhatsApp", "Veja no site". Não "clique aqui".
- Campo que não faz sentido para o assunto volta como string vazia. Vazio é melhor que enchimento — o dono prefere preencher um campo a apagar uma frase inventada.`;

/** Um produto do catálogo, do jeito que o modelo de linguagem precisa ver para
 *  escolher: curto, com o que distingue uma máquina da outra. */
export type ProdutoParaEscolha = {
  id: string;
  nome: string;
  ficha: string;
  preco: string;
  estoque: number;
};

/** O modelo escolhe o produto? Só quando o produto é cenário.
 *
 *  Em peça de venda a máquina é a decisão comercial, e ela é do dono. Em peça
 *  de conteúdo — prova social, capa de série, carrossel educativo — o produto
 *  só ilustra, e escolher à mão é trabalho sem decisão. */
export function modeloEscolheOProduto(modelo: Modelo): boolean {
  const temCampoDeProduto = modelo.campos.some((c) => c.tipo === 'produto');
  return temCampoDeProduto && !modelo.produtoEhOAssunto;
}

/** A instrução daquela peça, montada a partir dos campos declarados. */
export function instrucaoDoModelo(
  modelo: Modelo,
  assunto: string,
  contexto: { produtos?: ProdutoParaEscolha[]; produtoEscolhido?: string | null } = {}
): string {
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

  const partes = [
    `PEÇA: ${modelo.nome} (${modelo.descricao})`,
    `FORMATO: ${modelo.formato}${modelo.slides > 1 ? `, ${modelo.slides} slides` : ''}`,
    `SUPERFÍCIE: ${modelo.superficie === 'claro' ? 'clara (marfim)' : 'escura (ônix)'}`,
  ].join('\n');

  const blocos = [partes];

  // O produto que o dono já escolheu entra como fato, não como sugestão: sem
  // isto a escrita acontecia às cegas e podia produzir um título falando de
  // uma máquina enquanto a ficha, vinda do cadastro, falava de outra.
  if (contexto.produtoEscolhido) {
    blocos.push(
      `MÁQUINA DESTA PEÇA (já escolhida pelo dono — escreva sobre ela, não sobre outra):\n${contexto.produtoEscolhido}`
    );
  }

  if (contexto.produtos?.length) {
    const catalogo = contexto.produtos
      .map((p) => `- ${p.id} · ${p.nome} · ${p.ficha} · ${p.preco}${p.estoque > 0 ? ' · em estoque' : ''}`)
      .join('\n');
    blocos.push(
      `CATÁLOGO DA LOJA — escolha UMA máquina para ilustrar esta peça:\n${catalogo}\n\nNesta peça o produto é cenário, não o assunto: escolha a que mais combina com o texto que você vai escrever. Prefira a que está em estoque. Devolva o id exato em "produtoId". Se nenhuma combinar, devolva "produtoId" vazio.`
    );
  }

  blocos.push(`ASSUNTO QUE O DONO MANDOU:\n${assunto}`);
  blocos.push(`CAMPOS A PREENCHER:\n${lista}`);
  blocos.push(
    'Chame a ferramenta "preencher" com um valor para cada campo. Campo que não faz sentido para este assunto vai como string vazia.'
  );

  return blocos.join('\n\n');
}

/** O esquema da ferramenta, montado dos campos do modelo.
 *
 *  Pedir JSON em texto e depois procurar as chaves funcionava na maioria das
 *  vezes e falhava sem aviso no resto — e a primeira tentativa nem chegou lá:
 *  ela forçava o formato começando a resposta do assistente com `{`, e o modelo
 *  recusou ("does not support assistant message prefill"). Com ferramenta, o
 *  formato é contrato da API: ou vem no esquema, ou não vem. */
export function ferramentaDoModelo(modelo: Modelo) {
  const propriedades: Record<string, { type: 'string'; description: string }> = {};
  for (const c of camposRedigiveis(modelo)) {
    const partes = [c.rotulo];
    if (c.maxPalavras) partes.push(`no máximo ${c.maxPalavras} palavras`);
    if (c.slide) partes.push(`slide ${c.slide}`);
    if (c.ajuda) partes.push(c.ajuda);
    propriedades[c.chave] = { type: 'string', description: partes.join(' — ') };
  }

  // `produtoId` entra no mesmo esquema, e não numa segunda chamada: a escolha
  // da máquina e o texto que fala dela são a mesma decisão. Separar em duas
  // chamadas deixaria o texto ser escrito antes de a máquina existir — que é
  // exatamente o defeito que isto veio corrigir.
  if (modeloEscolheOProduto(modelo)) {
    propriedades.produtoId = {
      type: 'string',
      description: 'O id, exatamente como veio no catálogo, da máquina que ilustra esta peça. Vazio se nenhuma combinar.',
    };
  }

  return {
    name: 'preencher',
    description: 'Preenche os campos de texto da peça.',
    input_schema: { type: 'object' as const, properties: propriedades },
  };
}

/** O id do produto que a resposta escolheu, conferido contra o catálogo.
 *
 *  Conferir não é zelo: id inventado viraria `product_id` apontando para
 *  nada, e a peça salvaria com uma referência quebrada. */
export function produtoEscolhido(bruto: unknown, idsValidos: Set<string>): string | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const id = (bruto as Record<string, unknown>).produtoId;
  return typeof id === 'string' && idsValidos.has(id) ? id : null;
}

/** Fica só com as chaves que o modelo declarou, e só com strings.
 *
 *  O que volta de um modelo de linguagem é texto, não contrato: chave inventada,
 *  número no lugar de string e objeto aninhado são todos possíveis. Peneirar
 *  aqui é o que impede uma resposta torta de virar campo fantasma no formulário
 *  ou `[object Object]` desenhado na arte. */
/** Troca o `\n` escrito como texto por quebra de linha de verdade.
 *
 *  O modelo de linguagem às vezes devolve a quebra como os dois caracteres
 *  barra e n — a ajuda do campo diz "quebre com Enter", e dentro de uma string
 *  JSON a resposta escapa o Enter. O resultado desenhado na arte era
 *  "Como funciona\na importação", com a barra e o n visíveis, e o texto nem
 *  quebrava. Normalizar aqui, na entrada, em vez de confiar que a próxima
 *  resposta venha certa. */
export function semEscapes(texto: string): string {
  return texto.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, ' ');
}

export function peneirar(bruto: unknown, modelo: Modelo): Record<string, string> {
  if (!bruto || typeof bruto !== 'object') return {};
  const permitidas = new Set(camposRedigiveis(modelo).map((c) => c.chave));
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(bruto as Record<string, unknown>)) {
    if (!permitidas.has(chave)) continue;
    if (typeof valor !== 'string') continue;
    const limpo = semEscapes(valor).trim();
    if (limpo) saida[chave] = limpo;
  }
  return saida;
}

// Havia aqui um `lerJson` que recortava o objeto entre a primeira e a última
// chave do texto. Saiu junto com a tentativa de pedir JSON em prosa: com
// ferramenta, o que volta já é objeto, e peneirar continua necessário porque o
// esquema garante o formato e não o conteúdo.

/* ----------------------------------------------------------------- legenda */

// A legenda é outro ofício, e por isso tem voz própria.
//
// A arte não aceita emoji, hashtag nem markdown: o texto vai para um canvas, e
// cerquilha aparece desenhada. A legenda é o contrário — ela vive no campo de
// texto do aplicativo, e sem hashtag ninguém de fora do perfil encontra o
// post. Usar o mesmo prompt para as duas coisas produziria ou arte suja ou
// legenda muda.
//
// A estrutura não é pedida em prosa: a ferramenta devolve gancho, fatos,
// chamada e hashtags em campos separados, e a montagem acontece aqui. Assim
// "três fatos" é contagem de array, não uma recomendação que o modelo segue na
// maioria das vezes.

export const VOZ_DA_LEGENDA = `Você escreve as legendas de Instagram da Prog Imports, uma loja brasileira que importa tecnologia dos Estados Unidos — MacBooks, iPhones, iPads, notebooks gamer e de trabalho, monitores e periféricos.

O TOM
- Português do Brasil, direto, adulto. Quem lê está considerando gastar vários milhares de reais e já pesquisou antes de chegar aqui.
- Frase curta, uma ideia por linha. Nada de "incrível", "imperdível", "corra", "não perca", "garanta já".
- Emoji: no máximo um, e só se ele substituir uma palavra. Legenda de loja séria não é enfeitada.
- Nunca escreva em CAIXA ALTA para dar ênfase.

O QUE NÃO INVENTAR — esta é a regra que importa
- Preço, parcela, desconto, prazo, frete, garantia e especificação técnica só entram se vierem nos DADOS CONFERIDOS abaixo. Eles saem do cadastro do produto. Inventar um preço numa legenda é pior que inventar numa arte: a legenda é o que o cliente copia e cobra depois.
- Se não houver número conferido para um fato, escreva um fato sem número em vez de estimar.
- Não prometa estoque nem data de entrega que não esteja nos dados.
- RUMOR NÃO É FATO. Se o ASSUNTO vem de relato, vazamento ou rumor ("diz relatório", "segundo", "rumor", "deve", "pode", "reportedly"), a legenda escreve no condicional ou com atribuição — "deve chegar em 27 de outubro, segundo relatos" — e nunca como fato confirmado. Só cite o veículo se o assunto citar. A loja não anuncia o que a fabricante não anunciou.

A FORMA (do playbook)
- Gancho: a primeira linha, no máximo 8 palavras. É a única que aparece antes do "mais" — ela precisa funcionar sozinha.
- Fatos: exatamente três linhas. Cada uma com um motivo concreto; use número sempre que houver um conferido.
- Chamada: uma linha, começando por verbo — "Chame no WhatsApp", "Veja no site". Nunca "clique aqui" nem "link na bio" sem o verbo.
- Hashtags: de 3 a 5, de nicho. #macbookprom4 e #notebookgamerimportado encontram cliente; #tecnologia e #promocao não encontram ninguém. Sem a cerquilha na resposta: devolva só a palavra.`;

export type LegendaEscrita = {
  gancho: string;
  fatos: string[];
  chamada: string;
  hashtags: string[];
};

/** A instrução da legenda.
 *
 *  Recebe os campos que já estão na arte porque legenda e arte são lidas
 *  juntas: repetir o título em prosa desperdiça a única linha que aparece
 *  antes do "mais", e contradizê-lo é pior. E recebe os dados do produto
 *  separados, rotulados como conferidos — é o que torna possível citar preço
 *  sem abrir a porta para inventá-lo. */
export function instrucaoDaLegenda(
  modelo: Modelo,
  entrada: { assunto?: string; conteudo: Record<string, string>; produto?: string | null }
): string {
  const naArte = camposRedigiveis(modelo)
    .map((c) => ({ c, valor: entrada.conteudo[c.chave]?.trim() }))
    .filter((x) => x.valor)
    .map((x) => `- ${x.c.rotulo}: ${x.valor}`)
    .join('\n');

  // Só os campos com fonte: preço veio do cadastro, não da redação.
  const conferidos = modelo.campos
    .filter((c) => c.tipo === 'preco' || c.tipo === 'numero')
    .map((c) => ({ c, valor: entrada.conteudo[c.chave]?.trim() }))
    .filter((x) => x.valor)
    .map((x) => `- ${x.c.rotulo}: ${x.valor}`)
    .join('\n');

  const partes = [
    `PEÇA: ${modelo.nome} (${modelo.formato}${modelo.slides > 1 ? `, ${modelo.slides} slides` : ''})`,
  ];
  if (entrada.produto) partes.push(`PRODUTO DO CATÁLOGO:\n${entrada.produto}`);
  if (conferidos) partes.push(`DADOS CONFERIDOS (pode citar; nada além disto):\n${conferidos}`);
  if (naArte) partes.push(`JÁ ESCRITO NA ARTE (não repita literalmente):\n${naArte}`);
  if (entrada.assunto?.trim()) partes.push(`ASSUNTO:\n${entrada.assunto.trim()}`);

  partes.push(
    'Chame a ferramenta "escrever_legenda". Se não houver dado conferido para sustentar um fato, escreva o fato sem número — não estime.'
  );

  return partes.join('\n\n');
}

export const FERRAMENTA_DA_LEGENDA = {
  name: 'escrever_legenda',
  description: 'Escreve a legenda do post no formato do playbook.',
  input_schema: {
    type: 'object' as const,
    properties: {
      gancho: {
        type: 'string' as const,
        description: 'A primeira linha, no máximo 8 palavras. É a única que aparece antes do "mais".',
      },
      fatos: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Exatamente três linhas, uma por motivo concreto. Número só se for conferido.',
      },
      chamada: {
        type: 'string' as const,
        description: 'Uma linha começando por verbo.',
      },
      hashtags: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'De 3 a 5 hashtags de nicho, sem a cerquilha.',
      },
    },
    required: ['gancho', 'fatos', 'chamada', 'hashtags'],
  },
};

function texto(valor: unknown): string {
  return typeof valor === 'string' ? semEscapes(valor).trim() : '';
}

/** Normaliza uma hashtag: sem cerquilha, sem espaço, sem acento.
 *
 *  Acento em hashtag funciona no Instagram, mas divide a audiência entre duas
 *  grafias da mesma palavra — e a busca não junta as duas. */
function hashtag(bruta: unknown): string {
  return texto(bruta)
    .replace(/^#+/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

/** Monta a legenda final a partir do que a ferramenta devolveu.
 *
 *  Devolve string vazia quando falta o gancho: legenda sem primeira linha não
 *  é legenda pela metade, é a parte que não funciona. */
export function montarLegenda(bruto: unknown): string {
  if (!bruto || typeof bruto !== 'object') return '';
  const dados = bruto as Partial<Record<keyof LegendaEscrita, unknown>>;

  const gancho = texto(dados.gancho);
  if (!gancho) return '';

  const fatos = (Array.isArray(dados.fatos) ? dados.fatos : []).map(texto).filter(Boolean).slice(0, 3);
  const chamada = texto(dados.chamada);
  const tags = [...new Set((Array.isArray(dados.hashtags) ? dados.hashtags : []).map(hashtag).filter(Boolean))].slice(0, 5);

  const blocos = [gancho];
  if (fatos.length) blocos.push(fatos.join('\n'));
  if (chamada) blocos.push(chamada);
  if (tags.length) blocos.push(tags.map((t) => `#${t}`).join(' '));

  return blocos.join('\n\n');
}
