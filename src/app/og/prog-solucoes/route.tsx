import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

// Imagem de prévia (Open Graph, 1200×630) dos links da Prog Soluções que moram
// neste domínio: diagnóstico dos leads, página do vendedor e links do painel
// (Captação, Pós-venda, Gastos). ?t= título · ?s= subtítulo · ?l=en.
//
// Refeita em 30/10/2026 ("estão borradas e esquisitas"): a prévia compacta do
// WhatsApp mostra só um QUADRADO recortado do centro da imagem. Com o texto à
// esquerda, o recorte pegava só o fundo escuro. Agora tudo é centralizado e o
// emblema "P" fica no meio: o quadrado do centro sempre mostra a marca e o título.
// Cores do design "Noite azul" (azul #5b74ff → #3349f0 sobre azul-noite).

export const runtime = 'edge';

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
  const titulo = (p.get('t') || 'Sites, lojas virtuais e sistemas').slice(0, 70);
  const sub = (p.get('s') || 'Prog Soluções · Goiânia').slice(0, 90);
  const rodape = p.get('l') === 'en' ? 'Websites · Online stores · Management systems' : 'Sites · Lojas virtuais · Sistemas de gestão';
  const tudo = `PProg Soluções${titulo}${sub}${rodape}`;
  const [bold, regular] = await Promise.all([sora(700, tudo), sora(400, tudo)]);
  const fonts = [
    ...(bold ? [{ name: 'Sora', data: bold, weight: 700 as const, style: 'normal' as const }] : []),
    ...(regular ? [{ name: 'Sora', data: regular, weight: 400 as const, style: 'normal' as const }] : []),
  ];
  const tamanho = titulo.length > 40 ? 50 : titulo.length > 24 ? 60 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070b1c',
          backgroundImage:
            'radial-gradient(circle at 50% 38%, rgba(91,116,255,0.38), transparent 42%), radial-gradient(circle at 50% 120%, rgba(255,150,90,0.14), transparent 55%), linear-gradient(180deg, #0c1336 0%, #070b1c 60%, #0a0e22 100%)',
          fontFamily: fonts.length ? 'Sora' : 'sans-serif',
          color: '#eef1ff',
          position: 'relative',
        }}
      >
        {/* Emblema no centro: é o que aparece na miniatura quadrada do WhatsApp. */}
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #6a82ff 0%, #3349f0 100%)',
            boxShadow: '0 24px 70px rgba(51,73,240,0.65)',
            fontSize: 84,
            fontWeight: 700,
            color: '#ffffff',
          }}
        >
          P
        </div>
        <div style={{ display: 'flex', marginTop: 22, fontSize: 26, fontWeight: 700, color: '#b3c0ff', letterSpacing: '0.04em' }}>Prog Soluções</div>
        <div
          style={{
            display: 'flex',
            marginTop: 26,
            maxWidth: 1000,
            textAlign: 'center',
            justifyContent: 'center',
            fontSize: tamanho,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
          }}
        >
          {titulo}
        </div>
        <div style={{ display: 'flex', marginTop: 16, maxWidth: 960, textAlign: 'center', justifyContent: 'center', fontSize: 28, color: '#b4bcdf', lineHeight: 1.3 }}>
          {sub}
        </div>
        <div style={{ position: 'absolute', bottom: 34, display: 'flex', fontSize: 20, color: '#8089b3' }}>{rodape}</div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } }
  );
}
