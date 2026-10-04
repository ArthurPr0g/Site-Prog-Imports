// Redução da foto antes do envio. Só roda no navegador.
//
// Foto de celular sai com 12 megapixels e 3 a 8 MB. Nada disso chega ao
// cliente: a vitrine mostra a imagem em algumas centenas de pixels, e o resto é
// banda, armazenamento e espera. Reduzir aqui deixa o upload rápido, o storage
// barato e — o que motivou este arquivo — mantém o arquivo bem abaixo do limite
// de corpo das server actions, que derrubava a tela inteira quando estourado.

/** Lado maior depois da redução.
 *
 *  Era 2560, pelo argumento de que a foto do produto É a vitrine e precisa
 *  aguentar o zoom numa tela de alta densidade. O argumento continua certo; o
 *  número é que estava alto demais para ele.
 *
 *  A conta: a galeria declara `sizes="1080px"` e amplia 1,8× no hover, então o
 *  maior pedido real da página é por volta de 1100px de layout. 1600 cobre isso
 *  com folga, inclusive em tela densa. O que 2560 acrescentava não chegava a
 *  aparecer — as 130 fotos do catálogo somavam 61,6MB e, refeitas em 1600 WebP,
 *  passaram a somar 5,6MB sem diferença visível no zoom (o JPEG de 2560 tinha
 *  até mais granulado no degradê que o WebP de 1600).
 *
 *  Isso importa além da banda: as fotos são servidas sem o otimizador da
 *  Vercel, então o arquivo guardado é exatamente o arquivo entregue. */
const LADO_MAXIMO = 1600;

/** Abaixo disto não vale reprocessar: reencodar uma imagem já pequena só
 *  adiciona perda de qualidade sem ganho de tamanho. */
const TAMANHO_ACEITAVEL = 1200 * 1024;

/** Alta o bastante para não deixar marca visível em foto de produto — fundo
 *  liso e borda de metal são justamente onde a compressão aparece. */
const QUALIDADE = 0.94;

function carregar(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, QUALIDADE));
}

/** Devolve a mesma foto menor, ou a original quando não há ganho.
 *
 *  WebP primeiro porque comprime melhor que JPEG **e** guarda transparência —
 *  que importa aqui: produto recortado sobre fundo transparente vira produto com
 *  fundo preto se passar por JPEG. Sem suporte a WebP, cai para JPEG.
 *
 *  Qualquer falha devolve o arquivo original: perder a foto por causa da
 *  otimização seria pior que enviá-la grande. */
export async function comprimirImagem(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const img = await carregar(file);
  if (!img || !img.width || !img.height) return file;

  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));

  // Já é pequena e cabe na tela: mexer nela só tiraria qualidade.
  if (escala === 1 && file.size <= TAMANHO_ACEITAVEL) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  // O padrão do canvas já é bilinear; pedir alta qualidade explicitamente é o
  // que evita serrilhado ao reduzir foto grande de uma vez só.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = (await paraBlob(canvas, 'image/webp')) ?? (await paraBlob(canvas, 'image/jpeg'));
  if (!blob || blob.size >= file.size) return file;

  const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${base}.${extensao}`, { type: blob.type });
}
