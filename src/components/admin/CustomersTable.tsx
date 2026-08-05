'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Link2Off, UserPlus } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import {
  saveCustomerAction,
  deleteCustomerAction,
  unlinkCustomerProfileAction,
  type CustomerFormInput,
} from '@/app/actions/customers';
import Link from 'next/link';
import type { Customer } from '@/lib/data/customers';
import { SeloAdimplencia } from '@/components/admin/SeloAdimplencia';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const VAZIO: CustomerFormInput = {
  name: '',
  email: '',
  phone: '',
  doc: '',
  cep: '',
  addressLine: '',
  addressNumber: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  notes: '',
};

function paraFormulario(c: Customer): CustomerFormInput {
  const { id, name, email, phone, doc, cep, addressLine, addressNumber, complement, district, city, state, notes } = c;
  return { id, name, email, phone, doc, cep, addressLine, addressNumber, complement, district, city, state, notes };
}

export function CustomersTable({ customers }: { customers: Customer[] }) {
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<CustomerFormInput | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  // Filtro no cliente: o volume aqui é de dezenas, não de milhares, e ida ao
  // servidor a cada tecla digitada só deixaria a busca lenta.
  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? customers.filter((c) =>
        [c.name, c.email, c.phone, c.doc, c.city].some((v) => v.toLowerCase().includes(termo))
      )
    : customers;

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await saveCustomerAction(form);
      toast(result.message);
      if (result.ok) setForm(null);
    });
  }

  function excluir(c: Customer) {
    if (!window.confirm(`Excluir o cliente "${c.name}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const result = await deleteCustomerAction(c.id);
      toast(result.message);
    });
  }

  function desvincular(c: Customer) {
    if (!window.confirm(`Desvincular a conta do site de "${c.name}"? O cliente continua cadastrado.`)) return;
    startTransition(async () => {
      const result = await unlinkCustomerProfileAction(c.id);
      toast(result.message);
    });
  }

  const set = (campo: keyof CustomerFormInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [campo]: e.target.value } : f));

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail, telefone, documento ou cidade…"
          className={`min-w-[280px] flex-1 ${inputClass}`}
        />
        <button
          onClick={() => setForm({ ...VAZIO })}
          className="flex items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
        >
          <UserPlus size={16} />
          Novo cliente
        </button>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[1.5fr_1.4fr_1fr_150px_120px] gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <div>Cliente</div>
            <div>E-mail</div>
            <div>Telefone</div>
            <div>Situação</div>
            <div className="text-right">Ações</div>
          </div>

          {visiveis.length === 0 && (
            <div className="py-6 text-sm text-fg-tertiary">
              {customers.length === 0
                ? 'Nenhum cliente cadastrado ainda.'
                : 'Nenhum cliente encontrado com esse termo.'}
            </div>
          )}

          {visiveis.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1.5fr_1.4fr_1fr_150px_120px] items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid h-7.5 w-7.5 flex-shrink-0 place-items-center rounded-full border border-border-hover bg-[#1c1c21] text-xs font-extrabold text-accent">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {/* O nome é o caminho para o histórico: é onde o operador
                      procura quando quer saber tudo do cliente. */}
                  <Link
                    href={`/admin/clientes/${c.id}`}
                    className="block truncate font-bold hover:text-accent hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.profileId && (
                    // Sinaliza que este cliente também tem conta na loja — evita
                    // o operador cadastrar a mesma pessoa duas vezes.
                    <div className="text-[11px] font-bold text-accent">tem conta no site</div>
                  )}
                </div>
              </div>
              <div className="truncate text-[13px] text-fg-secondary">{c.email || '—'}</div>
              <div className="text-[13px] text-fg-secondary">{c.phone || '—'}</div>
              <div>
                <SeloAdimplencia situacao={c.adimplencia} compacto atrasadas={c.parcelasAtrasadas} />
              </div>
              <div className="flex justify-end gap-1.5">
                {c.profileId && (
                  <button
                    onClick={() => desvincular(c)}
                    disabled={pending}
                    title="Desvincular conta do site"
                    aria-label={`Desvincular conta do site de ${c.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    <Link2Off size={14} />
                  </button>
                )}
                <button
                  onClick={() => setForm(paraFormulario(c))}
                  disabled={pending}
                  title="Editar"
                  aria-label={`Editar ${c.name}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => excluir(c)}
                  disabled={pending}
                  title="Excluir"
                  aria-label={`Excluir ${c.name}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-5 text-[15px] font-extrabold">
              {form.id ? 'Editar cliente' : 'Novo cliente'}
            </div>

            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Identificação</div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input value={form.name} onChange={set('name')} placeholder="Nome completo *" className={`sm:col-span-2 ${inputClass}`} />
              <input value={form.email} onChange={set('email')} placeholder="E-mail" className={inputClass} />
              <input value={form.phone} onChange={set('phone')} placeholder="Telefone" className={inputClass} />
              <input value={form.doc} onChange={set('doc')} placeholder="CPF ou CNPJ" className={inputClass} />
            </div>

            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Endereço (opcional)</div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input value={form.cep} onChange={set('cep')} placeholder="CEP" className={inputClass} />
              <input value={form.district} onChange={set('district')} placeholder="Bairro" className={inputClass} />
              <input value={form.addressLine} onChange={set('addressLine')} placeholder="Rua / Avenida" className={`sm:col-span-2 ${inputClass}`} />
              <input value={form.addressNumber} onChange={set('addressNumber')} placeholder="Número" className={inputClass} />
              <input value={form.complement} onChange={set('complement')} placeholder="Complemento" className={inputClass} />
              <input value={form.city} onChange={set('city')} placeholder="Cidade" className={inputClass} />
              <input value={form.state} onChange={set('state')} placeholder="Estado (UF)" className={inputClass} />
            </div>

            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Observações</div>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              placeholder="Anotações internas sobre este cliente"
              className={`mb-5 w-full resize-y ${inputClass}`}
            />

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setForm(null)}
                disabled={pending}
                className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={pending}
                className="rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
              >
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
