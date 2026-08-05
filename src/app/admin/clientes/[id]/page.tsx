import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { carregarHistoricoDoCliente } from '@/lib/data/customer-history';
import { resumirFinanceiroDoCliente } from '@/lib/customer-history';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ClienteHistorico } from '@/components/admin/ClienteHistorico';
import { SeloAdimplencia } from '@/components/admin/SeloAdimplencia';

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (!cliente) notFound();

  const historico = await carregarHistoricoDoCliente(id, cliente.profile_id);
  const resumo = resumirFinanceiroDoCliente(historico, hojeISO());

  const contato = [cliente.email, cliente.phone].filter(Boolean).join(' · ');
  const endereco = [cliente.city, cliente.state].filter(Boolean).join(' — ');

  return (
    <div>
      <Link
        href="/admin/clientes"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-fg-tertiary hover:text-accent"
      >
        <ArrowLeft size={14} /> Voltar para Clientes
      </Link>

      <AdminPageHeader
        title={cliente.name}
        subtitle={[cliente.doc, contato, endereco].filter(Boolean).join('  |  ') || 'Sem dados de contato'}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SeloAdimplencia situacao={resumo.adimplencia} atrasadas={resumo.qtdAtrasadas} />
        {!cliente.profile_id && (
          <span className="text-[12px] text-fg-faded">
            Sem conta no site — cadastrado só no gerenciamento.
          </span>
        )}
        {!!cliente.notes && <span className="text-[12px] text-fg-tertiary">{cliente.notes}</span>}
      </div>

      <ClienteHistorico historico={historico} resumo={resumo} />
    </div>
  );
}
