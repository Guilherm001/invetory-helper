import type { CotacaoData } from '../types'

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function gerarCotacao(data: CotacaoData) {
  const [{ pdf }, { default: CotacaoPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../pdf/CotacaoPdf'),
  ])

  const blob = await pdf(<CotacaoPdf data={data} />).toBlob()
  const dia = new Date().toISOString().slice(0, 10)
  const nome = `cotacao-${slug(data.fornecedor) || 'fornecedor'}-${dia}.pdf`
  const file = new File([blob], nome, { type: 'application/pdf' })

  // celular: abre o menu de compartilhar
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Cotação - ${data.fornecedor}` })
      return
    } catch (err) {
      // usuário fechou o menu: não baixa nada
      if (err instanceof DOMException && err.name === 'AbortError') return
      // qualquer outro erro: cai no download
    }
  }

  // computador (ou sem suporte): baixa o arquivo
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}