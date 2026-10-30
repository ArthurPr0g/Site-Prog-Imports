// Sinal pago → Prestação de serviço. Só no servidor (roda no webhook do Asaas,
// sem sessão, com a chave do atendente).
//
// Pedido do dono (29/10/2026): quando o cliente paga o sinal, a venda cai
// sozinha na página de Prestação de serviço para ele começar o desenvolvimento,
// já com tudo o que a Captação sabe do cliente. Mesmos serviços do catálogo que
// o cliente aceitou (pacote da última proposta da Lia), combo e mensalidade
// pelo ajuste automático do ERP, condição "Pix ou boleto (50% + 50%)" com a
// primeira parcela já recebida, e o Financeiro sincronizado.

import type { DbDoAtendente } from '@/lib/atendente/db';
import { NOMES, type Escolha } from '@/lib/simulador';
import { escolhaDoJson } from '@/lib/pos-venda';
import { mensalidadeDoServico } from '@/lib/itens-do-kit';
import { ajustarCombosEMensalidades } from '@/lib/combo-servicos';
import {
  calcularEntrega,
  totalizarItens,
  PLAN_MONTHS_DEFAULT,
  type BillingType,
  type InternalService,
  type ServiceOrderItem,
} from '@/lib/services';
import { aplicarDesconto, type Desconto, SEM_DESCONTO } from '@/lib/discount';
import { carneDaCondicao, condicoesGravadas, METODO_50_50 } from '@/lib/pagamento-servico';
import { salvarParcelas } from '@/lib/data/installments';
import { sincronizarFinanceiroDaPrestacao } from '@/lib/data/service-orders';
import { buscarCliente } from '@/lib/pagamentos/asaas';
import { CHECKLIST, type RespostasDoChecklist } from '@/lib/checklist-descoberta';
import { SITE_URL } from '@/lib/seo';

const hojeEmBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const dataBR = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Serviços (nomes do catálogo) do pacote que a Lia propôs. */
function nomesDoPacote(e: Escolha): string[] {
  const nomes = [NOMES.BRL[e.produto][e.nivel]];
  if (e.comGestao && e.produto !== 'erp') nomes.push(NOMES.BRL.erp[e.nivelGestao]);
  if (e.marca) nomes.push(NOMES.BRL.marca[e.marca - 1]);
  for (const n of [...nomes]) {
    const m = mensalidadeDoServico(n);
    if (m && !nomes.includes(m)) nomes.push(m);
  }
  return nomes;
}

/** O que o cliente contou na descoberta, em linhas legíveis. */
function descobertaEmTexto(r: RespostasDoChecklist): string[] {
  return CHECKLIST.filter((p) => r[p.chave] && (!Array.isArray(r[p.chave]) || (r[p.chave] as string[]).length)).map((p) => {
    const v = r[p.chave];
    return `• ${p.pergunta} ${Array.isArray(v) ? v.join(', ') : String(v)}`;
  });
}

export type PastaDoCliente = { empresa: string; responsavel: string | null };

/** Nome da pasta no OneDrive (o mesmo que a tarefa do PC usa). */
export function nomeDaPasta(p: PastaDoCliente): string {
  // "Pessoa - Empresa" (padrão do Arthur desde 30/10/2026; antes era "Empresa - Pessoa").
  const primeiro = (p.responsavel ?? '').trim().split(/\s+/)[0];
  const jaTemPessoa = primeiro && p.empresa.toLowerCase().startsWith(`${primeiro.toLowerCase()} - `);
  return (primeiro && !jaTemPessoa ? `${primeiro} - ${p.empresa}` : p.empresa).replace(/[<>:"/\\|?*]/g, ' ').trim();
}

/**
 * Abre a prestação do lead (uma só por lead; se já existir, só dá baixa na
 * primeira parcela). Devolve o id da prestação ou um motivo de não ter aberto.
 */
export async function abrirPrestacaoDoSinal(
  db: DbDoAtendente,
  cobrancaId: string
): Promise<{ ok: true; orderId: string } | { ok: false; motivo: string }> {
  const { data: cob } = await db
    .from('cobrancas')
    .select('id, lead_id, conversation_id, valor, link, pago_em, asaas_payment_id')
    .eq('id', cobrancaId)
    .maybeSingle();
  if (!cob) return { ok: false, motivo: 'cobrança não encontrada' };
  const pagoEm = (cob.pago_em ?? new Date().toISOString()).slice(0, 10);

  const { data: lead } = await db
    .from('leads')
    .select(
      'id, name, city, state, email, phone, responsible_name, customer_id, asaas_customer_id, closed_value, closed_monthly, pacote, discovery, reasons, public_token, website, instagram'
    )
    .eq('id', cob.lead_id)
    .maybeSingle();
  if (!lead) return { ok: false, motivo: 'lead não encontrado' };

  // Já existe (webhook repetido, ou o Arthur abriu à mão): só dá baixa no sinal.
  const { data: existente } = await db
    .from('service_orders')
    .select('id')
    .eq('lead_id', lead.id)
    .neq('status', 'Cancelada')
    .maybeSingle();
  if (existente) {
    await darBaixaNoSinal(db, existente.id, pagoEm);
    return { ok: true, orderId: existente.id };
  }

  const { data: conversa } = cob.conversation_id
    ? await db.from('ia_conversations').select('id, contact_id, contact_name, summary').eq('id', cob.conversation_id).maybeSingle()
    : { data: null };

  // Cliente do ERP: o que já existe, ou um novo com o CPF/CNPJ do cadastro no Asaas.
  let customerId = lead.customer_id;
  if (!customerId) {
    const asaas = lead.asaas_customer_id ? await buscarCliente(lead.asaas_customer_id) : null;
    const dados = asaas?.ok ? asaas.dados : null;
    const telefone = conversa?.contact_id?.startsWith('55') ? `+${conversa.contact_id}` : lead.phone;
    const { data: novo, error } = await db
      .from('customers')
      .insert({
        name: lead.responsible_name || dados?.name || conversa?.contact_name || lead.name,
        company: lead.name,
        email: dados?.email || lead.email,
        phone: telefone,
        doc: dados?.cpfCnpj ?? null,
        city: lead.city,
        state: lead.state,
        notes: 'Cliente criado pela Captação (Lia) quando o sinal foi pago.',
      })
      .select('id')
      .single();
    if (error || !novo) return { ok: false, motivo: `cliente não criado: ${error?.message ?? ''}` };
    customerId = novo.id;
    await db.from('leads').update({ customer_id: customerId }).eq('id', lead.id);
  }

  // Serviços do pacote aceito, pelo catálogo de agora.
  const { data: servicos } = await db.from('internal_services').select('*').eq('active', true);
  const catalogo: InternalService[] = (servicos ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    category: s.category ?? '',
    price: Number(s.price),
    billingType: s.billing_type as BillingType,
    leadTimeDays: s.lead_time_days ?? 0,
    active: s.active,
    position: s.position ?? 0,
  }));
  const porNome = new Map(catalogo.map((s) => [s.name, s]));
  // Pacote da última proposta (leads.pacote, gravado pela Lia ao passar o preço; 0086).
  const pacote = escolhaDoJson(lead.pacote);
  const nomes = pacote ? nomesDoPacote(pacote) : [];
  const itens: ServiceOrderItem[] = nomes
    .map((n) => porNome.get(n))
    .filter((s): s is InternalService => !!s)
    .map((s) => ({
      internalServiceId: s.id,
      name: s.name,
      description: s.description,
      amount: s.price,
      billingType: s.billingType,
      leadTimeDays: s.leadTimeDays,
    }));
  if (itens.length === 0) return { ok: false, motivo: 'pacote da proposta não encontrado no catálogo' };
  const ajustados = ajustarCombosEMensalidades(itens, catalogo)?.items ?? itens;
  const { total, mensal, prazoDias, temPlano } = totalizarItens(ajustados);

  // Desconto extra que o superior aprovou: a diferença para o valor fechado.
  const fechado = Number(lead.closed_value ?? 0);
  const extra = fechado > 0 ? Math.round((total - fechado) * 100) / 100 : 0;
  const desconto: Desconto =
    extra >= 1 ? { tipo: 'valor', valor: extra, descricao: 'Condição especial aprovada na negociação (Lia)' } : SEM_DESCONTO;
  const trabalho = aplicarDesconto(total, desconto);

  const inicio = hojeEmBrasilia();
  const entrega = calcularEntrega(inicio, prazoDias);
  const carne = carneDaCondicao(METODO_50_50, trabalho, inicio, entrega) ?? [];
  // Sinal (parcela 0) já pago no Asaas.
  const carneComSinal = carne.map((p) => (p.number === 0 ? { ...p, status: 'Recebida' as const, paidAt: pagoEm } : p));

  const projeto = nomes.filter((n) => !/^Mensalidade/i.test(n)).join(' + ');
  const responsavel = lead.responsible_name || conversa?.contact_name || null;
  const descoberta = descobertaEmTexto((lead.discovery ?? {}) as RespostasDoChecklist);
  const notas = [
    `Venda fechada pela Lia (Captação). Sinal de ${reais(Number(cob.valor))} pago em ${dataBR(cob.pago_em)} pelo Asaas.`,
    `Responsável: ${responsavel ?? 'não informado'}${conversa?.contact_id ? ` · WhatsApp +${conversa.contact_id}` : ''}${lead.email ? ` · ${lead.email}` : ''}`,
    `Prazo: até ${prazoDias} dias úteis contados do material completo (textos, fotos e acessos). Entrega prevista aqui é estimada a partir de hoje.`,
    `Pasta no OneDrive: 05 - Negócios > 1 - Prog Soluções > 2 - Clientes > ${nomeDaPasta({ empresa: lead.name, responsavel })}`,
    `Diagnóstico: ${SITE_URL}/diagnostico/${lead.public_token}`,
    ...(conversa ? [`Conversa com a Lia: ${SITE_URL}/admin/atendimento?conversa=${conversa.id}`] : []),
    ...(lead.website ? [`Site atual: ${lead.website}`] : []),
    ...(lead.instagram ? [`Instagram: ${lead.instagram}`] : []),
    ...((lead.reasons ?? []).length ? ['', 'O que o diagnóstico apontou:', ...(lead.reasons ?? []).map((m) => `• ${m}`)] : []),
    ...(descoberta.length ? ['', 'O que o cliente contou (descoberta):', ...descoberta] : []),
    ...(conversa?.summary ? ['', `Resumo da conversa: ${conversa.summary}`] : []),
  ].join('\n');

  const { data: ordem, error: erroOrdem } = await db
    .from('service_orders')
    .insert({
      customer_id: customerId,
      lead_id: lead.id,
      title: `${projeto} — ${lead.name}`,
      notes: notas,
      status: 'Em andamento',
      payment_status: 'Previsto',
      payment_method: METODO_50_50,
      total_amount: total,
      monthly_amount: mensal,
      discount_type: desconto.tipo,
      discount_value: desconto.valor,
      discount_note: desconto.descricao,
      ...condicoesGravadas(carneComSinal),
      installment_notes: '',
      plan_months: temPlano ? PLAN_MONTHS_DEFAULT : null,
      // A mensalidade começa na entrega do projeto.
      plan_start_date: temPlano ? (entrega ?? inicio) : null,
      lead_time_days: prazoDias,
      start_date: inicio,
      due_date: entrega,
    })
    .select('id')
    .single();
  if (erroOrdem || !ordem) return { ok: false, motivo: `prestação não criada: ${erroOrdem?.message ?? ''}` };

  await db.from('service_order_items').insert(
    ajustados.map((i, posicao) => ({
      order_id: ordem.id,
      internal_service_id: i.internalServiceId,
      name: i.name,
      description: i.description,
      amount: i.amount,
      billing_type: i.billingType,
      lead_time_days: i.billingType === 'mensal' ? 0 : i.leadTimeDays,
      position: posicao,
    }))
  );
  if (carneComSinal.length) await salvarParcelas('servico', ordem.id, carneComSinal, undefined, db);
  await sincronizarFinanceiroDaPrestacao(ordem.id, db);
  // Liga ao projeto do pós-venda (nasce no fechamento; 0086).
  await db.from('projetos').update({ service_order_id: ordem.id }).eq('lead_id', lead.id);
  return { ok: true, orderId: ordem.id };
}

async function darBaixaNoSinal(db: DbDoAtendente, orderId: string, pagoEm: string) {
  await db
    .from('payment_installments')
    .update({ status: 'Recebida', paid_at: pagoEm, updated_at: new Date().toISOString() })
    .eq('source_type', 'servico')
    .eq('source_id', orderId)
    .eq('number', 0)
    .neq('status', 'Recebida');
  await sincronizarFinanceiroDaPrestacao(orderId, db);
}
