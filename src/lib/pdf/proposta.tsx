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
import { montarClausulas, metadesDoPagamento, TITULO_CONTRATO, type DadosDoContratado } from '@/lib/contract';

export type DadosDaProposta = {
  numero: string;
  criadoEm: string;
  titulo: string;
  observacoes: string;
  cliente: { nome: string; documento: string; email: string; telefone: string; cidade: string };
  itens: ServiceOrderItem[];
  totalUnico: number;
  totalMensal: number;
  mesesPlano: number | null;
  prazoDias: number;
  incluirContrato: boolean;
  clientePossuiDominio: boolean;
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
      paddingBottom: 50,
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
    logo: { height: 34, objectFit: 'contain' },
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
    textoCaixa: { fontSize: 8.5, color: CINZA, marginBottom: 2 },

    rodape: {
      position: 'absolute',
      bottom: 26,
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

    assinaturas: { marginTop: 26 },
    blocoAssinatura: { marginBottom: 22 },
    papel: { fontSize: 9, fontWeight: 'bold', color: accent, marginBottom: 8 },
    campoAssinatura: { fontSize: 9, marginBottom: 9 },
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
  const { primeira, segunda } = metadesDoPagamento(d.totalUnico);
  const temPlano = d.totalMensal > 0 && (d.mesesPlano ?? 0) > 0;
  const meses = d.mesesPlano ?? 0;
  const valorContrato = d.totalUnico + d.totalMensal * meses;

  const clausulas = d.incluirContrato
    ? montarClausulas({
        contratante: d.cliente.nome,
        documentoContratante: d.cliente.documento,
        valorDesenvolvimento: d.totalUnico,
        valorMensal: d.totalMensal,
        mesesPlano: d.mesesPlano,
        prazoDias: d.prazoDias,
        clientePossuiDominio: d.clientePossuiDominio,
        contratado: d.contratado,
      })
    : [];

  // Cabeçalho e rodapé se repetem nas duas páginas e não têm estado nenhum.
  // São funções que devolvem elementos, chamadas com `{topo()}`, em vez de
  // componentes declarados aqui dentro: componente criado durante o render é
  // recriado a cada passagem, e o lint barra isso com razão.
  const topo = () => (
    <View style={s.topo}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {d.marca.logo && <Image src={d.marca.logo} style={s.logo} />}
        <View style={{ marginLeft: d.marca.logo ? 10 : 0 }}>
          <Text style={s.marcaNome}>{d.marca.nome}</Text>
          <Text style={s.marcaTagline}>{d.marca.tagline}</Text>
        </View>
      </View>
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
                <Text style={s.rotuloTotal}>Investimento inicial</Text>
                <Text style={s.valorTotal}>{formatBRL(d.totalUnico)}</Text>
              </View>
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
            <Text style={{ ...s.textoCaixa, marginTop: 3, fontSize: 8 }}>
              O pagamento pode ser à vista ou parcelado; no parcelamento podem incidir juros ou taxas da instituição
              financeira ou da plataforma de pagamento utilizada.
            </Text>
          </View>
        </View>

        {!!d.observacoes && (
          <View style={s.bloco} wrap={false}>
            <Text style={s.secao}>Observações</Text>
            <Text style={s.paragrafo}>{d.observacoes}</Text>
          </View>
        )}

        {rodape()}
      </Page>

      {d.incluirContrato && (
        <Page size="A4" style={s.pagina}>
          {topo()}

          <Text style={s.contratoTitulo}>{TITULO_CONTRATO}</Text>

          <View style={s.partes}>
            <Text style={s.paragrafo}>
              CONTRATANTE: {d.cliente.nome || '_________________________________________________'}
              {d.cliente.documento ? ` — CPF/CNPJ: ${d.cliente.documento}` : ''}
            </Text>
            <Text style={s.paragrafo}>
              CONTRATADO: {d.contratado.nome}
              {d.contratado.cargo ? `, ${d.contratado.cargo}` : ''}
              {d.contratado.documento ? ` — CPF/CNPJ: ${d.contratado.documento}` : ''}
            </Text>
            <Text style={{ ...s.paragrafo, marginTop: 5 }}>
              As partes acima identificadas firmam o presente Contrato de Prestação de Serviços, mediante as
              cláusulas abaixo.
            </Text>
          </View>

          {clausulas.map((c) => (
            <View key={c.numero} style={s.clausula} wrap={false}>
              <Text style={s.clausulaTitulo}>
                CLÁUSULA {c.numero} – {c.titulo}
              </Text>
              {c.paragrafos?.map((p, i) => (
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
              {!!c.fecho && <Text style={{ ...s.paragrafo, marginTop: 4 }}>{c.fecho}</Text>}
            </View>
          ))}

          <View style={s.assinaturas} wrap={false}>
            <View style={s.blocoAssinatura}>
              <Text style={s.papel}>CONTRATANTE</Text>
              <Text style={s.campoAssinatura}>
                Nome: {d.cliente.nome || '_________________________________________________'}
              </Text>
              <Text style={s.campoAssinatura}>
                CPF/CNPJ: {d.cliente.documento || '________________________________'}
              </Text>
              <Text style={s.campoAssinatura}>Assinatura: _________________________________________________</Text>
              <Text style={s.campoAssinatura}>Data: ______ / ______ / __________</Text>
            </View>

            <View style={s.blocoAssinatura}>
              <Text style={s.papel}>CONTRATADO</Text>
              <Text style={s.campoAssinatura}>Nome: {d.contratado.nome}</Text>
              {!!d.contratado.documento && (
                <Text style={s.campoAssinatura}>CPF/CNPJ: {d.contratado.documento}</Text>
              )}
              <Text style={s.campoAssinatura}>Assinatura: _________________________________________________</Text>
              <Text style={s.campoAssinatura}>Data: ______ / ______ / __________</Text>
            </View>
          </View>

          {rodape()}
        </Page>
      )}
    </Document>
  );
}
