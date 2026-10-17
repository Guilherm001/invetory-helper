import type { DocumentoResumo, ItemDocumento } from '../services/documentosService'
import { EMPRESA, linhasEmpresa } from './empresa'
import { enderecoDe } from './impressao'
import { dataCurta, dataHora, numeroTexto, reais } from './formatar'

type Cor = [number, number, number]

const TEAL: Cor = [7, 156, 156]
const CINZA_MARCA: Cor = [107, 114, 128]
const ESCURO: Cor = [30, 41, 59]
const CINZA: Cor = [100, 116, 139]
const CINZA_CLARO: Cor = [241, 245, 249]
const LINHA: Cor = [226, 232, 240]

const arred = (n: number) => Math.round(n * 100) / 100

async function montarPdf(doc: DocumentoResumo, itens: ItemDocumento[]) {
  const { jsPDF } = await import('jspdf')

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 15
  const orc = doc.documento === 'orcamento'
  const titulo = orc ? 'ORÇAMENTO' : 'PEDIDO'

  // total dos itens (subtotal), desconto e valor final
  const desconto = Number(doc.desconto ?? 0)
  const totalFinal = arred(doc.total - desconto)

  // ---------- cabeçalho ----------
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(26)
  pdf.setTextColor(...TEAL)
  pdf.text('GROW', M, 18)
  const larguraGrow = pdf.getTextWidth('GROW')
  pdf.setTextColor(...CINZA_MARCA)
  pdf.text('LIM', M + larguraGrow, 18)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...CINZA)
  linhasEmpresa()
    .slice(0, 2)
    .forEach((l, i) => pdf.text(l, M, 23.5 + i * 3.8))

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(...ESCURO)
  pdf.text(`${titulo} Nº ${doc.numero}`, W - M, 13, { align: 'right' })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...CINZA)
  let yd = 19.5
  pdf.text(dataHora(doc.criado_em), W - M, yd, { align: 'right' })
  if (orc && doc.validade) {
    yd += 5
    pdf.text(`Válido até ${dataCurta(doc.validade)}`, W - M, yd, { align: 'right' })
  }
  if (doc.orcamento_numero !== null) {
    yd += 5
    pdf.text(`Origem: orçamento nº ${doc.orcamento_numero}`, W - M, yd, { align: 'right' })
  }

  pdf.setFillColor(...TEAL)
  pdf.rect(0, 33, W, 1.5, 'F')

  // ---------- cliente e entrega ----------
  const rotulo = (txt: string, x: number, yy: number) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...CINZA)
    pdf.text(txt, x, yy)
  }

  let y = 45
  const colW = (W - M * 2 - 10) / 2
  const xDir = M + colW + 10

  rotulo('CLIENTE', M, y)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(...ESCURO)
  const nomeCli = pdf.splitTextToSize(doc.cliente_nome?.trim() || 'Não informado', colW) as string[]
  pdf.text(nomeCli, M, y + 6)
  let yEsq = y + 6 + nomeCli.length * 5
  if (doc.cliente_telefone) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(doc.cliente_telefone, M, yEsq)
    yEsq += 5
  }

  rotulo(doc.tipo === 'entrega' ? 'ENTREGA' : 'RETIRADA', xDir, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...ESCURO)
  const textoDir =
    doc.tipo === 'entrega' ? enderecoDe(doc) || 'Endereço não informado' : 'Retirada na loja'
  const linhasDir = pdf.splitTextToSize(textoDir, colW) as string[]
  pdf.text(linhasDir, xDir, y + 6)
  const yDir = y + 6 + linhasDir.length * 4.6

  y = Math.max(yEsq, yDir) + 6

  // ---------- tabela de itens ----------
  const xQtd = M + 2
  const xProd = M + 30
  const xPreco = W - M - 38 // borda direita da coluna de preço
  const xSub = W - M - 2 // borda direita da coluna de subtotal
  const larguraProd = xPreco - 28 - xProd

  const cabecalho = (topo: number) => {
    pdf.setFillColor(...CINZA_CLARO)
    pdf.rect(M, topo, W - M * 2, 8, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...CINZA)
    pdf.text('QTD', xQtd, topo + 5.4)
    pdf.text('PRODUTO', xProd, topo + 5.4)
    pdf.text('PREÇO UN.', xPreco, topo + 5.4, { align: 'right' })
    pdf.text('SUBTOTAL', xSub, topo + 5.4, { align: 'right' })
    return topo + 8
  }

  y = cabecalho(y)

  for (const i of itens) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    const nomeLinhas = pdf.splitTextToSize(i.produto_nome, larguraProd) as string[]

    pdf.setFontSize(8.5)
    const extras: string[] = []
    if (i.produto_codigo) extras.push(`Cód. ${i.produto_codigo}`)
    if (i.observacao?.trim()) extras.push(`obs: ${i.observacao.trim()}`)
    const extraLinhas = extras.flatMap((e) => pdf.splitTextToSize(e, larguraProd) as string[])

    const altura = Math.max(9, nomeLinhas.length * 4.6 + extraLinhas.length * 3.8 + 5)

    // não cabe: nova página, repete o cabeçalho da tabela
    if (y + altura > H - 30) {
      pdf.addPage()
      y = cabecalho(M)
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...TEAL)
    pdf.text(`${numeroTexto(i.quantidade)}${i.unidade ? ` ${i.unidade}` : ''}`, xQtd, y + 6)

    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...ESCURO)
    pdf.text(nomeLinhas, xProd, y + 6)

    if (extraLinhas.length > 0) {
      pdf.setFontSize(8.5)
      pdf.setTextColor(...CINZA)
      pdf.text(extraLinhas, xProd, y + 6 + nomeLinhas.length * 4.6)
    }

    pdf.setFontSize(10)
    pdf.setTextColor(...CINZA)
    pdf.text(reais(i.preco_unitario), xPreco, y + 6, { align: 'right' })

    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...ESCURO)
    pdf.text(reais(i.subtotal), xSub, y + 6, { align: 'right' })

    y += altura
    pdf.setDrawColor(...LINHA)
    pdf.line(M, y, W - M, y)
  }

  // ---------- subtotal, desconto e total ----------
  if (y + 20 + (desconto > 0 ? 13 : 0) > H - 22) {
    pdf.addPage()
    y = M
  }
  y += 8

  const xCaixa = W - M - 80 // mesma coluna da caixa verde do total
  if (desconto > 0) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...CINZA)
    pdf.text('Subtotal', xCaixa + 4, y + 3)
    pdf.text(reais(doc.total), W - M - 4, y + 3, { align: 'right' })
    pdf.text('Desconto', xCaixa + 4, y + 8)
    pdf.text(`- ${reais(desconto)}`, W - M - 4, y + 8, { align: 'right' })
    y += 13
  }

  pdf.setFillColor(...TEAL)
  pdf.roundedRect(xCaixa, y, 80, 12, 2, 2, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Total', xCaixa + 4, y + 7.8)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text(reais(totalFinal), W - M - 4, y + 8, { align: 'right' })
  y += 12 + 8

  // ---------- pagamento e observação ----------
  const bloco = (nome: string, conteudo: string) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    const linhas = pdf.splitTextToSize(conteudo, W - M * 2) as string[]
    if (y + 6 + linhas.length * 4.6 > H - 22) {
      pdf.addPage()
      y = M
    }
    rotulo(nome, M, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...ESCURO)
    pdf.text(linhas, M, y + 5.5)
    y += 5.5 + linhas.length * 4.6 + 4
  }

  if (doc.pagamento) bloco('PAGAMENTO', doc.pagamento)
  if (doc.observacao?.trim()) bloco('OBSERVAÇÃO', doc.observacao.trim())

  // ---------- rodapé de cada página ----------
  const paginas = pdf.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    pdf.setPage(p)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...CINZA)
    pdf.text(
      `Documento sem valor fiscal.${doc.vendedor_nome ? ` Atendido por ${doc.vendedor_nome}.` : ''}`,
      M,
      H - 10
    )
    pdf.text(`Página ${p} de ${paginas}`, W - M, H - 10, { align: 'right' })
    if (p === paginas && EMPRESA.rodape) {
      pdf.text(EMPRESA.rodape, W / 2, H - 16, { align: 'center' })
    }
  }

  return {
    blob: pdf.output('blob') as Blob,
    nome: `${orc ? 'orcamento' : 'pedido'}-${doc.numero}.pdf`,
  }
}

// carrega a biblioteca antes do clique: o navegador só deixa compartilhar logo após o toque
export function precarregarPdf() {
  void import('jspdf')
}

const ehCelular = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

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
export async function gerarDocumentoPdf(doc: DocumentoResumo, itens: ItemDocumento[]) {
  const { blob, nome } = await montarPdf(doc, itens)
  const arquivo = new File([blob], nome, { type: 'application/pdf' })

  if (
    ehCelular() &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [arquivo] })
  ) {
    try {
      await navigator.share({
        files: [arquivo],
        title: `${doc.documento === 'orcamento' ? 'Orçamento' : 'Pedido'} nº ${doc.numero}`,
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