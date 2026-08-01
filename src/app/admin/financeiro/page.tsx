import { listFinanceEntries, primeiraMovimentacao } from '@/lib/data/finance';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { FinanceBoard } from '@/components/admin/FinanceBoard';

export default async function AdminFinanceiroPage() {
  const [entries, primeiraData] = await Promise.all([listFinanceEntries(), primeiraMovimentacao()]);

  return (
    <div>
      <AdminPageHeader
        title="Financeiro"
        subtitle="Livro-caixa de receitas e despesas — lançamentos manuais e o que vier de vendas e serviços"
      />
      <FinanceBoard entries={entries} primeiraData={primeiraData} />
    </div>
  );
}
