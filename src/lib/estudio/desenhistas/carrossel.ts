// Os carrosséis da seção 04 do playbook.
//
// A diferença para o feed é que aqui o modelo não desenha uma arte, desenha uma
// sequência — e a sequência tem regra própria: uma ideia por slide, nunca mais
// de dois slides seguidos com o mesmo fundo, e a linha dourada do rodapé
// contando o progresso. A alternância claro/escuro é o que segura o arraste;
// cinco telas escuras em fila fazem o dedo parar no terceiro.

import {
  COR,
  MARGEM,
  brilho,
  caminhoArredondado,
  espacamento,
  fonteMono,
  fonteTexto,
  fonteTitulo,
  lockup,
  marcaDagua,
  ouroMetal,
  paragrafo,
  preencher,
  produto,
  progresso,
  regua,
  rodapeEsfumado,
  rotulo,
  sombraDeContato,
  titulo,
  type Ctx,
  type Figura,
  type Halo,
} from '@/lib/estudio/marca';
import { PARCELAS_SEM_JUROS } from '@/lib/parcelamento';
import { campo, type Desenhista } from '@/lib/estudio/desenhistas/tipos';

const HALOS: Halo[] = ['roxo', 'magenta', 'turquesa', 'rubi', 'ouro'];
const halo = (c: Record<string, string>, padrao: Halo = 'roxo'): Halo => {
  const v = campo(c, 'halo', padrao) as Halo;
  return HALOS.includes(v) ? v : padrao;
};

/* ------------------------------------------------------------------ apoio */

/** Balão de conversa. O canto vivo diz de que lado a fala sai. */
function balao(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  largura: number,
  opcoes: { daProg?: boolean; inclinacao?: number } = {}
): void {
  if (!texto) return;
  const { daProg = false, inclinacao = 0 } = opcoes;
  const tamanho = 32;
  ctx.font = fonteTexto(tamanho, 600);

  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width <= largura - 64 || !atual) atual = t;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);

  const larguraReal = Math.min(
    largura,
    Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 64
  );
  const altura = linhas.length * tamanho * 1.3 + 52;

  ctx.save();
  ctx.translate(x + larguraReal / 2, y + altura / 2);
  ctx.rotate((inclinacao * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = daProg
    ? ouroMetal(ctx, -larguraReal / 2, -altura / 2, larguraReal, altura)
    : COR.marfim;
  caminhoArredondado(
    ctx,
    -larguraReal / 2,
    -altura / 2,
    larguraReal,
    altura,
    daProg ? [32, 32, 32, 8] : [32, 32, 8, 32]
  );
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = COR.onix;
  linhas.forEach((l, i) =>
    ctx.fillText(l, -larguraReal / 2 + 32, -altura / 2 + 26 + tamanho + i * tamanho * 1.3)
  );
  ctx.restore();
}

/** Etiqueta preta inclinada, com rótulo mono em cima e frase embaixo. */
function placa(
  ctx: Ctx,
  rotuloTexto: string,
  frase: string,
  x: number,
  y: number,
  inclinacao = -3
): void {
  if (!frase) return;
  ctx.font = fonteTexto(30, 700);
  const largura = Math.max(ctx.measureText(frase).width, 180) + 56;
  const altura = 104;

  ctx.save();
  ctx.translate(x + largura / 2, y + altura / 2);
  ctx.rotate((inclinacao * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.25)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = COR.onix;
  ctx.fillRect(-largura / 2, -altura / 2, largura, altura);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.font = fonteMono(20);
  const soltar = espacamento(ctx, '2px');
  ctx.fillStyle = COR.ouro;
  ctx.fillText(rotuloTexto.toUpperCase(), -largura / 2 + 28, -altura / 2 + 38);
  soltar();

  ctx.font = fonteTexto(30, 700);
  ctx.fillStyle = COR.marfim;
  ctx.fillText(frase, -largura / 2 + 28, altura / 2 - 26);
  ctx.restore();
}

/** Cartão de comparação: rótulo, valor grande e uma linha de apoio. */
function cartaoComparativo(
  ctx: Ctx,
  x: number,
  y: number,
  largura: number,
  dados: { rotulo: string; valor: string; apoio: string; destaque: boolean }
): void {
  const altura = 230;
  ctx.save();
  if (dados.destaque) {
    ctx.translate(x + largura / 2, y + altura / 2);
    ctx.rotate((2 * Math.PI) / 180);
    ctx.translate(-largura / 2, -altura / 2);
  } else {
    ctx.translate(x, y);
  }

  ctx.fillStyle = 'rgba(24,24,27,.92)';
  ctx.fillRect(0, 0, largura, altura);
  if (dados.destaque) {
    ctx.strokeStyle = COR.ouro;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, largura - 3, altura - 3);
  }

  ctx.font = fonteMono(22);
  const soltar = espacamento(ctx, '2.2px');
  ctx.fillStyle = dados.destaque ? COR.ouro : COR.prataEscura;
  ctx.fillText(dados.rotulo.toUpperCase(), 32, 56);
  soltar();

  ctx.font = fonteTitulo(58);
  ctx.fillStyle = dados.destaque ? COR.ouroClaro : COR.prataEscura;
  ctx.fillText(dados.valor, 32, 136);
  if (!dados.destaque) {
    const l = ctx.measureText(dados.valor).width;
    ctx.fillRect(32, 116, l, 3);
  }

  ctx.font = fonteTexto(26);
  ctx.fillStyle = dados.destaque ? COR.prata : COR.prataEscura;
  ctx.fillText(dados.apoio, 32, 186);
  ctx.restore();
}

/** A prateleira do slide de fechamento do 4A.
 *
 *  Três máquinas diferentes quando o dono escolher três; caindo para o mesmo
 *  aparelho girado quando só houver um. Prateleira com três vezes o mesmo
 *  notebook não é prateleira — e a pergunta do slide é justamente "qual
 *  máquina você quer". */
function vitrine(ctx: Ctx, principal: Figura, segunda: Figura | null, terceira: Figura | null, largura: number): void {
  produto(ctx, segunda ?? principal, { x: -140, y: 90, largura: 620, altura: 460 }, { rotacao: -16, desfoque: 40 });
  produto(ctx, terceira ?? principal, { x: largura - 480, y: 70, largura: 620, altura: 460 }, { rotacao: 14, desfoque: 40 });
  produto(ctx, principal, { x: 130, y: 170, largura: 820, altura: 600 }, { rotacao: -3, desfoque: 50 });
}

/** Lê "rótulo; valor" ou "rótulo; a; b; c" por linha. */
function linhasTabeladas(texto: string): string[][] {
  return texto
    .split('\n')
    .map((l) => l.split(';').map((c) => c.trim()))
    .filter((cols) => cols.some(Boolean));
}

/* ------------------------------------------- 4A · como funciona a importação */

export const desenhar4A: Desenhista = ({ ctx, largura, altura, conteudo, imagens, slide }) => {
  const p = imagens.produto;

  if (slide === 1) {
    preencher(ctx, COR.onix, largura, altura);
    brilho(ctx, 650, 970, 560, halo(conteudo, 'turquesa'), 0.46);
    if (p) {
      sombraDeContato(ctx, 670, 1255, 700, 80, 0.8);
      produto(ctx, p, { x: 230, y: 700, largura: 800, altura: 560 }, { rotacao: -7 });
    }
    // O rotulo comeca onde o lockup termina: a largura dele muda com a fonte
    // carregada, entao numero fixo colidia com o IMPORTS.
    const fimDoLockup = lockup(ctx, imagens.icone ?? null, MARGEM, MARGEM, 64);
    rotulo(ctx, 'Guia Prog · 01', fimDoLockup + 28, MARGEM + 42, 26, COR.prataEscura);

    const t = campo(conteudo, 'capaTitulo', 'Do site americano\nà sua mesa.');
    const alturaTitulo = tituloComUltimaLinhaEmOuro(ctx, t, MARGEM, 200, 118, largura - MARGEM * 2);
    const apoio = campo(conteudo, 'capaApoio');
    if (apoio) paragrafo(ctx, apoio, MARGEM, 200 + alturaTitulo + 32, 34, { largura: 640, maxLinhas: 3 });

    rotulo(ctx, 'Arraste →', largura - MARGEM, altura - 110, 26, COR.ouro, 'right');
  }

  if (slide === 2) {
    preencher(ctx, COR.onix, largura, altura);
    marcaDagua(ctx, '01', largura - 180, 60, 520, { traco: 'rgba(217,182,110,.28)' });
    brilho(ctx, 540, 520, 640, halo(conteudo), 0.44);
    if (p) {
      sombraDeContato(ctx, 540, 745, 720, 80, 0.8);
      produto(ctx, p, { x: 110, y: 180, largura: 860, altura: 600 }, { rotacao: -6 });
    }
    rotulo(ctx, 'Etapa 1 de 4', MARGEM, MARGEM + 26, 26, COR.prataEscura);

    balao(ctx, campo(conteudo, 'perguntaCliente'), 400, 560, 560, { inclinacao: 2 });
    balao(ctx, campo(conteudo, 'respostaProg'), MARGEM, 730, 560, { daProg: true, inclinacao: -2 });

    const t = campo(conteudo, 'slide2Titulo', 'Você escolhe.\nA gente cota.');
    const alturaTitulo = titulo(ctx, t, MARGEM, 1000, 92, { largura: largura - MARGEM * 2, maxLinhas: 2 });
    const apoio = campo(conteudo, 'slide2Apoio');
    if (apoio) paragrafo(ctx, apoio, MARGEM, 1000 + alturaTitulo + 28, 32, { largura: largura - MARGEM * 2, maxLinhas: 3 });
  }

  if (slide === 3) {
    preencher(ctx, COR.marfim, largura, altura);
    rotulo(ctx, 'Etapa 2 e 3 de 4', MARGEM, MARGEM + 26, 26, COR.grafiteTexto);

    let y = 150;
    for (const [numero, chaveTitulo, chaveApoio] of [
      ['02', 'etapa2', 'etapa2Apoio'],
      ['03', 'etapa3', 'etapa3Apoio'],
    ] as const) {
      regua(ctx, MARGEM, y, largura - MARGEM * 2, COR.onix, 3);
      ctx.font = fonteTitulo(64);
      ctx.fillStyle = COR.bronze;
      ctx.fillText(numero, MARGEM, y + 100);
      titulo(ctx, campo(conteudo, chaveTitulo, '—'), MARGEM + 164, y + 36, 58, {
        largura: largura - MARGEM * 2 - 164,
        cor: COR.onix,
        maxLinhas: 1,
      });
      paragrafo(ctx, campo(conteudo, chaveApoio), MARGEM + 164, y + 104, 30, {
        largura: largura - MARGEM * 2 - 164,
        cor: COR.tintaSecundaria,
        maxLinhas: 2,
      });
      y += 200;
    }
    regua(ctx, MARGEM, y, largura - MARGEM * 2, COR.onix, 3);

    if (p) produto(ctx, p, { x: 240, y: 700, largura: 860, altura: 620 }, { rotacao: -16, sombra: 'rgba(60,45,20,.35)' });
    placa(ctx, 'Rastreio', 'Etapa por etapa', MARGEM, 1010);
  }

  if (slide === 4) {
    preencher(ctx, COR.onix, largura, altura);
    brilho(ctx, 540, 640, 620, halo(conteudo), 0.44);
    if (p) {
      sombraDeContato(ctx, 540, 905, 680, 80, 0.8);
      produto(ctx, p, { x: 160, y: 380, largura: 760, altura: 540 }, { rotacao: -5 });
    }
    rotulo(ctx, 'Etapa 4 · o que muda pra você', MARGEM, MARGEM + 26, 26, COR.prataEscura);

    const vao = 16;
    const larguraCartao = (largura - MARGEM * 2 - vao) / 2;
    cartaoComparativo(ctx, MARGEM, 170, larguraCartao, {
      rotulo: 'Varejo BR',
      valor: campo(conteudo, 'precoVarejo', '—'),
      apoio: 'Quando chega',
      destaque: false,
    });
    cartaoComparativo(ctx, MARGEM + larguraCartao + vao, 170, larguraCartao, {
      rotulo: 'Prog Imports',
      valor: campo(conteudo, 'precoProg', '—'),
      apoio: 'Já disponível',
      destaque: true,
    });

    rodapeEsfumado(ctx, COR.onix, largura, altura, 480, 0.45);
    const t = campo(conteudo, 'slide4Titulo', 'Mesmo modelo.\nMuito menos.');
    titulo(ctx, t, MARGEM, altura - 290, 84, { largura: largura - MARGEM * 2, maxLinhas: 2 });
    rotulo(ctx, 'Valores ilustrativos · confirme na cotação', MARGEM, altura - 120, 22, COR.grafiteTexto);
  }

  if (slide === 5) {
    preencher(ctx, COR.onix, largura, altura);
    brilho(ctx, 540, 480, 640, 'ouro', 0.34);
    if (p) {
      sombraDeContato(ctx, 540, 790, 760, 80, 0.8);
      vitrine(ctx, p, imagens.produtoA ?? null, imagens.produtoB ?? null, largura);
    }
    rodapeEsfumado(ctx, COR.onix, largura, altura, 560, 0.4);

    const t = campo(conteudo, 'fechamentoTitulo', 'Qual máquina\nvocê quer?');
    const alturaTitulo = titulo(ctx, t, MARGEM, altura - 500, 106, { largura: largura - MARGEM * 2, maxLinhas: 2 });
    const apoio = campo(conteudo, 'fechamentoApoio');
    if (apoio) paragrafo(ctx, apoio, MARGEM, altura - 500 + alturaTitulo + 36, 34, { largura: largura - MARGEM * 2, maxLinhas: 2 });

    botaoDuplo(ctx, MARGEM, altura - 230, 'WhatsApp na bio →', 'Salvar guia');
  }

  progresso(ctx, slide, 5, largura, altura, slide === 3);
};

/* --------------------------------------------------- 4B · lançamento de linha */

export const desenhar4B: Desenhista = ({ ctx, largura, altura, conteudo, imagens, slide }) => {
  const p = imagens.produto;

  if (slide === 1) {
    preencher(ctx, COR.onix, largura, altura);
    rotulo(ctx, campo(conteudo, 'etiqueta', 'Lançamento · EUA'), MARGEM, MARGEM + 30, 26, COR.ouro);
    if (imagens.icone) ctx.drawImage(imagens.icone, largura - MARGEM - 64, MARGEM, 64, 64);

    brilho(ctx, largura / 2, 560, 660, halo(conteudo, 'magenta'), 0.48);
    marcaDagua(ctx, campo(conteudo, 'marcaDagua', 'GEN 10'), largura / 2, 170, 330);
    if (p) {
      sombraDeContato(ctx, 540, 815, 760, 90, 0.8);
      produto(ctx, p, { x: 110, y: 260, largura: 860, altura: 600 }, { rotacao: -9 });
    }
    rodapeEsfumado(ctx, COR.onix, largura, altura, 440, 0.45);

    const t = campo(conteudo, 'capaTitulo', 'Legion\nGen 10.');
    const alturaTitulo = tituloComUltimaLinhaEmOuro(ctx, t, MARGEM, altura - 420, 128, largura - MARGEM * 2);
    const apoio = campo(conteudo, 'capaApoio');
    if (apoio) paragrafo(ctx, apoio, MARGEM, altura - 420 + alturaTitulo + 24, 36, { largura: largura - MARGEM * 2, maxLinhas: 2 });
  }

  if (slide === 2) {
    preencher(ctx, COR.onix, largura, altura);
    brilho(ctx, 540, 1000, 620, halo(conteudo, 'magenta'), 0.4);
    rotulo(ctx, 'Ficha técnica', MARGEM, MARGEM + 26, 26, COR.prataEscura);

    const linhas = linhasTabeladas(campo(conteudo, 'comparativo'));
    const colunas = Math.max(...linhas.map((l) => l.length), 2);
    const larguraRotulo = 300;
    const larguraColuna = (largura - MARGEM * 2 - larguraRotulo) / (colunas - 1);
    let y = 160;

    linhas.forEach((cols, indice) => {
      regua(ctx, MARGEM, y, largura - MARGEM * 2, COR.grafiteClaro);
      const ehCabecalho = indice === 0;
      if (!ehCabecalho) {
        ctx.font = fonteMono(22);
        const soltar = espacamento(ctx, '2.2px');
        ctx.fillStyle = COR.prataEscura;
        ctx.fillText((cols[0] ?? '').toUpperCase(), MARGEM, y + 52);
        soltar();
      }
      for (let c = 1; c < colunas; c++) {
        const destaque = c === colunas - 1;
        const x = MARGEM + larguraRotulo + (c - 1) * larguraColuna;
        if (ehCabecalho) {
          ctx.font = fonteTitulo(40);
          ctx.fillStyle = destaque ? COR.ouroClaro : COR.marfim;
        } else {
          ctx.font = fonteTexto(30);
          ctx.fillStyle = destaque ? COR.ouroClaro : COR.marfim;
        }
        ctx.fillText(cols[c] ?? '', x, y + 52);
      }
      y += 76;
    });
    regua(ctx, MARGEM, y, largura - MARGEM * 2, COR.grafiteClaro);

    const nota = campo(conteudo, 'notaTabela');
    if (nota) rotulo(ctx, nota, MARGEM, y + 60, 22, COR.grafiteTexto);

    if (p) produto(ctx, p, { x: 110, y: 820, largura: 860, altura: 560 }, { rotacao: -8 });
  }

  if (slide === 3) {
    preencher(ctx, COR.marfim, largura, altura);
    rotulo(ctx, 'Preço no Brasil', MARGEM, MARGEM + 26, 26, COR.grafiteTexto);
    if (p) produto(ctx, p, { x: 360, y: 90, largura: 680, altura: 480 }, { rotacao: -8, sombra: 'rgba(60,45,20,.35)' });
    placa(ctx, `${PARCELAS_SEM_JUROS}× sem juros`, 'em todos', MARGEM, 200);

    let y = 620;
    for (const linha of linhasTabeladas(campo(conteudo, 'precos'))) {
      regua(ctx, MARGEM, y, largura - MARGEM * 2, COR.onix, 3);
      titulo(ctx, linha[0] ?? '', MARGEM, y + 30, 60, { largura: 560, cor: COR.onix, maxLinhas: 1 });
      ctx.font = fonteTitulo(60, 700);
      ctx.fillStyle = (linha[1] ?? '').toLowerCase().includes('consulta') ? COR.onix : COR.bronze;
      ctx.textAlign = 'right';
      ctx.fillText(linha[1] ?? '', largura - MARGEM, y + 86);
      ctx.textAlign = 'left';
      y += 128;
    }
    regua(ctx, MARGEM, y, largura - MARGEM * 2, COR.onix, 3);

    const nota = campo(conteudo, 'notaPreco');
    if (nota) paragrafo(ctx, nota, MARGEM, altura - 190, 30, { largura: largura - MARGEM * 2, cor: COR.tintaSecundaria, maxLinhas: 2 });
  }

  if (slide === 4) {
    preencher(ctx, COR.onix, largura, altura);
    brilho(ctx, 700, 300, 620, halo(conteudo, 'magenta'), 0.46);
    if (p) produto(ctx, p, { x: 420, y: -60, largura: 760, altura: 540 }, { rotacao: 18, desfoque: 50 });

    const fimDoLockup = lockup(ctx, imagens.icone ?? null, MARGEM, MARGEM, 64);
    rotulo(ctx, 'Lista VIP · 1º lote', fimDoLockup + 28, MARGEM + 42, 26, COR.prataEscura);

    const t = campo(conteudo, 'vipTitulo', 'Seja o\nprimeiro\na receber.');
    const alturaTitulo = titulo(ctx, t, MARGEM, 560, 110, { largura: largura - MARGEM * 2, maxLinhas: 3 });
    const apoio = campo(conteudo, 'vipApoio');
    if (apoio) paragrafo(ctx, apoio, MARGEM, 560 + alturaTitulo + 36, 34, { largura: 820, maxLinhas: 2 });

    // Caixa do comando. A palavra-chave é o que você vai monitorar nos
    // comentários, então ela é o único elemento dourado do slide.
    const caixaY = altura - 260;
    ctx.strokeStyle = COR.ouro;
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGEM, caixaY, largura - MARGEM * 2, 120);
    ctx.font = fonteTexto(34);
    ctx.fillStyle = COR.marfim;
    ctx.fillText('Comente', MARGEM + 36, caixaY + 76);
    ctx.font = fonteMono(44, 700);
    const soltar = espacamento(ctx, '6px');
    ctx.fillStyle = COR.ouroClaro;
    ctx.textAlign = 'right';
    ctx.fillText(`"${campo(conteudo, 'palavraChave', 'QUERO').toUpperCase()}"`, largura - MARGEM - 36, caixaY + 78);
    ctx.textAlign = 'left';
    soltar();
  }

  progresso(ctx, slide, 4, largura, altura, slide === 3);
};

/* ------------------------------------------------------------------ apoio 2 */

/** Título cuja última linha sai em ouro — o gesto de fechamento do playbook. */
function tituloComUltimaLinhaEmOuro(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  tamanho: number,
  largura: number
): number {
  const linhas = texto.split('\n').filter(Boolean);
  const entrelinha = tamanho * 0.92;
  linhas.forEach((linha, i) => {
    const ultima = i === linhas.length - 1;
    const cor = ultima && linhas.length > 1
      ? ouroMetal(ctx, x, y + i * entrelinha, Math.min(largura, tamanho * linha.length * 0.6), tamanho)
      : COR.marfim;
    titulo(ctx, linha, x, y + i * entrelinha, tamanho, { largura, cor, maxLinhas: 1 });
  });
  return linhas.length * entrelinha;
}

/** Os dois botões do fechamento: um cheio em ouro, um só contornado. */
function botaoDuplo(ctx: Ctx, x: number, y: number, principal: string, secundario: string): void {
  const altura = 88;
  ctx.font = fonteTexto(30, 600);
  const l1 = ctx.measureText(principal).width + 80;
  ctx.fillStyle = ouroMetal(ctx, x, y, l1, altura);
  ctx.fillRect(x, y, l1, altura);
  ctx.fillStyle = COR.onix;
  ctx.fillText(principal, x + 40, y + 56);

  const l2 = ctx.measureText(secundario).width + 76;
  ctx.strokeStyle = '#3a3a3f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + l1 + 16, y, l2, altura);
  ctx.fillStyle = COR.marfim;
  ctx.fillText(secundario, x + l1 + 54, y + 56);
}

export const DESENHISTAS_DE_CARROSSEL: Record<string, Desenhista> = {
  '4a': desenhar4A,
  '4b': desenhar4B,
};

