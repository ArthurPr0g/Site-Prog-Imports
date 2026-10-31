import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbDoAtendente } from '@/lib/atendente/db';
import { analisarTrechos } from '@/lib/reunioes/copiloto';
import { baloesVivos } from '@/lib/reunioes/comum';

// Copiloto da sala por rota (Fase 2, 31/10/2026). A sala do Arthur usa a ação do servidor (copilotoAction); esta
// rota existe para os testes automáticos rodarem o copiloto sem login, com o segredo do relógio, como a de trechos.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const segredo = process.env.ATENDENTE_TICK_SECRET;
  const peloRelogio = !!segredo && req.headers.get('authorization') === `Bearer ${segredo}`;
  if (!peloRelogio && !(await requireAdmin())) return new NextResponse('Forbidden', { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ erro: 'reunião inválida' }, { status: 400 });
  const r = await analisarTrechos(dbDoAtendente(), id);
  return NextResponse.json({ baloes: baloesVivos(r.baloes), erro: r.erro ?? null });
}
