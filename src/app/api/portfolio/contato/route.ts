import { NextRequest, NextResponse, after } from 'next/server';
import { createHash } from 'crypto';
import { dbDoAtendente } from '@/lib/atendente/db';
import { normalizarTelefone, prepararContato, receberContato } from '@/lib/atendente/portfolio';

// Formulário de contato do portfólio (https://portfolio-arthur-prog.vercel.app) → Lia (migration 0111).
// Responde na hora e prepara depois (after): pesquisa do lead + pré-briefing. A Lia só chama o cliente
// quando a preparação termina (lib/atendente/portfolio.ts). A pesquisa leva de 30 s a alguns minutos.
//
// Proteções: CORS só para o portfólio (e localhost para testar o portfólio na máquina), campo-isca
// "site" (robô preenche, a gente finge que deu certo), corpo de até 8 KB, campos com limite de tamanho
// e no máximo 3 envios em 10 min do mesmo telefone ou do mesmo IP (guardado só como hash).

export const maxDuration = 300;

const ORIGENS = new Set(['https://portfolio-arthur-prog.vercel.app']);
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
const EMAIL = /^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,}$/;
const IDIOMAS = new Set(['pt', 'en', 'pt-pt']);
const MAX_CORPO = 8 * 1024;

const permitida = (origem: string | null) => !!origem && (ORIGENS.has(origem) || LOCAL.test(origem));

function cabecalhos(origem: string | null): Record<string, string> {
  if (!permitida(origem)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origem!,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const responder = (origem: string | null, corpo: Record<string, unknown>, status = 200) =>
  NextResponse.json(corpo, { status, headers: cabecalhos(origem) });

export function OPTIONS(req: NextRequest) {
  const origem = req.headers.get('origin');
  return new NextResponse(null, { status: permitida(origem) ? 204 : 403, headers: cabecalhos(origem) });
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '');

export async function POST(req: NextRequest) {
  const origem = req.headers.get('origin');
  if (!permitida(origem)) return responder(origem, { ok: false, erro: 'origem não permitida' }, 403);

  const bruto = await req.text();
  if (bruto.length > MAX_CORPO) return responder(origem, { ok: false, erro: 'mensagem grande demais' }, 413);
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(bruto) as Record<string, unknown>;
  } catch {
    return responder(origem, { ok: false, erro: 'formato inválido' }, 400);
  }
  if (!j || typeof j !== 'object') return responder(origem, { ok: false, erro: 'formato inválido' }, 400);

  // Campo-isca preenchido: robô. Responde como se tivesse dado certo e não grava nada.
  if (texto(j.site, 200)) return responder(origem, { ok: true });

  const nome = texto(j.nome, 120);
  const emailBruto = texto(j.email, 200).toLowerCase();
  const email = EMAIL.test(emailBruto) ? emailBruto : null;
  const telefoneBruto = texto(j.telefone, 40);
  const idioma = IDIOMAS.has(texto(j.idioma, 10)) ? texto(j.idioma, 10) : null;
  const telefone = telefoneBruto ? normalizarTelefone(telefoneBruto, idioma) : null;
  const mensagem = texto(j.mensagem, 3000) || null;
  const paginaBruta = texto(j.pagina, 500);
  const pagina = /^https?:\/\//.test(paginaBruta) ? paginaBruta : null;

  if (!nome) return responder(origem, { ok: false, erro: 'nome obrigatório' }, 400);
  if (!telefone && !email) {
    return responder(origem, { ok: false, erro: telefoneBruto ? 'telefone inválido' : 'informe telefone ou e-mail' }, 400);
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'sem-ip';
  const ipHash = createHash('sha256').update(`portfolio:${ip}`).digest('hex').slice(0, 64);

  try {
    const db = dbDoAtendente();
    const r = await receberContato(db, { nome, email, telefone, mensagem, idioma, pagina }, ipHash);
    if (!r.ok) return responder(origem, { ok: false, erro: 'muitos envios; tente de novo em alguns minutos' }, 429);
    const id = r.id;
    if (id) {
      after(async () => {
        try {
          await prepararContato(db, id);
        } catch (e) {
          console.error('[portfolio] preparação falhou', e);
        }
      });
    }
    return responder(origem, { ok: true });
  } catch (e) {
    console.error('[portfolio] contato falhou', e);
    return responder(origem, { ok: false, erro: 'falha ao registrar' }, 500);
  }
}
