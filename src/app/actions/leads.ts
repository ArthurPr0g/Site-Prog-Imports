'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types';
import type { ModeloMensagem } from '@/lib/mensagens-lead';
import { LEAD_STATUSES, linhasDoCsv, registrosDaImportacao, retornoDepoisDe, type LeadStatus, type Pais, motivoFantasma, emailDeVerdade, whatsappDoLead } from '@/lib/captacao';
import { SITE_URL } from '@/lib/seo';
import { gravarLeads } from '@/lib/captacao-gravar';
import { saveServiceQuoteAction } from '@/app/actions/service-quotes';
import { listInternalServices } from '@/lib/data/internal-services';
import { leadsQueJaSaoClientes } from '@/lib/data/leads';
import { ajustarCombosEMensalidades } from '@/lib/combo-servicos';
import { PLAN_MONTHS_DEFAULT, type ServiceOrderItem } from '@/lib/services';
import { SEM_DESCONTO } from '@/lib/discount';
import { NICHOS, type ListaDeNichos } from '@/lib/nichos';
import { tabelaBRL } from '@/lib/precos-captacao';
import { mensalidadeDoServico, valoresDoItem } from '@/lib/itens-do-kit';
import { limparRespostas, type RespostasDoChecklist } from '@/lib/checklist-descoberta';

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
    .select('status, first_contact_at, replied_at, closed_at')
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

  // Arthur passou o lead para uma etapa de conversa: se ele estava na lista de um vendedor, é dele agora.
  const passou =
    input.status && ETAPAS_DE_CONVERSA.includes(input.status) ? await assumirDoVendedor(supabase, id, atual.status) : '';
  revalidatePath('/admin/captacao');
  return okResult(`Lead atualizado.${passou}`);
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
  const passou = await assumirDoVendedor(supabase, id, atual.status);
  revalidatePath('/admin/captacao');
  return okResult(
    (etapa >= 3 ? 'Sequência encerrada para este lead.' : 'Envio registrado. O próximo retorno já está agendado.') + passou
  );
}

// Mensalidade de cada produto no catálogo (nomes de 0045–0049).

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
    .select('name, country, suggested_services, customer_id, quote_id, notes, status')
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
  const passou = await assumirDoVendedor(supabase, id, lead.status);
  revalidatePath('/admin/captacao');
  return { ...okResult(`Proposta criada em Orçamentos Serviços. Revise e envie o PDF.${passou}`), quoteId: quote?.id };
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

/* ------------------------------------------------------------ página do vendedor */

/** Filtros do painel na hora de gerar o link (o "Adicionar mais 20" usa os mesmos). */
export type FiltrosDoKit = { pais?: string; ramo?: string; servico?: string; notaMin?: number; busca?: string };

export type NovoKit = {
  leadIds: string[];
  sellerName: string;
  sellerWhatsapp: string;
  sellerEmail: string;
  instructions: string;
  filtros: FiltrosDoKit;
  /** Link da atendente de IA: só leads com e-mail (o primeiro contato dela é por e-mail). */
  ia?: boolean;
};

const LIMITE_DO_KIT = 20;

async function catalogoAtivo() {
  const catalogo = (await listInternalServices()).filter((s) => s.active);
  return {
    catalogo,
    porNome: new Map(catalogo.map((s) => [s.name, s])),
    tabBRL: tabelaBRL(new Map(catalogo.map((s) => [s.name, s.price]))),
  };
}

/**
 * Itens do link: retrato do valor e dos serviços (com descrição e preço do
 * catálogo de agora) de cada lead. O vendedor vende pelo preço que recebeu.
 */
async function montarItensDoKit(
  supabase: NonNullable<Awaited<ReturnType<typeof adminClient>>>,
  kitId: string,
  ids: string[],
  primeiraPosicao: number
) {
  const { data: leads } = await supabase.from('leads').select('id, country, suggested_services').in('id', ids);
  const { porNome, tabBRL } = await catalogoAtivo();
  const ordem = new Map(ids.map((id, i) => [id, primeiraPosicao + i]));
  return (leads ?? []).map((l) => ({
    kit_id: kitId,
    lead_id: l.id,
    position: ordem.get(l.id) ?? primeiraPosicao,
    ...valoresDoItem(l, porNome, tabBRL),
  }));
}

/** Gera o link do vendedor com até 20 leads (os escolhidos na tela, pelos filtros). */
export async function criarKitAction(input: NovoKit): Promise<ActionResult & { token?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const nome = input.sellerName.trim();
  if (!nome) return errResult('Informe o nome do vendedor.');
  let ids = [...new Set(input.leadIds)];
  if (input.ia) {
    const { data: comEmail } = await supabase.from('leads').select('id, email').in('id', ids).not('email', 'is', null);
    const ok = new Set((comEmail ?? []).filter((l) => l.email && emailDeVerdade(l.email)).map((l) => l.id));
    ids = ids.filter((id) => ok.has(id));
  }
  ids = ids.slice(0, LIMITE_DO_KIT);
  if (ids.length === 0)
    return errResult(input.ia ? 'Nenhum lead com e-mail nesses filtros (a IA chega por e-mail).' : 'Nenhum lead para enviar com esses filtros.');
  let whats = input.sellerWhatsapp.replace(/\D/g, '');
  if (whats && whats.length <= 11) whats = `55${whats}`;

  const { catalogo } = await catalogoAtivo();
  const { data: kit, error } = await supabase
    .from('lead_seller_kits')
    .insert({
      seller_name: nome,
      seller_whatsapp: whats || null,
      seller_email: input.sellerEmail.trim() || null,
      instructions: input.instructions.trim() || null,
      filters: input.filtros,
      kind: input.ia ? 'ia' : 'pessoa',
      catalog: catalogo.map((s) => ({
        nome: s.name,
        categoria: s.category,
        descricao: s.description,
        preco: s.price,
        mensal: s.billingType === 'mensal',
        prazoDias: s.leadTimeDays,
      })),
    })
    .select('id, token')
    .single();
  if (error || !kit) return errResult(friendlyDbError(error, 'Não foi possível criar o link.'));

  const itens = await montarItensDoKit(supabase, kit.id, ids, 0);
  const { error: erroItens } = await supabase.from('lead_kit_items').insert(itens);
  if (erroItens || itens.length === 0) {
    await supabase.from('lead_seller_kits').delete().eq('id', kit.id);
    return errResult(friendlyDbError(erroItens, 'Não foi possível montar o link.'));
  }
  revalidatePath('/admin/captacao');
  return { ...okResult(`Link criado com ${itens.length} lead(s) para ${nome}.`), token: kit.token };
}

/**
 * "Adicionar mais 20": os próximos leads de maior nota com os mesmos filtros do
 * link, ainda Novos, fora de outro link ativo e que não são clientes. Atende o
 * "Pedir mais leads" do vendedor (limpa o pedido).
 */
export async function adicionarAoKitAction(kitId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { data: kit } = await supabase.from('lead_seller_kits').select('id, filters, active, kind').eq('id', kitId).maybeSingle();
  if (!kit) return errResult('Link não encontrado.');
  if (!kit.active) return errResult('Reative o link antes de adicionar leads.');

  const ids = await leadsLivresParaOKit(supabase, (kit.filters ?? {}) as FiltrosDoKit, LIMITE_DO_KIT, kit.kind === 'ia');
  if (ids.length === 0)
    return errResult('Não há mais leads livres com os filtros deste link. Gere um link novo com outros filtros.');

  const itens = await montarItensDoKit(supabase, kitId, ids, (await ultimaPosicao(supabase, kitId)) + 1);
  const { error } = await supabase.from('lead_kit_items').insert(itens);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível adicionar os leads.'));
  await supabase.from('lead_seller_kits').update({ more_requested_at: null }).eq('id', kitId);
  revalidatePath('/admin/captacao');
  return okResult(`${itens.length} lead(s) adicionados ao link.`);
}

type Db = NonNullable<Awaited<ReturnType<typeof adminClient>>>;

async function ultimaPosicao(supabase: Db, kitId: string): Promise<number> {
  const { data } = await supabase
    .from('lead_kit_items')
    .select('position')
    .eq('kit_id', kitId)
    .order('position', { ascending: false })
    .limit(1);
  return data?.[0]?.position ?? 0;
}

/** Etapas em que o lead está sendo atendido (passar para uma delas = conversar com ele). */
const ETAPAS_DE_CONVERSA: LeadStatus[] = ['contatado', 'respondeu', 'reuniao', 'proposta', 'fechado'];

/**
 * Os próximos leads de maior nota com os filtros do link: ainda Novos, fora de
 * outro link ativo, que não passaram para o Arthur e que não são clientes.
 */
async function leadsLivresParaOKit(supabase: Db, f: FiltrosDoKit, quantidade: number, comEmail = false): Promise<string[]> {
  // Leads já em algum link ativo (inclusive este) não entram de novo; nem os que o Arthur assumiu.
  const [{ data: emUso }, { data: assumidos }] = await Promise.all([
    supabase.from('lead_kit_items').select('lead_id, kit_id, lead_seller_kits!inner(active)').eq('lead_seller_kits.active', true),
    supabase.from('lead_kit_transfers').select('lead_id'),
  ]);
  const ocupados = new Set([...(emUso ?? []), ...(assumidos ?? [])].map((i) => i.lead_id));

  let q = supabase
    .from('leads')
    .select('id, name, city, niche, state, phone, email, customer_id, score, maps_status, last_review_at, review_count')
    .eq('status', 'novo')
    .is('customer_id', null)
    .gte('score', f.notaMin ?? 0)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(400);
  if (f.pais) q = q.eq('country', f.pais);
  if (f.ramo) q = q.eq('niche', f.ramo);
  if (f.servico) q = q.contains('suggested_services', [f.servico]);
  if (comEmail) q = q.not('email', 'is', null);
  const { data: candidatos } = await q;
  const termo = (f.busca ?? '').trim().toLowerCase();
  const livres = (candidatos ?? []).filter(
    (l) =>
      !ocupados.has(l.id) &&
      (!comEmail || (!!l.email && emailDeVerdade(l.email))) &&
      // Possível empresa fantasma (fechada ou parada) não vai para o vendedor.
      !motivoFantasma({ mapsStatus: l.maps_status, lastReviewAt: l.last_review_at, reviewCount: l.review_count, phone: l.phone, email: l.email }) &&
      (!termo || [l.name, l.city, l.niche, l.state].some((c) => c?.toLowerCase().includes(termo)))
  );
  // Mesma regra do painel para "já é cliente" (telefone ou e-mail de um cliente).
  const clientes = new Set(
    await leadsQueJaSaoClientes(livres.map((l) => ({ id: l.id, phone: l.phone, email: l.email, customerId: l.customer_id })))
  );
  return livres
    .filter((l) => !clientes.has(l.id))
    .slice(0, quantidade)
    .map((l) => l.id);
}

/**
 * O Arthur começou a atender um lead que estava, ainda sem contato, na lista de
 * um vendedor: o lead sai da lista (registrado em lead_kit_transfers, aparece
 * como "com o Arthur" na página do vendedor) e entra outro lead livre no lugar.
 * Lead que o vendedor já contatou continua com ele. Devolve o aviso para o toast.
 */
async function assumirDoVendedor(supabase: Db, leadId: string, statusAntes: string): Promise<string> {
  if (statusAntes !== 'novo') return '';
  const { data: itens } = await supabase
    .from('lead_kit_items')
    .select('kit_id, lead_seller_kits!inner(active, seller_name, filters, kind)')
    .eq('lead_id', leadId)
    .eq('lead_seller_kits.active', true);
  if (!itens?.length) return '';

  const avisos: string[] = [];
  for (const item of itens) {
    const kit = item.lead_seller_kits;
    const { error } = await supabase
      .from('lead_kit_transfers')
      .upsert({ kit_id: item.kit_id, lead_id: leadId, taken_at: new Date().toISOString() });
    if (error) continue; // sem o registro, o lead fica onde está
    await supabase.from('lead_kit_items').delete().match({ kit_id: item.kit_id, lead_id: leadId });

    const [novo] = await leadsLivresParaOKit(supabase, (kit.filters ?? {}) as FiltrosDoKit, 1, kit.kind === 'ia');
    if (novo) {
      const reposto = await montarItensDoKit(supabase, item.kit_id, [novo], (await ultimaPosicao(supabase, item.kit_id)) + 1);
      const { error: erroNovo } = await supabase.from('lead_kit_items').insert(reposto);
      if (!erroNovo) {
        await supabase.from('lead_kit_transfers').update({ replacement_lead_id: novo }).match({ kit_id: item.kit_id, lead_id: leadId });
        avisos.push(`saiu da lista de ${kit.seller_name} e entrou outro no lugar`);
        continue;
      }
    }
    avisos.push(`saiu da lista de ${kit.seller_name} (não havia outro lead livre com os filtros do link para repor)`);
  }
  return avisos.length ? ` Este lead ${avisos.join('; ')}.` : '';
}

/**
 * Orquestração: manda um lead para um vendedor (Felipe, a IA…) ou tira de
 * todos (kitId null = fica com o Arthur, sem vendedor). Sai dos outros links
 * ativos. Para a IA, o lead precisa de e-mail (o primeiro contato dela).
 */
export async function moverLeadAction(
  leadId: string,
  kitId: string | null,
  /** semEmail: o Arthur faz o 1º contato pelo WhatsApp dele, então a IA não precisa do e-mail. */
  opcoes: { semEmail?: boolean } = {}
): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { data: lead } = await supabase.from('leads').select('id, email, status').eq('id', leadId).maybeSingle();
  if (!lead) return errResult('Lead não encontrado.');

  let destino: { id: string; seller_name: string; kind: string } | null = null;
  if (kitId) {
    const { data } = await supabase.from('lead_seller_kits').select('id, seller_name, kind, active').eq('id', kitId).maybeSingle();
    if (!data?.active) return errResult('Link não encontrado ou desativado.');
    if (data.kind === 'ia' && !opcoes.semEmail && !(lead.email && emailDeVerdade(lead.email)))
      return errResult('Este lead não tem e-mail: a IA chega por e-mail. Mande para o Felipe.');
    destino = data;
  }

  const { data: atuais } = await supabase
    .from('lead_kit_items')
    .select('kit_id, lead_seller_kits!inner(active)')
    .eq('lead_id', leadId)
    .eq('lead_seller_kits.active', true);
  const sair = (atuais ?? []).map((i) => i.kit_id).filter((k) => k !== kitId);
  if (sair.length) {
    const { error } = await supabase.from('lead_kit_items').delete().eq('lead_id', leadId).in('kit_id', sair);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível tirar o lead do link atual.'));
  }
  if (destino && !(atuais ?? []).some((i) => i.kit_id === destino.id)) {
    const itens = await montarItensDoKit(supabase, destino.id, [leadId], (await ultimaPosicao(supabase, destino.id)) + 1);
    const { error } = await supabase.from('lead_kit_items').insert(itens);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível mandar o lead.'));
  }
  revalidatePath('/admin/captacao');
  const aviso = lead.status !== 'novo' ? ' (o lead já tinha contato: o histórico continua com ele)' : '';
  return okResult(destino ? `Lead com ${destino.seller_name}${aviso}.` : 'Lead fora dos vendedores: fica com você.');
}

/**
 * "Chamar pelo meu WhatsApp e passar para a Lia" (pedido do dono, 28/10/2026):
 * a 1ª mensagem sai do WhatsApp do Arthur, à mão (sem risco de bloqueio por
 * automação), com o link do diagnóstico cujo botão abre a conversa no número
 * da Lia. Quando o cliente clica, a conversa começa por ele e a IA assume.
 * Coloca o lead na lista da Lia (e tira dos outros links) e devolve o texto.
 */
export async function passarParaLiaAction(
  leadId: string
): Promise<ActionResult & { whatsapp?: string | null; texto?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { data: kit } = await supabase
    .from('lead_seller_kits')
    .select('id, token, seller_name')
    .eq('kind', 'ia')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!kit) return errResult('Gere antes o link da atendente de IA (aba Vendedores).');
  const { data: lead } = await supabase.from('leads').select('name, phone, country, public_token').eq('id', leadId).maybeSingle();
  if (!lead) return errResult('Lead não encontrado.');

  const r = await moverLeadAction(leadId, kit.id, { semEmail: true });
  if (!r.ok) return r;

  const link = `${SITE_URL}/diagnostico/${lead.public_token}?k=${kit.token}`;
  const ingles = lead.country === 'US';
  const texto = ingles
    ? `Hi! This is Arthur from Prog Soluções. I put together a free review of ${lead.name}'s online presence: ${link}\n\nIf it makes sense, the button at the end of the page takes you straight to ${kit.seller_name}, our assistant, who can answer your questions right away.`
    : `Oi, tudo bem? Aqui é o Arthur, da Prog Soluções. Fiz um diagnóstico gratuito da presença online da ${lead.name}: ${link}\n\nSe fizer sentido, o botão no fim da página te leva direto para a ${kit.seller_name}, nossa assistente, que tira suas dúvidas na hora.`;
  const wa = whatsappDoLead(lead.phone, lead.country as Pais);
  return { ...okResult(`Lead na lista da ${kit.seller_name}. Mande a mensagem pelo seu WhatsApp.`), whatsapp: wa?.numero ?? null, texto };
}

/** Depois que o Arthur confirma que mandou: lead vira "Contatado" (se ainda era Novo). */
export async function confirmarPassagemParaLiaAction(leadId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { data: l } = await supabase.from('leads').select('status, notes, first_contact_at').eq('id', leadId).maybeSingle();
  if (!l) return errResult('Lead não encontrado.');
  const agora = new Date().toISOString();
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const { error } = await supabase
    .from('leads')
    .update({
      ...(l.status === 'novo' ? { status: 'contatado', first_contact_at: l.first_contact_at ?? agora } : {}),
      last_contact_at: agora,
      notes: [l.notes, `[Arthur ${hoje}] Chamou pelo WhatsApp dele e passou para a Lia.`].filter(Boolean).join('\n'),
      updated_at: agora,
    })
    .eq('id', leadId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível registrar.'));
  revalidatePath('/admin/captacao');
  return okResult('Registrado. Quando o cliente clicar no botão do diagnóstico, a Lia assume a conversa.');
}

/** Desativa (ou reativa) o link: desativado, a página do vendedor some. */
export async function alternarKitAction(id: string, ativo: boolean): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase.from('lead_seller_kits').update({ active: ativo }).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível alterar o link.'));
  revalidatePath('/admin/captacao');
  return okResult(ativo ? 'Link reativado.' : 'Link desativado: a página do vendedor não abre mais.');
}

/** Checklist de descoberta preenchido pelo dono no painel. */
export async function salvarChecklistAction(id: string, respostas: RespostasDoChecklist): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { data: atual } = await supabase.from('leads').select('status').eq('id', id).maybeSingle();
  if (!atual) return errResult('Lead não encontrado.');
  const { error } = await supabase
    .from('leads')
    .update({
      discovery: limparRespostas(respostas),
      discovery_by: 'Arthur',
      discovery_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o checklist.'));
  // Preencher o checklist é conversar com o cliente.
  const passou = await assumirDoVendedor(supabase, id, atual.status);
  revalidatePath('/admin/captacao');
  return okResult(`Checklist salvo.${passou}`);
}
