/* eslint-disable jsx-a11y/alt-text */
// Documento da proposta comercial. Página 1 é a proposta; se o contrato estiver
// marcado, as páginas seguintes trazem as cláusulas para assinatura.
//
// Fundo branco por decisão do dono: é documento para imprimir e assinar. A
// identidade da loja entra pela cor de destaque e pela logo, não pelo fundo
// escuro do site — que gastaria tinta e sairia ilegível impresso.
//
// `Image` do react-pdf não aceita `alt`, daí o disable do jsx-a11y no topo:
// a regra é de HTML e não se aplica a este renderizador.

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { formatBRL, formatDateBR } from '@/lib/format';
import { formatPrazo, type ServiceOrderItem } from '@/lib/services';
import {
  montarClausulas,
  metadesDoPagamento,
  tituloDoContrato,
  qualificacaoDasPartes,
  classificarServico,
  type ClausulaContrato,
  type DadosDoContratado,
  type DadosDoContratante,
  type ServicoDoContrato,
} from '@/lib/contract';
import { temDesconto, valorDoDesconto, aplicarDesconto, rotuloDoDesconto, type Desconto } from '@/lib/discount';

export type DadosDaProposta = {
  numero: string;
  criadoEm: string;
  titulo: string;
  observacoes: string;
  /** `endereco` só vai para a qualificação do contrato; a proposta mostra a cidade. */
  cliente: { nome: string; documento: string; email: string; telefone: string; cidade: string; endereco: string };
  /** `categoria` é a do serviço do catálogo e decide as cláusulas de cada item. */
  itens: (ServiceOrderItem & { categoria?: string | null })[];
  totalUnico: number;
  totalMensal: number;
  mesesPlano: number | null;
  prazoDias: number;
  incluirContrato: boolean;
  clientePossuiDominio: boolean;
  /** Cláusulas combinadas só com este cliente; entram antes do foro. */
  clausulasExtras?: ClausulaContrato[];
  desconto: Desconto;
  marca: { nome: string; tagline: string; accent: string; logo?: string };
  contratado: DadosDoContratado;
};

const CINZA = '#4a4a52';
const CINZA_CLARO = '#8a8a93';
const LINHA = '#e2e2e6';

function estilos(accent: string) {
  return StyleSheet.create({
    pagina: {
      backgroundColor: '#ffffff',
      paddingTop: 34,
      // Só o suficiente para o rodapé fixo (bottom 22 + ~15 de altura).
      paddingBottom: 44,
      paddingHorizontal: 44,
      fontSize: 10,
      color: '#1a1a1f',
      lineHeight: 1.5,
    },
    topo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 10,
      marginBottom: 16,
    },
    // Sem largura: só a altura, para a proporção original ser mantida.
    logo: { height: 40, objectFit: 'contain' },
    marcaNome: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1f' },
    marcaTagline: { fontSize: 8, color: CINZA_CLARO, marginTop: 2 },
    topoDireita: { alignItems: 'flex-end' },
    etiqueta: { fontSize: 8, color: CINZA_CLARO, textTransform: 'uppercase', letterSpacing: 1 },
    numero: { fontSize: 12, fontWeight: 'bold', color: accent, marginTop: 2 },

    tituloProposta: { fontSize: 16, fontWeight: 'bold', marginBottom: 3 },
    subtitulo: { fontSize: 9.5, color: CINZA, marginBottom: 14 },

    secao: { fontSize: 8.5, fontWeight: 'bold', color: accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
    bloco: { marginBottom: 12 },

    linhaDado: { flexDirection: 'row', marginBottom: 3 },
    rotuloDado: { width: 92, fontSize: 9, color: CINZA_CLARO },
    valorDado: { flex: 1, fontSize: 9.5 },

    thead: {
      flexDirection: 'row',
      backgroundColor: '#f6f6f8',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: LINHA,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    th: { fontSize: 8, fontWeight: 'bold', color: CINZA, textTransform: 'uppercase', letterSpacing: 0.6 },
    tr: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: LINHA,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    colServico: { flex: 1, paddingRight: 12 },
    colPrazo: { width: 58 },
    colValor: { width: 86, textAlign: 'right' },
    /** Largura fixa e SEM flex. Reaproveitar `textoItem` aqui fazia a coluna de
     *  prazo herdar `flex: 1` e disputar o espaço com a descrição meio a meio —
     *  daí a descrição espremida e o vão enorme ao lado de "7 dias". */
    celulaPrazo: { width: 58, fontSize: 9 },
    nomeServico: { fontSize: 10, fontWeight: 'bold' },
    descServico: { fontSize: 8, color: CINZA_CLARO, marginTop: 2, lineHeight: 1.3 },
    valorServico: { fontSize: 10, fontWeight: 'bold' },
    mensalTag: { fontSize: 8, color: accent, fontWeight: 'bold' },

    totais: { marginTop: 10, alignItems: 'flex-end' },
    linhaTotal: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
    rotuloTotal: { fontSize: 9.5, color: CINZA, textAlign: 'right', width: 190 },
    valorTotal: { fontSize: 10.5, fontWeight: 'bold', width: 100, textAlign: 'right' },
    destaqueTotal: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 6,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: LINHA,
    },
    rotuloDestaque: { fontSize: 10.5, fontWeight: 'bold', textAlign: 'right', width: 190 },
    valorDestaque: { fontSize: 14, fontWeight: 'bold', color: accent, width: 100, textAlign: 'right' },

    caixa: {
      borderWidth: 1,
      borderColor: LINHA,
      borderLeftWidth: 3,
      borderLeftColor: accent,
      backgroundColor: '#fafafb',
      padding: 9,
      marginTop: 3,
    },
    /** `lineHeight` menor que o da página: a caixa é uma lista curta de linhas
     *  independentes, não texto corrido, e o espaçamento de leitura contínua
     *  aqui só empurra o bloco para a página seguinte. */
    textoCaixa: { fontSize: 8.5, color: CINZA, marginBottom: 2, lineHeight: 1.3 },

    rodape: {
      position: 'absolute',
      // Ancorado pelo TOPO, na altura exata do A4 (841,89pt) menos a margem de
      // 22pt e a altura do rodapé. Com `bottom: 22` o react-pdf errava a conta:
      // o rodapé sumia das primeiras páginas e aparecia no alto das seguintes —
      // conferido no PDF gerado.
      top: 800,
      left: 44,
      right: 44,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: LINHA,
      paddingTop: 7,
    },
    rodapeTexto: { fontSize: 7.5, color: CINZA_CLARO },

    contratoTitulo: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, lineHeight: 1.35 },
    partes: { marginBottom: 16 },
    clausula: { marginBottom: 11 },
    clausulaTitulo: { fontSize: 9.5, fontWeight: 'bold', marginBottom: 4 },
    paragrafo: { fontSize: 9, textAlign: 'justify', marginBottom: 3 },
    item: { flexDirection: 'row', marginBottom: 2, paddingLeft: 8 },
    marcador: { width: 10, fontSize: 9, color: accent },
    textoItem: { flex: 1, fontSize: 9 },
    rotuloLista: { fontSize: 9, fontWeight: 'bold', marginTop: 5, marginBottom: 3 },

    assinaturas: { marginTop: 18 },
    blocoAssinatura: { marginBottom: 18 },
    testemunhas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    testemunha: { width: '47%' },
    papel: { fontSize: 9, fontWeight: 'bold', color: accent, marginBottom: 8 },
    campoAssinatura: { fontSize: 9, marginBottom: 9 },

    blocoAssinado: { marginBottom: 9 },
    /** Só a altura: a proporção original manda na largura, senão a assinatura
     *  sai esticada — e assinatura deformada é a primeira coisa que denuncia
     *  um documento montado. `marginBottom` negativo aproxima o traço da
     *  linha, como quem assina em cima dela. */
    assinaturaImagem: { height: 42, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: -6 },
    linhaAssinatura: { borderBottomWidth: 1, borderBottomColor: '#1a1a1f', width: 240 },
    rotuloAssinado: { fontSize: 8, color: CINZA_CLARO, marginTop: 3 },
  });
}

/** Uma linha "Rótulo: valor", omitida quando não há valor — campo vazio num
 *  documento que vai para o cliente parece descuido. */
function Dado({ rotulo, valor, s }: { rotulo: string; valor: string; s: ReturnType<typeof estilos> }) {
  if (!valor) return null;
  return (
    <View style={s.linhaDado}>
      <Text style={s.rotuloDado}>{rotulo}</Text>
      <Text style={s.valorDado}>{valor}</Text>
    </View>
  );
}

export function PropostaDocument(d: DadosDaProposta) {
  const s = estilos(d.marca.accent);
  const temPlano = d.totalMensal > 0 && (d.mesesPlano ?? 0) > 0;
  const meses = d.mesesPlano ?? 0;

  // O desconto incide só no trabalho; a mensalidade é preço recorrente e não
  // entra. Daqui para baixo, `trabalho` é o que o cliente realmente paga — e é
  // ele que alimenta as parcelas de 50% e o contrato, para os três números não
  // poderem se contradizer dentro do mesmo documento.
  const descontoBrl = valorDoDesconto(d.totalUnico, d.desconto);
  const trabalho = aplicarDesconto(d.totalUnico, d.desconto);
  const comDesconto = temDesconto(d.desconto) && descontoBrl > 0;

  const { primeira, segunda } = metadesDoPagamento(trabalho);
  const valorContrato = trabalho + d.totalMensal * meses;

  // Cada item leva as cláusulas do seu tipo de serviço: é o que impede um
  // orçamento de mentoria de sair com cláusula de domínio.
  const servicosDoContrato: ServicoDoContrato[] = d.itens.map((i) => ({
    nome: i.name,
    modulo: classificarServico({ categoria: i.categoria, nome: i.name }),
    cobranca: i.billingType,
  }));

  const contratante: DadosDoContratante = {
    nome: d.cliente.nome,
    documento: d.cliente.documento,
    endereco: d.cliente.endereco,
    email: d.cliente.email,
    telefone: d.cliente.telefone,
  };

  const clausulas = d.incluirContrato
    ? montarClausulas({
        numeroProposta: d.numero,
        contratante,
        servicos: servicosDoContrato,
        valorDesenvolvimento: trabalho,
        valorMensal: d.totalMensal,
        mesesPlano: d.mesesPlano,
        prazoDias: d.prazoDias,
        clientePossuiDominio: d.clientePossuiDominio,
        contratado: d.contratado,
        clausulasExtras: d.clausulasExtras,
      })
    : [];

  const partes = qualificacaoDasPartes({ contratante, contratado: d.contratado });

  // Cabeçalho e rodapé se repetem nas duas páginas e não têm estado nenhum.
  // São funções que devolvem elementos, chamadas com `{topo()}`, em vez de
  // componentes declarados aqui dentro: componente criado durante o render é
  // recriado a cada passagem, e o lint barra isso com razão.
  const topo = () => (
    <View style={s.topo}>
      {/* A logo já traz o nome da marca desenhado. Repetir "Prog Imports" ao
          lado dela era o mesmo texto duas vezes. O nome escrito só aparece
          quando não há arquivo de logo — aí ele é a única identificação. */}
      {d.marca.logo ? (
        <Image src={d.marca.logo} style={s.logo} />
      ) : (
        <View>
          <Text style={s.marcaNome}>{d.marca.nome}</Text>
          <Text style={s.marcaTagline}>{d.marca.tagline}</Text>
        </View>
      )}
      <View style={s.topoDireita}>
        <Text style={s.etiqueta}>Proposta</Text>
        <Text style={s.numero}>{d.numero}</Text>
        <Text style={{ ...s.rodapeTexto, marginTop: 2 }}>{formatDateBR(d.criadoEm)}</Text>
      </View>
    </View>
  );

  const rodape = () => (
    <View style={s.rodape} fixed>
      <Text style={s.rodapeTexto}>
        {d.marca.nome} · {d.contratado.nome}
        {d.contratado.documento ? ` · ${d.contratado.documento}` : ''}
      </Text>
      <Text style={s.rodapeTexto} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );

  return (
    <Document title={`Proposta ${d.numero} — ${d.titulo}`} author={d.marca.nome}>
      <Page size="A4" style={s.pagina}>
        {/* O rodapé `fixed` vem PRIMEIRO na página: no fim dela, o react-pdf
            só o repetia a partir da página onde ele caía no fluxo, e as
            anteriores saíam sem numeração. */}
        {rodape()}
        {topo()}

        <Text style={s.tituloProposta}>{d.titulo}</Text>
        <Text style={s.subtitulo}>
          Proposta comercial de prestação de serviços
          {d.prazoDias > 0 ? ` · prazo de execução: ${formatPrazo(d.prazoDias)}` : ''}
        </Text>

        <View style={s.bloco}>
          <Text style={s.secao}>Cliente</Text>
          <Dado rotulo="Nome" valor={d.cliente.nome} s={s} />
          <Dado rotulo="CPF/CNPJ" valor={d.cliente.documento} s={s} />
          <Dado rotulo="E-mail" valor={d.cliente.email} s={s} />
          <Dado rotulo="Telefone" valor={d.cliente.telefone} s={s} />
          <Dado rotulo="Cidade" valor={d.cliente.cidade} s={s} />
          {!d.cliente.nome && <Text style={s.valorDado}>—</Text>}
        </View>

        <View style={s.bloco}>
          <Text style={s.secao}>Serviços</Text>
          <View style={s.thead}>
            <Text style={{ ...s.th, ...s.colServico }}>Descrição</Text>
            <Text style={{ ...s.th, ...s.colPrazo }}>Prazo</Text>
            <Text style={{ ...s.th, ...s.colValor }}>Valor</Text>
          </View>

          {/* Sem `wrap={false}`: uma linha que não cabe no resto da página era
              empurrada inteira para a seguinte, deixando meia página em branco
              e criando uma segunda página que o conteúdo não pedia. Deixando
              quebrar, a descrição continua na página de baixo. */}
          {d.itens.map((item, i) => (
            <View key={i} style={s.tr}>
              <View style={s.colServico}>
                <Text style={s.nomeServico}>{item.name}</Text>
                {!!item.description && <Text style={s.descServico}>{item.description}</Text>}
              </View>
              <Text style={s.celulaPrazo}>
                {item.billingType === 'mensal' ? 'contínuo' : formatPrazo(item.leadTimeDays)}
              </Text>
              <View style={s.colValor}>
                <Text style={s.valorServico}>{formatBRL(item.amount)}</Text>
                {item.billingType === 'mensal' && <Text style={s.mensalTag}>por mês</Text>}
              </View>
            </View>
          ))}

          <View style={s.totais}>
            {d.totalUnico > 0 && (
              <View style={s.linhaTotal}>
                <Text style={s.rotuloTotal}>{comDesconto ? 'Subtotal dos serviços' : 'Investimento inicial'}</Text>
                <Text style={s.valorTotal}>{formatBRL(d.totalUnico)}</Text>
              </View>
            )}
            {comDesconto && (
              <>
                <View style={s.linhaTotal}>
                  <Text style={{ ...s.rotuloTotal, color: d.marca.accent }}>
                    Desconto ({rotuloDoDesconto(d.desconto)})
                    {d.desconto.descricao ? ` — ${d.desconto.descricao}` : ''}
                  </Text>
                  {/* Hífen comum, não o sinal de menos (U+2212): a Helvetica
                      embutida no PDF não tem esse glifo e o descartava, e o
                      desconto saía como se fosse acréscimo. */}
                  <Text style={{ ...s.valorTotal, color: d.marca.accent }}>-{formatBRL(descontoBrl)}</Text>
                </View>
                <View style={s.linhaTotal}>
                  <Text style={s.rotuloTotal}>Investimento inicial</Text>
                  <Text style={s.valorTotal}>{formatBRL(trabalho)}</Text>
                </View>
              </>
            )}
            {temPlano && (
              <>
                <View style={s.linhaTotal}>
                  <Text style={s.rotuloTotal}>Mensalidade</Text>
                  <Text style={s.valorTotal}>{formatBRL(d.totalMensal)}/mês</Text>
                </View>
                <View style={s.linhaTotal}>
                  <Text style={s.rotuloTotal}>Duração do plano</Text>
                  <Text style={s.valorTotal}>{meses} meses</Text>
                </View>
              </>
            )}
            <View style={s.destaqueTotal}>
              <Text style={s.rotuloDestaque}>{temPlano ? 'Valor total do contrato' : 'Valor total'}</Text>
              <Text style={s.valorDestaque}>{formatBRL(valorContrato)}</Text>
            </View>
          </View>
        </View>

        {/* `wrap={false}` aqui, e não nas linhas da tabela: este bloco é curto e
            precisa ficar inteiro. Sem isso o título ficava sozinho no pé de uma
            página e a caixa começava na seguinte. */}
        <View style={s.bloco} wrap={false}>
          <Text style={s.secao}>Condições de pagamento</Text>
          <View style={s.caixa}>
            {d.totalUnico > 0 && (
              <>
                <Text style={s.textoCaixa}>
                  • 50% na contratação — {formatBRL(primeira)}, como sinal para início dos trabalhos.
                </Text>
                <Text style={s.textoCaixa}>
                  • 50% na entrega — {formatBRL(segunda)}, na conclusão, antes da publicação.
                </Text>
              </>
            )}
            {temPlano && (
              <Text style={s.textoCaixa}>
                • Plano mensal de {formatBRL(d.totalMensal)}, cobrado na data acordada de cada mês, por {meses} meses.
              </Text>
            )}
            <Text style={{ ...s.textoCaixa, marginTop: 3, fontSize: 7.5, marginBottom: 0 }}>
              À vista ou parcelado; no parcelamento podem incidir juros ou taxas da operadora de pagamento.
            </Text>
          </View>
        </View>

        {!!d.observacoes && (
          <View style={s.bloco} wrap={false}>
            <Text style={s.secao}>Observações</Text>
            <Text style={s.paragrafo}>{d.observacoes}</Text>
          </View>
        )}

      </Page>

      {d.incluirContrato && (
        <Page size="A4" style={s.pagina}>
          {rodape()}
          {topo()}

          <Text style={s.contratoTitulo}>{tituloDoContrato(servicosDoContrato)}</Text>

          <View style={s.partes}>
            <Text style={s.paragrafo}>
              <Text style={{ fontWeight: 'bold' }}>CONTRATANTE: </Text>
              {partes.contratante}
            </Text>
            <Text style={s.paragrafo}>
              <Text style={{ fontWeight: 'bold' }}>CONTRATADO: </Text>
              {partes.contratado}
            </Text>
            <Text style={{ ...s.paragrafo, marginTop: 5 }}>
              As partes acima identificadas firmam o presente Contrato de Prestação de Serviços, que se regerá pelas
              cláusulas seguintes.
            </Text>
          </View>

          {/* A cláusula pode quebrar entre páginas: com o contrato modular algumas
              passam de meia página, e `wrap={false}` nelas deixava vãos enormes.
              Só o título e o primeiro parágrafo andam juntos, para o título
              nunca ficar sozinho no pé da página — `minPresenceAhead` no título
              não bastou, conferido no PDF gerado. */}
          {clausulas.map((c) => (
            <View key={c.numero} style={s.clausula}>
              <View wrap={false}>
                <Text style={s.clausulaTitulo}>
                  CLÁUSULA {c.numero} – {c.titulo}
                </Text>
                {!!c.paragrafos?.length && <Text style={s.paragrafo}>{c.paragrafos[0]}</Text>}
              </View>
              {c.paragrafos?.slice(1).map((p, i) => (
                <Text key={i} style={s.paragrafo}>{p}</Text>
              ))}
              {c.itens?.map((it, i) => (
                <View key={i} style={s.item}>
                  <Text style={s.marcador}>•</Text>
                  <Text style={s.textoItem}>{it}</Text>
                </View>
              ))}
              {!!c.rotuloSegundaLista && <Text style={s.rotuloLista}>{c.rotuloSegundaLista}</Text>}
              {c.segundaLista?.map((it, i) => (
                <View key={i} style={s.item}>
                  <Text style={s.marcador}>•</Text>
                  <Text style={s.textoItem}>{it}</Text>
                </View>
              ))}
              {c.fecho?.map((p, i) => (
                <Text key={i} style={{ ...s.paragrafo, marginTop: i === 0 ? 4 : 0 }}>
                  {p}
                </Text>
              ))}
            </View>
          ))}

          <View style={s.assinaturas} wrap={false}>
            <Text style={s.paragrafo}>
              E, por estarem de acordo, as partes assinam este contrato juntamente com 2 (duas) testemunhas.
            </Text>
            <Text style={{ ...s.campoAssinatura, marginTop: 6, marginBottom: 16 }}>
              Local e data: ______________________________, ______ / ______ / __________
            </Text>

            <View style={s.blocoAssinatura}>
              <Text style={s.papel}>CONTRATANTE</Text>
              <Text style={s.campoAssinatura}>
                Nome: {d.cliente.nome || '_________________________________________________'}
              </Text>
              <Text style={s.campoAssinatura}>
                CPF/CNPJ: {d.cliente.documento || '________________________________'}
              </Text>
              <Text style={s.campoAssinatura}>Assinatura: _________________________________________________</Text>
            </View>

            <View style={s.blocoAssinatura}>
              <Text style={s.papel}>CONTRATADO</Text>
              <Text style={s.campoAssinatura}>Nome: {d.contratado.nome}</Text>
              {!!d.contratado.documento && (
                <Text style={s.campoAssinatura}>CPF/CNPJ: {d.contratado.documento}</Text>
              )}
              {/* Com assinatura cadastrada ela entra impressa, sobre a linha —
                  é o lado que já está assinado quando o contrato chega ao
                  cliente. Sem ela, a linha em branco continua ali para assinar
                  à mão, que era o comportamento anterior. */}
              {d.contratado.assinatura ? (
                <View style={s.blocoAssinado}>
                  <Image src={d.contratado.assinatura} style={s.assinaturaImagem} />
                  <View style={s.linhaAssinatura} />
                  <Text style={s.rotuloAssinado}>Assinatura</Text>
                </View>
              ) : (
                <Text style={s.campoAssinatura}>
                  Assinatura: _________________________________________________
                </Text>
              )}
            </View>

            {/* Duas testemunhas fazem do contrato assinado à mão um título
                executivo extrajudicial (CPC, art. 784, III): a cobrança vai
                direto para a execução, sem precisar provar a dívida antes. */}
            <View style={s.testemunhas}>
              {[1, 2].map((n) => (
                <View key={n} style={s.testemunha}>
                  <Text style={s.papel}>TESTEMUNHA {n}</Text>
                  <Text style={s.campoAssinatura}>Nome: ______________________________</Text>
                  <Text style={s.campoAssinatura}>CPF: _______________________________</Text>
                  <Text style={s.campoAssinatura}>Assinatura: ________________________</Text>
                </View>
              ))}
            </View>
          </View>

        </Page>
      )}
    </Document>
  );
}
