'use server';
// Sala de reunião, Fases 2 e 3 (31/10/2026; migration 0118): copiloto, anotações, botões de ação e a sala de
// espera do cliente. O admin é conferido em cada ação; o banco é lido pela chave do servidor.
//
// Botões de ação (coluna Ações): cada um mostra um resumo e pede confirmação na tela antes de chamar o que grava.
// Reaproveitam o que já existe: Asaas (pagamentos/asaas.ts, igual ao gerar_cobranca_do_sinal da Lia), a
// pré-proposta em PDF da Lia (montarPreProposta + PrePropostaDocument), o desconto extra (ia_discount_requests,
// que o calcular_preco da Lia já aplica), a sala da reunião (novaReuniaoAction) com a Agenda do Google, e o
// Pós-venda (criarProjetoDaVenda, o mesmo do mudar_etapa "fechado"; o Téo e a Bia continuam no fluxo deles,
// disparados pelo sinal pago). Tudo fica registrado na reunião (reunioes.acoes) e na pré-venda (observações).
//
// Nunca manda nada a lead de teste ("TESTE" no nome) nem a conversa do simulador; WhatsApp só dentro da janela de
// 24 h (fora dela, texto livre não é entregue: avisa que precisa de modelo aprovado).

import { renderToBuffer } from '@react-pdf/renderer';
import { requireAdmin } from '@/lib/auth';
import { dbDoAtendente, type DbDoAtendente } from '@/lib/atendente/db';
import { type ActionResult, okResult, errResult } from '@/lib/action-result';
import { lerConfig, SIMULADOR } from '@/lib/atendente/agente';
import { enviarComLink, enviarDocumento, enviarTexto, JANELA_MS, whatsappConfigurado } from '@/lib/atendente/whatsapp-api';
import { emailConfigurado, enviarEmail } from '@/lib/atendente/email';
import { asaasConfigurado, ambienteAsaas, criarCliente, criarCobranca, daquiA, documentoValido } from '@/lib/pagamentos/asaas';
import { montarPreProposta } from '@/lib/pdf/montar-pre-proposta';
import { PrePropostaDocument } from '@/lib/pdf/pre-proposta';
import { calcularProposta } from '@/lib/atendente/regras';
import { criarProjetoDaVenda, escolhaDoJson } from '@/lib/pos-venda';
import { CASES, linkDoCase } from '@/lib/cases-portfolio';
import { dinheiroDoPais } from '@/lib/idioma-do-lead';
import { agendaConectada, agendaDe, criarEventoNaAgenda, horarioPorExtenso, horariosLivres, ocupadosNaAgenda } from '@/lib/google-agenda';
import { LEAD_STATUS_LABEL } from '@/lib/captacao';
import type { Escolha } from '@/lib/simulador';
import type { Json } from '@/lib/supabase/database.types';
import { analisarTrechos } from '@/lib/reunioes/copiloto';
import { catalogoDoLead } from '@/lib/reunioes/catalogo';
import { linkDoCliente } from '@/lib/reunioes/sala';
import { baloesVivos, type AcaoDaSala, type Balao } from '@/lib/reunioes/comum';
import { novaReuniaoAction } from './reunioes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,60}$/;
const ehTeste = (nome: string | null | undefined) => /teste/i.test(nome ?? '');

async function db() {
  return (await requireAdmin()) ? dbDoAtendente() : null;
}

/* ------------------------------------------------------------ apoio */

type Contexto = {
  id: string;
  leadId: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  teste: boolean;
  conversa: { id: string; contato: string; janela: boolean; simulada: boolean } | null;
};

async function contextoDaReuniao(d: DbDoAtendente, id: string): Promise<Contexto | null> {
  const { data: r } = await d.from('reunioes').select('id, lead_id, email_cliente, leads(name, email, phone)').eq('id', id).maybeSingle();
  if (!r) return null;
  const { data: c } = r.lead_id
    ? await d.from('ia_conversations').select('id, contact_id, last_inbound_at').eq('lead_id', r.lead_id).order('last_message_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const nome = r.leads?.name ?? 'Cliente';
  return {
    id,
    leadId: r.lead_id,
    nome,
    email: r.leads?.email || r.email_cliente || null,
    telefone: r.leads?.phone ?? null,
    teste: ehTeste(nome),
    conversa: c
      ? {
          id: c.id,
          contato: c.contact_id,
          simulada: c.contact_id.startsWith(SIMULADOR),
          janela: !!c.last_inbound_at && Date.now() - new Date(c.last_inbound_at).getTime() < JANELA_MS - 5 * 60_000,
        }
      : null,
  };
}

/** Registra a ação na reunião e na pré-venda do lead (linha nas observações; campos extras quando houver). */
async function registrar(d: DbDoAtendente, c: Contexto, tipo: string, texto: string, ok: boolean, prevenda?: Record<string, unknown>) {
  const acao: AcaoDaSala = { em: new Date().toISOString(), tipo, texto: texto.slice(0, 600), ok };
  await d.rpc('reuniao_registrar_acao', { p_id: c.id, p_acao: acao as unknown as Json });
  if (!c.leadId) return;
  const { data: pv } = await d.from('prevenda').select('observacoes').eq('lead_id', c.leadId).maybeSingle();
  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const linha = `[Sala ${quando}] ${texto}`;
  await d
    .from('prevenda')
    .upsert({ lead_id: c.leadId, observacoes: [pv?.observacoes, linha].filter(Boolean).join('\n').slice(-20000), updated_at: new Date().toISOString(), ...(prevenda ?? {}) });
}

/** Grava no histórico da conversa o que saiu pelo WhatsApp (como a Lia faz). */
async function noHistorico(d: DbDoAtendente, conversaId: string, texto: string, r: { ok: true; id: string } | { ok: false; erro: string }) {
  await d.from('ia_messages').insert({
    conversation_id: conversaId,
    direction: 'out',
    author: 'sistema',
    body: texto.slice(0, 4000),
    ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }),
  });
}

/** Pode mandar texto livre pelo WhatsApp agora? Devolve o motivo quando não. */
function podeWhatsApp(c: Contexto): string | null {
  if (c.teste) return 'lead de teste: nada é enviado';
  if (!c.conversa) return 'o lead não tem conversa no WhatsApp';
  if (c.conversa.simulada) return 'conversa do simulador';
  if (!whatsappConfigurado()) return 'WhatsApp não configurado';
  if (!c.conversa.janela) return 'fora da janela de 24 h: precisa de um modelo aprovado pela Meta';
  return null;
}

/* ------------------------------------------------------------ copiloto e anotações */

export async function copilotoAction(id: string): Promise<{ baloes: Balao[]; erro?: string }> {
  const d = await db();
  if (!d || !UUID.test(id)) return { baloes: [], erro: 'Sem permissão.' };
  const r = await analisarTrechos(d, id);
  return { baloes: baloesVivos(r.baloes), erro: r.erro };
}

export async function dispensarBalaoAction(id: string, balaoId: string): Promise<void> {
  const d = await db();
  if (!d || !UUID.test(id)) return;
  const { data: r } = await d.from('reunioes').select('copiloto').eq('id', id).maybeSingle();
  const lista = ((Array.isArray(r?.copiloto) ? r.copiloto : []) as Balao[]).map((b) => (b.id === balaoId ? { ...b, dispensado: true } : b));
  await d.from('reunioes').update({ copiloto: lista as unknown as Json }).eq('id', id);
}

export async function salvarAnotacoesAction(id: string, texto: string): Promise<ActionResult> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const { error } = await d.from('reunioes').update({ anotacoes: texto.slice(0, 20000) || null }).eq('id', id);
  return error ? errResult('Não salvou as anotações.') : okResult('');
}

/* ------------------------------------------------------------ cobrança do sinal */

export type ResumoDoSinal =
  | {
      ok: true;
      cliente: string;
      email: string | null;
      whatsapp: string;
      total: number;
      origem: string;
      sinal: number;
      vencimento: string;
      precisaDocumento: boolean;
      existente: { valor: number; link: string } | null;
      ambiente: string;
      moeda: 'BRL' | 'USD';
    }
  | { ok: false; message: string };

/** Valor do projeto: o combinado na pré-venda; senão o último passado ao lead; senão o pacote pelo catálogo. */
async function valorDoProjeto(d: DbDoAtendente, leadId: string): Promise<{ total: number; origem: string; moeda: 'BRL' | 'USD' } | null> {
  const [{ data: pv }, { data: l }] = await Promise.all([
    d.from('prevenda').select('valor_proposta').eq('lead_id', leadId).maybeSingle(),
    d.from('leads').select('closed_value, closed_currency, pacote').eq('id', leadId).maybeSingle(),
  ]);
  const moeda = (l?.closed_currency as 'BRL' | 'USD' | null) ?? 'BRL';
  if (Number(pv?.valor_proposta) > 0) return { total: Number(pv!.valor_proposta), origem: 'valor combinado na pré-venda', moeda };
  if (Number(l?.closed_value) > 0) return { total: Number(l!.closed_value), origem: 'última proposta passada ao cliente', moeda };
  const e = escolhaDoJson(l?.pacote);
  if (!e) return null;
  const cat = await catalogoDoLead(d, leadId);
  const p = calcularProposta(e, cat.tabela, 0, cat.prazos);
  return p.total > 0 ? { total: p.total, origem: 'pacote do lead, preço cheio do catálogo', moeda: cat.tabela.moeda } : null;
}

export async function resumoDoSinalAction(id: string): Promise<ResumoDoSinal> {
  const d = await db();
  if (!d || !UUID.test(id)) return { ok: false, message: 'Sem permissão.' };
  const c = await contextoDaReuniao(d, id);
  if (!c?.leadId) return { ok: false, message: 'A reunião não tem lead ligado.' };
  if (!asaasConfigurado()) return { ok: false, message: 'O Asaas não está configurado (ASAAS_API_KEY).' };
  const v = await valorDoProjeto(d, c.leadId);
  if (!v) return { ok: false, message: 'Sem valor: passe o preço (Enviar proposta) ou digite o valor combinado na pré-venda.' };
  const ambiente = ambienteAsaas();
  const [{ data: existente }, { data: l }] = await Promise.all([
    d.from('cobrancas').select('valor, link').match({ lead_id: c.leadId, parcela: 'sinal', ambiente }).maybeSingle(),
    d.from('leads').select('asaas_customer_id').eq('id', c.leadId).maybeSingle(),
  ]);
  const motivo = podeWhatsApp(c);
  return {
    ok: true,
    cliente: c.nome,
    email: c.email,
    whatsapp: motivo ? `não vai (${motivo})` : 'vai o link agora (janela de 24 h aberta)',
    total: v.total,
    origem: v.origem,
    sinal: Math.round((v.total / 2) * 100) / 100,
    vencimento: daquiA(3),
    precisaDocumento: !l?.asaas_customer_id,
    existente: existente?.link ? { valor: Number(existente.valor), link: existente.link } : null,
    ambiente,
    moeda: v.moeda,
  };
}

export async function dispararSinalAction(id: string, entrada: { documento?: string; nome?: string }): Promise<ActionResult & { link?: string }> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const c = await contextoDaReuniao(d, id);
  if (!c?.leadId) return errResult('A reunião não tem lead ligado.');
  if (!asaasConfigurado()) return errResult('O Asaas não está configurado.');
  const ambiente = ambienteAsaas();
  // Lead de teste nunca gera cobrança de verdade.
  if (c.teste && ambiente === 'producao') return errResult('Lead de teste: no Asaas de produção a cobrança não é criada.');
  const v = await valorDoProjeto(d, c.leadId);
  if (!v) return errResult('Sem valor do projeto.');
  if (v.moeda === 'USD') return errResult('Venda em dólar: o Asaas só cobra em reais. Combine o pagamento com o cliente.');

  const { data: existente } = await d.from('cobrancas').select('valor, link').match({ lead_id: c.leadId, parcela: 'sinal', ambiente }).maybeSingle();
  let link = existente?.link ?? null;
  const valor = existente ? Number(existente.valor) : Math.round((v.total / 2) * 100) / 100;
  let vencimento = daquiA(3);
  if (!link) {
    const { data: l } = await d.from('leads').select('name, email, asaas_customer_id').eq('id', c.leadId).maybeSingle();
    let cliente = l?.asaas_customer_id ?? null;
    if (!cliente) {
      const documento = documentoValido(entrada.documento ?? '');
      if (!documento) return errResult('Digite o CPF (11 dígitos) ou o CNPJ (14 dígitos) do cliente.');
      const celular = c.conversa?.contato.startsWith('55') ? c.conversa.contato.slice(2) : null;
      const r = await criarCliente({ nome: (entrada.nome ?? '').trim() || c.nome, documento, email: c.email, celular, referencia: c.leadId });
      if (!r.ok) return errResult(`O Asaas recusou o cadastro: ${r.erro}`);
      cliente = r.dados.id;
      await d.from('leads').update({ asaas_customer_id: cliente }).eq('id', c.leadId);
    }
    const cob = await criarCobranca({ cliente, valor, vencimento, descricao: `Sinal (50%) do projeto de ${c.nome} - Prog Soluções`, referencia: `lead:${c.leadId}:sinal` });
    if (!cob.ok) {
      await registrar(d, c, 'sinal', `Cobrança do sinal falhou no Asaas: ${cob.erro}`, false);
      return errResult(`O Asaas não gerou a cobrança: ${cob.erro}`);
    }
    link = cob.dados.invoiceUrl;
    await d.from('cobrancas').insert({
      lead_id: c.leadId,
      conversation_id: c.conversa?.id ?? null,
      parcela: 'sinal',
      valor,
      vencimento,
      asaas_payment_id: cob.dados.id,
      link,
      status: cob.dados.status ?? 'PENDING',
      ambiente,
    });
  } else vencimento = '';

  const m = dinheiroDoPais(valor, 'BRL');
  const texto = `Segue o link do sinal (50%) do seu projeto com a Prog Soluções: ${m}${vencimento ? `, vence em ${vencimento.split('-').reverse().slice(0, 2).join('/')}` : ''}. Você escolhe Pix, boleto ou cartão. Assim que o pagamento cair, o projeto começa.`;
  const enviado: string[] = [];
  // E-mail
  if (c.teste) enviado.push('e-mail não enviado (lead de teste)');
  else if (c.email && emailConfigurado()) {
    const cfg = await lerConfig(d);
    const r = await enviarEmail({ para: c.email, assunto: 'Sinal do seu projeto · Prog Soluções', texto: `Olá!\n\n${texto}\n\n${link}\n\nArthur · Prog Soluções`, nomeDoRemetente: 'Arthur | Prog Soluções', responderPara: cfg.ownerEmail });
    enviado.push(r.ok ? `e-mail para ${c.email}` : `e-mail falhou (${r.erro})`);
  } else enviado.push(c.email ? 'e-mail não configurado' : 'sem e-mail do cliente');
  // WhatsApp
  const motivo = podeWhatsApp(c);
  if (motivo) enviado.push(`WhatsApp não foi (${motivo})`);
  else {
    const r = await enviarComLink(c.conversa!.contato, texto, link!, 'Pagar o sinal');
    const r2 = r.ok ? r : await enviarTexto(c.conversa!.contato, `${texto}\n\n${link}`);
    await noHistorico(d, c.conversa!.id, `${texto}\n${link}`, r2);
    enviado.push(r2.ok ? 'WhatsApp enviado' : `WhatsApp falhou (${r2.erro})`);
  }
  await registrar(d, c, 'sinal', `${existente ? 'Cobrança do sinal reenviada' : 'Cobrança do sinal criada'}: ${m} (${ambiente}). ${enviado.join('; ')}. ${link}`, true);
  return { ...okResult(`${existente ? 'Cobrança já existia' : 'Cobrança criada'}: ${m}. ${enviado.join('; ')}.`), link: link ?? undefined };
}

/* ------------------------------------------------------------ proposta em PDF e desconto */

export type DadosDaProposta = { escolha: Escolha | null; descontoPct: number; descontoMax: number; whatsapp: string; resumo: string | null };

/** Para o formulário: o pacote do lead, o desconto já aprovado e se o WhatsApp sai agora. */
export async function dadosDaPropostaAction(id: string, e?: Escolha): Promise<DadosDaProposta | null> {
  const d = await db();
  if (!d || !UUID.test(id)) return null;
  const c = await contextoDaReuniao(d, id);
  if (!c) return null;
  const cfg = await lerConfig(d);
  const { data: l } = c.leadId ? await d.from('leads').select('pacote').eq('id', c.leadId).maybeSingle() : { data: null };
  const escolha = e ?? escolhaDoJson(l?.pacote);
  const descontoPct = await descontoAprovado(d, c);
  let resumo: string | null = null;
  if (escolha) {
    const cat = await catalogoDoLead(d, c.leadId);
    const p = calcularProposta(escolha, cat.tabela, descontoPct, cat.prazos);
    const m = (v: number) => dinheiroDoPais(v, cat.tabela.moeda);
    resumo = p.total > 0 ? `${p.linhas.map((x) => x.nome).join(' + ')}: ${m(p.totalComExtra)}${descontoPct ? ` (com ${descontoPct}% de desconto; cheio ${m(p.total)})` : ''} + ${m(p.mensal)}/mês` : null;
  }
  const motivo = podeWhatsApp(c);
  return { escolha, descontoPct, descontoMax: cfg.extraDiscountMax, whatsapp: motivo ? `não vai (${motivo}): baixe o PDF e mande você` : 'vai pelo WhatsApp agora', resumo };
}

async function descontoAprovado(d: DbDoAtendente, c: Contexto): Promise<number> {
  if (!c.leadId) return 0;
  const { data } = await d.from('ia_discount_requests').select('percent, status').eq('lead_id', c.leadId).eq('status', 'aprovado').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return Number(data?.percent ?? 0);
}

export async function enviarPropostaAction(id: string, e: Escolha): Promise<ActionResult & { pdf?: string; arquivo?: string }> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const c = await contextoDaReuniao(d, id);
  if (!c) return errResult('Reunião não encontrada.');
  const escolha = escolhaDoJson(e);
  if (!escolha) return errResult('Escolha o pacote.');
  const cat = await catalogoDoLead(d, c.leadId);
  const pct = await descontoAprovado(d, c);
  const pre = montarPreProposta(escolha, cat.tabela, cat.prazos, { cliente: c.nome, vendedor: 'Arthur', descontoExtraPct: pct });
  if (!pre) return errResult('Esse pacote não tem preço no catálogo.');
  const pdf = new Uint8Array(await renderToBuffer(PrePropostaDocument(pre.dados)));
  const arquivo = `${pre.nomeDoArquivo}.pdf`;
  // Mesmo efeito da Lia no lead: valor e pacote passados, etapa sobe para Proposta (nunca desce).
  if (c.leadId) {
    const { data: l } = await d.from('leads').select('status, notes').eq('id', c.leadId).maybeSingle();
    const subir = l && ['novo', 'contatado', 'respondeu', 'reuniao'].includes(l.status);
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await d
      .from('leads')
      .update({
        closed_value: pre.proposta.totalComExtra,
        closed_monthly: pre.proposta.mensal,
        closed_currency: cat.tabela.moeda,
        pacote: { produto: escolha.produto, nivel: escolha.nivel, comGestao: escolha.comGestao, nivelGestao: escolha.nivelGestao, marca: escolha.marca },
        ...(subir ? { status: 'proposta', notes: [l?.notes, `[Arthur ${hoje}] ${LEAD_STATUS_LABEL.proposta}: proposta em PDF na reunião`].filter(Boolean).join('\n'), updated_at: new Date().toISOString() } : {}),
      })
      .eq('id', c.leadId);
  }
  const motivo = podeWhatsApp(c);
  let via = `PDF não foi pelo WhatsApp (${motivo}); baixado para você mandar`;
  if (!motivo) {
    const r = await enviarDocumento(c.conversa!.contato, pdf, arquivo, 'application/pdf');
    await noHistorico(d, c.conversa!.id, `📄 ${arquivo}`, r);
    via = r.ok ? 'PDF enviado pelo WhatsApp' : `o WhatsApp recusou o PDF (${r.erro}); baixado para você mandar`;
  }
  const total = dinheiroDoPais(pre.proposta.totalComExtra, cat.tabela.moeda);
  await registrar(d, c, 'proposta', `Proposta em PDF: ${pre.dados.itens.map((i) => i.nome).join(' + ')}, ${total}${pct ? ` (desconto ${pct}%)` : ''}. ${via}.`, true, {
    proposta_enviada_em: new Date().toISOString(),
    valor_proposta: pre.proposta.totalComExtra,
    valor_mensal: pre.proposta.mensal,
  });
  return { ...okResult(`${via}. Total ${total}.`), ...(motivo || via.startsWith('o WhatsApp recusou') ? { pdf: Buffer.from(pdf).toString('base64'), arquivo } : {}) };
}

export async function aplicarDescontoAction(id: string, percentual: number): Promise<ActionResult> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const c = await contextoDaReuniao(d, id);
  if (!c?.leadId) return errResult('A reunião não tem lead ligado.');
  const cfg = await lerConfig(d);
  const pct = Math.round(Number(percentual) * 10) / 10;
  if (!(pct > 0) || pct > cfg.extraDiscountMax) return errResult(`O desconto vai de 0,5% a ${cfg.extraDiscountMax}% (limite em Atendimento › Configurações).`);
  // Fica no mesmo lugar do desconto que a Lia pede: a proposta dela e a desta sala já aplicam.
  if (c.conversa) {
    // Um desconto aprovado por lead: o novo substitui o anterior (a Lia lê o aprovado da conversa).
    const { data: atual } = await d.from('ia_discount_requests').select('id').eq('lead_id', c.leadId).eq('status', 'aprovado').limit(1).maybeSingle();
    const agora = new Date().toISOString();
    const { error } = atual
      ? await d.from('ia_discount_requests').update({ percent: pct, decided_at: agora, decided_by: 'Arthur (sala)', reason: 'Aplicado pelo Arthur na sala de reunião' }).eq('id', atual.id)
      : await d.from('ia_discount_requests').insert({
          conversation_id: c.conversa.id,
          lead_id: c.leadId,
          percent: pct,
          reason: 'Aplicado pelo Arthur na sala de reunião',
          release_at: agora,
          status: 'aprovado',
          decided_at: agora,
          decided_by: 'Arthur (sala)',
        });
    if (error) return errResult('Não gravou o desconto.');
  }
  const v = await valorDoProjeto(d, c.leadId);
  const reais = v ? Math.round(v.total * (pct / 100) * 100) / 100 : null;
  await registrar(d, c, 'desconto', `Desconto de ${pct}% aplicado${reais ? ` (cerca de ${dinheiroDoPais(reais, v!.moeda)} sobre ${dinheiroDoPais(v!.total, v!.moeda)})` : ''}.`, true, reais ? { desconto: reais } : undefined);
  return okResult(`Desconto de ${pct}% aplicado. A próxima proposta (sua ou da Lia) já sai com ele.`);
}

/* ------------------------------------------------------------ próxima reunião */

export async function horariosLivresAction(): Promise<{ iso: string; texto: string }[]> {
  const d = await db();
  if (!d) return [];
  const { data: cfg } = await d.from('ia_config').select('agenda').eq('id', true).maybeSingle();
  const agenda = agendaDe(cfg?.agenda);
  const agora = new Date();
  const ate = new Date(agora.getTime() + (agenda.horizonte_dias + 1) * 86400_000);
  const [daAgenda, { data: marcadas }] = await Promise.all([
    ocupadosNaAgenda(d, agora, ate),
    d.from('reunioes').select('inicio, fim').eq('status', 'marcada').gte('fim', agora.toISOString()).lte('inicio', ate.toISOString()),
  ]);
  const ocupados = [...(daAgenda ?? []), ...(marcadas ?? []).map((r) => ({ inicio: new Date(r.inicio).getTime(), fim: new Date(r.fim).getTime() }))];
  return horariosLivres(ocupados, agora.getTime(), 6, agenda).map((x) => ({ iso: x.toISOString(), texto: horarioPorExtenso(x) }));
}

export async function marcarProximaAction(id: string, inicioIso: string, assunto: string): Promise<ActionResult & { link?: string; novaId?: string }> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const c = await contextoDaReuniao(d, id);
  if (!c?.leadId) return errResult('A reunião não tem lead ligado.');
  const inicio = new Date(inicioIso);
  if (!Number.isFinite(inicio.getTime()) || inicio.getTime() < Date.now()) return errResult('Escolha um horário no futuro.');
  const r = await novaReuniaoAction(c.leadId, inicio.toISOString(), assunto || 'continuação');
  if (!r.ok || !r.id) return errResult(r.message || 'Não marcou a reunião.');
  const { data: nova } = await d.from('reunioes').select('sala_token, titulo, fim').eq('id', r.id).maybeSingle();
  const link = nova?.sala_token ? linkDoCliente(nova.sala_token) : null;
  const avisos: string[] = [];
  if (await agendaConectada(d)) {
    const ev = await criarEventoNaAgenda(d, {
      titulo: nova?.titulo ?? `Prog Soluções × ${c.nome}`,
      descricao: `${link ? `Sala da reunião (vídeo da Prog Soluções): ${link}\nSe a sala não abrir, use o Google Meet deste convite.\n\n` : ''}Marcada pelo Arthur na sala de reunião.`,
      inicio,
      fim: new Date(nova?.fim ?? inicio.getTime() + 30 * 60_000),
      emailCliente: c.teste ? null : c.email,
    });
    if (ev.ok) {
      await d.from('reunioes').update({ google_event_id: ev.id, meet_link: ev.meet }).eq('id', r.id);
      avisos.push(c.email && !c.teste ? `convite para ${c.email}` : 'na sua agenda');
    } else avisos.push(`não entrou na agenda (${ev.erro})`);
  } else avisos.push('agenda do Google não conectada');
  const quando = horarioPorExtenso(inicio);
  const motivo = podeWhatsApp(c);
  if (!motivo && link) {
    const texto = `Combinado: nossa próxima conversa fica para ${quando} (horário de Brasília). É só entrar por este link na hora:`;
    const w = await enviarComLink(c.conversa!.contato, texto, link, 'Entrar na reunião');
    await noHistorico(d, c.conversa!.id, `${texto} ${link}`, w);
    avisos.push(w.ok ? 'link no WhatsApp' : `WhatsApp falhou (${w.erro})`);
  } else avisos.push(`WhatsApp não foi (${motivo ?? 'sem link'})`);
  await registrar(d, c, 'proxima_reuniao', `Próxima reunião marcada: ${quando}. ${avisos.join('; ')}.`, true, {
    proximo_passo: `Reunião ${quando}`.slice(0, 500),
    proximo_responsavel: 'Eu (Arthur)',
    proximo_prazo: new Date(inicio.getTime() - 3 * 3600_000).toISOString().slice(0, 10),
  });
  return { ...okResult(`Marcada: ${quando}. ${avisos.join('; ')}.`), link: link ?? undefined, novaId: r.id };
}

/* ------------------------------------------------------------ case do portfólio */

export async function mandarCaseAction(id: string, slug: string, peloWhatsApp: boolean): Promise<ActionResult & { link?: string }> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const caso = CASES[slug];
  if (!caso) return errResult('Case não encontrado.');
  const c = await contextoDaReuniao(d, id);
  if (!c) return errResult('Reunião não encontrada.');
  const { eua } = await catalogoDoLead(d, c.leadId);
  const link = linkDoCase(slug, eua);
  let via = 'no chat da reunião';
  if (peloWhatsApp) {
    const motivo = podeWhatsApp(c);
    if (motivo) via = `no chat da reunião (WhatsApp não foi: ${motivo})`;
    else {
      const texto = `Aqui está o case ${caso.titulo} que comentei na reunião:`;
      const w = await enviarComLink(c.conversa!.contato, texto, link, 'Ver o case');
      await noHistorico(d, c.conversa!.id, `${texto} ${link}`, w);
      via = w.ok ? 'no chat e no WhatsApp' : `no chat (WhatsApp falhou: ${w.erro})`;
    }
  }
  await registrar(d, c, 'case', `Case mandado ${via}: ${caso.titulo} (${link}).`, true);
  return { ...okResult(`Case ${caso.titulo} mandado ${via}.`), link };
}

/* ------------------------------------------------------------ fechou */

export async function fechouAction(id: string, responsavel: string): Promise<ActionResult> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const c = await contextoDaReuniao(d, id);
  if (!c?.leadId) return errResult('A reunião não tem lead ligado.');
  const { data: l } = await d.from('leads').select('name, status, notes, closed_at, pacote, closed_value, closed_monthly, closed_currency, responsible_name').eq('id', c.leadId).maybeSingle();
  if (!l) return errResult('Lead não encontrado.');
  const agora = new Date().toISOString();
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const resp = responsavel.trim().slice(0, 120);
  if (l.status !== 'fechado') {
    await d
      .from('leads')
      .update({
        status: 'fechado',
        closed_at: l.closed_at ?? agora,
        notes: [l.notes, `[Arthur ${hoje}] ${LEAD_STATUS_LABEL.fechado}: fechou na sala de reunião`].filter(Boolean).join('\n'),
        ...(resp ? { responsible_name: resp } : {}),
        next_contact: null,
        updated_at: agora,
      })
      .eq('id', c.leadId);
  }
  // Pós-venda: o mesmo caminho do mudar_etapa "fechado" (um projeto por lead; chamar de novo devolve o existente).
  const pj = await criarProjetoDaVenda(d, {
    leadId: c.leadId,
    cliente: l.name,
    responsavel: resp || l.responsible_name || null,
    vendidoPor: 'Arthur',
    escolha: escolhaDoJson(l.pacote),
    moeda: (l.closed_currency as 'BRL' | 'USD' | null) ?? 'BRL',
    valor: l.closed_value ?? null,
    mensal: l.closed_monthly ?? null,
  });
  if ('erro' in pj) {
    await registrar(d, c, 'fechou', `Fechou, mas o projeto do Pós-venda não foi criado: ${pj.erro}`, false);
    return errResult(`Lead marcado como fechado, mas o projeto não foi criado: ${pj.erro}`);
  }
  const { data: pv } = await d.from('prevenda').select('passos').eq('lead_id', c.leadId).maybeSingle();
  const passos = { ...((pv?.passos ?? {}) as Record<string, unknown>), resposta: { estado: 'feito', em: agora.slice(0, 10) } };
  await registrar(d, c, 'fechou', `Fechou na reunião. Lead em Fechado; projeto no Pós-venda ${pj.novo ? 'criado' : 'já existia'}.`, true, { passos });
  return okResult(`Fechado. Projeto no Pós-venda ${pj.novo ? 'criado' : 'já existia'}. Próximo passo: o sinal (botão acima); com ele pago, a Bia abre o projeto.`);
}

/* ------------------------------------------------------------ registro e estado */

export async function acoesDaReuniaoAction(id: string): Promise<AcaoDaSala[]> {
  const d = await db();
  if (!d || !UUID.test(id)) return [];
  const { data } = await d.from('reunioes').select('acoes').eq('id', id).maybeSingle();
  return ((Array.isArray(data?.acoes) ? data.acoes : []) as AcaoDaSala[]).slice(-30).reverse();
}

/* ------------------------------------------------------------ cliente: sala de espera */

/** A página do cliente pergunta se o Arthur já abriu a sala (sem dado do lead: só o estado). */
export async function estadoParaClienteAction(token: string): Promise<{ aberta: boolean; encerrada: boolean } | null> {
  if (!TOKEN.test(token)) return null;
  const { data: r } = await dbDoAtendente().from('reunioes').select('sala_status, status').eq('sala_token', token).maybeSingle();
  if (!r) return null;
  return { aberta: r.sala_status === 'ao_vivo', encerrada: r.sala_status === 'encerrada' || r.status === 'cancelada' };
}
