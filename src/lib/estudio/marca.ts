// Sistema visual do Instagram da Prog Imports, em código.
//
// Fonte da verdade: o Playbook Instagram v1.0 (out/2026). Tudo que aparece aqui
// está lá — cores, tipografia, grid, regras. Se o playbook mudar, este arquivo
// muda junto e os treze modelos acompanham sozinhos.
//
// Por que canvas e não HTML: os modelos usam contorno de texto, sombra
// projetada, recorte e degradê em texto. Renderizador de HTML para imagem
// (Satori e parentes) não suporta nenhum dos quatro, e o resultado sairia
// diferente do playbook. O projeto já desenha a proposta da loja e a etiqueta
// de envio em canvas — este é o mesmo caminho, no tamanho final, sem servidor.

/* ---------------------------------------------------------------- formatos */

/** Feed: 4:5. O perfil corta para 3:4 — o essencial fica nos 1012px centrais. */
export const FEED = { largura: 1080, altura: 1350 } as const;
/** Story e capa de Reels. */
export const STORY = { largura: 1080, altura: 1920 } as const;
/** Capa de destaque: o disco é centrado num quadrado de 1080. */
export const DESTAQUE = { largura: 1080, altura: 1920 } as const;

export const MARGEM = 72;

/** Faixa vertical que sobrevive ao corte 3:4 do grid do perfil. */
export const CORTE_GRID = { topo: 168, altura: 1012 } as const;

/* ------------------------------------------------------------------ cores */

export const COR = {
  onix: '#0C0C0D',
  grafite: '#18181B',
  grafiteClaro: '#2A2A2E',
  marfim: '#F2EEE7',
  papel: '#E7E1D6',
  papelBorda: '#d6cfc2',
  ouro: '#C9A15A',
  ouroClaro: '#D9B66E',
  bronze: '#8C6A2F',
  prata: '#B9B4AB',
  prataEscura: '#9C978E',
  grafiteTexto: '#6f6a62',
  tintaSecundaria: '#4a4740',
} as const;

/** Brilhos de fundo por família de produto. O playbook usa um halo colorido
 *  atrás do aparelho; a cor acompanha a identidade da marca do produto, não a
 *  da Prog — é o único lugar onde cor fora da paleta entra. */
export const HALO = {
  roxo: 'rgba(124,72,255,',
  magenta: 'rgba(176,70,255,',
  turquesa: 'rgba(54,209,196,',
  rubi: 'rgba(230,40,90,',
  ouro: 'rgba(201,161,90,',
} as const;

export type Halo = keyof typeof HALO;

/* -------------------------------------------------------------- tipografia */

const TITULO = 'Archivo';
const TEXTO = 'Archivo';
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** Largura ótica dos títulos. O playbook pede Archivo Expanded 115%; o eixo
 *  `wdth` da variável entrega isso de verdade onde o navegador suporta
 *  `fontStretch` no canvas, e caímos para escala horizontal onde não. */
const LARGURA_TITULO = 1.15;

export const fonteTitulo = (tamanho: number, peso: 700 | 800 | 900 = 800) =>
  `${peso} ${tamanho}px ${TITULO}`;
export const fonteTexto = (tamanho: number, peso: 400 | 500 | 600 | 700 = 400) =>
  `${peso} ${tamanho}px ${TEXTO}`;
export const fonteMono = (tamanho: number, peso: 400 | 500 | 600 | 700 = 500) =>
  `${peso} ${tamanho}px ${MONO}`;

// `fontStretch` e `letterSpacing` do canvas são recentes: a tipagem do DOM
// aceita só as palavras-chave ("expanded", "condensed"), mas a implementação
// aceita porcentagem, que é o que o playbook pede (115%). Daí o tipo próprio.
export type Figura = HTMLImageElement | HTMLCanvasElement;

export type Ctx = Omit<CanvasRenderingContext2D, 'fontStretch' | 'letterSpacing'> & {
  fontStretch?: string;
  letterSpacing?: string;
};

/** Garante que as fontes estão prontas antes do primeiro traço. Sem isto o
 *  canvas desenha com a fonte de sistema e o PNG sai com outra tipografia —
 *  falha silenciosa, e só aparece quando a peça já está no Instagram.
 *
 *  Resolve uma vez e guarda a promessa. Quem desenha chama isto antes de cada
 *  quadro, e `document.fonts.ready` não é de graça: numa gravação de 60 quadros
 *  por segundo eram 300 esperas pelo mesmo resultado, cada uma empurrando o
 *  desenho para depois do próximo quadro. */
let fontesProntas: Promise<void> | null = null;

export function carregarFontes(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  if (!fontesProntas) {
    fontesProntas = (async () => {
      await Promise.all([
        document.fonts.load('800 104px Archivo'),
        document.fonts.load('400 32px Archivo'),
        document.fonts.load("500 26px 'JetBrains Mono'"),
        document.fonts.load("700 44px 'JetBrains Mono'"),
      ]);
      await document.fonts.ready;
    })();
  }
  return fontesProntas;
}

/** Aplica a largura expandida dos títulos e devolve a função que desfaz. */
function comLarguraDeTitulo(ctx: Ctx): { fatorX: number; desfazer: () => void } {
  if (typeof ctx.fontStretch === 'string') {
    const anterior = ctx.fontStretch;
    ctx.fontStretch = `${Math.round(LARGURA_TITULO * 100)}%`;
    return { fatorX: 1, desfazer: () => { ctx.fontStretch = anterior; } };
  }
  ctx.save();
  ctx.scale(LARGURA_TITULO, 1);
  return { fatorX: LARGURA_TITULO, desfazer: () => ctx.restore() };
}

/* ------------------------------------------------------------ texto básico */

export function espacamento(ctx: Ctx, valor: string): () => void {
  if (typeof ctx.letterSpacing !== 'string') return () => {};
  const anterior = ctx.letterSpacing;
  ctx.letterSpacing = valor;
  return () => { ctx.letterSpacing = anterior; };
}

/** Quebra o texto em até `maxLinhas`, medindo na fonte que já está no contexto. */
export function quebrar(
  ctx: Ctx,
  texto: string,
  largura: number,
  maxLinhas = 4
): string[] {
  // A quebra explícita do autor manda: título de post é escrito para quebrar
  // em lugar certo, e reflow automático estraga o ritmo da frase.
  if (texto.includes('\n')) return texto.split('\n').slice(0, maxLinhas);

  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tentativa).width <= largura || !atual) atual = tentativa;
    else { linhas.push(atual); atual = p; }
    if (linhas.length === maxLinhas) break;
  }
  if (atual && linhas.length < maxLinhas) linhas.push(atual);
  return linhas;
}

/** Título do playbook: Archivo 800, expandido, entrelinha .92, tracking −3.5%.
 *  Devolve a altura ocupada, para quem desenha empilhar o que vem depois. */
export function titulo(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  tamanho: number,
  opcoes: { largura?: number; cor?: string | CanvasGradient; maxLinhas?: number; alinhamento?: CanvasTextAlign } = {}
): number {
  const { largura = FEED.largura - MARGEM * 2, cor = COR.marfim, maxLinhas = 4, alinhamento = 'left' } = opcoes;
  ctx.font = fonteTitulo(tamanho);
  const soltar = espacamento(ctx, `${(-0.035 * tamanho).toFixed(2)}px`);
  const { fatorX, desfazer } = comLarguraDeTitulo(ctx);

  ctx.fillStyle = cor;
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'alphabetic';
  const linhas = quebrar(ctx, texto, largura / fatorX, maxLinhas);
  const entrelinha = tamanho * 0.92;
  linhas.forEach((linha, i) => ctx.fillText(linha, x / fatorX, y + tamanho * 0.78 + i * entrelinha));

  desfazer();
  soltar();
  ctx.textAlign = 'left';
  return linhas.length * entrelinha;
}

/** Rótulo mono em caixa-alta, +12% de tracking — specs, etapas, selos. */
export function rotulo(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  tamanho = 26,
  cor: string = COR.prataEscura,
  alinhamento: CanvasTextAlign = 'left'
): void {
  ctx.font = fonteMono(tamanho);
  const soltar = espacamento(ctx, `${(0.12 * tamanho).toFixed(2)}px`);
  ctx.fillStyle = cor;
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(texto.toUpperCase(), x, y);
  soltar();
  ctx.textAlign = 'left';
}

/** Parágrafo em Archivo regular. Devolve a altura ocupada. */
export function paragrafo(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  tamanho: number,
  opcoes: { largura?: number; cor?: string; maxLinhas?: number; peso?: 400 | 500 | 600 | 700 } = {}
): number {
  const { largura = FEED.largura - MARGEM * 2, cor = COR.prata, maxLinhas = 3, peso = 400 } = opcoes;
  ctx.font = fonteTexto(tamanho, peso);
  ctx.fillStyle = cor;
  ctx.textBaseline = 'alphabetic';
  const linhas = quebrar(ctx, texto, largura, maxLinhas);
  const entrelinha = tamanho * 1.4;
  linhas.forEach((linha, i) => ctx.fillText(linha, x, y + tamanho + i * entrelinha));
  return linhas.length * entrelinha;
}

/* -------------------------------------------------------------- ouro metal */

/** O degradê de ouro escovado do playbook, em 100°. Usado em preço, em palavra
 *  destacada do título e em selo — nunca como fundo inteiro. */
export function ouroMetal(
  ctx: Ctx,
  x: number,
  y: number,
  largura: number,
  altura: number
): CanvasGradient {
  const g = ctx.createLinearGradient(x, y + altura, x + largura, y);
  g.addColorStop(0, '#9A7432');
  g.addColorStop(0.45, '#EBD29A');
  g.addColorStop(0.75, '#B98C3E');
  g.addColorStop(1, '#7E5C24');
  return g;
}

/** Variante para superfície circular (selo de desconto, medalha de destaque). */
export function ouroMedalha(
  ctx: Ctx,
  cx: number,
  cy: number,
  raio: number
): CanvasGradient {
  const g = ctx.createLinearGradient(cx - raio, cy - raio, cx + raio, cy + raio);
  g.addColorStop(0, '#7E5C24');
  g.addColorStop(0.48, '#EBD29A');
  g.addColorStop(0.72, '#B98C3E');
  g.addColorStop(1, '#6E4E1C');
  return g;
}

/* ------------------------------------------------------------ fundo e luz */

export function preencher(ctx: Ctx, cor: string, l: number, a: number): void {
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, l, a);
}

/** Halo colorido atrás do produto. */
export function brilho(
  ctx: Ctx,
  cx: number,
  cy: number,
  raio: number,
  cor: Halo,
  opacidade = 0.3
): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
  g.addColorStop(0, `${HALO[cor]}${opacidade})`);
  g.addColorStop(0.7, `${HALO[cor]}0)`);
  ctx.fillStyle = g;
  ctx.fillRect(cx - raio, cy - raio, raio * 2, raio * 2);
}

/** Sombra de contato sob o produto recortado. Sem ela o aparelho flutua e a
 *  peça perde o peso que o playbook pede. */
export function sombraDeContato(
  ctx: Ctx,
  cx: number,
  cy: number,
  largura: number,
  altura: number,
  opacidade = 0.75
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, altura / largura);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, largura / 2);
  g.addColorStop(0, `rgba(0,0,0,${opacidade})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, largura / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Degradê que apaga o pé da arte para o fundo, abrindo espaço para o texto. */
export function rodapeEsfumado(
  ctx: Ctx,
  cor: string,
  largura: number,
  altura: number,
  alturaDoFade: number,
  parada = 0.42
): void {
  const g = ctx.createLinearGradient(0, altura - alturaDoFade, 0, altura);
  g.addColorStop(0, `${cor}00`);
  g.addColorStop(parada, cor);
  g.addColorStop(1, cor);
  ctx.fillStyle = g;
  ctx.fillRect(0, altura - alturaDoFade, largura, alturaDoFade);
}

/* --------------------------------------------------------------- elementos */

/** Número gigante em contorno, atrás do produto (o "9i", o "VS", o "01"). */
export function marcaDagua(
  ctx: Ctx,
  texto: string,
  cx: number,
  y: number,
  tamanho: number,
  opcoes: { preenchido?: string; traco?: string; espessura?: number } = {}
): void {
  const { preenchido, traco = 'rgba(217,182,110,.45)', espessura = 3 } = opcoes;
  ctx.font = fonteTitulo(tamanho, 900);
  const soltar = espacamento(ctx, `${(-0.06 * tamanho).toFixed(2)}px`);
  const { fatorX, desfazer } = comLarguraDeTitulo(ctx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (preenchido) {
    ctx.fillStyle = preenchido;
    ctx.fillText(texto, cx / fatorX, y);
  } else {
    ctx.lineWidth = espessura;
    ctx.strokeStyle = traco;
    ctx.strokeText(texto, cx / fatorX, y);
  }
  desfazer();
  soltar();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Selo circular de desconto, inclinado, em ouro escovado. */
export function selo(
  ctx: Ctx,
  cx: number,
  cy: number,
  raio: number,
  acima: string,
  valor: string,
  inclinacao = 12
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((inclinacao * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = ouroMedalha(ctx, 0, 0, raio);
  ctx.beginPath();
  ctx.arc(0, 0, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = COR.onix;
  ctx.textAlign = 'center';
  ctx.font = fonteMono(Math.round(raio * 0.17), 600);
  const soltar = espacamento(ctx, `${(raio * 0.02).toFixed(2)}px`);
  ctx.fillText(acima.toUpperCase(), 0, -raio * 0.12);
  soltar();

  ctx.font = fonteTitulo(Math.round(raio * 0.54), 900);
  const { fatorX, desfazer } = comLarguraDeTitulo(ctx);
  ctx.fillText(valor, 0, raio * 0.4 / 1);
  desfazer();
  void fatorX;

  ctx.restore();
  ctx.textAlign = 'left';
}

/** Lockup horizontal da marca: globo + PROG / IMPORTS. 64px de altura é a
 *  regra do playbook para o topo das artes. */
export function lockup(
  ctx: Ctx,
  icone: HTMLImageElement | null,
  x: number,
  y: number,
  altura = 64,
  claro = false
): number {
  let cursor = x;
  if (icone) {
    ctx.drawImage(icone, cursor, y, altura, altura);
    cursor += altura + altura * 0.28;
  }
  const corProg = claro ? COR.bronze : COR.ouroClaro;
  const corImports = claro ? COR.grafiteTexto : COR.prata;

  ctx.font = fonteTitulo(Math.round(altura * 0.47), 700);
  const soltar1 = espacamento(ctx, `${(altura * 0.03).toFixed(2)}px`);
  ctx.fillStyle = corProg;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PROG', cursor, y + altura * 0.44);
  soltar1();

  ctx.font = fonteTitulo(Math.round(altura * 0.19), 700);
  const soltar2 = espacamento(ctx, `${(altura * 0.1).toFixed(2)}px`);
  ctx.fillStyle = corImports;
  ctx.fillText('IMPORTS', cursor, y + altura * 0.82);
  soltar2();

  return cursor + ctx.measureText('IMPORTS').width;
}

/** Caixa com contorno fino — "EXCLUSIVO EUA", "NOVO · LACRADO". */
export function etiqueta(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  opcoes: { cor?: string; tamanho?: number; alinhamento?: 'esquerda' | 'direita' } = {}
): void {
  const { cor = COR.ouro, tamanho = 24, alinhamento = 'esquerda' } = opcoes;
  ctx.font = fonteMono(tamanho);
  const soltar = espacamento(ctx, `${(0.14 * tamanho).toFixed(2)}px`);
  const texto2 = texto.toUpperCase();
  const largura = ctx.measureText(texto2).width + tamanho * 1.7;
  const altura = tamanho * 2.1;
  const esquerda = alinhamento === 'direita' ? x - largura : x;

  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  ctx.strokeRect(esquerda, y, largura, altura);
  ctx.fillStyle = cor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto2, esquerda + largura / 2, y + altura / 2 + 1);
  soltar();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Barra de progresso do carrossel: linha dourada no rodapé. */
export function progresso(
  ctx: Ctx,
  slide: number,
  total: number,
  largura: number,
  altura: number,
  claro = false
): void {
  const y = altura - MARGEM;
  const util = largura - MARGEM * 2;
  if (total <= 1) return;
  const vao = 8;
  const passo = (util - vao * (total - 1)) / total;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < slide ? (claro ? COR.bronze : COR.ouro) : claro ? COR.papelBorda : COR.grafiteClaro;
    ctx.fillRect(MARGEM + i * (passo + vao), y, passo, 4);
  }
}

/** Desenha a imagem do produto encaixada numa caixa, preservando a proporção,
 *  com rotação e sombra projetada. É o gesto que repete em quase todo modelo. */
export function produto(
  ctx: Ctx,
  img: Figura,
  caixa: { x: number; y: number; largura: number; altura: number },
  opcoes: {
    rotacao?: number;
    sombra?: string;
    desfoque?: number;
    /** Fração da base a esconder, 0 a 1. É o `clip-path: inset(0 0 26% 0)` do
     *  playbook: corta a parte de baixo do render para o aparelho nascer de
     *  dentro do degradê do rodapé em vez de flutuar sobre ele. */
    recorteInferior?: number;
  } = {}
): void {
  const { rotacao = 0, sombra = 'rgba(0,0,0,.55)', desfoque = 50, recorteInferior = 0 } = opcoes;
  const escala = Math.min(caixa.largura / img.width, caixa.altura / img.height);
  const l = img.width * escala;
  const a = img.height * escala;
  const cx = caixa.x + caixa.largura / 2;
  const cy = caixa.y + caixa.altura / 2;

  ctx.save();
  ctx.translate(cx, cy);
  if (rotacao) ctx.rotate((rotacao * Math.PI) / 180);
  if (recorteInferior > 0) {
    ctx.beginPath();
    ctx.rect(-l / 2, -a / 2, l, a * (1 - recorteInferior));
    ctx.clip();
  }
  ctx.shadowColor = sombra;
  ctx.shadowBlur = desfoque;
  ctx.shadowOffsetY = desfoque;
  ctx.drawImage(img, -l / 2, -a / 2, l, a);
  ctx.restore();
}

/** Retângulo de cantos arredondados, com raio por canto.
 *
 *  Raio por canto e não um só porque o balão de conversa do playbook tem três
 *  cantos redondos e um vivo — é o vivo que diz de que lado a fala sai. */
export function caminhoArredondado(
  ctx: Ctx,
  x: number,
  y: number,
  l: number,
  a: number,
  raios: [number, number, number, number]
): void {
  const [se, sd, id, ie] = raios.map((r) => Math.min(r, l / 2, a / 2)) as [number, number, number, number];
  ctx.beginPath();
  ctx.moveTo(x + se, y);
  ctx.lineTo(x + l - sd, y);
  ctx.quadraticCurveTo(x + l, y, x + l, y + sd);
  ctx.lineTo(x + l, y + a - id);
  ctx.quadraticCurveTo(x + l, y + a, x + l - id, y + a);
  ctx.lineTo(x + ie, y + a);
  ctx.quadraticCurveTo(x, y + a, x, y + a - ie);
  ctx.lineTo(x, y + se);
  ctx.quadraticCurveTo(x, y, x + se, y);
  ctx.closePath();
}

/** Linha fina de separação, o traço que divide título de ficha técnica. */
export function regua(ctx: Ctx, x: number, y: number, largura: number, cor: string, espessura = 2): void {
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, largura, espessura);
}

/** Texto em mono com várias linhas, a ficha técnica do rodapé. */
export function specs(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  tamanho = 26,
  cor: string = COR.prata
): number {
  const linhas = texto.split('\n').filter(Boolean);
  ctx.font = fonteMono(tamanho);
  const soltar = espacamento(ctx, `${(0.08 * tamanho).toFixed(2)}px`);
  ctx.fillStyle = cor;
  ctx.textBaseline = 'alphabetic';
  const entrelinha = tamanho * 1.6;
  linhas.forEach((linha, i) => ctx.fillText(linha.toUpperCase(), x, y + tamanho + i * entrelinha));
  soltar();
  return linhas.length * entrelinha;
}
