// Desenho da etiqueta no canvas. Só roda no navegador.
//
// Canvas em vez de biblioteca de HTML-para-imagem: a etiqueta é um retângulo
// com sete blocos de texto e uma imagem, e o resultado precisa sair sempre
// igual, com pixel previsível para impressora térmica. Converter HTML traria
// dependência nova, dependeria do CSS da página e mudaria de aparência a cada
// ajuste de tema.

import { linhasDoEndereco, type Etiqueta } from '@/lib/shipping-label';

/** 10 × 15 cm a 300 dpi — o formato de etiqueta que Correios e transportadoras
 *  aceitam, e o que a impressora térmica comum imprime sem redimensionar. */
export const LARGURA = 1181;
export const ALTURA = 1772;

const MARGEM = 70;
const PRETO = '#111111';
const CINZA = '#6b6b73';
const LINHA = '#d9d9de';

const FONTE = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

function fonte(tamanho: number, peso: 400 | 600 | 700 | 800 = 400): string {
  return `${peso} ${tamanho}px ${FONTE}`;
}

/** Escreve respeitando a largura, quebrando por palavra e cortando com "…" se
 *  passar do número de linhas. Endereço longo é comum, e deixar o texto sair
 *  pela borda estragaria a etiqueta inteira sem avisar. */
function escreverQuebrando(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  largura: number,
  alturaLinha: number,
  maxLinhas = 3
): number {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';

  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tentativa).width <= largura || !atual) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);

  const visiveis = linhas.slice(0, maxLinhas);
  if (linhas.length > maxLinhas && visiveis.length > 0) {
    let ultima = visiveis[visiveis.length - 1];
    while (ultima && ctx.measureText(`${ultima}…`).width > largura) {
      ultima = ultima.slice(0, -1);
    }
    visiveis[visiveis.length - 1] = `${ultima}…`;
  }

  visiveis.forEach((l, i) => ctx.fillText(l, x, y + i * alturaLinha));
  return y + visiveis.length * alturaLinha;
}

function rotulo(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number): void {
  ctx.fillStyle = CINZA;
  ctx.font = fonte(20, 700);
  // Espaçamento manual: canvas não tem letter-spacing em todo navegador, e o
  // rótulo espaçado é o que dá ar de etiqueta em vez de texto solto.
  const espacado = texto.split('').join(' ');
  ctx.fillText(espacado, x, y);
}

function separador(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.strokeStyle = LINHA;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGEM, y);
  ctx.lineTo(LARGURA - MARGEM, y);
  ctx.stroke();
}

/** Carrega a logo. Falha não impede a etiqueta de sair: uma etiqueta sem logo
 *  entrega a encomenda do mesmo jeito; um erro na hora de despachar, não. */
export function carregarLogo(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Desenha a etiqueta inteira. Fundo branco e tinta preta de propósito: é papel
 *  para colar em caixa, muitas vezes impresso em térmica monocromática. */
export function desenharEtiqueta(
  ctx: CanvasRenderingContext2D,
  etiqueta: Etiqueta,
  logo: HTMLImageElement | null
): void {
  const largura = LARGURA - MARGEM * 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // Moldura: dá o limite de corte quando a etiqueta sai numa folha A4.
  ctx.strokeStyle = PRETO;
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, LARGURA - 48, ALTURA - 48);

  ctx.textBaseline = 'alphabetic';
  let y = MARGEM + 40;

  // --- topo: logo à esquerda, pedido à direita ------------------------------
  if (logo && logo.width > 0) {
    const alturaLogo = 74;
    const larguraLogo = (logo.width / logo.height) * alturaLogo;
    ctx.drawImage(logo, MARGEM, y - 52, Math.min(larguraLogo, 420), alturaLogo);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = PRETO;
  ctx.font = fonte(34, 800);
  ctx.fillText(etiqueta.pedido, LARGURA - MARGEM, y - 8);
  ctx.fillStyle = CINZA;
  ctx.font = fonte(20);
  ctx.fillText(etiqueta.data, LARGURA - MARGEM, y + 22);
  ctx.textAlign = 'left';

  y += 60;
  separador(ctx, y);

  // --- destinatário ---------------------------------------------------------
  // Fica em cima e ocupa a maior área: é o que o entregador procura primeiro, e
  // é o erro mais caro da etiqueta.
  y += 60;
  rotulo(ctx, 'DESTINATÁRIO', MARGEM, y);

  y += 60;
  ctx.fillStyle = PRETO;
  ctx.font = fonte(58, 800);
  y = escreverQuebrando(ctx, etiqueta.destinatario.nome, MARGEM, y, largura, 68, 2);

  y += 26;
  ctx.font = fonte(38);
  for (const linha of linhasDoEndereco(etiqueta.destinatario)) {
    y = escreverQuebrando(ctx, linha, MARGEM, y, largura, 50, 2);
    y += 8;
  }

  // O CEP em caixa própria: é por ele que a triagem separa a encomenda, e
  // perdido no meio do endereço ele erra com muito mais frequência.
  y += 30;
  const alturaCaixa = 118;
  ctx.strokeStyle = PRETO;
  ctx.lineWidth = 3;
  ctx.strokeRect(MARGEM, y, largura, alturaCaixa);
  ctx.fillStyle = CINZA;
  ctx.font = fonte(20, 700);
  ctx.fillText('CEP', MARGEM + 26, y + 42);
  ctx.fillStyle = PRETO;
  ctx.font = fonte(66, 800);
  ctx.fillText(etiqueta.destinatario.cep || '—', MARGEM + 26, y + 94);

  const contato = [etiqueta.destinatario.telefone, etiqueta.destinatario.doc].filter(Boolean).join('   ·   ');
  if (contato) {
    ctx.textAlign = 'right';
    ctx.fillStyle = CINZA;
    ctx.font = fonte(24);
    ctx.fillText(contato, LARGURA - MARGEM - 26, y + 76);
    ctx.textAlign = 'left';
  }

  // --- remetente ------------------------------------------------------------
  // Ancorado no rodapé, e não emendado no destinatário: assim o espaço em
  // branco fica no meio da etiqueta — onde a fita passa — em vez de sobrar um
  // vazio embaixo que faz a etiqueta parecer cortada. É também a posição em que
  // o remetente aparece nas etiquetas dos Correios.
  const yRemetente = ALTURA - MARGEM - 500;
  separador(ctx, yRemetente - 44);
  y = yRemetente;
  rotulo(ctx, 'REMETENTE', MARGEM, y);

  y += 48;
  ctx.fillStyle = PRETO;
  ctx.font = fonte(32, 700);
  y = escreverQuebrando(ctx, etiqueta.remetente.nome, MARGEM, y, largura, 42, 1);

  y += 12;
  ctx.fillStyle = CINZA;
  ctx.font = fonte(27);
  // Uma linha por trecho: o endereço da própria loja é conhecido e curto, e
  // limitar aqui é o que garante que o bloco nunca invada o rodapé.
  for (const linha of linhasDoEndereco(etiqueta.remetente)) {
    y = escreverQuebrando(ctx, linha, MARGEM, y, largura, 37, 1);
  }
  const rodapeRemetente = [
    etiqueta.remetente.cep ? `CEP ${etiqueta.remetente.cep}` : '',
    etiqueta.remetente.telefone,
    etiqueta.remetente.doc,
  ]
    .filter(Boolean)
    .join('   ·   ');
  if (rodapeRemetente) {
    escreverQuebrando(ctx, rodapeRemetente, MARGEM, y + 36, largura, 34, 1);
  }

  // --- conteúdo -------------------------------------------------------------
  // No rodapé porque é conferência de quem despacha, não informação de entrega.
  if (etiqueta.conteudo) {
    const yRodape = ALTURA - MARGEM - 80;
    separador(ctx, yRodape - 40);
    ctx.fillStyle = CINZA;
    ctx.font = fonte(20, 700);
    ctx.fillText('CONTEÚDO', MARGEM, yRodape);
    ctx.fillStyle = PRETO;
    ctx.font = fonte(24);
    escreverQuebrando(ctx, etiqueta.conteudo, MARGEM, yRodape + 36, largura, 32, 2);
  }
}
