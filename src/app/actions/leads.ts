'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types';
import type { ModeloMensagem } from '@/lib/mensagens-lead';
import { LEAD_STATUSES, linhasDoCsv, registrosDaImportacao, retornoDepoisDe, type LeadStatus, type Pais } from '@/lib/captacao';
import { gravarLeads } from '@/lib/captacao-gravar';
import { saveServiceQuoteAction } from '@/app/actions/service-quotes';
import { listInternalServices } from '@/lib/data/internal-services';
import { ajustarCombosEMensalidades } from '@/lib/combo-servicos';
import { PLAN_MONTHS_DEFAULT, type ServiceOrderItem } from '@/lib/services';
import { SEM_DESCONTO } from '@/lib/discount';
import { NICHOS, type ListaDeNichos } from '@/lib/nichos';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

const LIMITE_ARQUIVO = 5 * 1024 * 1024;
// Soma dos arquivos de uma importação: a régua do Next para actions é 6 MB.
const LIMITE_TOTAL = 5.5 * 1024 * 1024;

/**
 * Importa o CSV do google-maps-scraper-kit. Lead que já existe (mesmo
 * place_id, ou mesmo nome + telefone) tem os dados públicos e a nota
 * atualizados; status, notas e datas de contato nunca são tocados.
 */
export async function importLeadsAction(formData: FormData): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const arquivos = formData.getAll('arquivo').filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0) return errResult('Escolha pelo menos um arquivo CSV.');
  if (arquivos.some((a) => a.size > LIMITE_ARQUIVO)) return errResult('Arquivo maior que 5 MB. Divida a busca em partes.');
  if (arquivos.reduce((s, a) => s + a.size, 0) > LIMITE_TOTAL) {
    return errResult('Arquivos demais de uma vez (mais de 5,5 MB). Importe em duas levas.');
  }

  // Valem para as linhas sem as colunas busca_* (CSV que não veio do captar.ps1).
  const paisDoForm: Pais = formData.get('pais') === 'US' ? 'US' : 'BR';
  const nicheDoForm = String(formData.get('nicho') ?? '').trim() || null;
  const cityDoForm = String(formData.get('cidade') ?? '').trim() || null;
  const stateDoForm =
    String(formData.get('estado') ?? '')
      .trim()
      .toUpperCase() || null;

  const registros: TablesInsert<'leads'>[] = [];
  for (const arquivo of arquivos) {
    const padroes = { pais: paisDoForm, niche: nicheDoForm, city: cityDoForm, state: stateDoForm, source: arquivo.name };
    registros.push(...registrosDaImportacao(linhasDoCsv(await arquivo.text()), padroes));
  }
  if (registros.length === 0) return errResult('Nenhuma empresa encontrada. Confira se são CSVs do scraper.');
  const semRamo = registros.filter((r) => !r.niche).length;

  const r = await gravarLeads(supabase, registros);
  if (!r.ok) return errResult(friendlyDbError({ message: r.erro }, 'Não foi possível importar os leads.'));
  const jaExistiam = r.atualizados;
  const novos = r.novos;

  revalidatePath('/admin/captacao');
  const aviso = semRamo ? ` ${semRamo} sem ramo: preencha o ramo ao importar CSV que não veio do captar.ps1.` : '';
  return okResult(`${arquivos.length} arquivo(s): ${novos} lead(s) novo(s) e ${jaExistiam} atualizado(s).${aviso}`);
}

export type LeadUpdate = {
  status?: LeadStatus;
  nextContact?: string | null;
  notes?: string | null;
  semWhatsapp?: boolean;
};

export async function updateLeadAction(id: string, input: LeadUpdate): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: atual } = await supabase
    .from('leads')
    .select('first_contact_at, replied_at, closed_at')
    .eq('id', id)
    .maybeSingle();
  if (!atual) return errResult('Lead não encontrado.');

  const agora = new Date().toISOString();
  const payload: TablesUpdate<'leads'> = { updated_at: agora };

  if (input.status !== undefined) {
    if (!LEAD_STATUSES.includes(input.status)) return errResult('Etapa inválida.');
    payload.status = input.status;
    // As datas marcam a primeira vez que o lead passou da etapa, e servem para
    // a taxa de resposta: voltar a etapa não apaga o que já aconteceu.
    const passouDoContato = !['novo', 'nao_contatar'].includes(input.status);
    const respondeu = ['respondeu', 'reuniao', 'proposta', 'fechado'].includes(input.status);
    if (passouDoContato && !atual.first_contact_at) payload.first_contact_at = agora;
    if (respondeu && !atual.replied_at) payload.replied_at = agora;
    payload.closed_at = input.status === 'fechado' ? (atual.closed_at ?? agora) : null;
    // Lead encerrado não tem próximo contato.
    if (['fechado', 'perdido', 'nao_contatar'].includes(input.status)) payload.next_contact = null;
  }
  if (input.nextContact !== undefined && payload.next_contact === undefined) {
    payload.next_contact = input.nextContact || null;
  }
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
  if (input.semWhatsapp !== undefined) payload.sem_whatsapp = input.semWhatsapp;

  const { error } = await supabase.from('leads').update(payload).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o lead.'));

  revalidatePath('/admin/captacao');
  return okResult('Lead atualizado.');
}

/** Cadastra o lead como cliente do ERP (para o orçamento de serviço) e liga os dois. */
export async function convertLeadToCustomerAction(id: string): Promise<ActionResult & { customerId?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: lead } = await supabase
    .from('leads')
    .select('name, phone, email, city, state, address, website, maps_url, category, customer_id')
    .eq('id', id)
    .maybeSingle();
  if (!lead) return errResult('Lead não encontrado.');
  if (lead.customer_id) return { ...okResult('Este lead já é cliente.'), customerId: lead.customer_id };

  const notas = [
    'Veio da Captação (Google Maps).',
    lead.category && `Ramo: ${lead.category}`,
    lead.address && `Endereço: ${lead.address}`,
    lead.website && `Site: ${lead.website}`,
    lead.maps_url && `Maps: ${lead.maps_url}`,
  ]
    .filter(Boolean)
    .join('\n');

  const { data: cliente, error } = await supabase
    .from('customers')
    .insert({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      state: lead.state,
      notes: notas,
    })
    .select('id')
    .single();
  if (error || !cliente) return errResult(friendlyDbError(error, 'Não foi possível cadastrar o cliente.'));

  await supabase.from('leads').update({ customer_id: cliente.id, updated_at: new Date().toISOString() }).eq('id', id);

  revalidatePath('/admin/captacao');
  revalidatePath('/admin/clientes');
  revalidatePath('/admin/orcamentos-servicos');
  return { ...okResult('Cliente cadastrado. Já pode fazer o orçamento.'), customerId: cliente.id };
}

export async function saveLeadTemplatesAction(modelos: ModeloMensagem[]): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  for (const m of modelos) {
    if (!['whatsapp', 'email'].includes(m.channel) || !['pt', 'en'].includes(m.lang)) return errResult('Modelo inválido.');
    if (!Number.isInteger(m.step) || m.step < 0 || m.step > 3 || !['A', 'B'].includes(m.variant)) {
      return errResult('Modelo inválido.');
    }
  }
  // A é obrigatória; B vazia significa "sem teste A/B" e é apagada.
  const preenchidos = modelos.filter((m) => m.body.trim());
  const faltando = modelos.find((m) => m.variant === 'A' && !m.body.trim());
  if (faltando) return errResult('A variante A não pode ficar vazia.');
  if (preenchidos.some((m) => m.channel === 'email' && !m.subject?.trim())) return errResult('Preencha o assunto do e-mail.');

  if (preenchidos.length) {
    const { error } = await supabase.from('lead_templates').upsert(
      preenchidos.map((m) => ({
        channel: m.channel,
        lang: m.lang,
        step: m.step,
        variant: m.variant,
        subject: m.channel === 'email' ? m.subject!.trim() : null,
        body: m.body.trim(),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'channel,lang,step,variant' }
    );
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar as mensagens.'));
  }
  for (const m of modelos.filter((x) => x.variant === 'B' && !x.body.trim())) {
    await supabase.from('lead_templates').delete().match({ channel: m.channel, lang: m.lang, step: m.step, variant: 'B' });
  }

  revalidatePath('/admin/captacao');
  return okResult('Mensagens salvas.');
}

/**
 * "Enviei": registra a mensagem da etapa `etapa` (0 = primeiro contato, 1–3 =
 * retornos dos dias 3, 7 e 14). Marca contatado, grava a variante do teste A/B
 * no primeiro contato e agenda o próximo retorno da sequência.
 */
export async function registrarEnvioAction(id: string, etapa: number, variante: 'A' | 'B'): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  if (!Number.isInteger(etapa) || etapa < 0 || etapa > 3) return errResult('Etapa inválida.');

  const { data: atual } = await supabase
    .from('leads')
    .select('status, first_contact_at, followup_step, ab_variant')
    .eq('id', id)
    .maybeSingle();
  if (!atual) return errResult('Lead não encontrado.');

  const agora = new Date().toISOString();
  const primeiro = atual.first_contact_at ?? agora;
  const payload: TablesUpdate<'leads'> = {
    first_contact_at: primeiro,
    last_contact_at: agora,
    followup_step: Math.max(atual.followup_step, etapa + 1),
    next_contact: retornoDepoisDe(etapa, primeiro),
    updated_at: agora,
  };
  if (atual.status === 'novo') payload.status = 'contatado';
  if (etapa === 0 && !atual.ab_variant) payload.ab_variant = variante;

  const { error } = await supabase.from('leads').update(payload).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível registrar o envio.'));
  revalidatePath('/admin/captacao');
  return okResult(etapa >= 3 ? 'Sequência encerrada para este lead.' : 'Envio registrado. O próximo retorno já está agendado.');
}

// Mensalidade de cada produto no catálogo (nomes de 0045–0049).
function mensalidadeDoServico(nome: string): string | null {
  if (nome.startsWith('Site ')) return 'Mensalidade Site';
  if (nome.startsWith('Loja ')) return 'Mensalidade Loja';
  const gestao = nome.match(/^Sistema de Gestão (Básico|Intermediário|Avançado)$/);
  return gestao ? `Mensalidade Gestão ${gestao[1]}` : null;
}

/**
 * Proposta em um clique: garante o cliente e cria o Orçamento de Serviço com
 * os serviços sugeridos do lead (itens do catálogo + mensalidade), já com a
 * regra de combo do ERP (ajustarCombosEMensalidades). Abre para ajustar.
 */
export async function criarPropostaAction(id: string): Promise<ActionResult & { quoteId?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { data: lead } = await supabase
    .from('leads')
    .select('name, country, suggested_services, customer_id, quote_id, notes')
    .eq('id', id)
    .maybeSingle();
  if (!lead) return errResult('Lead não encontrado.');
  if (lead.quote_id) return { ...okResult('Este lead já tem proposta.'), quoteId: lead.quote_id };
  if (lead.country !== 'BR') {
    return errResult('Proposta automática só para o Brasil por enquanto: o orçamento do ERP é em reais.');
  }

  let customerId = lead.customer_id;
  if (!customerId) {
    const r = await convertLeadToCustomerAction(id);
    if (!r.ok || !r.customerId) return r;
    customerId = r.customerId;
  }

  const catalogo = (await listInternalServices()).filter((s) => s.active);
  const porNome = new Map(catalogo.map((s) => [s.name, s]));
  const nomes = [...lead.suggested_services];
  for (const n of lead.suggested_services) {
    const m = mensalidadeDoServico(n);
    if (m && !nomes.includes(m)) nomes.push(m);
  }
  const itens: ServiceOrderItem[] = nomes
    .map((n) => porNome.get(n))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({
      internalServiceId: s.id,
      name: s.name,
      description: s.description,
      amount: s.price,
      billingType: s.billingType,
      leadTimeDays: s.leadTimeDays,
    }));
  if (itens.length === 0) return errResult('Nenhum serviço sugerido existe no catálogo. Monte a proposta à mão.');
  const ajustados = ajustarCombosEMensalidades(itens, catalogo)?.items ?? itens;
  const temMensal = ajustados.some((i) => i.billingType === 'mensal');

  const r = await saveServiceQuoteAction({
    customerId,
    title: `Proposta para ${lead.name}`,
    notes: 'Criada pela Captação a partir dos serviços sugeridos. Revise antes de enviar.',
    status: 'Em elaboração',
    planMonths: temMensal ? PLAN_MONTHS_DEFAULT : null,
    includeContract: false,
    clientHasDomain: false,
    desconto: SEM_DESCONTO,
    items: ajustados,
  });
  if (!r.ok) return r;

  // O save não devolve o id: pega o orçamento mais recente deste cliente.
  const { data: quote } = await supabase
    .from('service_quotes')
    .select('id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (quote) {
    await supabase
      .from('leads')
      .update({ quote_id: quote.id, status: 'proposta', updated_at: new Date().toISOString() })
      .eq('id', id);
  }
  revalidatePath('/admin/captacao');
  return { ...okResult('Proposta criada em Orçamentos Serviços. Revise e envie o PDF.'), quoteId: quote?.id };
}

/** Pedido de busca para o programa do PC (um por nicho; "todos" cria um por nicho da lista). */
export async function pedirBuscaAction(input: {
  niche: string;
  city: string;
  country: Pais;
  lista?: ListaDeNichos;
}): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const city = input.city.trim();
  if (!/,\s*[A-Za-z]{2}$/.test(city)) return errResult('Informe a cidade com a sigla do estado, ex.: Goiânia, GO.');
  if (input.country !== 'BR' && input.country !== 'US') return errResult('País inválido.');

  const nichos = input.lista ? NICHOS[input.lista] : [input.niche.trim()].filter(Boolean);
  if (nichos.length === 0) return errResult('Informe o nicho.');

  const { error } = await supabase
    .from('lead_search_requests')
    .insert(nichos.map((niche) => ({ niche, city, country: input.country })));
  if (error) return errResult(friendlyDbError(error, 'Não foi possível registrar o pedido.'));
  revalidatePath('/admin/captacao');
  return okResult(
    nichos.length > 1
      ? `${nichos.length} buscas na fila. O programa do PC busca uma por vez e importa sozinho.`
      : 'Busca na fila. O programa do PC busca e importa sozinho.'
  );
}

export async function cancelarBuscaAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('lead_search_requests').delete().eq('id', id).eq('status', 'pendente');
  if (error) return errResult(friendlyDbError(error, 'Não foi possível cancelar.'));
  revalidatePath('/admin/captacao');
  return okResult('Busca cancelada.');
}
