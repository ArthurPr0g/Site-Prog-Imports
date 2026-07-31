import { ModuloPendente } from '@/components/admin/ModuloPendente';

export default function AdminPageOrcamentosServicos() {
  return (
    <ModuloPendente
      titulo="Orçamentos Serviços"
      subtitulo="Propostas de serviços que não aparecem no site público"
      modulo="M7 — Orçamentos Serviços"
      entrega={[
        'Proposta para serviços como criação de sites, sistemas e design',
        'Escopo, valores e condições',
        'Conversão em prestação de serviço quando aprovado',
      ]}
      depende="M6 — Serviços e Prestação"
    />
  );
}