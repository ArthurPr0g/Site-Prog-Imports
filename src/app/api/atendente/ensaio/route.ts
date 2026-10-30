import { NextRequest, NextResponse } from 'next/server';
import { dbDoAtendente } from '@/lib/atendente/db';
import { responderConversa, SIMULADOR } from '@/lib/atendente/agente';
import { interpretarPedido } from '@/lib/atendente/encomenda';
import { asaasConfigurado, ambienteAsaas } from '@/lib/pagamentos/asaas';
import { whatsappConfigurado } from '@/lib/atendente/whatsapp-api';
import { transcricaoConfigurada } from '@/lib/atendente/transcricao';
import { emailConfigurado } from '@/lib/atendente/email';

// Ensaio e saúde do sistema (30/10/2026, antes do piloto do Felipe). Mesmo segredo do relógio; chamado
// pelo banco (pg_net), então o segredo não sai do cofre. Nada aqui manda mensagem a cliente:
//   { acao: 'saude' }                          o que está configurado (sem mostrar valores)
//   { acao: 'interpretar', nome, texto }       como a Lia lê um pedido "Lia, faça todo o projeto"
//   { acao: 'responder', conversaId }          a Lia responde, SÓ em conversa do simulador

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const segredo = process.env.ATENDENTE_TICK_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; nome?: string; texto?: string; conversaId?: string };
  const db = dbDoAtendente();

  if (corpo.acao === 'saude') {
    const { count } = await db.from('integracoes').select('chave', { count: 'exact', head: true });
    return NextResponse.json({
      asaas: asaasConfigurado() ? ambienteAsaas() : 'não configurado',
      whatsapp: whatsappConfigurado(),
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      transcricao: transcricaoConfigurada(),
      email: emailConfigurado(),
      integracoesGoogle: count ?? 0,
    });
  }
  if (corpo.acao === 'interpretar' && corpo.texto) {
    return NextResponse.json(await interpretarPedido(db, corpo.nome ?? null, corpo.texto));
  }
  if (corpo.acao === 'responder' && corpo.conversaId) {
    const { data: c } = await db.from('ia_conversations').select('contact_id').eq('id', corpo.conversaId).maybeSingle();
    if (!c?.contact_id.startsWith(SIMULADOR)) return NextResponse.json({ erro: 'só conversa do simulador' }, { status: 400 });
    const motivo = await responderConversa(corpo.conversaId);
    return NextResponse.json({ motivo });
  }
  return NextResponse.json({ erro: 'ação desconhecida' }, { status: 400 });
}
