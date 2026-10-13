// Nome do PDF da proposta: "<código> <cliente> - <serviços>", por exemplo
// "3F2A9C1B Dhagner - Combo Loja Profissional + Sistema de Gestão Básico".
// É o nome que o cliente vê ao receber o arquivo, então leva acentos e espaços
// de verdade; só saem os caracteres que Windows e macOS recusam em nome de
// arquivo. O mesmo texto vira o título do documento (aba do visualizador).

import { tituloDosServicos, type ServiceOrderItem } from '@/lib/services';

const PROIBIDOS = /[\\/:*?"<>|\u0000-\u001f]/g;
const LIMITE = 150;

function limpar(texto: string): string {
  return (texto ?? '').replace(PROIBIDOS, ' ').replace(/\s+/g, ' ').trim();
}

export function nomeDaProposta({
  numero,
  cliente,
  itens,
  titulo,
}: {
  numero: string;
  cliente: string;
  itens: Pick<ServiceOrderItem, 'name' | 'billingType'>[];
  titulo: string;
}): string {
  const servicos = limpar(tituloDosServicos(itens)) || limpar(titulo) || 'Serviços';
  const inicio = [limpar(numero), limpar(cliente)].filter(Boolean).join(' ');
  const nome = `${inicio} - ${servicos}`;
  // Muitos serviços: corta o fim da lista, nunca o código nem o cliente.
  return nome.length > LIMITE ? `${nome.slice(0, LIMITE - 1).trimEnd()}…` : nome;
}

/** Cabeçalho Content-Disposition com o nome em UTF-8 (RFC 5987) e uma versão
 *  sem acento para navegadores antigos. */
export function contentDispositionDoPdf(nome: string): string {
  const ascii = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/["\\]/g, '')
    .trim();
  return `inline; filename="${ascii || 'proposta'}.pdf"; filename*=UTF-8''${encodeURIComponent(`${nome}.pdf`)}`;
}
