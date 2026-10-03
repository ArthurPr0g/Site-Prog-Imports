// Ponto de entrada do desenho: carrega o que a peça precisa e chama o modelo.
//
// Separado dos desenhistas de propósito. Eles só sabem pintar num contexto
// pronto; quem resolve fonte, imagem e tamanho é aqui. Isso mantém cada
// desenhista legível e deixa o carregamento — a parte que erra em silêncio —
// num lugar só.

import { carregarFontes, COR, preencher, type Ctx } from '@/lib/estudio/marca';
import { recortarProduto } from '@/lib/image-cutout';
import { DIMENSOES, modeloPorCodigo } from '@/lib/estudio/modelos';
import { DESENHISTAS_DE_FEED } from '@/lib/estudio/desenhistas/feed';
import { DESENHISTAS_DE_CARROSSEL } from '@/lib/estudio/desenhistas/carrossel';
import type { Conteudo, Desenhista, Imagens } from '@/lib/estudio/desenhistas/tipos';

export const DESENHISTAS: Record<string, Desenhista> = {
  ...DESENHISTAS_DE_FEED,
  ...DESENHISTAS_DE_CARROSSEL,
};

/** Carrega uma imagem para o canvas.
 *
 *  `crossOrigin` é obrigatório nas fotos do storage: sem ele o navegador marca
 *  o canvas como contaminado e `toDataURL` passa a lançar — o desenho aparece
 *  na tela e o download morre, que é o pior jeito de descobrir o problema. */
export function carregarImagem(src: string | null | undefined): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export type FontesDaPeca = {
  produto?: string | null;
  produtoA?: string | null;
  produtoB?: string | null;
  fundo?: string | null;
};

/** Carrega a foto do produto já recortada.
 *
 *  A foto do catálogo vem sobre o cartão da loja (#111114), e o playbook
 *  precisa do aparelho solto para ele saltar sobre o halo colorido — sem o
 *  recorte, o "produto" é a foto inteira e cobre a arte de ponta a ponta.
 *
 *  `recortarProduto` devolve `null` quando o fundo não é liso o bastante. Aí a
 *  foto original é melhor que um recorte quebrado, e é ela que volta. */
async function carregarProduto(src: string | null | undefined) {
  const img = await carregarImagem(src);
  if (!img) return null;
  return recortarProduto(img) ?? img;
}

/** A marca entra em toda peça; vale carregar junto e não por modelo. */
export async function carregarImagens(fontes: FontesDaPeca): Promise<Imagens> {
  const [produto, produtoA, produtoB, fundo, icone, logo] = await Promise.all([
    carregarProduto(fontes.produto),
    carregarProduto(fontes.produtoA),
    carregarProduto(fontes.produtoB),
    carregarImagem(fontes.fundo),
    carregarImagem('/marca/icone.png'),
    carregarImagem('/marca/logo.png'),
  ]);
  return { produto, produtoA, produtoB, fundo, icone, logo };
}

/** Desenha a peça inteira. O canvas já deve estar no tamanho final. */
export async function desenharPeca(
  ctx: Ctx,
  modelo: string,
  conteudo: Conteudo,
  imagens: Imagens,
  slide = 1
): Promise<void> {
  await carregarFontes();

  const m = modeloPorCodigo(modelo);
  const { largura, altura } = DIMENSOES[m?.formato ?? 'feed'];
  ctx.clearRect(0, 0, largura, altura);

  const desenhista = DESENHISTAS[modelo];
  if (!desenhista) {
    // Modelo catalogado mas ainda sem desenhista: melhor um aviso legível na
    // arte que um retângulo vazio que parece bug do navegador.
    preencher(ctx, m?.superficie === 'claro' ? COR.marfim : COR.onix, largura, altura);
    ctx.fillStyle = m?.superficie === 'claro' ? COR.grafiteTexto : COR.prataEscura;
    ctx.font = '500 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Modelo ${modelo.toUpperCase()} ainda não desenhado`, largura / 2, altura / 2);
    ctx.textAlign = 'left';
    return;
  }

  desenhista({ ctx, largura, altura, conteudo, imagens, slide });
}
