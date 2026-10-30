import { NextRequest, NextResponse, after } from 'next/server';
import { dbDoAtendente } from '@/lib/atendente/db';
import { lerConfig } from '@/lib/atendente/agente';
import { pesquisarProximo } from '@/lib/atendente/pesquisa';
import { baterRelogio, verificarSaude } from '@/lib/atendente/saude';
import { passoDoEnsaio } from '@/lib/atendente/ensaio-semanal';

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
    const cfg = await lerConfig(db);
    // Este relógio também vigia o do minuto (saude.ts) e roda o ensaio semanal da Lia, um passo por vez.
    await baterRelogio(db, 'pesquisa');
    await verificarSaude(db, cfg, 'pesquisa');
    await pesquisarProximo(db, cfg);
    await passoDoEnsaio(db, cfg);
  });
  return NextResponse.json({ ok: true });
}
