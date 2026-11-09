import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { CotacaoData } from '../types'
import RomarLogo from './RomarLogo'

const VERDE = '#1E9E48'
const VERMELHO = '#E4312F'
const TEAL = '#079C9C'
const CINZA_MARCA = '#6B7280'
const CINZA_ESCURO = '#1E293B'
const CINZA = '#64748B'
const LINHA = '#E2E8F0'
const LINHA_PREENCHER = '#94A3B8'

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 64,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: CINZA_ESCURO,
  },

  // ---------- cabeçalho ----------
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerDireita: { alignItems: 'flex-end' },
  headerRotulo: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: CINZA },
  headerDestaque: { fontFamily: 'Helvetica-Bold', fontSize: 24, color: VERDE, marginTop: 2 },
  headerPequeno: { fontSize: 9, color: CINZA, marginTop: 2 },
  barras: { flexDirection: 'row', marginTop: 10, marginBottom: 26 },
  barraVermelha: { width: 90, height: 4.5, backgroundColor: VERMELHO, marginRight: 6 },
  barraVerde: { flex: 1, height: 4.5, backgroundColor: VERDE },

  // ---------- fornecedor ----------
  topo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  topoEsq: { flex: 1, paddingRight: 20 },
  topoDir: { width: 140 },
  rotuloPequeno: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: CINZA, marginBottom: 4 },
  fornecedorNome: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  infoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  infoRotulo: { fontSize: 9.5, color: CINZA },
  infoValor: { fontFamily: 'Helvetica-Bold', fontSize: 9.5 },

  // ---------- tabela ----------
  thead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: VERDE,
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: CINZA },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 9,
    borderBottomWidth: 0.7,
    borderBottomColor: LINHA,
  },
  colQtd: { width: 80, fontFamily: 'Helvetica-Bold' },
  colItem: { flex: 1, paddingRight: 12 },
  colPreco: { width: 95, alignItems: 'flex-end' },
  campoPreco: { width: 85, height: 13, borderBottomWidth: 0.7, borderBottomColor: LINHA_PREENCHER },

  // ---------- resposta do fornecedor ----------
  resposta: { marginTop: 30 },
  respostaTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: CINZA, marginBottom: 14 },
  respostaLinha: { flexDirection: 'row', marginBottom: 18 },
  campo: { flex: 1 },
  campoGap: { width: 20 },
  campoRotulo: { fontSize: 9, color: CINZA },
  campoLinha: { height: 16, borderBottomWidth: 0.7, borderBottomColor: LINHA_PREENCHER },
  campoLinhaObs: { height: 20, borderBottomWidth: 0.7, borderBottomColor: LINHA_PREENCHER },

  // ---------- rodapé ----------
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 0.7,
    borderTopColor: LINHA,
    paddingTop: 8,
  },
  marcaRow: { flexDirection: 'row' },
  marcaGrow: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: TEAL },
  marcaLim: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: CINZA_MARCA },
  pagina: { fontSize: 8.5, color: CINZA },
})

export default function CotacaoPdf({ data }: { data: CotacaoData }) {
  const hoje = new Date().toLocaleDateString('pt-BR')

  return (
    <Document title={`Cotação - ${data.fornecedor}`} author="GROWLIM">
      <Page size="A4" style={styles.page}>
        {/* cabeçalho */}
        <View style={styles.header}>
          <RomarLogo height={62} />
          <View style={styles.headerDireita}>
            <Text style={styles.headerRotulo}>SOLICITAÇÃO DE COTAÇÃO</Text>
            <Text style={styles.headerDestaque}>{hoje}</Text>
            <Text style={styles.headerPequeno}>Data de emissão</Text>
          </View>
        </View>

        <View style={styles.barras}>
          <View style={styles.barraVermelha} />
          <View style={styles.barraVerde} />
        </View>

        {/* fornecedor + resumo */}
        <View style={styles.topo}>
          <View style={styles.topoEsq}>
            <Text style={styles.rotuloPequeno}>FORNECEDOR</Text>
            <Text style={styles.fornecedorNome}>{data.fornecedor}</Text>
          </View>
          <View style={styles.topoDir}>
            <Text style={styles.rotuloPequeno}>RESUMO</Text>
            <View style={styles.infoLinha}>
              <Text style={styles.infoRotulo}>Itens solicitados</Text>
              <Text style={styles.infoValor}>{data.itens.length}</Text>
            </View>
          </View>
        </View>

        {/* tabela */}
        <View style={styles.thead} fixed>
          <Text style={[styles.th, { width: 80 }]}>QTD</Text>
          <Text style={[styles.th, { flex: 1 }]}>ITEM</Text>
          <Text style={[styles.th, { width: 95, textAlign: 'right' }]}>PREÇO UN.</Text>
        </View>

        {data.itens.map((item, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.colQtd}>
              {item.quantity}
              {item.unit ? ` ${item.unit}` : ''}
            </Text>
            <Text style={styles.colItem}>{item.name}</Text>
            <View style={styles.colPreco}>
              <View style={styles.campoPreco} />
            </View>
          </View>
        ))}

        {/* resposta do fornecedor */}
        <View style={styles.resposta} wrap={false}>
          <Text style={styles.respostaTitulo}>RESPOSTA DO FORNECEDOR</Text>

          <View style={styles.respostaLinha}>
            <View style={styles.campo}>
              <Text style={styles.campoRotulo}>Prazo de entrega</Text>
              <View style={styles.campoLinha} />
            </View>
            <View style={styles.campoGap} />
            <View style={styles.campo}>
              <Text style={styles.campoRotulo}>Condição de pagamento</Text>
              <View style={styles.campoLinha} />
            </View>
          </View>

          <View>
            <Text style={styles.campoRotulo}>Observações</Text>
            <View style={styles.campoLinhaObs} />
            <View style={styles.campoLinhaObs} />
          </View>
        </View>

        {/* rodapé */}
        <View style={styles.footer} fixed>
          <View style={styles.marcaRow}>
            <Text style={styles.marcaGrow}>GROW</Text>
            <Text style={styles.marcaLim}>LIM</Text>
          </View>
          <Text
            style={styles.pagina}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}