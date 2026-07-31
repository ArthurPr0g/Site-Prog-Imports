import { ModuloPendente } from '@/components/admin/ModuloPendente';

export default function AdminPageEstoque() {
  return (
    <ModuloPendente
      titulo="Estoque"
      subtitulo="Inventário físico de produtos disponíveis para venda"
      modulo="M2 — Estoque"
      entrega={[
        'Cards de indicador: valor total, custo total, vendidos, em transporte',
        'Tabela com foto, origem, status, cliente reservado, cotação, lucro esperado',
        'Origens: Manual, Orçamento e Troca',
        'Proteções de exclusão para item já vendido ou usado em troca',
      ]}
      depende="M1 — Clientes e Configurações"
    />
  );
}