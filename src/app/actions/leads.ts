'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types';
import type { ModeloMensagem } from '@/lib/mensagens-lead';
import { LEAD_STATUSES, avaliarLead, chaveDoLead, linhasDoCsv, type LeadStatus, type Pais } from '@/lib/captacao';

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

  // Mesma empresa repetida (tiles do --grid, ou em dois arquivos): fica a última.
  const porChave = new Map<string, TablesInsert<'leads'>>();
  let semRamo = 0;
  for (const arquivo of arquivos) {
    const linhas = linhasDoCsv(await arquivo.text());
    for (const l of linhas) {
      const pais: Pais = l.buscaPais === 'US' || l.buscaPais === 'BR' ? l.buscaPais : paisDoForm;
      const niche = l.buscaRamo ?? nicheDoForm;
      const city = l.buscaCidade ?? cityDoForm;
      const state = l.buscaEstado || stateDoForm;
      if (!niche) semRamo++;
      const { score, suggestedServices, reasons } = avaliarLead(l, niche);
      const chave = chaveDoLead(l);
      porChave.set(chave, {
        dedupe_key: chave,
        place_id: l.placeId,
        name: l.name,
        category: l.category,
        niche,
        city,
        state,
        country: pais,
        address: l.address,
        phone: l.phone,
        email: l.email,
        website: l.website,
        site_check: l.siteCheck,
        instagram: l.instagram,
        facebook: l.facebook,
        linkedin: l.linkedin,
        maps_url: l.mapsUrl,
        rating: l.rating,
        review_count: l.reviewCount,
        score,
        suggested_services: suggestedServices,
        reasons,
        source: arquivo.name,
        updated_at: new Date().toISOString(),
      });
    }
  }
  const registros = [...porChave.values()];
  if (registros.length === 0) return errResult('Nenhuma empresa encontrada. Confira se são CSVs do scraper.');

  // A contagem vai na URL (filtro "in"): lotes de 100 chaves cabem com folga
  // no limite de tamanho da URL; o upsert vai no corpo e aceita lotes maiores.
  let jaExistiam = 0;
  for (let i = 0; i < registros.length; i += 100) {
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in(
        'dedupe_key',
        registros.slice(i, i + 100).map((r) => r.dedupe_key)
      );
    jaExistiam += count ?? 0;
  }

  for (let i = 0; i < registros.length; i += 500) {
    const { error } = await supabase.from('leads').upsert(registros.slice(i, i + 500), { onConflict: 'dedupe_key' });
    if (error) return errResult(friendlyDbError(error, 'Não foi possível importar os leads.'));
  }

  revalidatePath('/admin/captacao');
  const aviso = semRamo ? ` ${semRamo} sem ramo: preencha o ramo ao importar CSV que não veio do captar.ps1.` : '';
  return okResult(
    `${arquivos.length} arquivo(s): ${registros.length - jaExistiam} lead(s) novo(s) e ${jaExistiam} atualizado(s).${aviso}`
  );
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
    if (!['whatsapp', 'email'].includes(m.channel) || !['pt', 'en'].includes(m.lang)) {
      return errResult('Modelo inválido.');
    }
    if (!m.body.trim()) return errResult('A mensagem não pode ficar vazia.');
    if (m.channel === 'email' && !m.subject?.trim()) return errResult('Preencha o assunto do e-mail.');
  }

  const { error } = await supabase.from('lead_templates').upsert(
    modelos.map((m) => ({
      channel: m.channel,
      lang: m.lang,
      subject: m.channel === 'email' ? m.subject!.trim() : null,
      body: m.body.trim(),
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'channel,lang' }
  );
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar as mensagens.'));

  revalidatePath('/admin/captacao');
  return okResult('Mensagens salvas.');
}
