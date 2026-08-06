// Etiqueta de transporte: monta o conteúdo a partir da venda, do cadastro do
// cliente e do remetente configurado. Puro — o desenho no canvas vive em
// `lib/shipping-label-canvas.ts`, que só recebe o resultado daqui.

export type EnderecoDaEtiqueta = {
  nome: string;
  doc: string;
  telefone: string;
  /** Rua já com número, do jeito que vai impresso. */
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

export type Etiqueta = {
  remetente: EnderecoDaEtiqueta;
  destinatario: EnderecoDaEtiqueta;
  pedido: string;
  data: string;
  /** Itens resumidos, para conferir o volume na hora de despachar. */
  conteudo: string;
};

const VAZIO: EnderecoDaEtiqueta = {
  nome: '',
  doc: '',
  telefone: '',
  logradouro: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
};

function limpar(v: string | null | undefined): string {
  return (v ?? '').trim();
}

/** CEP no formato 00000-000. Aceita o que estiver gravado — com pontuação,
 *  sem, ou com espaços — porque veio de digitação livre em três telas
 *  diferentes. Quem não tiver 8 dígitos sai como está: inventar formato
 *  esconderia um CEP incompleto justamente de quem precisa notar. */
export function formatarCEP(cep: string): string {
  const digitos = limpar(cep).replace(/\D/g, '');
  if (digitos.length !== 8) return limpar(cep);
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

/** Junta rua e número como se escreve num envelope. */
function comNumero(rua: string, numero: string): string {
  const r = limpar(rua);
  const n = limpar(numero);
  if (!r) return '';
  return n ? `${r}, ${n}` : r;
}

/** "Goiânia / GO" e "Goiânia - GO" viram cidade e UF separados.
 *
 *  O endereço das vendas do site é um retrato gravado na hora da compra
 *  (`address_snapshot`), e lá a cidade já vem com a UF junto num campo só. A
 *  etiqueta imprime as duas em posições diferentes, então precisa separá-las. */
export function separarCidadeUF(texto: string): { cidade: string; uf: string } {
  const t = limpar(texto);
  const m = t.match(/^(.*?)[\s]*[/-][\s]*([A-Za-z]{2})$/);
  if (m) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  return { cidade: t, uf: '' };
}

export type RemetenteConfigurado = {
  senderName: string;
  senderDoc: string;
  senderPhone: string;
  senderCep: string;
  senderAddressLine: string;
  senderAddressNumber: string;
  senderComplement: string;
  senderDistrict: string;
  senderCity: string;
  senderState: string;
};

export function remetenteDaConfiguracao(s: RemetenteConfigurado): EnderecoDaEtiqueta {
  return {
    nome: limpar(s.senderName),
    doc: limpar(s.senderDoc),
    telefone: limpar(s.senderPhone),
    logradouro: comNumero(s.senderAddressLine, s.senderAddressNumber),
    complemento: limpar(s.senderComplement),
    bairro: limpar(s.senderDistrict),
    cidade: limpar(s.senderCity),
    uf: limpar(s.senderState).toUpperCase(),
    cep: formatarCEP(s.senderCep),
  };
}

/** Endereço gravado na venda do site, no formato do checkout. */
export type EnderecoDaVenda = {
  rua?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  cep?: string | null;
};

/** Cadastro do cliente no ERP. */
export type ClienteDaVenda = {
  name?: string | null;
  doc?: string | null;
  phone?: string | null;
  cep?: string | null;
  addressLine?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

/** Destinatário da etiqueta.
 *
 *  O retrato da venda vem primeiro: é o endereço que o cliente escolheu naquela
 *  compra. O cadastro pode ter mudado desde então, e mudar não deve reescrever
 *  para onde uma encomenda antiga foi enviada.
 *
 *  Nome, documento e telefone vêm do cadastro mesmo assim — o retrato não os
 *  guarda, e a transportadora precisa de alguém para procurar na entrega. */
export function destinatarioDaVenda(
  nomeNaVenda: string,
  endereco: EnderecoDaVenda | null,
  cliente: ClienteDaVenda | null
): EnderecoDaEtiqueta {
  const nome = limpar(cliente?.name) || limpar(nomeNaVenda);
  const doc = limpar(cliente?.doc);
  const telefone = limpar(cliente?.phone);

  if (endereco && (limpar(endereco.rua) || limpar(endereco.cep))) {
    const { cidade, uf } = separarCidadeUF(endereco.cidade ?? '');
    return {
      nome,
      doc,
      telefone,
      // A rua do checkout já vem com o número embutido ("Rua T-38, 1200").
      logradouro: limpar(endereco.rua),
      complemento: limpar(endereco.complemento),
      bairro: limpar(endereco.bairro),
      cidade,
      uf,
      cep: formatarCEP(endereco.cep ?? ''),
    };
  }

  if (cliente) {
    return {
      nome,
      doc,
      telefone,
      logradouro: comNumero(cliente.addressLine ?? '', cliente.addressNumber ?? ''),
      complemento: limpar(cliente.complement),
      bairro: limpar(cliente.district),
      cidade: limpar(cliente.city),
      uf: limpar(cliente.state).toUpperCase(),
      cep: formatarCEP(cliente.cep ?? ''),
    };
  }

  return { ...VAZIO, nome };
}

/** O que falta para a etiqueta poder ser impressa.
 *
 *  Lista em vez de booleano: "não dá para gerar" sem dizer o que falta obriga o
 *  dono a caçar o campo vazio em duas telas diferentes. */
export function faltaParaEtiqueta(e: Etiqueta): string[] {
  const problemas: string[] = [];

  if (!e.remetente.nome || !e.remetente.logradouro || !e.remetente.cep) {
    problemas.push('Preencha o endereço do remetente em Configurações.');
  }
  if (!e.destinatario.nome) {
    problemas.push('A venda não tem o nome de quem compra.');
  }
  if (!e.destinatario.logradouro || !e.destinatario.cep) {
    problemas.push(
      'O destinatário está sem endereço. Vincule a venda a um cliente do cadastro e preencha o endereço dele.'
    );
  }

  return problemas;
}

/** Linhas do endereço, na ordem do envelope e sem buracos.
 *
 *  Devolver linhas prontas mantém o desenho burro: o canvas só imprime uma
 *  embaixo da outra, sem decidir o que fazer quando falta complemento ou UF. */
export function linhasDoEndereco(e: EnderecoDaEtiqueta): string[] {
  const cidadeUF = [e.cidade, e.uf].filter(Boolean).join(' — ');
  return [e.logradouro, e.complemento, e.bairro, cidadeUF].map(limpar).filter(Boolean);
}

/** Nome de arquivo do PNG: sem acento, sem barra, previsível. */
export function nomeDoArquivo(pedido: string, nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase();
  const numero = pedido.replace(/\D/g, '') || 'venda';
  return `etiqueta-${numero}${limpo ? `-${limpo}` : ''}.png`;
}
