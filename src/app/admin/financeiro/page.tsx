import { ModuloPendente } from '@/components/admin/ModuloPendente';

export default function AdminPageFinanceiro() {
  return (
    <ModuloPendente
      titulo="Financeiro"
      subtitulo="Livro-caixa consolidado de receitas e despesas"
      modulo="M5 — Financeiro"
      entrega={[
        'Lançamentos automáticos de vendas e serviços, mais lançamentos manuais',
        'Receita e despesa, real e prevista, por período',
        'Lucro líquido calculado sobre o lucro real, não sobre o faturamento',
        'Gráfico de fluxo de caixa mensal',
      ]}
      depende="M4 — Vendas"
    />
  );
}