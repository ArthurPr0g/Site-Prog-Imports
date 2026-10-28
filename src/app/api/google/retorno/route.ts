import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { dbDoAtendente } from '@/lib/atendente/db';
import { conectar } from '@/lib/google-agenda';
import { SITE_URL } from '@/lib/seo';

// Volta do consentimento do Google: confere o estado, troca o código pelo
// refresh token e guarda (tabela integracoes, só o servidor lê).

export async function GET(req: NextRequest) {
  const voltar = (r: string) => NextResponse.redirect(`${SITE_URL}/admin/captacao?aba=atendimento&google=${r}`);
  if (!(await requireAdmin())) return NextResponse.redirect(`${SITE_URL}/entrar?next=/admin/captacao`);
  const jar = await cookies();
  const estado = jar.get('google_estado')?.value;
  jar.delete({ name: 'google_estado', path: '/api/google' });
  const p = req.nextUrl.searchParams;
  if (p.get('error')) return voltar('cancelado');
  const codigo = p.get('code');
  if (!codigo || !estado || p.get('state') !== estado) return voltar('erro');
  const erro = await conectar(dbDoAtendente(), codigo);
  return voltar(erro ? 'erro' : 'ok');
}
