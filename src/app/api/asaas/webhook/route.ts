import { NextRequest, NextResponse, after } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { dbDoAtendente } from '@/lib/atendente/db';
import { lerConfig, responderConversa } from '@/lib/atendente/agente';
import { enviarEmail } from '@/lib/atendente/email';
import { SITE_URL } from '@/lib/seo';

// Webhook do Asaas (registrado por scripts/asaas/registrar-webhook.mjs).
// O Asaas manda o authToken no cabeçalho `asaas-access-token` (docs.asaas.com,
// conferido em 28/10/2026). Responde 200 na hora; o resto roda depois (after).

const PAGO = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);

function tokenValido(recebido: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !recebido || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

type Evento = { event?: string; payment?: { id?: string; status?: string; value?: number } };

export async function POST(req: NextRequest) {
  if (!tokenValido(req.headers.get('asaas-access-token'))) return new NextResponse('Forbidden', { status: 403 });
  const ev = (await req.json().catch(() => ({}))) as Evento;
  const pagamento = ev.payment;
  if (!ev.event || !pagamento?.id) return NextResponse.json({ ok: true });

  const db = dbDoAtendente();
  const { data: cob } = await db
    .from('cobrancas')
    .select('id, lead_id, conversation_id, parcela, valor, status, pago_em, leads(name)')
    .eq('asaas_payment_id', pagamento.id)
    .maybeSingle();
  // Cobrança feita fora do sistema (direto no Asaas): não é nossa, só confirma.
  if (!cob) return NextResponse.json({ ok: true });

  const pagouAgora = PAGO.has(ev.event) && !cob.pago_em;
  await db
    .from('cobrancas')
    .update({
      status: pagamento.status ?? cob.status,
      ...(pagouAgora ? { pago_em: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cob.id);

  after(async () => {
    const cfg = await lerConfig(db);
    const empresa = cob.leads?.name ?? 'cliente';
    const valor = `R$ ${Number(cob.valor).toFixed(2).replace('.', ',')}`;
    const painel = `${SITE_URL}/admin/captacao?aba=atendimento${cob.conversation_id ? `&conversa=${cob.conversation_id}` : ''}`;
    if (pagouAgora) {
      if (cfg.ownerEmail) {
        await enviarEmail({
          para: cfg.ownerEmail,
          assunto: `💰 ${cob.parcela === 'sinal' ? 'Sinal' : 'Pagamento'} pago: ${empresa} (${valor})`,
          texto: `${empresa} pagou ${cob.parcela === 'sinal' ? 'o sinal' : 'a parcela da entrega'} (${valor}).\n\nConversa: ${painel}`,
          nomeDoRemetente: `${cfg.personaName} (atendente)`,
        });
      }
      if (cob.conversation_id && cob.parcela === 'sinal') {
        await responderConversa(
          cob.conversation_id,
          `O cliente pagou o sinal (${valor}). Agradeça com entusiasmo, confirme que o projeto começou e mande, numa lista curta, o material que vai ser preciso para o pacote fechado (fotos, lista de produtos com preços, textos, logo, acessos, conforme o caso). Lembre que o prazo conta a partir do material completo e que ele pode mandar tudo por aqui.`
        );
      }
    } else if (ev.event === 'PAYMENT_OVERDUE' && cfg.ownerEmail) {
      await enviarEmail({
        para: cfg.ownerEmail,
        assunto: `⏰ Cobrança vencida: ${empresa} (${valor})`,
        texto: `A cobrança ${cob.parcela === 'sinal' ? 'do sinal' : 'da entrega'} de ${empresa} venceu sem pagamento.\n\nConversa: ${painel}`,
        nomeDoRemetente: `${cfg.personaName} (atendente)`,
      });
    }
  });

  return NextResponse.json({ ok: true });
}
