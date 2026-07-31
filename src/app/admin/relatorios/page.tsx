import { ModuloPendente } from '@/components/admin/ModuloPendente';

export default function AdminPageRelatorios() {
  return (
    <ModuloPendente
      titulo="Relatórios"
      subtitulo="Exportação bruta das tabelas do sistema"
      modulo="M9 — Relatórios"
      entrega={[
        'Dados brutos das tabelas macro: vendas, estoque, orçamentos, financeiro, clientes',
        'Filtro por período',
        'Exportação',
      ]}
      depende="Todos os módulos anteriores"
    />
  );
}