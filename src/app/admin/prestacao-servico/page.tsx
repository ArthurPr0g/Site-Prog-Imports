import { ModuloPendente } from '@/components/admin/ModuloPendente';

export default function AdminPagePrestacaoServico() {
  return (
    <ModuloPendente
      titulo="Prestação de Serviço"
      subtitulo="Serviços prestados a clientes"
      modulo="M6 — Serviços e Prestação"
      entrega={[
        'Catálogo interno preenche nome e valor automaticamente',
        'Lançamento financeiro automático conforme o status',
        'Indicadores de serviços prestados e receita',
      ]}
      depende="M1 e M5"
    />
  );
}