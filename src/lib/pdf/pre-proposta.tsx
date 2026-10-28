// Pré-proposta (V6, pedido do dono em 28/10/2026): o vendedor baixa do
// simulador um PDF com o pacote, o que inclui, valores, prazo e pagamento, para
// o cliente que quer "algo por escrito". Não é contrato: a proposta oficial com
// contrato segue com o Arthur. Fundo branco (vai para impressão e WhatsApp).
// Fonte padrão do react-pdf (Helvetica): sem emoji, só texto.

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export type DadosDaPreProposta = {
  cliente: string | null;
  vendedor: string;
  emitidaEm: Date;
  validadeDias: number;
  itens: { nome: string; valor: string; inclui: string[] }[];
  desconto: string | null;
  total: string;
  aPartirDe: boolean;
  mensal: string;
  economiaMensal: string | null;
  prazoDias: number;
  pagamento: string[];
};

const ACENTO = '#c8913a';
const CINZA = '#4a4a52';
const CLARO = '#8a8a93';
const LINHA = '#e2e2e6';

const s = StyleSheet.create({
  pagina: { padding: 44, fontSize: 10, color: '#1a1a1f', lineHeight: 1.5, backgroundColor: '#ffffff' },
  topo: { borderBottomWidth: 2, borderBottomColor: ACENTO, paddingBottom: 10, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  marca: { fontSize: 18, fontFamily: 'Helvetica-Bold', lineHeight: 1.2, marginBottom: 3 },
  sub: { fontSize: 9, color: CLARO },
  titulo: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  item: { borderBottomWidth: 1, borderBottomColor: LINHA, paddingVertical: 8 },
  linhaItem: { flexDirection: 'row', justifyContent: 'space-between' },
  nome: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  inclui: { color: CINZA, fontSize: 9, marginTop: 2 },
  total: { marginTop: 12, padding: 12, backgroundColor: '#f7f3ec', borderRadius: 6 },
  totalLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  grande: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  secao: { marginTop: 14, fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 4 },
  texto: { color: CINZA },
  rodape: { position: 'absolute', bottom: 24, left: 44, right: 44, fontSize: 8, color: CLARO, textAlign: 'center' },
});

const data = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function PrePropostaDocument(d: DadosDaPreProposta) {
  const validade = new Date(d.emitidaEm.getTime() + d.validadeDias * 24 * 3600_000);
  return (
    <Document title={`Pré-proposta Prog Soluções${d.cliente ? ` - ${d.cliente}` : ''}`} author="Prog Soluções">
      <Page size="A4" style={s.pagina}>
        <View style={s.topo}>
          <View>
            <Text style={s.marca}>Prog Soluções</Text>
            <Text style={s.sub}>Sites, lojas virtuais e sistemas para pequenas empresas · Goiânia</Text>
          </View>
          <Text style={s.sub}>Emitida em {data(d.emitidaEm)}</Text>
        </View>

        <Text style={s.titulo}>Pré-proposta{d.cliente ? ` para ${d.cliente}` : ''}</Text>
        <Text style={s.texto}>
          Resumo do pacote conversado com {d.vendedor}. Válida até {data(validade)}. A proposta oficial, com contrato, é enviada
          pelo Arthur no fechamento.
        </Text>

        <Text style={s.secao}>O que entra no pacote</Text>
        {d.itens.map((i) => (
          <View key={i.nome} style={s.item} wrap={false}>
            <View style={s.linhaItem}>
              <Text style={s.nome}>{i.nome}</Text>
              <Text>{i.valor}</Text>
            </View>
            {i.inclui.map((x) => (
              <Text key={x} style={s.inclui}>
                • {x}
              </Text>
            ))}
          </View>
        ))}

        <View style={s.total} wrap={false}>
          {d.desconto && (
            <View style={s.totalLinha}>
              <Text>Desconto do combo</Text>
              <Text>- {d.desconto}</Text>
            </View>
          )}
          <View style={s.totalLinha}>
            <Text style={s.grande}>Total{d.aPartirDe ? ' (a partir de)' : ''}</Text>
            <Text style={s.grande}>{d.total}</Text>
          </View>
          <View style={s.totalLinha}>
            <Text>Mensalidade (hospedagem, segurança, backups e suporte)</Text>
            <Text>{d.mensal}/mês</Text>
          </View>
          {d.economiaMensal && <Text style={s.inclui}>{d.economiaMensal}</Text>}
        </View>

        {d.prazoDias > 0 && (
          <>
            <Text style={s.secao}>Prazo</Text>
            <Text style={s.texto}>
              Até {d.prazoDias} dias úteis, contados a partir do sinal pago e do envio do material (textos, fotos e acessos).
            </Text>
          </>
        )}

        <Text style={s.secao}>Pagamento</Text>
        {d.pagamento.map((p) => (
          <Text key={p} style={s.texto}>
            • {p}
          </Text>
        ))}

        <Text style={s.rodape} fixed>
          Prog Soluções · Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO · Valores sujeitos à
          proposta oficial
        </Text>
      </Page>
    </Document>
  );
}
