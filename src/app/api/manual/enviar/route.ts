import { NextRequest, NextResponse } from 'next/server';
import { enviarTexto } from '@/lib/atendente/whatsapp-api';
import { ehDoManual, tokenDoManualConfere } from '@/lib/atendente/manual';

// PROVISÓRIO (MVP do Manual do Empreendedorismo Médico, 30/10/2026): a porta do Manual (Supabase da LM)
// chama aqui para entregar as respostas ao Ian pelo número da Lia. Só aceita o token do Manual e só
// manda para os números de MANUAL_NUMEROS. Ver src/lib/atendente/manual.ts.

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!tokenDoManualConfere(req.headers.get('x-mem-canal-token'))) {
    return NextResponse.json({ ok: false, erro: 'não autorizado' }, { status: 401 });
  }
  const corpo = (await req.json().catch(() => null)) as { para?: string; textos?: string[] } | null;
  const para = corpo?.para ?? '';
  const textos = (corpo?.textos ?? []).filter((t) => typeof t === 'string' && t.trim()).slice(0, 12);
  if (!para || !textos.length) return NextResponse.json({ ok: false, erro: 'corpo inválido' }, { status: 400 });
  if (!ehDoManual(para)) return NextResponse.json({ ok: false, erro: 'número fora do Manual' }, { status: 403 });
  const resultados = [];
  for (const t of textos) resultados.push(await enviarTexto(para, t.slice(0, 4000)));
  const falhas = resultados.filter((r) => !r.ok);
  return NextResponse.json({ ok: !falhas.length, enviados: resultados.length - falhas.length, erros: falhas.map((f) => (f.ok ? '' : f.erro)) }, { status: falhas.length ? 502 : 200 });
}
