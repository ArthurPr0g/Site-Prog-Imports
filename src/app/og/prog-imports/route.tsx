import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

// Prévia (Open Graph, 1200×630) da loja Prog Imports. Antes a prévia era o próprio logo (500×174,
// declarado como 1200×630): no WhatsApp saía borrado e cortado (30/10/2026). Agora o logo fica
// centralizado num fundo claro e quente, inteiro dentro do quadrado do centro (a miniatura compacta
// do WhatsApp é um quadrado recortado do meio).

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const logo = new URL('/images/logo.png', req.nextUrl.origin).toString();
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
          background: '#f7f4ee',
          backgroundImage: 'radial-gradient(circle at 50% 42%, rgba(201,162,77,0.28), transparent 46%), linear-gradient(180deg, #fbf9f5 0%, #f1ece2 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={580} height={202} alt="Prog Imports" />
        <div style={{ display: 'flex', marginTop: 34, fontSize: 30, color: '#4a4540', letterSpacing: '0.02em' }}>
          Tecnologia importada premium
        </div>
        <div style={{ display: 'flex', marginTop: 10, fontSize: 22, color: '#8a8278' }}>MacBooks · iPhones · Notebooks gamer</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } }
  );
}
