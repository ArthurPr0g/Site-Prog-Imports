import { createClient } from '@/lib/supabase/server';
import { carregarParcelasPorCliente } from '@/lib/data/customer-history';
import { calcularAdimplencia, type Adimplencia } from '@/lib/customer-history';
import { statusExibido, type Installment } from '@/lib/installments';

// Clientes do ERP. Diferente de `profiles`, que é "quem tem conta no site":
// aqui entra também quem comprou pelo WhatsApp, trouxe produto para troca ou
// contratou um serviço — gente que nunca vai logar.

export type Customer = {
  id: string;
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
  /** Preenchido só quando o cliente também tem conta no site. */
  profileId: string | null;
  createdAt: string;
  /** Derivado das parcelas em aberto, nunca gravado. */
  adimplencia: Adimplencia;
  parcelasAtrasadas: number;
};

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  doc: string | null;
  cep: string | null;
  address_line: string | null;
  address_number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  profile_id: string | null;
  created_at: string;
};

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toCustomer(r: Row, parcelas: Installment[] = []): Customer {
  const hoje = hojeISO();
  return {
    adimplencia: calcularAdimplencia(parcelas, hoje),
    parcelasAtrasadas: parcelas.filter((p) => statusExibido(p, hoje) === 'Atrasada').length,
    id: r.id,
    name: r.name,
    email: r.email ?? '',
    phone: r.phone ?? '',
    doc: r.doc ?? '',
    cep: r.cep ?? '',
    addressLine: r.address_line ?? '',
    addressNumber: r.address_number ?? '',
    complement: r.complement ?? '',
    district: r.district ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    notes: r.notes ?? '',
    profileId: r.profile_id,
    createdAt: r.created_at,
  };
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  const supabase = await createClient();
  let query = supabase.from('customers').select('*').order('name');

  const termo = search?.trim();
  if (termo) {
    // Busca no que a pessoa provavelmente lembra: nome, e-mail, telefone ou documento.
    query = query.or(
      ['name', 'email', 'phone', 'doc'].map((c) => `${c}.ilike.%${termo}%`).join(',')
    );
  }

  const { data } = await query;
  // Uma consulta só traz as parcelas de todos os clientes, para a listagem não
  // fazer uma ida ao banco por linha.
  const parcelas = await carregarParcelasPorCliente();
  return (data ?? []).map((r) => toCustomer(r as Row, parcelas.get(r.id) ?? []));
}

/** Clientes do ERP que parecem ser a mesma pessoa de um perfil do site.
 *
 *  Usado no cadastro: quando alguém cria conta com e-mail e nome iguais aos de
 *  um cliente já cadastrado, mostramos para a própria pessoa confirmar se é ela
 *  antes de vincular. Vincular sozinho pelo e-mail seria arriscado — e-mail
 *  compartilhado em família ou empresa juntaria históricos de gente diferente. */
export async function findCustomerCandidates(email: string, name: string): Promise<Customer[]> {
  const emailLimpo = email.trim().toLowerCase();
  if (!emailLimpo) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('*')
    .is('profile_id', null)
    .ilike('email', emailLimpo);

  const nomeLimpo = name.trim().toLowerCase();
  return (data ?? [])
    .map((r) => toCustomer(r as Row))
    .filter((c) => !nomeLimpo || c.name.trim().toLowerCase() === nomeLimpo);
}
