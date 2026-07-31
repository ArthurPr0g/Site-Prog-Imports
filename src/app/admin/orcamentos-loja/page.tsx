import { ModuloPendente } from '@/components/admin/ModuloPendente';

export default function AdminPageOrcamentosLoja() {
  return (
    <ModuloPendente
      titulo="Orçamentos Loja"
      subtitulo="Cotação de compra internacional antes de virar estoque"
      modulo="M3 — Orçamentos Loja"
      entrega={[
        'Motor de cálculo USD→BRL com os 6 componentes de custo',
        'Cotação oficial vinda de Configurações, com recálculo em massa',
        'Duplicar, exportar para o cliente e enviar para o estoque',
        'Badge de adimplência do cliente e PIX parcelado',
      ]}
      depende="M1 e M2"
    />
  );
}