import { formatarReais, type PedidoSugerido } from './melhorPreco'
import { numero } from './formatacao'

type Cor = [number, number, number]
const VERDE: Cor = [30, 158, 72]
const VERMELHO: Cor = [228, 49, 47]
const TEAL: Cor = [7, 156, 156]
const CINZA_MARCA: Cor = [107, 114, 128]
const CINZA_ESCURO: Cor = [30, 41, 59]
const CINZA: Cor = [100, 116, 139]
const LINHA: Cor = [226, 232, 240]

// "Depósito Central" -> "deposito-central"
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

export async function montarPdf(pedido: PedidoSugerido, nomeComparacao?: string) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 15
  const CW = W - M * 2
  const LIMITE = H - 24 // área útil antes do rodapé

  // ---------- cabeçalho (igual ao do pedido de compra) ----------
  desenharLogoRomar(doc, M, 10, 22)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA)
  doc.text('PEDIDO DE COMPRA', W - M, 14, { align: 'right' })

  doc.setFontSize(24)
  doc.setTextColor(...VERDE)
  doc.text(new Date().toLocaleDateString('pt-BR'), W - M, 24, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA)
  doc.text('Data de emissão', W - M, 30, { align: 'right' })

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
  const nomeLinhas = doc.splitTextToSize(pedido.fornecedor.name, metade - 6) as string[]
  let yEsq = topo + 6.5
  doc.text(nomeLinhas, M, yEsq)
  yEsq += (nomeLinhas.length - 1) * 5.6

  if (pedido.fornecedor.contact) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...CINZA)
    const contatoLinhas = doc.splitTextToSize(pedido.fornecedor.contact, metade - 6) as string[]
    yEsq += 5.5
    doc.text(contatoLinhas, M, yEsq)
    yEsq += (contatoLinhas.length - 1) * 4.8
  }

  // direita: condições
  const condicoes: [string, string][] = []
  if (pedido.fornecedor.lead_time_days != null) {
    const d = pedido.fornecedor.lead_time_days
    condicoes.push(['Prazo', `${d} ${d === 1 ? 'dia' : 'dias'}`])
  }
  if (nomeComparacao) condicoes.push(['Referência', nomeComparacao])

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

    doc.setDrawColor(...TEAL)
    doc.setLineWidth(0.5)
    doc.line(M, topoTabela + 7, W - M, topoTabela + 7)
    doc.setLineWidth(0.2)
    return topoTabela + 7
  }

  y = cabecalhoTabela(y)

  for (const { item, preco, subtotal } of pedido.itens) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    const nomeL = doc.splitTextToSize(item.name, larguraItem) as string[]

    const altura = Math.max(11, nomeL.length * 5 + 6)

    // não cabe: nova página, repete o cabeçalho da tabela
    if (y + altura > LIMITE) {
      doc.addPage()
      y = cabecalhoTabela(M)
    }

    const base = y + 7

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(`${numero(item.quantity)}${item.unit ? ` ${item.unit}` : ''}`, xQtd, base)

    doc.setFont('helvetica', 'normal')
    doc.text(nomeL, xItem, base)

    doc.setTextColor(...CINZA)
    doc.text(formatarReais(preco), xPreco, base, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...CINZA_ESCURO)
    doc.text(formatarReais(subtotal), xSub, base, { align: 'right' })

    y += altura
    doc.setDrawColor(...LINHA)
    doc.line(M, y, W - M, y)
  }

  // ---------- total ----------
  if (y + 24 > LIMITE) {
    doc.addPage()
    y = M - 4
  }

  const larguraTotais = 76
  const xTotais = W - M - larguraTotais

  y += 7
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
  doc.setTextColor(...TEAL)
  doc.text(formatarReais(pedido.subtotal), W - M, y, { align: 'right' })

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
    nome: `pedido-${slug(pedido.fornecedor.name)}.pdf`,
  }
}

// carrega a biblioteca antes do clique: o navegador só deixa compartilhar logo após o toque
export function precarregarPdf() {
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
export async function gerarPedidoPdf(pedido: PedidoSugerido, nomeComparacao?: string) {
  const { blob, nome } = await montarPdf(pedido, nomeComparacao)
  const arquivo = new File([blob], nome, { type: 'application/pdf' })

  if (
    ehCelular() &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [arquivo] })
  ) {
    try {
      await navigator.share({
        files: [arquivo],
        title: `Pedido - ${pedido.fornecedor.name}`,
      })
      return
    } catch (e) {
      // a pessoa fechou a folha de compartilhar: não é erro
      if (e instanceof DOMException && e.name === 'AbortError') return
      // qualquer outra falha: cai para o download
    }
  }

  baixar(blob, nome)
}