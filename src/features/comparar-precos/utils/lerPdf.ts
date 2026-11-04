// lê um PDF e devolve uma linha de texto por linha visual da página
export async function extrairLinhasDoPdf(arquivo: File): Promise<string[]> {
  // import dinâmico: pdfjs só roda no navegador
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise
  const linhas: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p)
    const conteudo = await pagina.getTextContent()

    // agrupa os pedaços de texto que estão na mesma altura (y)
    const grupos: { y: number; pecas: { x: number; s: string }[] }[] = []
    for (const it of conteudo.items) {
      if (!('str' in it) || !it.str.trim()) continue
      const x = it.transform[4]
      const y = it.transform[5]
      const grupo = grupos.find((g) => Math.abs(g.y - y) <= 3)
      if (grupo) grupo.pecas.push({ x, s: it.str })
      else grupos.push({ y, pecas: [{ x, s: it.str }] })
    }

    grupos
      .sort((a, b) => b.y - a.y) // de cima para baixo
      .forEach((g) => {
        const texto = g.pecas
          .sort((a, b) => a.x - b.x) // da esquerda para a direita
          .map((x) => x.s.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (texto) linhas.push(texto)
      })
  }
  return linhas
}