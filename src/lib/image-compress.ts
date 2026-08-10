// Redução da foto antes do envio. Só roda no navegador.
//
// Foto de celular sai com 12 megapixels e 3 a 8 MB. Nada disso chega ao
// cliente: a vitrine mostra a imagem em algumas centenas de pixels, e o resto é
// banda, armazenamento e espera. Reduzir aqui deixa o upload rápido, o storage
// barato e — o que motivou este arquivo — mantém o arquivo bem abaixo do limite
// de corpo das server actions, que derrubava a tela inteira quando estourado.

/** Lado maior depois da redução.
 *
 *  2560px porque a foto do produto É a vitrine: ela aparece grande na página,
 *  ampliada no zoom e em tela de alta densidade, onde cada ponto do layout vale
 *  dois ou três pixels reais. Reduzir mais que isso economizava banda às custas
 *  do único lugar onde o cliente decide a compra. */
const LADO_MAXIMO = 2560;

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
