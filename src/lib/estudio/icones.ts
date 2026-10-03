// Os ícones das capas de destaque, em vetor.
//
// Vêm do Lucide (licença ISC), que já é a biblioteca de ícones do site — o
// playbook pede "um único set em todas as capas", e usar o mesmo do admin
// garante isso sem um segundo acervo para manter.
//
// Os caminhos estão embutidos em vez de carregados do pacote porque o canvas
// desenha `Path2D`, não componente React. Buscar o SVG de um CDN na hora de
// desenhar também funcionaria, mas faria a capa depender da rede no momento da
// exportação — e uma capa que falha calada vira um disco vazio no perfil.
//
// Sistema de coordenadas do Lucide: 24×24, traço de 2, pontas e junções
// arredondadas. O desenho escala para o tamanho pedido.

export type Icone = {
  rotulo: string;
  /** Caminhos de traço, em SVG path data. */
  tracos: string[];
  /** Círculos de traço, em coordenadas do Lucide. */
  circulos?: { cx: number; cy: number; r: number }[];
  /** Polilinha de traço. */
  linhas?: { pontos: [number, number][] }[];
};

export const ICONES: Record<string, Icone> = {
  package: {
    rotulo: 'Pronta entrega',
    tracos: [
      'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
      'M12 22V12',
      'm7.5 4.27 9 5.15',
    ],
    linhas: [{ pontos: [[3.29, 7], [12, 12], [20.71, 7]] }],
  },
  plane: {
    rotulo: 'Encomende',
    tracos: [
      'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
    ],
  },
  route: {
    rotulo: 'Como funciona',
    tracos: ['M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15'],
    circulos: [
      { cx: 6, cy: 19, r: 3 },
      { cx: 18, cy: 5, r: 3 },
    ],
  },
  'shield-check': {
    rotulo: 'Garantia',
    tracos: [
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
      'm9 12 2 2 4-4',
    ],
  },
  'message-square-quote': {
    rotulo: 'Clientes',
    tracos: [
      'M14 14a2 2 0 0 0 2-2V8h-2',
      'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z',
      'M8 14a2 2 0 0 0 2-2V8H8',
    ],
  },
  flame: {
    rotulo: 'Teste de Fogo',
    tracos: [
      'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4',
    ],
  },
};

/** A ordem do funil, que é a ordem em que os destaques devem ficar no perfil:
 *  estoque, encomenda, processo, confiança, prova, conteúdo, marca. O sétimo é
 *  o globo da marca, desenhado com a imagem e não com traço. */
export const ORDEM_DOS_DESTAQUES = [
  'package',
  'plane',
  'route',
  'shield-check',
  'message-square-quote',
  'flame',
  'globo',
] as const;

/** Desenha o ícone centrado em (cx, cy), com o lado pedido. */
export function desenharIcone(
  ctx: CanvasRenderingContext2D,
  nome: string,
  cx: number,
  cy: number,
  lado: number,
  cor: string
): boolean {
  const icone = ICONES[nome];
  if (!icone) return false;

  const escala = lado / 24;
  ctx.save();
  ctx.translate(cx - lado / 2, cy - lado / 2);
  ctx.scale(escala, escala);
  ctx.strokeStyle = cor;
  // O traço é dado em unidades do ícone, e o contexto já está escalado — por
  // isso 1.7 aqui vira um traço fino e constante em qualquer tamanho de disco,
  // que é o "traço 1,5px" que o playbook pede para o set inteiro.
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const d of icone.tracos) ctx.stroke(new Path2D(d));
  for (const c of icone.circulos ?? []) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const l of icone.linhas ?? []) {
    ctx.beginPath();
    l.pontos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  }

  ctx.restore();
  return true;
}
