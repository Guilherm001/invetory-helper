import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import { dataCurta, numeroTexto, reais } from '@/features/loja/lib/formatar'
import { numeroPedido } from '../lib/compras'

type Cor = [number, number, number]
const TEAL: Cor = [7, 156, 156]
const CINZA_ESCURO: Cor = [30, 41, 59]
const CINZA: Cor = [100, 116, 139]
const CINZA_CLARO: Cor = [241, 245, 249]
const LINHA: Cor = [226, 232, 240]

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fornecedor'

export async function montarPdfCompra(
  pedido: PedidoCompra,
  itens: ItemPedidoCompra[],
  empresa: string
) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 15

  const xQtd = M + 2
  const xItem = M + 30
  const xPreco = W - M - 36
  const xSub = W - M - 2
  const larguraItem = xPreco - 28 - xItem

  // ---------- cabeçalho ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...TEAL)
  const linhasEmpresa = (doc.splitTextToSize(empresa || 'Pedido de compra', W / 2 - M) as string[]).slice(0, 2)
  doc.text(linhasEmpresa, M, 15)

  doc.setTextColor(...CINZA_ESCURO)
  doc.setFontSize(14)
  doc.text('Pedido de compra', W - M, 12, { align: 'right' })
  doc.setFontSize(11)
  doc.text(`Nº ${numeroPedido(pedido.numero)}`, W - M, 18.5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA)
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - M, 24.5, { align: 'right' })

  doc.setFillColor(...TEAL)
  doc.rect(0, 28, W, 1.5, 'F')

  // ---------- fornecedor ----------
  let y = 41
  doc.setTextColor(...CINZA)
  doc.setFontSize(9)
  doc.text('FORNECEDOR', M, y)

  y += 6
  doc.setTextColor(...CINZA_ESCURO)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  const nomeLinhas = doc.splitTextToSize(pedido.fornecedor_nome, W - M * 2) as string[]
  doc.text(nomeLinhas, M, y)
  y += (nomeLinhas.length - 1) * 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...CINZA)

  const detalhes: string[] = []
  if (pedido.fornecedor_contato) detalhes.push(`Contato: ${pedido.fornecedor_contato}`)
  if (pedido.previsao_entrega) detalhes.push(`Entrega prevista: ${dataCurta(pedido.previsao_entrega)}`)
  if (pedido.prazo_dias != null)
    detalhes.push(`Prazo: ${pedido.prazo_dias} ${pedido.prazo_dias === 1 ? 'dia' : 'dias'}`)
  if (pedido.condicao_pagamento) detalhes.push(`Pagamento: ${pedido.condicao_pagamento}`)
  if (pedido.comparacao_nome) detalhes.push(`Referência: ${pedido.comparacao_nome}`)

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

  for (const it of itens) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const nomeL = doc.splitTextToSize(it.produto_nome, larguraItem) as string[]

    doc.setFontSize(8.5)
    const obsL = it.observacao?.trim()
      ? (doc.splitTextToSize(`obs: ${it.observacao.trim()}`, larguraItem) as string[])
      : []

    const altura = Math.max(9, nomeL.length * 4.8 + obsL.length * 4.2 + 4.5)

    if (y + altura > H - 30) {
      doc.addPage()
      y = cabecalhoTabela(M)
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TEAL)
    doc.text(`${numeroTexto(it.quantidade)}${it.unidade ? ` ${it.unidade}` : ''}`, xQtd, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(nomeL, xItem, y + 6)

    if (obsL.length > 0) {
      doc.setFontSize(8.5)
      doc.setTextColor(...CINZA)
      doc.text(obsL, xItem, y + 6 + nomeL.length * 4.8)
      doc.setFontSize(10)
    }

    doc.setTextColor(...CINZA)
    doc.text(reais(it.preco_unitario), xPreco, y + 6, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(reais(it.subtotal), xSub, y + 6, { align: 'right' })

    y += altura
    doc.setDrawColor(...LINHA)
    doc.line(M, y, W - M, y)
  }

  // ---------- totais ----------
  const soma = itens.reduce((s, i) => s + i.subtotal, 0)
  const linhasTotais: [string, string][] = [['Subtotal', reais(soma)]]
  if (pedido.frete > 0) linhasTotais.push(['Frete', reais(pedido.frete)])
  if (pedido.desconto > 0) linhasTotais.push(['Desconto', `- ${reais(pedido.desconto)}`])

  if (y + linhasTotais.length * 6 + 24 > H - 20) {
    doc.addPage()
    y = M
  }

  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const [rotulo, valor] of linhasTotais) {
    y += 6
    doc.setTextColor(...CINZA)
    doc.text(rotulo, W - M - 78, y)
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(valor, W - M - 2, y, { align: 'right' })
  }

  y += 4
  doc.setFillColor(...TEAL)
  doc.roundedRect(W - M - 80, y, 80, 12, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Total', W - M - 76, y + 7.8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(reais(pedido.total), W - M - 4, y + 8, { align: 'right' })
  y += 12

  // ---------- observações ----------
  if (pedido.observacao?.trim()) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const linhas = doc.splitTextToSize(pedido.observacao.trim(), W - M * 2) as string[]

    if (y + 14 + linhas.length * 5 > H - 20) {
      doc.addPage()
      y = M - 6
    }

    y += 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...CINZA)
    doc.text('OBSERVAÇÕES', M, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(linhas, M, y + 5.5)
  }

  // ---------- rodapé ----------
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...CINZA)
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 10, { align: 'right' })
  }

  return {
    blob: doc.output('blob') as Blob,
    nome: `pedido-compra-${String(pedido.numero).padStart(4, '0')}-${slug(pedido.fornecedor_nome)}.pdf`,
  }
}

// carrega a biblioteca antes do clique: o celular só deixa compartilhar logo após o toque
export function precarregarPdfCompra() {
  void import('jspdf')
}

function ehCelular() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// celular: compartilhar | computador: baixar
export async function gerarPdfCompra(
  pedido: PedidoCompra,
  itens: ItemPedidoCompra[],
  empresa: string
) {
  const { blob, nome } = await montarPdfCompra(pedido, itens, empresa)
  const arquivo = new File([blob], nome, { type: 'application/pdf' })

  if (
    ehCelular() &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [arquivo] })
  ) {
    try {
      await navigator.share({
        files: [arquivo],
        title: `Pedido de compra ${numeroPedido(pedido.numero)}`,
      })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }

  baixar(blob, nome)
}