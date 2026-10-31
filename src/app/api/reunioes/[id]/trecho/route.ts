import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbDoAtendente } from '@/lib/atendente/db';
import { transcreverComTempo, transcricaoConfigurada } from '@/lib/atendente/transcricao';
import { lerEnergia, trechosTranscritos } from '@/lib/reunioes/comum';

// Transcrição ao vivo da sala. Fase 2 (31/10/2026): o navegador do Arthur manda a cada ~15 s UM áudio, a
// mistura da reunião, e a energia de cada lado (microfone dele e áudio da chamada) a cada 200 ms. O Whisper da
// Groq devolve os segmentos com o tempo; quem falou em cada um é o lado com mais energia naquele intervalo.
// Antes eram dois áudios (um por lado): 1 h de reunião gastava sozinha os 7.200 s/h do plano grátis da Groq.
// Limite batido (429): o áudio vai para o Storage e a lista de pendentes; ao encerrar, é transcrito.
// Acesso: o Arthur logado (admin) ou o segredo do relógio (testes automáticos sem login).
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const segredo = process.env.ATENDENTE_TICK_SECRET;
  const peloRelogio = !!segredo && req.headers.get('authorization') === `Bearer ${segredo}`;
  if (!peloRelogio && !(await requireAdmin())) return new NextResponse('Forbidden', { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ erro: 'reunião inválida' }, { status: 400 });
  if (!transcricaoConfigurada()) return NextResponse.json({ erro: 'transcrição não configurada (TRANSCRICAO_API_KEY)' }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get('audio');
  const t = Math.max(0, Math.min(6 * 3600, Number(form?.get('t') ?? 0) || 0));
  const energia = lerEnergia(form?.get('energia'));
  // Compatível com a Fase 1 (aba aberta antes do deploy): sem energia, vale o lado do campo "quem".
  const q = form?.get('quem');
  const quemFixo = q === 'cliente' || q === 'arthur' ? q : null;
  if (!(audio instanceof Blob) || audio.size < 800) return NextResponse.json({ trechos: [] });
  if (audio.size > MAX_BYTES) return NextResponse.json({ erro: 'trecho grande demais' }, { status: 413 });

  const db = dbDoAtendente();
  const { data: r } = await db.from('reunioes').select('sala_status, leads(name)').eq('id', id).maybeSingle();
  if (!r) return NextResponse.json({ erro: 'reunião não encontrada' }, { status: 404 });

  const dados = Buffer.from(await audio.arrayBuffer());
  const res = await transcreverComTempo(dados, audio.type || 'audio/webm', r.leads?.name ?? undefined);

  if (!res.ok && res.limite) {
    // Limite do plano: guarda o áudio para transcrever no fim (nada se perde).
    const path = `${id}/pendente-${String(Math.round(t)).padStart(5, '0')}-${Date.now().toString(36)}.webm`;
    const { error } = await db.storage.from('reunioes').upload(path, dados, { contentType: 'audio/webm', upsert: false });
    if (!error) await db.rpc('reuniao_guardar_pendente', { p_id: id, p_item: { t: Math.round(t), path, energia, quem: quemFixo } });
    return NextResponse.json({ trechos: [], adiado: true, esperarSeg: res.esperarSeg, guardado: !error });
  }
  if (!res.ok) return NextResponse.json({ erro: 'a transcrição falhou' }, { status: 502 });

  const trechos = trechosTranscritos(res, energia, t, quemFixo);
  for (const x of trechos) {
    const { error } = await db.rpc('reuniao_acrescentar_trecho', { p_id: id, p_trecho: x });
    if (error) return NextResponse.json({ erro: 'não gravou o trecho' }, { status: 500 });
  }
  return NextResponse.json({ trechos });
}
