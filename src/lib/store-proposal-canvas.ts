// Desenho da proposta da loja. Só roda no navegador.
//
// Escuro com a cor de destaque, ao contrário do PDF de contrato, que é branco.
// São peças de uso diferente: o PDF vai para impressora e assinatura, esta
// imagem vai para o WhatsApp do cliente e fica ao lado das fotos do site. Aqui
// parecer a loja vale mais que economizar tinta.

import { BRAND } from '@/lib/brand';
import { formatBRL } from '@/lib/format';
import type { PropostaDaLoja } from '@/lib/store-proposal';

/** 1080 × 1350 é o retrato 4:5 que WhatsApp e Instagram mostram inteiro, sem
 *  cortar as bordas nem exigir que o cliente abra em tela cheia. */
export const LARGURA = 1080;
export const ALTURA = 1350;

const MARGEM = 72;
const FUNDO = '#0f0f12';
const CARTAO = '#17171c';
const BORDA = '#2a2a32';
const BRANCO = '#f5f5f7';
const CINZA = '#9a9aa4';
const CINZA_FRACO = '#6f6f79';

const FONTE = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

function fonte(tamanho: number, peso: 400 | 600 | 700 | 800 = 400): string {
  return `${peso} ${tamanho}px ${FONTE}`;
}

/** Retângulo de cantos arredondados. Existe como função porque `roundRect` só
 *  chegou aos navegadores recentemente e uma proposta que não desenha numa
 *  máquina mais velha é pior que dez linhas de traçado manual. */
function caminhoArredondado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const raio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.lineTo(x + w - raio, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + raio);
  ctx.lineTo(x + w, y + h - raio);
  ctx.quadraticCurveTo(x + w, y + h, x + w - raio, y + h);
  ctx.lineTo(x + raio, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - raio);
  ctx.lineTo(x, y + raio);
  ctx.quadraticCurveTo(x, y, x + raio, y);
  ctx.closePath();
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number, maxLinhas: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';

  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tentativa).width <= largura || !atual) atual = tentativa;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);

  const visiveis = linhas.slice(0, maxLinhas);
  if (linhas.length > maxLinhas && visiveis.length) {
    let ultima = visiveis[visiveis.length - 1];
    while (ultima && ctx.measureText(`${ultima}…`).width > largura) ultima = ultima.slice(0, -1);
    visiveis[visiveis.length - 1] = `${ultima}…`;
  }
  return visiveis;
}

/** Desenha a foto preenchendo a área sem deformar: recorta o excesso do lado
 *  maior, como `object-fit: cover`. Esticar deixaria notebook com tela oval. */
function desenharFoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const escala = Math.max(w / img.width, h / img.height);
  const larguraFinal = img.width * escala;
  const alturaFinal = img.height * escala;
  ctx.drawImage(img, x + (w - larguraFinal) / 2, y + (h - alturaFinal) / 2, larguraFinal, alturaFinal);
}

/** Desenha a proposta inteira. */
export function desenharProposta(
  ctx: CanvasRenderingContext2D,
  p: PropostaDaLoja,
  logo: HTMLImageElement | null,
  foto: HTMLImageElement | null
): void {
  const largura = LARGURA - MARGEM * 2;

  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // Brilho da marca no topo, o mesmo gesto do site.
  const brilho = ctx.createRadialGradient(LARGURA / 2, -180, 40, LARGURA / 2, -180, 780);
  brilho.addColorStop(0, `${BRAND.accent}2e`);
  brilho.addColorStop(1, `${BRAND.accent}00`);
  ctx.fillStyle = brilho;
  ctx.fillRect(0, 0, LARGURA, 620);

  ctx.textBaseline = 'alphabetic';
  let y = MARGEM + 46;

  // --- topo -----------------------------------------------------------------
  if (logo && logo.width > 0) {
    const alturaLogo = 60;
    ctx.drawImage(logo, MARGEM, y - 44, (logo.width / logo.height) * alturaLogo, alturaLogo);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = BRAND.accent;
  ctx.font = fonte(19, 800);
  ctx.fillText('P R O P O S T A', LARGURA - MARGEM, y - 22);
  ctx.fillStyle = CINZA_FRACO;
  ctx.font = fonte(19);
  ctx.fillText(p.data, LARGURA - MARGEM, y + 8);
  ctx.textAlign = 'left';

  // --- foto -----------------------------------------------------------------
  y += 54;
  const alturaFoto = 430;
  ctx.save();
  caminhoArredondado(ctx, MARGEM, y, largura, alturaFoto, 28);
  ctx.fillStyle = CARTAO;
  ctx.fill();
  ctx.clip();
  if (foto && foto.width > 0) {
    desenharFoto(ctx, foto, MARGEM, y, largura, alturaFoto);
  } else {
    // Sem foto o espaço continua reservado: a proposta mantém a mesma altura e
    // o mesmo ritmo, em vez de mudar de formato conforme o cadastro.
    ctx.fillStyle = CINZA_FRACO;
    ctx.font = fonte(22, 700);
    ctx.textAlign = 'center';
    ctx.fillText('Sem foto cadastrada', LARGURA / 2, y + alturaFoto / 2 + 8);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.strokeStyle = BORDA;
  ctx.lineWidth = 2;
  caminhoArredondado(ctx, MARGEM, y, largura, alturaFoto, 28);
  ctx.stroke();

  // --- produto --------------------------------------------------------------
  y += alturaFoto + 62;
  if (p.categoria) {
    ctx.fillStyle = BRAND.accent;
    ctx.font = fonte(18, 800);
    ctx.fillText(p.categoria.toUpperCase(), MARGEM, y);
    y += 34;
  }

  ctx.fillStyle = BRANCO;
  ctx.font = fonte(44, 800);
  for (const linha of quebrar(ctx, p.produto, largura, 2)) {
    ctx.fillText(linha, MARGEM, y);
    y += 54;
  }

  if (p.specs) {
    ctx.fillStyle = CINZA;
    ctx.font = fonte(24);
    y += 4;
    for (const linha of quebrar(ctx, p.specs, largura, 2)) {
      ctx.fillText(linha, MARGEM, y);
      y += 34;
    }
  }

  // --- valor ----------------------------------------------------------------
  // Ancorado no rodapé: é a informação que o cliente procura, e ancorar mantém
  // o preço sempre no mesmo lugar, independentemente do tamanho do nome.
  const yCartao = ALTURA - MARGEM - 372;
  const alturaCartao = 300;
  caminhoArredondado(ctx, MARGEM, yCartao, largura, alturaCartao, 26);
  ctx.fillStyle = CARTAO;
  ctx.fill();
  ctx.strokeStyle = `${BRAND.accent}55`;
  ctx.lineWidth = 2;
  ctx.stroke();

  const xInterno = MARGEM + 40;
  let yi = yCartao + 56;

  ctx.fillStyle = CINZA_FRACO;
  ctx.font = fonte(17, 800);
  ctx.fillText('V A L O R   F I N A L', xInterno, yi);

  yi += 62;
  ctx.fillStyle = BRANCO;
  ctx.font = fonte(62, 800);
  ctx.fillText(formatBRL(p.valorFinal), xInterno, yi);

  // O preço cheio riscado só aparece quando existe desconto de verdade —
  // riscar um valor igual ao final seria teatro de desconto.
  if (p.descontoBrl > 0) {
    const larguraValor = ctx.measureText(formatBRL(p.valorFinal)).width;
    ctx.font = fonte(26);
    ctx.fillStyle = CINZA_FRACO;
    const cheio = formatBRL(p.precoCheio);
    const xCheio = xInterno + larguraValor + 24;
    ctx.fillText(cheio, xCheio, yi - 6);
    const larguraCheio = ctx.measureText(cheio).width;
    ctx.strokeStyle = CINZA_FRACO;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xCheio, yi - 14);
    ctx.lineTo(xCheio + larguraCheio, yi - 14);
    ctx.stroke();

    ctx.fillStyle = BRAND.accent;
    ctx.font = fonte(20, 800);
    ctx.fillText(`desconto de ${p.rotuloDesconto}`, xCheio, yi + 24);
  }

  yi += 54;
  ctx.fillStyle = CINZA;
  ctx.font = fonte(22);
  ctx.fillText(`Frete: ${p.frete}`, xInterno, yi);

  yi += 46;
  ctx.fillStyle = CINZA_FRACO;
  ctx.font = fonte(17, 800);
  ctx.fillText('P A G A M E N T O', xInterno, yi);

  yi += 34;
  ctx.fillStyle = CINZA;
  ctx.font = fonte(22);
  ctx.fillText(p.formas.join('   ·   '), xInterno, yi);

  // --- rodapé ---------------------------------------------------------------
  const yRodape = ALTURA - MARGEM + 6;
  ctx.fillStyle = CINZA_FRACO;
  ctx.font = fonte(18);
  ctx.fillText(p.validade, MARGEM, yRodape - 22);

  ctx.textAlign = 'right';
  ctx.fillStyle = CINZA;
  ctx.font = fonte(19, 700);
  ctx.fillText(BRAND.name, LARGURA - MARGEM, yRodape - 22);
  ctx.textAlign = 'left';
}
