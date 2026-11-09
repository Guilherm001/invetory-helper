import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import { dataCurta, numeroTexto, reais } from '@/features/loja/lib/formatar'
import { numeroPedido } from '../lib/compras'

type Cor = [number, number, number]
const VERDE: Cor = [30, 158, 72]
const VERMELHO: Cor = [228, 49, 47]
const TEAL: Cor = [7, 156, 156]
const CINZA_MARCA: Cor = [107, 114, 128]
const CINZA_ESCURO: Cor = [30, 41, 59]
const CINZA: Cor = [100, 116, 139]
const LINHA: Cor = [226, 232, 240]

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fornecedor'

// mesma logo do RomarLogo.tsx (viewBox 275 x 171), desenhada direto no jsPDF
function desenharLogoRomar(doc: any, x: number, y: number, altura: number) {
  const s = altura / 171

  const poligono = (pts: [number, number][], cor: Cor) => {
    const [x0, y0] = pts[0]
    const segmentos = pts
      .slice(1)
      .map((p, i) => [(p[0] - pts[i][0]) * s, (p[1] - pts[i][1]) * s])
    doc.setFillColor(...cor)
    doc.lines(segmentos, x + x0 * s, y + y0 * s, [1, 1], 'F', true)
  }

  poligono([[68, 8], [112, 86], [26, 86]], VERMELHO)
  poligono([[80, 8], [232, 8], [264, 86], [120, 86]], VERDE)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(60 * s * (72 / 25.4))
  doc.setTextColor(...VERDE)
  doc.text('ROMAR', x + 145 * s, y + 138 * s, { align: 'center' })

  doc.setFillColor(...VERMELHO)
  doc.rect(x + 26 * s, y + 148 * s, 88 * s, 16 * s, 'F')
  doc.setFillColor(...VERDE)
  doc.rect(x + 124 * s, y + 148 * s, 140 * s, 16 * s, 'F')
}

// marca GROWLIM: GROW (teal) + LIM (cinza), a segunda parte começa onde a primeira termina
function desenharMarcaGrowlim(doc: any, x: number, y: number, tamanho: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(tamanho)
  doc.setTextColor(...TEAL)
  doc.text('GROW', x, y)
  const larguraGrow = doc.getTextWidth('GROW')
  doc.setTextColor(...CINZA_MARCA)
  doc.text('LIM', x + larguraGrow, y)
}

export async function montarPdfCompra(
  pedido: PedidoCompra,
  itens: ItemPedidoCompra[],
  _empresa: string
) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 15
  const CW = W - M * 2
  const LIMITE = H - 24 // área útil antes do rodapé

  // ---------- cabeçalho ----------
  desenharLogoRomar(doc, M, 10, 22)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA)
  doc.text('PEDIDO DE COMPRA', W - M, 14, { align: 'right' })

  doc.setFontSize(24)
  doc.setTextColor(...VERDE)
  doc.text(`Nº ${numeroPedido(pedido.numero)}`, W - M, 24, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA)
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - M, 30, { align: 'right' })

  // barra vermelha + verde (eco das barras da logo)
  doc.setFillColor(...VERMELHO)
  doc.rect(M, 37, 32, 1.6, 'F')
  doc.setFillColor(...VERDE)
  doc.rect(M + 34, 37, CW - 34, 1.6, 'F')

  // ---------- fornecedor (esquerda) e condições (direita) ----------
  const topo = 50
  const metade = CW / 2
  const xDir = M + metade + 4
  const xValor = xDir + 28
  const larguraValor = W - M - xValor

  // esquerda: fornecedor
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...CINZA)
  doc.text('FORNECEDOR', M, topo)

  doc.setFontSize(13)
  doc.setTextColor(...CINZA_ESCURO)
  const nomeLinhas = doc.splitTextToSize(pedido.fornecedor_nome, metade - 6) as string[]
  let yEsq = topo + 6.5
  doc.text(nomeLinhas, M, yEsq)
  yEsq += (nomeLinhas.length - 1) * 5.6

  if (pedido.fornecedor_contato) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...CINZA)
    const contatoLinhas = doc.splitTextToSize(pedido.fornecedor_contato, metade - 6) as string[]
    yEsq += 5.5
    doc.text(contatoLinhas, M, yEsq)
    yEsq += (contatoLinhas.length - 1) * 4.8
  }

  // direita: condições
  const condicoes: [string, string][] = []
  if (pedido.previsao_entrega) condicoes.push(['Entrega prevista', dataCurta(pedido.previsao_entrega)])
  if (pedido.prazo_dias != null)
    condicoes.push(['Prazo', `${pedido.prazo_dias} ${pedido.prazo_dias === 1 ? 'dia' : 'dias'}`])
  if (pedido.condicao_pagamento) condicoes.push(['Pagamento', pedido.condicao_pagamento])
  if (pedido.comparacao_nome) condicoes.push(['Referência', pedido.comparacao_nome])

  let yDir = topo
  if (condicoes.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text('CONDIÇÕES', xDir, yDir)
    yDir += 6.5

    for (const [rotulo, valor] of condicoes) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      const linhas = doc.splitTextToSize(valor, larguraValor) as string[]

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...CINZA)
      doc.text(rotulo, xDir, yDir)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...CINZA_ESCURO)
      doc.text(linhas, xValor, yDir)

      yDir += linhas.length * 4.6 + 1.6
    }
    yDir -= 4.6 + 1.6 // volta para a última linha escrita
  }

  let y = Math.max(yEsq, yDir) + 9

  // ---------- tabela ----------
  const xQtd = M
  const xItem = M + 28
  const xPreco = W - M - 36
  const xSub = W - M
  const larguraItem = xPreco - 30 - xItem

  const cabecalhoTabela = (topoTabela: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text('QTD', xQtd, topoTabela + 4)
    doc.text('ITEM', xItem, topoTabela + 4)
    doc.text('PREÇO UN.', xPreco, topoTabela + 4, { align: 'right' })
    doc.text('SUBTOTAL', xSub, topoTabela + 4, { align: 'right' })

    doc.setDrawColor(...VERDE)
    doc.setLineWidth(0.5)
    doc.line(M, topoTabela + 7, W - M, topoTabela + 7)
    doc.setLineWidth(0.2)
    return topoTabela + 7
  }

  y = cabecalhoTabela(y)

  for (const it of itens) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    const nomeL = doc.splitTextToSize(it.produto_nome, larguraItem) as string[]

    doc.setFontSize(8.5)
    const obsL = it.observacao?.trim()
      ? (doc.splitTextToSize(`obs: ${it.observacao.trim()}`, larguraItem) as string[])
      : []

    const altura = Math.max(11, nomeL.length * 5 + obsL.length * 4.2 + 6)

    if (y + altura > LIMITE) {
      doc.addPage()
      y = cabecalhoTabela(M)
    }

    const base = y + 7

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(`${numeroTexto(it.quantidade)}${it.unidade ? ` ${it.unidade}` : ''}`, xQtd, base)

    doc.setFont('helvetica', 'normal')
    doc.text(nomeL, xItem, base)

    if (obsL.length > 0) {
      doc.setFontSize(8.5)
      doc.setTextColor(...CINZA)
      doc.text(obsL, xItem, base + nomeL.length * 5)
    }

    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...CINZA)
    doc.text(reais(it.preco_unitario), xPreco, base, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(reais(it.subtotal), xSub, base, { align: 'right' })

    y += altura
    doc.setDrawColor(...LINHA)
    doc.line(M, y, W - M, y)
  }

  // ---------- totais ----------
  const soma = itens.reduce((s, i) => s + i.subtotal, 0)
  const linhasTotais: [string, string][] = [['Subtotal', reais(soma)]]
  if (pedido.frete > 0) linhasTotais.push(['Frete', reais(pedido.frete)])
  if (pedido.desconto > 0) linhasTotais.push(['Desconto', `- ${reais(pedido.desconto)}`])

  if (y + linhasTotais.length * 6.5 + 24 > LIMITE) {
    doc.addPage()
    y = M - 4
  }

  const larguraTotais = 76
  const xTotais = W - M - larguraTotais

  y += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const [rotulo, valor] of linhasTotais) {
    y += 6.5
    doc.setTextColor(...CINZA)
    doc.text(rotulo, xTotais, y)
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(valor, W - M, y, { align: 'right' })
  }

  y += 4
  doc.setDrawColor(...CINZA_ESCURO)
  doc.setLineWidth(0.4)
  doc.line(xTotais, y, W - M, y)
  doc.setLineWidth(0.2)

  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...CINZA_ESCURO)
  doc.text('Total', xTotais, y)
  doc.setFontSize(16)
  doc.setTextColor(...VERDE)
  doc.text(reais(pedido.total), W - M, y, { align: 'right' })

  // ---------- observações ----------
  if (pedido.observacao?.trim()) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const linhas = doc.splitTextToSize(pedido.observacao.trim(), CW) as string[]

    if (y + 10 + 6 + linhas.length * 5 > LIMITE) {
      doc.addPage()
      y = M - 4
    }

    y += 14
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
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
    doc.setDrawColor(...LINHA)
    doc.line(M, H - 15, W - M, H - 15)

    desenharMarcaGrowlim(doc, M, H - 9.5, 11)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...CINZA)
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 9.5, { align: 'right' })
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