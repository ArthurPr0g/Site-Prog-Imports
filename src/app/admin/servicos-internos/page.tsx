import { ModuloPendente } from '@/components/admin/ModuloPendente';

export default function AdminPageServicosInternos() {
  return (
    <ModuloPendente
      titulo="Serviços"
      subtitulo="Cadastro dos serviços que não aparecem no site público"
      modulo="M6 — Serviços e Prestação"
      entrega={[
        'Catálogo separado do de Serviços da Loja',
        'Exemplos: criação de sites, sistemas, design',
        'Valor usado como base em orçamentos e prestações',
      ]}
      depende="M1 — Clientes"
    />
  );
}