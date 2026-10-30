import { NextRequest, NextResponse, after } from 'next/server';
import { dbDoAtendente } from '@/lib/atendente/db';
import { lerConfig } from '@/lib/atendente/agente';
import { pesquisarProximo } from '@/lib/atendente/pesquisa';

// Relógio da pesquisa do lead (migration 0095): o pg_cron chama a cada 2 min com o segredo do relógio.
// Responde na hora (o pg_net espera só 5 s) e pesquisa depois, em segundo plano: a busca web leva de 30 s
// a alguns minutos, mais do que o relógio de 1 min aguenta.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const segredo = process.env.ATENDENTE_TICK_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  after(async () => {
    const db = dbDoAtendente();
    await pesquisarProximo(db, await lerConfig(db));
  });
  return NextResponse.json({ ok: true });
}
