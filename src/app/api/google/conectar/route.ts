import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { googleConfigurado, urlDeAutorizacao } from '@/lib/google-agenda';
import { SITE_URL } from '@/lib/seo';

// "Conectar Google Agenda" (painel da Captação > Atendimento): manda o Arthur
// para o consentimento do Google. O estado aleatório no cookie protege o retorno.

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.redirect(`${SITE_URL}/entrar?next=/admin/captacao`);
  if (!googleConfigurado()) return NextResponse.redirect(`${SITE_URL}/admin/captacao?aba=atendimento&google=sem_chaves`);
  const estado = crypto.randomUUID();
  (await cookies()).set('google_estado', estado, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/google' });
  return NextResponse.redirect(urlDeAutorizacao(estado));
}
