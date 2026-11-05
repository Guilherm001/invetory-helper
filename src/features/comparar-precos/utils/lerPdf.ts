// ---------- extração do texto do PDF ----------

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

// ---------- interpretação das linhas ----------

export type ModoPreco = 'unidade' | 'caixa'

export interface LinhaPdf {
  nome: string
  embalagem: number | null // unidades por caixa ("20 caixas" -> 20)
  quantidade: number | null // quantas caixas foram pedidas ("4 caixas" -> 4)
  unitario: number // valor unitário como veio no PDF
  total: number | null
  unitarioPor: 'caixa' | 'peca' // o unitário do PDF é por caixa ou por peça?
}

// 2 a 4 casas decimais; não pode estar colado em letra ou número ("0,40MM" não é preço)
const MONEY =
  /(?<![\d.,])(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2,4}|\d+,\d{2,4}|\d+\.\d{2})(?![\dA-Za-z])/g

// código do produto no começo da linha: "0228199 COLA MADEIRA ..."
const CODIGO = /^\d{5,}\s+/

// tabela de pedido: nº do item + referência no começo da linha
// "9 T-5336 ALICATE ..." | "6 15941 SOLDA ..."
const PREFIXO_TABELA = /^\d{1,3}\s+(?:[A-Za-z]{1,3}-\d+|\d{4,})\s+(?=\S)/

// cabeçalho, rodapé e total de orçamento/pedido: nunca são itens
const LIXO =
  /^(p[áa]gina\s+\d+\s+de\s+\d+|c[óo]digo\s+descri|item\s+ref|gerado em|total\s*:|\d+\s+itens?\s+total)|ltda\.?$/i

const UNIDADES =
  '(?:caixas?|cx|unidades?|unid|un|pe[çc]as?|pcs?|pacotes?|pct|fardos?|sacos?|rolos?|kits?|latas?)'

function paraValor(s: string): number {
  return s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s)
}

// "Cimento CP-II  20 caixas  4 caixas  32,50  130,00" -> LinhaPdf
// também entende "Embalagem: 20 caixas" e "Quantidade: 4 caixas"
// o formato de orçamento "0228199 COLA MADEIRA - 637 24 3,735 89,640"
// e o pedido de venda "9 T-5336 ALICATE TRAMONTINA UNIVERSAL 8 4 R$ 38,69 R$ 154,76"
export function interpretarLinhaPdf(bruta: string): LinhaPdf | null {
  const valores = [...bruta.matchAll(MONEY)]
  if (valores.length === 0) return null

  const ultimo = valores[valores.length - 1]
  const penultimo = valores.length >= 2 ? valores[valores.length - 2] : null

  // com 2 ou mais valores: o penúltimo é o unitário e o último é o total
  const unitario = paraValor((penultimo ?? ultimo)[1])
  const total = penultimo ? paraValor(ultimo[1]) : null

  let resto = bruta.slice(0, (penultimo ?? ultimo).index ?? bruta.length)

  // linha de tabela (tem unitário e total): tira nº do item e referência do começo
  if (total !== null) resto = resto.replace(PREFIXO_TABELA, '')

  const achado = { embalagem: null as number | null, quantidade: null as number | null }
  const formatoOrcamento = CODIGO.test(bruta.trim())

  // quantidade solta antes do unitário: "... 24 3,735 89,640"
  if (total !== null) {
    const q = resto.match(/(?:^|\s)(\d+)\s*$/)
    if (q) {
      const qtd = Number(q[1])
      if (qtd >= 1 && Math.abs(qtd * unitario - total) <= Math.max(0.05, total * 0.01)) {
        achado.quantidade = qtd
        resto = resto.slice(0, q.index)
      }
    }
  }

  // campos com rótulo
  resto = resto.replace(/embala[gn]em\s*:?\s*(?:c\/|com\s+)?(\d+)(?:\s*[a-zç]+)?/i, (_, n) => {
    achado.embalagem = Number(n)
    return ' '
  })
  resto = resto.replace(/(?:quantidade|qtde?\.?|qtd\.?)\s*:?\s*(\d+)(?:\s*[a-zç]+)?/i, (_, n) => {
    achado.quantidade = Number(n)
    return ' '
  })

  // campos sem rótulo: "20 caixas 4 caixas" (1º = embalagem, 2º = quantidade)
  // não vale para orçamento com código: lá "CAIXA 1000 PEÇAS" faz parte do nome
  if (!formatoOrcamento) {
    const sequencia = new RegExp(`(\\d+)\\s*${UNIDADES}\\b`, 'gi')
    const numeros = [...resto.matchAll(sequencia)].map((m) => Number(m[1]))
    if (numeros.length > 0) {
      resto = resto.replace(sequencia, ' ')
      for (const n of numeros) {
        if (achado.embalagem === null) achado.embalagem = n
        else if (achado.quantidade === null) achado.quantidade = n
      }
    }
  }

  let nome = resto
    .replace(/R\$\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s:;=|–—-]+$/, '')
    .trim()

  // formato "código descrição - referência": tira o código e a referência do fim
  if (CODIGO.test(nome)) {
    nome = nome.replace(CODIGO, '').replace(/\s+-\s+\S+$/, '').trim()
  }
  // sem nenhuma palavra não é item (ex.: sobrou só "1" de uma linha de números)
  if (!/[a-zà-ÿ]{3}/i.test(nome)) return null

  const { embalagem, quantidade } = achado

  // confere a conta para descobrir se o unitário é por caixa ou por peça
  let unitarioPor: 'caixa' | 'peca' = 'caixa'
  if (quantidade && total !== null) {
    const tolerancia = Math.max(0.05, total * 0.01)
    const porCaixa = Math.abs(quantidade * unitario - total) <= tolerancia
    const porPeca =
      embalagem !== null && Math.abs(quantidade * embalagem * unitario - total) <= tolerancia
    if (!porCaixa && porPeca) unitarioPor = 'peca'
  }

  return { nome, embalagem, quantidade, unitario, total, unitarioPor }
}

// lê o PDF e devolve só as linhas que têm preço
export async function extrairItensDoPdf(arquivo: File): Promise<LinhaPdf[]> {
  const linhas = await extrairLinhasDoPdf(arquivo)
  const itens: LinhaPdf[] = []
  // pedaços de descrição vistos antes de uma linha que só tem números
  let pendente: string[] = []

  for (const bruta of linhas) {
    if (LIXO.test(bruta)) continue

    const direto = interpretarLinhaPdf(bruta)
    if (direto) {
      itens.push(direto)
      pendente = []
      continue
    }

    if ([...bruta.matchAll(MONEY)].length > 0) {
      // linha só com números ("1 17,538 17,538" ou "2 R$ 10,77 R$ 21,54"): a descrição veio antes
      const junto = pendente.length
        ? interpretarLinhaPdf(`${pendente.join(' ')} ${bruta}`)
        : null
      if (junto) itens.push(junto)
      pendente = []
    } else if (CODIGO.test(bruta) || PREFIXO_TABELA.test(bruta)) {
      pendente = [bruta] // começo de um item
    } else if (pendente.length > 0) {
      pendente.push(bruta) // continuação da descrição
    }
  }
  return itens
}

// ---------- conversão ----------

export function precoDe(l: LinhaPdf, modo: ModoPreco): number {
  const emb = l.embalagem && l.embalagem > 0 ? l.embalagem : 1
  if (modo === 'caixa') return l.unitarioPor === 'caixa' ? l.unitario : l.unitario * emb
  return l.unitarioPor === 'peca' ? l.unitario : l.unitario / emb
}

// 3 casas: o diálogo arredonda para centavos pelos dígitos (3,735 -> 3,74)
const formatar = (n: number) => n.toFixed(3).replace('.', ',')

// vira o texto "nome preço" que o diálogo já sabe ler
export function textoDasLinhas(linhas: LinhaPdf[], modo: ModoPreco): string {
  return linhas.map((l) => `${l.nome} ${formatar(precoDe(l, modo))}`).join('\n')
}