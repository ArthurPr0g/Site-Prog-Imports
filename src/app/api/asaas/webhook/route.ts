import { NextRequest, NextResponse, after } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { dbDoAtendente } from '@/lib/atendente/db';
import { lerConfig, responderConversa } from '@/lib/atendente/agente';
import { enviarEmail } from '@/lib/atendente/email';
import { SITE_URL } from '@/lib/seo';
import { abrirPrestacaoDoSinal } from '@/lib/atendente/prestacao-do-sinal';
import { pedirAoAgente } from '@/lib/agentes/time';

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
    const painel = `${SITE_URL}/admin/atendimento${cob.conversation_id ? `&conversa=${cob.conversation_id}` : ''}`;
    if (pagouAgora) {
      // Sinal pago: a venda vira Prestação de serviço para o Arthur começar.
      const prestacao = cob.parcela === 'sinal' ? await abrirPrestacaoDoSinal(db, cob.id) : null;
      if (prestacao && !prestacao.ok) console.error('[asaas] prestação não aberta', cob.id, prestacao.motivo);
      // Sinal pago = a Bia abre o projeto no PC (pasta, briefing e pedidos para a Duda e a Nina; docs/AGENTES.md).
      if (prestacao?.ok) {
        const { data: pj } = await db.from('projetos').select('id, cliente').eq('lead_id', cob.lead_id).maybeSingle();
        await pedirAoAgente(db, 'bia', {
          titulo: `abrir o projeto de ${pj?.cliente ?? empresa}`,
          projeto: pj?.cliente ?? empresa,
          pedido: [
            `O cliente ${empresa} pagou o sinal (${valor}). Abra o projeto: pasta do cliente, briefing e os pedidos para a Duda e a Nina no Claude Design.`,
            pj ? `Projeto no Pós-venda: ${pj.id}` : `Projeto no Pós-venda: não achei pelo lead ${cob.lead_id}; procure pelo nome.`,
            `Prestação de serviço: ${prestacao.orderId}`,
          ].join('\n'),
        });
      }
      if (cfg.ownerEmail) {
        await enviarEmail({
          para: cfg.ownerEmail,
          assunto: `💰 ${cob.parcela === 'sinal' ? 'Sinal' : 'Pagamento'} pago: ${empresa} (${valor})`,
          texto: [
            `${empresa} pagou ${cob.parcela === 'sinal' ? 'o sinal' : 'a parcela da entrega'} (${valor}).`,
            prestacao?.ok
              ? `\nA prestação de serviço já está aberta para você começar: ${SITE_URL}/admin/prestacao-servico`
              : prestacao
                ? `\nNão consegui abrir a prestação sozinho (${prestacao.motivo}). Abra à mão no ERP.`
                : '',
            `\nConversa: ${painel}`,
          ].join('\n'),
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
