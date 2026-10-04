// Catálogo dos modelos do playbook.
//
// Esta lista é a ponte entre o playbook e o sistema: ela diz quais peças
// existem, que campos cada uma pede e o que já vem preenchido do produto. O
// editor monta o formulário a partir daqui, e o desenhista lê os mesmos campos
// — então acrescentar modelo novo é acrescentar uma entrada, não mexer na tela.

import { FEED, STORY, DESTAQUE } from '@/lib/estudio/marca';

export type TipoDeCampo =
  | 'texto'
  | 'textoLongo'
  | 'rotulo'
  | 'preco'
  | 'halo'
  | 'produto'
  | 'imagem'
  | 'numero';

export type Campo = {
  chave: string;
  rotulo: string;
  tipo: TipoDeCampo;
  /** Dica curta no formulário. Carrega a regra do playbook quando ela existe. */
  ajuda?: string;
  /** Quantas palavras o playbook tolera. O editor avisa quando passa. */
  maxPalavras?: number;
  obrigatorio?: boolean;
  /** Em carrossel, de qual slide é o campo. */
  slide?: number;
};

export type Formato = 'feed' | 'story' | 'carrossel' | 'destaque';

export type Modelo = {
  codigo: string;
  /** Tem roteiro de motion escrito. Modelo sem isso so exporta PNG. */
  animado?: boolean;
  nome: string;
  secao: string;
  formato: Formato;
  /** Quantos slides a peça gera. 1 para tudo que não é carrossel. */
  slides: number;
  /** Fundo predominante — o grid do feed alterna claro e escuro. */
  superficie: 'escuro' | 'claro';
  descricao: string;
  campos: Campo[];
};

export const DIMENSOES: Record<Formato, { largura: number; altura: number }> = {
  feed: FEED,
  carrossel: FEED,
  story: STORY,
  destaque: DESTAQUE,
};

/** Campos que quase todo modelo de produto repete. */
const CAMPOS_DE_PRODUTO: Campo[] = [
  { chave: 'produto', rotulo: 'Produto do catálogo', tipo: 'produto', ajuda: 'Puxa nome, specs, preço e a foto já recortada.' },
  { chave: 'halo', rotulo: 'Cor do brilho de fundo', tipo: 'halo', ajuda: 'Acompanha a marca do produto, não a da Prog.' },
];

export const MODELOS: Modelo[] = [
  {
    codigo: '3a',
    animado: true,
    nome: 'Produto — escuro',
    secao: '03 · Posts de feed',
    formato: 'feed',
    slides: 1,
    superficie: 'escuro',
    descricao: 'Tipo gigante atrás, produto saltando por cima. É a peça padrão de lançamento e de pronta entrega.',
    campos: [
      ...CAMPOS_DE_PRODUTO,
      { chave: 'marcaDagua', rotulo: 'Marca d’água atrás', tipo: 'texto', ajuda: 'Duas ou três letras: "9i", "M5", "51".', maxPalavras: 1 },
      { chave: 'etiqueta', rotulo: 'Etiqueta do topo', tipo: 'rotulo', ajuda: 'EXCLUSIVO EUA, PRONTA ENTREGA, NOVO · LACRADO.' },
      { chave: 'sobretitulo', rotulo: 'Linha acima do título', tipo: 'rotulo', ajuda: 'Marca · linha · geração · tamanho.' },
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto', maxPalavras: 6, obrigatorio: true, ajuda: 'Até 6 palavras — o produto precisa ocupar mais área que o texto.' },
      { chave: 'specs', rotulo: 'Specs', tipo: 'rotulo', ajuda: 'Duas linhas em mono. Separe com · e quebre com Enter.' },
      { chave: 'parcela', rotulo: 'Parcelamento', tipo: 'texto' },
      { chave: 'preco', rotulo: 'Preço', tipo: 'preco', obrigatorio: true, ajuda: 'O playbook não aceita peça de produto sem preço visível.' },
      { chave: 'selo', rotulo: 'Selo de desconto', tipo: 'texto', ajuda: 'Ex.: "−15%". Deixe vazio para não desenhar o selo.' },
    ],
  },
  {
    codigo: '3b',
    nome: 'Produto — claro',
    secao: '03 · Posts de feed',
    formato: 'feed',
    slides: 1,
    superficie: 'claro',
    descricao: 'Packshot em marfim com callouts técnicos ligados ao aparelho por uma linha.',
    campos: [
      ...CAMPOS_DE_PRODUTO,
      { chave: 'marcaDagua', rotulo: 'Marca d’água atrás', tipo: 'texto', maxPalavras: 1 },
      { chave: 'etiqueta', rotulo: 'Etiqueta do topo', tipo: 'rotulo' },
      { chave: 'sobretitulo', rotulo: 'Linha acima do título', tipo: 'rotulo' },
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto', maxPalavras: 6, obrigatorio: true },
      { chave: 'subtitulo', rotulo: 'Configuração', tipo: 'texto', ajuda: 'Ex.: 32 GB · 1 TB · Preto-espacial.' },
      { chave: 'callout1', rotulo: 'Callout 1', tipo: 'texto', ajuda: 'Duas linhas curtas em mono. Quebre com Enter.' },
      { chave: 'callout2', rotulo: 'Callout 2', tipo: 'texto' },
      { chave: 'parcela', rotulo: 'Parcelamento', tipo: 'texto' },
      { chave: 'preco', rotulo: 'Preço', tipo: 'preco', obrigatorio: true },
    ],
  },
  {
    codigo: '3c',
    animado: true,
    nome: 'Oferta',
    secao: '03 · Posts de feed',
    formato: 'feed',
    slides: 1,
    superficie: 'escuro',
    descricao: 'Produto sangrando na borda, preço cortado e preço novo em ouro, CTA para o WhatsApp.',
    campos: [
      ...CAMPOS_DE_PRODUTO,
      { chave: 'etiqueta', rotulo: 'Rótulo do topo', tipo: 'rotulo', ajuda: 'OFERTA DA SEMANA, ÚLTIMA UNIDADE.' },
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto', maxPalavras: 4, obrigatorio: true },
      // Chave própria, e não `subtitulo`: no 3B o subtítulo é a configuração
      // ("32 GB · 1 TB"), e com a mesma chave o preenchimento automático
      // mandava a ficha técnica para a segunda linha gigante do título.
      { chave: 'tituloLinha2', rotulo: 'Segunda linha do título', tipo: 'texto', ajuda: 'Sai em cinza, abaixo do título. Ex.: 16".' },
      { chave: 'precoDe', rotulo: 'Preço antigo', tipo: 'preco', ajuda: 'Sai riscado ao lado do novo.' },
      { chave: 'preco', rotulo: 'Preço com desconto', tipo: 'preco', obrigatorio: true },
      { chave: 'selo', rotulo: 'Selo de desconto', tipo: 'texto', ajuda: 'Ex.: "12%". Vazio não desenha o selo.' },
      { chave: 'rodape', rotulo: 'Linha do rodapé', tipo: 'rotulo', ajuda: 'Placa, parcelamento e prazo: RTX 5080 · 3× R$ 7.666 · PRONTA ENTREGA.' },
      { chave: 'cta', rotulo: 'Chamada', tipo: 'texto', ajuda: 'Ex.: WhatsApp →' },
    ],
  },
  {
    codigo: '3d',
    nome: 'Prova social',
    secao: '03 · Posts de feed',
    formato: 'feed',
    slides: 1,
    superficie: 'claro',
    descricao: 'Depoimento de cliente com o produto saindo da moldura e a nota do site.',
    campos: [
      ...CAMPOS_DE_PRODUTO,
      // Chave própria em vez de `etiqueta`: aqui o rótulo do topo é a promessa
      // de confiança, não a condição do produto. Com a chave compartilhada o
      // preenchimento automático trocava "Quem compra, confia" por "Pronta
      // entrega", que é verdade mas não é o que esta peça está dizendo.
      { chave: 'chamada', rotulo: 'Rótulo do topo', tipo: 'rotulo', ajuda: 'Quem compra, confia.' },
      { chave: 'nota', rotulo: 'Nota', tipo: 'texto', ajuda: 'Ex.: 4,9' },
      { chave: 'avaliacoes', rotulo: 'Quantidade de avaliações', tipo: 'texto', ajuda: 'Ex.: 23 avaliações no site.' },
      { chave: 'depoimento', rotulo: 'Depoimento', tipo: 'textoLongo', obrigatorio: true, ajuda: 'Frase do cliente, entre aspas.' },
      { chave: 'autor', rotulo: 'Assinatura', tipo: 'texto', ajuda: '— Lucas T., comprou Alienware Area-51.' },
    ],
  },
  {
    codigo: '3e',
    nome: 'Capa de Reels',
    secao: '03 · Posts de feed',
    formato: 'story',
    slides: 1,
    superficie: 'escuro',
    descricao: '1080×1920 com o essencial dentro do corte 4:5 — a capa precisa funcionar no grid do perfil.',
    campos: [
      ...CAMPOS_DE_PRODUTO,
      { chave: 'marcaDagua', rotulo: 'Marca d’água atrás', tipo: 'texto', ajuda: 'Ex.: "VS".', maxPalavras: 1 },
      { chave: 'etiqueta', rotulo: 'Série e episódio', tipo: 'rotulo', ajuda: 'TESTE DE FOGO · EP. 04.' },
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto', maxPalavras: 6, obrigatorio: true },
      { chave: 'subtitulo', rotulo: 'Linha de apoio', tipo: 'texto' },
    ],
  },
  {
    codigo: '4a',
    nome: 'Carrossel educativo',
    secao: '04 · Carrosséis',
    formato: 'carrossel',
    slides: 5,
    superficie: 'escuro',
    descricao: '"Como funciona a importação" em 5 slides. Uma ideia por slide, linha dourada de progresso no rodapé.',
    campos: [
      ...CAMPOS_DE_PRODUTO,
      { chave: 'capaTitulo', rotulo: 'Título da capa', tipo: 'texto', slide: 1, obrigatorio: true, ajuda: 'Quebre com Enter; a última linha sai em ouro.' },
      { chave: 'capaApoio', rotulo: 'Linha de apoio da capa', tipo: 'texto', slide: 1 },
      { chave: 'perguntaCliente', rotulo: 'Pergunta do cliente', tipo: 'texto', slide: 2, ajuda: 'Balão claro, como no WhatsApp.' },
      { chave: 'respostaProg', rotulo: 'Resposta da Prog', tipo: 'texto', slide: 2, ajuda: 'Balão dourado.' },
      { chave: 'slide2Titulo', rotulo: 'Título do slide 2', tipo: 'texto', slide: 2 },
      { chave: 'slide2Apoio', rotulo: 'Apoio do slide 2', tipo: 'texto', slide: 2 },
      { chave: 'etapa2', rotulo: 'Etapa 02 — título', tipo: 'texto', slide: 3 },
      { chave: 'etapa2Apoio', rotulo: 'Etapa 02 — descrição', tipo: 'texto', slide: 3 },
      { chave: 'etapa3', rotulo: 'Etapa 03 — título', tipo: 'texto', slide: 3 },
      { chave: 'etapa3Apoio', rotulo: 'Etapa 03 — descrição', tipo: 'texto', slide: 3 },
      { chave: 'precoVarejo', rotulo: 'Preço no varejo BR', tipo: 'preco', slide: 4 },
      { chave: 'precoProg', rotulo: 'Preço na Prog', tipo: 'preco', slide: 4 },
      { chave: 'slide4Titulo', rotulo: 'Título do slide 4', tipo: 'texto', slide: 4 },
      { chave: 'fechamentoTitulo', rotulo: 'Título do fechamento', tipo: 'texto', slide: 5 },
      { chave: 'fechamentoApoio', rotulo: 'Apoio do fechamento', tipo: 'texto', slide: 5 },
      // O slide de fechamento mostra a prateleira, e prateleira com três vezes
      // o mesmo aparelho não é prateleira. Dois produtos a mais só para ele.
      { chave: 'produtoA', rotulo: 'Segunda máquina da vitrine', tipo: 'produto', slide: 5, ajuda: 'Só aparece no slide de fechamento.' },
      { chave: 'produtoB', rotulo: 'Terceira máquina da vitrine', tipo: 'produto', slide: 5 },
    ],
  },
  {
    codigo: '4b',
    nome: 'Carrossel de lançamento',
    secao: '04 · Carrosséis',
    formato: 'carrossel',
    slides: 4,
    superficie: 'escuro',
    descricao: 'Produto em todos os slides, mudando o ângulo. Specs no 2, preço no 3, lista VIP no 4.',
    campos: [
      ...CAMPOS_DE_PRODUTO,
      { chave: 'etiqueta', rotulo: 'Rótulo do topo', tipo: 'rotulo', slide: 1, ajuda: 'LANÇAMENTO · EUA.' },
      { chave: 'capaTitulo', rotulo: 'Título da capa', tipo: 'texto', slide: 1, obrigatorio: true },
      { chave: 'capaApoio', rotulo: 'Apoio da capa', tipo: 'texto', slide: 1 },
      { chave: 'comparativo', rotulo: 'Tabela comparativa', tipo: 'textoLongo', slide: 2, ajuda: 'Uma linha por spec: "GPU; 5070; 5080; 5090".' },
      { chave: 'notaTabela', rotulo: 'Ressalva da tabela', tipo: 'rotulo', slide: 2, ajuda: 'CONFIGURAÇÕES DE REFERÊNCIA · CONFIRMAR NA COTAÇÃO.' },
      { chave: 'precos', rotulo: 'Lista de preços', tipo: 'textoLongo', slide: 3, ajuda: 'Uma linha por modelo: "Legion 5i; R$ 10.999".' },
      { chave: 'notaPreco', rotulo: 'Ressalva do preço', tipo: 'texto', slide: 3 },
      { chave: 'vipTitulo', rotulo: 'Título da lista VIP', tipo: 'texto', slide: 4 },
      { chave: 'vipApoio', rotulo: 'Apoio da lista VIP', tipo: 'texto', slide: 4 },
      { chave: 'palavraChave', rotulo: 'Palavra do CTA', tipo: 'texto', slide: 4, ajuda: 'Ex.: QUERO.' },
    ],
  },
  {
    codigo: '5a',
    animado: true,
    nome: 'Story de venda',
    secao: '05 · Stories',
    formato: 'story',
    slides: 1,
    superficie: 'escuro',
    descricao: 'Produto, preço e um CTA de resposta. É o modelo animado do playbook.',
    campos: [
      ...CAMPOS_DE_PRODUTO,
      { chave: 'etiqueta', rotulo: 'Rótulo do topo', tipo: 'rotulo', ajuda: 'CHEGOU · PRONTA ENTREGA.' },
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto', maxPalavras: 5, obrigatorio: true },
      { chave: 'specs', rotulo: 'Specs', tipo: 'rotulo' },
      { chave: 'preco', rotulo: 'Preço', tipo: 'preco', obrigatorio: true },
      { chave: 'cta', rotulo: 'Chamada', tipo: 'texto', ajuda: 'Ex.: Responda "QUERO" →' },
    ],
  },
  {
    codigo: '5b',
    nome: 'Story de enquete',
    secao: '05 · Stories',
    formato: 'story',
    slides: 1,
    superficie: 'escuro',
    descricao: 'Dois produtos lado a lado com o VS no meio. O sticker nativo de enquete entra por cima na hora de postar.',
    campos: [
      { chave: 'etiqueta', rotulo: 'Rótulo do topo', tipo: 'rotulo', ajuda: 'VOCÊ DECIDE · PRÓXIMO TESTE.' },
      { chave: 'titulo', rotulo: 'Pergunta', tipo: 'texto', obrigatorio: true },
      { chave: 'produtoA', rotulo: 'Produto da esquerda', tipo: 'produto' },
      { chave: 'rotuloA', rotulo: 'Nome da esquerda', tipo: 'rotulo' },
      { chave: 'haloA', rotulo: 'Brilho da esquerda', tipo: 'halo' },
      { chave: 'produtoB', rotulo: 'Produto da direita', tipo: 'produto' },
      { chave: 'rotuloB', rotulo: 'Nome da direita', tipo: 'rotulo' },
      { chave: 'haloB', rotulo: 'Brilho da direita', tipo: 'halo' },
    ],
  },
  {
    codigo: '5c',
    nome: 'Story de caixinha',
    secao: '05 · Stories',
    formato: 'story',
    slides: 1,
    superficie: 'claro',
    descricao: 'Fundo marfim com o logo centralizado e espaço para o sticker de perguntas.',
    campos: [
      { chave: 'titulo', rotulo: 'Convite', tipo: 'texto', obrigatorio: true, ajuda: 'Ex.: Pergunte ao importador.' },
      { chave: 'subtitulo', rotulo: 'Apoio', tipo: 'textoLongo' },
      { chave: 'placeholder', rotulo: 'Texto do sticker', tipo: 'texto', ajuda: 'Ex.: Sua dúvida sobre importação.' },
    ],
  },
  {
    codigo: '5d',
    nome: 'Story de resposta',
    secao: '05 · Stories',
    formato: 'story',
    slides: 1,
    superficie: 'escuro',
    descricao: 'Pergunta do seguidor em cima, resposta grande embaixo, foto de bastidor ao fundo.',
    campos: [
      { chave: 'imagem', rotulo: 'Foto de fundo', tipo: 'imagem', ajuda: 'Foto real do setup. Entra com o degradê por cima.' },
      { chave: 'autorPergunta', rotulo: 'Quem perguntou', tipo: 'rotulo', ajuda: 'PERGUNTA DE @usuario.' },
      { chave: 'pergunta', rotulo: 'Pergunta', tipo: 'texto', obrigatorio: true },
      { chave: 'titulo', rotulo: 'Resposta', tipo: 'texto', obrigatorio: true, ajuda: 'Curta e direta. Quebre com Enter.' },
      { chave: 'subtitulo', rotulo: 'Complemento', tipo: 'texto' },
    ],
  },
  {
    codigo: '5e1',
    nome: 'Destaque — ônix esculpido',
    secao: '05 · Capas de destaque',
    formato: 'destaque',
    slides: 1,
    superficie: 'escuro',
    descricao: 'Disco escuro com luz de canto e ícone fino em ouro. É a direção recomendada: o anel do Instagram já faz a moldura.',
    campos: [
      { chave: 'icone', rotulo: 'Ícone', tipo: 'texto', obrigatorio: true, ajuda: 'package, plane, route, shield-check, message-square-quote, flame, globo.' },
      { chave: 'nome', rotulo: 'Nome do destaque', tipo: 'texto', ajuda: 'Só para você se achar na lista — não é desenhado.' },
    ],
  },
  {
    codigo: '5e2',
    nome: 'Destaque — medalha de metal',
    secao: '05 · Capas de destaque',
    formato: 'destaque',
    slides: 1,
    superficie: 'claro',
    descricao: 'Disco em ouro escovado com ícone ônix. Conversa direto com o acabamento do logo e chama mais atenção.',
    campos: [
      { chave: 'icone', rotulo: 'Ícone', tipo: 'texto', obrigatorio: true },
      { chave: 'nome', rotulo: 'Nome do destaque', tipo: 'texto' },
    ],
  },
  {
    codigo: '5e3',
    nome: 'Destaque — índice técnico',
    secao: '05 · Capas de destaque',
    formato: 'destaque',
    slides: 1,
    superficie: 'escuro',
    descricao: 'Grafite com anel de precisão e numeração em mono. Deixa a ordem do funil explícita.',
    campos: [
      { chave: 'icone', rotulo: 'Ícone', tipo: 'texto', obrigatorio: true },
      { chave: 'numero', rotulo: 'Número', tipo: 'numero', ajuda: 'A ordem do funil: 01 estoque → 07 marca.' },
      { chave: 'nome', rotulo: 'Nome do destaque', tipo: 'texto' },
    ],
  },
];

export function modeloPorCodigo(codigo: string): Modelo | undefined {
  return MODELOS.find((m) => m.codigo === codigo);
}

/** Agrupa para a vitrine de modelos, na ordem do playbook. */
export function modelosPorSecao(): { secao: string; modelos: Modelo[] }[] {
  const mapa = new Map<string, Modelo[]>();
  for (const m of MODELOS) {
    if (!mapa.has(m.secao)) mapa.set(m.secao, []);
    mapa.get(m.secao)!.push(m);
  }
  return Array.from(mapa, ([secao, modelos]) => ({ secao, modelos }));
}
