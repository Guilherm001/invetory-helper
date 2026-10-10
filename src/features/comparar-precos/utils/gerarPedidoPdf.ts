import { formatarReais, type PedidoSugerido } from './melhorPreco'

const TEAL: [number, number, number] = [7, 156, 156]
const CINZA_ESCURO: [number, number, number] = [30, 41, 59]
const CINZA: [number, number, number] = [100, 116, 139]
const CINZA_CLARO: [number, number, number] = [241, 245, 249]
const LINHA: [number, number, number] = [226, 232, 240]

const numero = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','))

// "Depósito Central" -> "deposito-central"
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fornecedor'

export async function gerarPedidoPdf(pedido: PedidoSugerido, nomeComparacao?: string) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 15

  // colunas da tabela
  const xQtd = M + 2
  const xItem = M + 30
  const xPreco = W - M - 36 // alinhado à direita
  const xSub = W - M - 2 // alinhado à direita
  const larguraItem = xPreco - 28 - xItem

  // ---------- cabeçalho ----------
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Pedido de compra', M, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, M, 22)

  // ---------- dados do fornecedor ----------
  let y = 42
  doc.setTextColor(...CINZA)
  doc.setFontSize(9)
  doc.text('FORNECEDOR', M, y)

  y += 6
  doc.setTextColor(...CINZA_ESCURO)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(doc.splitTextToSize(pedido.fornecedor.name, W - M * 2), M, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...CINZA)

  const detalhes: string[] = []
  if (pedido.fornecedor.contact) detalhes.push(`Contato: ${pedido.fornecedor.contact}`)
  if (pedido.fornecedor.lead_time_days != null) {
    const d = pedido.fornecedor.lead_time_days
    detalhes.push(`Prazo: ${d} ${d === 1 ? 'dia' : 'dias'}`)
  }
  if (nomeComparacao) detalhes.push(`Referência: ${nomeComparacao}`)

  for (const linha of detalhes) {
    y += 5.5
    doc.text(doc.splitTextToSize(linha, W - M * 2), M, y)
  }

  // ---------- tabela ----------
  const cabecalhoTabela = (topo: number) => {
    doc.setFillColor(...CINZA_CLARO)
    doc.rect(M, topo, W - M * 2, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...CINZA)
    doc.text('QTD', xQtd, topo + 5.4)
    doc.text('ITEM', xItem, topo + 5.4)
    doc.text('PREÇO UN.', xPreco, topo + 5.4, { align: 'right' })
    doc.text('SUBTOTAL', xSub, topo + 5.4, { align: 'right' })
    return topo + 8
  }

  y += 10
  y = cabecalhoTabela(y)

  doc.setFontSize(10)

  for (const { item, preco, subtotal } of pedido.itens) {
    const linhasNome = doc.splitTextToSize(item.name, larguraItem) as string[]
    const alturaLinha = Math.max(9, linhasNome.length * 4.8 + 4.5)

    // não cabe: nova página, repete o cabeçalho da tabela
    if (y + alturaLinha > H - 30) {
      doc.addPage()
      y = cabecalhoTabela(M)
    }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TEAL)
    doc.text(`${numero(item.quantity)}${item.unit ? ` ${item.unit}` : ''}`, xQtd, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(linhasNome, xItem, y + 6)

    doc.setTextColor(...CINZA)
    doc.text(formatarReais(preco), xPreco, y + 6, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(formatarReais(subtotal), xSub, y + 6, { align: 'right' })

    y += alturaLinha
    doc.setDrawColor(...LINHA)
    doc.line(M, y, W - M, y)
  }

  // ---------- total ----------
  if (y + 18 > H - 20) {
    doc.addPage()
    y = M
  }

  y += 8
  doc.setFillColor(...TEAL)
  doc.roundedRect(W - M - 80, y, 80, 12, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Total', W - M - 76, y + 7.8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(formatarReais(pedido.subtotal), W - M - 4, y + 8, { align: 'right' })

  // ---------- rodapé com número de página ----------
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...CINZA)
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 10, { align: 'right' })
  }

  doc.save(`pedido-${slug(pedido.fornecedor.name)}.pdf`)
}