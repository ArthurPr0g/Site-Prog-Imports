import { ModuloPendente } from '@/components/admin/ModuloPendente';

export default function AdminPageAvaliacaoTroca() {
  return (
    <ModuloPendente
      titulo="Avaliação de Troca"
      subtitulo="Cliente entrega produtos usados como parte do pagamento"
      modulo="M8 — Avaliação de Troca"
      entrega={[
        'Até 10 produtos recebidos por negociação, com estado de conservação',
        'Cálculo de diferença a pagar e lucro total',
        'Gera itens de estoque e a venda do produto principal numa transação só',
      ]}
      depende="M2, M4 e M5"
    />
  );
}