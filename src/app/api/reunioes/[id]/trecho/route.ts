import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbDoAtendente } from '@/lib/atendente/db';
import { transcrever, transcricaoConfigurada } from '@/lib/atendente/transcricao';
import type { Trecho } from '@/lib/reunioes/comum';

// Transcrição ao vivo da sala (31/10/2026): a cada ~15 s o navegador do Arthur manda o áudio de cada lado
// separado (microfone dele = "arthur"; áudio da chamada = "cliente"), e o Whisper da Groq transcreve.
// Separar os lados é o que diz quem falou, sem precisar de diarização.
// Acesso: o Arthur logado (admin) ou o segredo do relógio (testes automáticos sem login).
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 3 * 1024 * 1024;

// Frases que o Whisper inventa em silêncio ou ruído (conhecidas em português).
const ALUCINACAO =
  /^(legendas? (pela|por) .*|legendado por .*|obrigad[oa]( por assistir)?[.!]*|tchau[.!]*|\.+|inscreva-se.*|amara\.org.*|transcrição .*|música|\[música\]|\(música\))$/i;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const segredo = process.env.ATENDENTE_TICK_SECRET;
  const peloRelogio = !!segredo && req.headers.get('authorization') === `Bearer ${segredo}`;
  if (!peloRelogio && !(await requireAdmin())) return new NextResponse('Forbidden', { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ erro: 'reunião inválida' }, { status: 400 });
  if (!transcricaoConfigurada()) return NextResponse.json({ erro: 'transcrição não configurada (TRANSCRICAO_API_KEY)' }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get('audio');
  const quem = form?.get('quem') === 'cliente' ? 'cliente' : 'arthur';
  const t = Math.max(0, Math.min(6 * 3600, Number(form?.get('t') ?? 0) || 0));
  if (!(audio instanceof Blob) || audio.size < 800) return NextResponse.json({ trecho: null });
  if (audio.size > MAX_BYTES) return NextResponse.json({ erro: 'trecho grande demais' }, { status: 413 });

  const db = dbDoAtendente();
  const { data: r } = await db.from('reunioes').select('sala_status').eq('id', id).maybeSingle();
  if (!r) return NextResponse.json({ erro: 'reunião não encontrada' }, { status: 404 });

  const texto = (await transcrever(Buffer.from(await audio.arrayBuffer()), audio.type || 'audio/webm'))?.trim() ?? '';
  if (!texto || ALUCINACAO.test(texto)) return NextResponse.json({ trecho: null });
  const trecho: Trecho = { quem, t: Math.round(t), texto: texto.slice(0, 4000) };
  const { error } = await db.rpc('reuniao_acrescentar_trecho', { p_id: id, p_trecho: trecho });
  if (error) return NextResponse.json({ erro: 'não gravou o trecho' }, { status: 500 });
  return NextResponse.json({ trecho });
}
