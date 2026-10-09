import type { CotacaoData } from '../types'

// celular: abre o menu de compartilhar (mude para false se quiser só baixar)
const COMPARTILHAR_NO_CELULAR = true

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// data local (toISOString usaria UTC e viraria o dia depois das 21h)
function dataLocal() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function ehCelular() {
  const ua = navigator.userAgent
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) // iPad
  )
}

// pré-carrega a biblioteca enquanto a pessoa digita as quantidades
export function preparar() {
  void import('@react-pdf/renderer')
  void import('../pdf/CotacaoPdf')
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)

  // navegador sem suporte a download por link: abre o PDF numa aba
  if (!('download' in HTMLAnchorElement.prototype)) {
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }

  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()

  // não apaga logo: celulares lentos precisam do link vivo
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function gerarCotacao(data: CotacaoData) {
  const [{ pdf }, { default: CotacaoPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../pdf/CotacaoPdf'),
  ])

  const blob = await pdf(<CotacaoPdf data={data} />).toBlob()
  const nome = `cotacao-${slug(data.fornecedor) || 'fornecedor'}-${dataLocal()}.pdf`

  if (COMPARTILHAR_NO_CELULAR && ehCelular()) {
    const file = new File([blob], nome, { type: 'application/pdf' })

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Cotação - ${data.fornecedor}` })
        return
      } catch (err) {
        // a pessoa fechou o menu: não baixa nada
        if (err instanceof DOMException && err.name === 'AbortError') return
        // qualquer outro erro (ex.: o navegador negou o compartilhamento): cai no download
      }
    }
  }

  baixar(blob, nome)
}