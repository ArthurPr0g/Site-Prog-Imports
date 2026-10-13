// Mensagem para mandar ao cliente junto com o PDF da proposta (WhatsApp ou
// e-mail). Pura: a tela só copia o texto. Usa os MESMOS números do PDF
// (totais recalculados dos itens, desconto, combo e metades), para a conversa
// e o documento nunca discordarem.
//
// O *negrito* e o ~riscado~ são a marcação do WhatsApp; no e-mail aparecem
// como asteriscos e tis, que continuam legíveis.

import { formatBRL } from '@/lib/format';
import { aplicarDesconto, rotuloDoDesconto, temDesconto, valorDoDesconto, type Desconto } from '@/lib/discount';
import { formatPrazo, tituloDosServicos, totalizarItens, type ServiceOrderItem } from '@/lib/services';
import { totaisDoCombo } from '@/lib/combo-servicos';
import { metadesDoPagamento } from '@/lib/contract';

/** Como chamar o cliente. Cadastro de empresa costuma vir como "Empresa -
 *  Contato" (ex.: "Kessin Barbershop - Cledson"): aí o nome é o do contato.
 *  Senão, o primeiro nome. Sem cliente, "tudo bem?" sem nome. */
export function primeiroNome(nomeDoCliente: string): string {
  const partes = (nomeDoCliente ?? '').split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  const pessoa = partes.length > 1 ? partes[partes.length - 1] : partes[0] ?? '';
  return pessoa.split(/\s+/)[0] ?? '';
}

export function mensagemDaProposta(q: {
  customerName: string;
  title: string;
  items: ServiceOrderItem[];
  desconto: Desconto;
  planMonths: number | null;
}): string {
  const totais = totalizarItens(q.items);
  const { separados, descontoCombo } = totaisDoCombo(q.items);
  const comDesconto = temDesconto(q.desconto) && valorDoDesconto(totais.total, q.desconto) > 0;
  const trabalho = aplicarDesconto(totais.total, q.desconto);
  const { primeira, segunda } = metadesDoPagamento(trabalho);
  const meses = q.planMonths ?? 0;
  const servicos = tituloDosServicos(q.items) || q.title;
  const nome = primeiroNome(q.customerName);

  const linhas: string[] = [];
  linhas.push(`Olá${nome ? `, ${nome}` : ''}! Tudo bem?`);
  linhas.push('');
  linhas.push(`Segue a proposta para *${servicos}*. Os detalhes de cada serviço estão no PDF.`);

  if (totais.total > 0) {
    linhas.push('');
    linhas.push('*Investimento*');
    if (descontoCombo > 0) {
      linhas.push(`• Contratando separado: ~${formatBRL(separados)}~`);
      linhas.push(`• Com o combo: ${formatBRL(totais.total)} (economia de ${formatBRL(descontoCombo)})`);
    }
    if (comDesconto) {
      const motivo = q.desconto.descricao ? ` de ${q.desconto.descricao.toLowerCase()}` : '';
      linhas.push(`• Desconto${motivo} (${rotuloDoDesconto(q.desconto)}): -${formatBRL(valorDoDesconto(totais.total, q.desconto))}`);
    }
    linhas.push(`• *Total: ${formatBRL(trabalho)}*`);
    if (totais.prazoDias > 0) linhas.push(`• Prazo de entrega: ${formatPrazo(totais.prazoDias)}`);

    linhas.push('');
    linhas.push('*Pagamento*');
    linhas.push(`• 50% para começar: ${formatBRL(primeira)}`);
    linhas.push(`• 50% na entrega: ${formatBRL(segunda)}`);
    linhas.push('Pix, boleto ou cartão. No cartão, cada parte pode ser dividida em até 2x sem juros.');
  }

  if (totais.mensal > 0) {
    linhas.push('');
    linhas.push(
      `*Mensalidade:* ${formatBRL(totais.mensal)}/mês${meses > 0 ? `, plano de ${meses} meses` : ''}, com hospedagem, segurança, backups e suporte.`
    );
  }

  linhas.push('');
  linhas.push('Qualquer dúvida, é só me chamar. Para começarmos, basta confirmar por aqui!');
  return linhas.join('\n');
}
