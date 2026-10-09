import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { CotacaoData } from '../types'

const TEAL = '#079C9C'
const GRAY_DARK = '#4B5563'
const GRAY_TEXT = '#6B7280'
const GRAY_LINE = '#E5E7EB'
const ZEBRA = '#F3FAFA'

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#111827',
  },
  logoRow: { flexDirection: 'row', alignItems: 'flex-end' },
  logoGrow: { fontFamily: 'Helvetica-Bold', fontSize: 52, color: TEAL, letterSpacing: 2 },
  logoLim: { fontFamily: 'Helvetica-Bold', fontSize: 52, color: GRAY_DARK, letterSpacing: 2 },
  bar: { height: 4, backgroundColor: TEAL, marginTop: 6, marginBottom: 24, borderRadius: 2 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 20, color: GRAY_DARK },
  date: { fontSize: 10, color: GRAY_TEXT },

  fornecedorBox: {
    backgroundColor: ZEBRA,
    borderLeftWidth: 4,
    borderLeftColor: TEAL,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  fornecedorLabel: { fontSize: 9, color: GRAY_TEXT, marginBottom: 2 },
  fornecedorNome: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: '#111827' },

  thead: {
    flexDirection: 'row',
    backgroundColor: TEAL,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#FFFFFF', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_LINE,
  },
  rowAlt: { backgroundColor: ZEBRA },
  colNum: { width: 28, color: GRAY_TEXT, fontSize: 10 },
  colName: { flex: 1, paddingRight: 10 },
  colQty: { width: 90, textAlign: 'right', fontFamily: 'Helvetica-Bold' },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: GRAY_LINE,
    paddingTop: 8,
    fontSize: 9,
    color: GRAY_TEXT,
  },
})

export default function CotacaoPdf({ data }: { data: CotacaoData }) {
  const hoje = new Date().toLocaleDateString('pt-BR')

  return (
    <Document title={`Cotação - ${data.fornecedor}`} author="GROWLIM">
      <Page size="A4" style={styles.page}>
        <View style={styles.logoRow}>
          <Text style={styles.logoGrow}>GROW</Text>
          <Text style={styles.logoLim}>LIM</Text>
        </View>
        <View style={styles.bar} />

        <View style={styles.titleRow}>
          <Text style={styles.title}>Solicitação de Cotação</Text>
          <Text style={styles.date}>{hoje}</Text>
        </View>

        <View style={styles.fornecedorBox}>
          <Text style={styles.fornecedorLabel}>FORNECEDOR</Text>
          <Text style={styles.fornecedorNome}>{data.fornecedor}</Text>
        </View>

        <View style={styles.thead} fixed>
          <Text style={[styles.th, styles.colNum]}>#</Text>
          <Text style={[styles.th, styles.colName]}>PRODUTO</Text>
          <Text style={[styles.th, styles.colQty]}>QUANTIDADE</Text>
        </View>

        {data.itens.map((item, i) => (
          <View
            key={i}
            style={i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}
            wrap={false}
          >
            <Text style={styles.colNum}>{i + 1}</Text>
            <Text style={styles.colName}>{item.name}</Text>
            <Text style={styles.colQty}>
              {item.quantity}
              {item.unit ? ` ${item.unit}` : ''}
            </Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>GROWLIM</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}