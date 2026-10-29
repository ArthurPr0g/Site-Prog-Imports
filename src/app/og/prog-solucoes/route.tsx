import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

// Imagem de prévia (Open Graph, 1200×630) dos links da Prog Soluções que moram
// neste domínio: diagnóstico dos leads, página do vendedor e links do painel da
// Captação/Pós-venda (pedido do dono em 28/10/2026: "ainda está como Prog Imports").
// Visual do portfólio Arthur Prog: fundo #08080a, azul-lavanda, Sora.
// ?t= título (ex.: o nome da empresa) · ?s= subtítulo.

export const runtime = 'edge';

const LAVANDA = '#8ea4f0';

/** Sora do Google Fonts só com as letras usadas (arquivo pequeno). Sem rede, cai na fonte padrão. */
async function sora(peso: number, texto: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Sora:wght@${peso}&text=${encodeURIComponent(texto)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const titulo = (p.get('t') || 'Sites, lojas virtuais e sistemas de gestão').slice(0, 90);
  const sub = (p.get('s') || 'Prog Soluções · Goiânia').slice(0, 120);
  const rodape = p.get('l') === 'en' ? 'Websites · Online stores · Management systems' : 'Sites · Lojas virtuais · Sistemas de gestão';
  const tudo = `Prog Soluções${titulo}${sub}${rodape}`;
  const [bold, regular] = await Promise.all([sora(700, tudo), sora(400, tudo)]);
  const fonts = [
    ...(bold ? [{ name: 'Sora', data: bold, weight: 700 as const, style: 'normal' as const }] : []),
    ...(regular ? [{ name: 'Sora', data: regular, weight: 400 as const, style: 'normal' as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: '#08080a',
          backgroundImage: `radial-gradient(circle at 85% 15%, rgba(142,164,240,0.28), transparent 45%), radial-gradient(circle at 10% 110%, rgba(142,164,240,0.14), transparent 50%)`,
          fontFamily: fonts.length ? 'Sora' : 'sans-serif',
          color: '#eceef1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: LAVANDA, display: 'flex' }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex' }}>Prog Soluções</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ width: 84, height: 5, borderRadius: 3, background: LAVANDA, display: 'flex' }} />
          <div style={{ fontSize: titulo.length > 48 ? 58 : 70, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.02em', display: 'flex' }}>
            {titulo}
          </div>
          <div style={{ fontSize: 30, color: '#9ba1ab', lineHeight: 1.35, display: 'flex' }}>{sub}</div>
        </div>

        <div style={{ display: 'flex', fontSize: 22, color: '#797f89' }}>{rodape}</div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } }
  );
}
