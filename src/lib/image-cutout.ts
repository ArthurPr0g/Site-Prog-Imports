// Recorte do fundo da foto do produto. Só roda no navegador.
//
// Foto de produto quase sempre vem sobre fundo liso — branco de estúdio ou
// cinza de catálogo. Sobre o cartão escuro da proposta esse retângulo aparece
// como uma mancha, e o produto fica preso dentro de uma caixa dentro de outra.
// Removendo o fundo, o produto passa a flutuar no cartão, que é como as lojas
// grandes apresentam o item.
//
// O recorte resolve o enquadramento junto: depois de tirar o fundo sabemos
// exatamente onde o produto começa e termina, e dá para encaixá-lo na área
// disponível sem cortar nada — que era o problema do enquadramento "cover",
// onde uma foto quadrada numa área larga perdia topo e base.
//
// Preenchimento a partir da borda, e não "toda cor parecida com o fundo": o
// preto do teclado é parecido com um fundo cinza-escuro, mas não está ligado à
// borda, então sobrevive. É essa diferença que separa recorte de destruição.

/** Distância de cor até a qual o pixel é fundo puro. */
const TOLERANCIA_DURA = 30;
/** Até aqui o pixel vira semitransparente, em rampa. É o que evita a borda
 *  serrilhada: foto tem antialiasing, e um corte binário deixaria degraus
 *  brancos ao redor do produto. */
const TOLERANCIA_SUAVE = 70;
/** Divergência máxima entre os cantos para o fundo ser considerado liso. */
const DIVERGENCIA_MAXIMA = 34;
/** Lado máximo processado. Acima disso a imagem é reduzida antes: o custo do
 *  preenchimento cresce com a área, e a proposta não usa mais que isto. */
const LADO_MAXIMO = 1400;

/** Quanto do produto precisa sobrar para o recorte ser confiável. Fora dessa
 *  faixa é sinal de que a heurística errou — fundo que não era liso, ou produto
 *  da mesma cor do fundo — e a foto original é melhor que um recorte quebrado. */
const AREA_MINIMA = 0.04;
const AREA_MAXIMA = 0.97;

function distancia(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  // Distância euclidiana em RGB. Não é perceptual, mas para fundo liso contra
  // produto a diferença é grande o bastante para não precisar de Lab.
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Recorta o produto da foto. Devolve `null` quando o fundo não é liso o
 *  suficiente — aí quem chama usa a imagem original. */
export function recortarProduto(img: HTMLImageElement): HTMLCanvasElement | null {
  if (!img.width || !img.height) return null;

  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * escala));
  const h = Math.max(1, Math.round(img.height * escala));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let dados: ImageData;
  try {
    dados = ctx.getImageData(0, 0, w, h);
  } catch {
    // Canvas contaminado: a foto veio sem CORS. Sem leitura não há recorte.
    return null;
  }
  const px = dados.data;

  // --- a cor do fundo, pelos quatro cantos ---------------------------------
  const cantos = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
  ].map(([x, y]) => {
    const i = (y * w + x) * 4;
    return [px[i], px[i + 1], px[i + 2]] as const;
  });

  const fundo = [0, 1, 2].map((c) => cantos.reduce((s, k) => s + k[c], 0) / cantos.length);
  const divergencia = Math.max(
    ...cantos.map((k) => distancia(k[0], k[1], k[2], fundo[0], fundo[1], fundo[2]))
  );
  // Cantos que discordam = foto de ambiente, não de catálogo. Recortar aí come
  // pedaço do cenário e às vezes do produto.
  if (divergencia > DIVERGENCIA_MAXIMA) return null;

  // --- preenchimento a partir da borda --------------------------------------
  const visitado = new Uint8Array(w * h);
  const pilha: number[] = [];

  for (let x = 0; x < w; x++) {
    pilha.push(x, x + (h - 1) * w);
  }
  for (let y = 0; y < h; y++) {
    pilha.push(y * w, w - 1 + y * w);
  }

  while (pilha.length) {
    const p = pilha.pop() as number;
    if (visitado[p]) continue;

    const i = p * 4;
    const d = distancia(px[i], px[i + 1], px[i + 2], fundo[0], fundo[1], fundo[2]);
    if (d >= TOLERANCIA_SUAVE) continue;

    visitado[p] = 1;

    if (d <= TOLERANCIA_DURA) {
      px[i + 3] = 0;
    } else {
      // Rampa: quanto mais longe do fundo, mais opaco. Aqui a expansão para —
      // esta é a borda do produto, e atravessá-la comeria o contorno.
      px[i + 3] = Math.round(((d - TOLERANCIA_DURA) / (TOLERANCIA_SUAVE - TOLERANCIA_DURA)) * 255);
      continue;
    }

    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) pilha.push(p - 1);
    if (x < w - 1) pilha.push(p + 1);
    if (y > 0) pilha.push(p - w);
    if (y < h - 1) pilha.push(p + w);
  }

  // --- o que sobrou vale a pena? --------------------------------------------
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let opacos = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 24) {
        opacos++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const proporcao = opacos / (w * h);
  if (maxX < 0 || proporcao < AREA_MINIMA || proporcao > AREA_MAXIMA) return null;

  // --- recorta na caixa do produto ------------------------------------------
  ctx.putImageData(dados, 0, 0);

  const larguraProduto = maxX - minX + 1;
  const alturaProduto = maxY - minY + 1;
  const recorte = document.createElement('canvas');
  recorte.width = larguraProduto;
  recorte.height = alturaProduto;
  const ctxRecorte = recorte.getContext('2d');
  if (!ctxRecorte) return null;
  ctxRecorte.drawImage(canvas, minX, minY, larguraProduto, alturaProduto, 0, 0, larguraProduto, alturaProduto);

  return recorte;
}
