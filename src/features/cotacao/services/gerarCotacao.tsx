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

  // sempre baixa o arquivo
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}