// Relógio dos pedidos do Claude Design (pedido do Arthur em 30/10/2026). Os pedidos da Duda e da Nina só
// valem depois das etapas anteriores (src/lib/pedidos-design.ts). A cada chamada, no máximo uma ação:
//  1. projeto com as três etapas ok e sem pedido → põe a Bia na fila para gerar a versão final e gravar
//     o texto em projetos.pedidos_design;
//  2. pedidos prontos e ainda não avisados → avisa o Arthur com o botão para o Pós-venda.
// Só no servidor.

import type { DbDoAtendente } from './db';
import type { ConfigDoAtendente } from './regras';
import type { Json } from '@/lib/supabase/database.types';
import { avisarArthur } from './avisos';
import { pedirAoAgente } from '@/lib/agentes/time';
import { etapasDoDesign, type PedidosDesign } from '@/lib/pedidos-design';
import { SITE_URL } from '@/lib/seo';

export async function cuidarDosPedidosDeDesign(db: DbDoAtendente, cfg: ConfigDoAtendente): Promise<number> {
  const { data: projetos } = await db
    .from('projetos')
    .select('id, cliente, lead_id, pasta, service_order_id, briefing_confirmado_em, pedidos_design, leads(briefing_confirmado_em, cobrancas(parcela, pago_em))')
    .eq('status', 'em_andamento')
    .not('pasta', 'is', null)
    .limit(100);
  const leadIds = (projetos ?? []).map((p) => p.lead_id).filter(Boolean) as string[];
  const { data: encomendas } = leadIds.length
    ? await db.from('encomendas').select('lead_id, pagamento').in('lead_id', leadIds).neq('status', 'cancelada')
    : { data: [] };
  const pagamentoDo = new Map((encomendas ?? []).map((e) => [e.lead_id, e.pagamento]));

  for (const p of projetos ?? []) {
    const pedidos = (p.pedidos_design ?? {}) as PedidosDesign;
    const lead = p.leads as { briefing_confirmado_em: string | null; cobrancas: { parcela: string; pago_em: string | null }[] } | null;
    const etapas = etapasDoDesign({
      pasta: p.pasta,
      sinalPago: (lead?.cobrancas ?? []).some((c) => c.parcela === 'sinal' && !!c.pago_em),
      pagamentoDaIndicacao: p.lead_id ? (pagamentoDo.get(p.lead_id) ?? null) : null,
      temPrestacao: !!p.service_order_id,
      briefingConfirmadoEm: p.briefing_confirmado_em ?? lead?.briefing_confirmado_em ?? null,
      pedidos,
    });
    if (etapas.liberado && !pedidos.pedido_em) {
      const agora = new Date().toISOString();
      // Marca antes: o próximo tick não pede de novo.
      await db.from('projetos').update({ pedidos_design: { ...pedidos, pedido_em: agora } as unknown as Json }).eq('id', p.id);
      await pedirAoAgente(db, 'bia', {
        titulo: `pedidos do Claude Design de ${p.cliente}`,
        projeto: p.cliente,
        pedido: [
          `PEDIDOS FINAIS DO CLAUDE DESIGN do projeto ${p.cliente} (id ${p.id}). As etapas anteriores estão ok: projeto aberto, financeiro resolvido e descoberta confirmada pelo cliente.`,
          `Pasta: ${p.pasta}`,
          'Siga a seção "Pedidos finais do Claude Design" das suas instruções: atualize o BRIEFING.md com tudo o que a Lia levantou e o cliente confirmou, gere a versão final de PEDIDO-DUDA.md e PEDIDO-NINA.md e grave os dois textos em projetos.pedidos_design (duda, nina, prontos_em). Não crie os artifacts de design por aqui (a fila roda na conta da LM): o Arthur dispara a Duda e a Nina na conta pessoal.',
        ].join('\n'),
      });
      return 1;
    }
    if (pedidos.prontos_em && !pedidos.avisado_em && (pedidos.duda || pedidos.nina)) {
      await db.from('projetos').update({ pedidos_design: { ...pedidos, avisado_em: new Date().toISOString() } as unknown as Json }).eq('id', p.id);
      await avisarArthur(db, cfg, {
        titulo: `🎨 Pedidos do Claude Design prontos: ${p.cliente}`,
        texto: 'Todas as etapas anteriores estão ok. Numa sessão do Claude Code na *conta pessoal*, peça: _Bia, dispara a Duda e a Nina do ' + p.cliente + '_. Ela cria o Design System e o Design no Claude e te manda os links para comentar e aprovar. (Manual: copiar os pedidos no Pós-venda e colar no Claude Design.)',
        link: `${SITE_URL}/admin/pos-venda`,
      });
      return 1;
    }
  }
  return 0;
}
