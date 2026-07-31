'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';

export type CustomerFormInput = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  doc: string;
  cep: string;
  addressLine: string;
  addressNumber: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

/** Só o nome é obrigatório: muita venda começa com "o cliente do WhatsApp que
 *  quer o Alienware" e os dados chegam depois. Exigir e-mail ou documento aqui
 *  faria o operador inventar valor para conseguir salvar. */
export async function saveCustomerAction(input: CustomerFormInput): Promise<ActionResult & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const name = input.name.trim();
  if (!name) return errResult('Informe o nome do cliente.');

  const email = input.email.trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return errResult('O e-mail informado não parece válido.');
  }

  const payload = {
    name,
    email: email || null,
    phone: input.phone.trim() || null,
    doc: input.doc.trim() || null,
    cep: input.cep.trim() || null,
    address_line: input.addressLine.trim() || null,
    address_number: input.addressNumber.trim() || null,
    complement: input.complement.trim() || null,
    district: input.district.trim() || null,
    city: input.city.trim() || null,
    state: input.state.trim() || null,
    notes: input.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from('customers').update(payload).eq('id', input.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar as alterações do cliente.'));
    revalidatePath('/admin/clientes');
    return { ...okResult('Cliente atualizado.'), id: input.id };
  }

  const { data, error } = await supabase.from('customers').insert(payload).select('id').single();
  if (error) return errResult(friendlyDbError(error, 'Não foi possível cadastrar o cliente.'));
  revalidatePath('/admin/clientes');
  return { ...okResult('Cliente cadastrado.'), id: data?.id };
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) {
    // 23503 aqui significa que o cliente já aparece em orçamento, venda, troca
    // ou prestação. A mensagem genérica de chave estrangeira não ajudaria o
    // operador a entender o que fazer.
    if (error.code === '23503') {
      return errResult(
        'Este cliente tem registros vinculados (orçamento, venda, troca ou serviço). Remova-os antes de excluir o cliente.'
      );
    }
    return errResult(friendlyDbError(error, 'Não foi possível excluir o cliente.'));
  }

  revalidatePath('/admin/clientes');
  return okResult('Cliente excluído.');
}

/** Desfaz o vínculo entre um cliente do ERP e uma conta do site. Existe para o
 *  caso de vínculo feito por engano — o cliente do ERP continua existindo. */
export async function unlinkCustomerProfileAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { error } = await supabase.from('customers').update({ profile_id: null }).eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível desvincular a conta.'));

  revalidatePath('/admin/clientes');
  return okResult('Conta do site desvinculada deste cliente.');
}
