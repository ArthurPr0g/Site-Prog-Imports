import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Robôs que montam a prévia de links (WhatsApp, Facebook, Telegram, Slack…). Nos
// links do painel da Captação/Pós-venda eles não estão logados e veriam a tela de
// login da loja: vão para a página só de prévia da Prog Soluções (sem dados).
const ROBO_DE_PREVIA = /whatsapp|facebookexternalhit|facebot|telegrambot|slackbot|twitterbot|linkedinbot|discordbot|skypeuripreview/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (/^\/admin\/(captacao|pos-venda)/.test(pathname) && ROBO_DE_PREVIA.test(request.headers.get('user-agent') ?? '')) {
    const url = request.nextUrl.clone();
    url.pathname = '/previa/prog-solucoes';
    url.search = `?p=${pathname.startsWith('/admin/pos-venda') ? 'pos-venda' : 'captacao'}`;
    return NextResponse.rewrite(url);
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
