// ---------- extração do texto do PDF ----------

async function abrirPdf(arquivo: File) {
  // import dinâmico: pdfjs só roda no navegador
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
  return pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise
}

type PdfDoc = Awaited<ReturnType<typeof abrirPdf>>

// uma linha visual da página, com a posição vertical (y) e a página
export interface LinhaY {
  texto: string
  y: number
  pag: number
  x0?: number // onde a linha começa (esquerda)
  descX?: number | null // onde começa a descrição (1º pedaço com palavra)
}

// uma linha de texto por linha visual da página (agrupa pela altura y)
async function linhasComY(pdf: PdfDoc): Promise<LinhaY[]> {
  const linhas: LinhaY[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p)
    const conteudo = await pagina.getTextContent()

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
        if (!texto) return
        const ordenadas = [...g.pecas].sort((a, b) => a.x - b.x)
        const desc = ordenadas.find((x) => /[a-zà-ÿ]{3}/i.test(x.s))
        linhas.push({ texto, y: g.y, pag: p, x0: ordenadas[0].x, descX: desc ? desc.x : null })
      })
  }
  return linhas
}

async function linhasDoPdf(pdf: PdfDoc): Promise<string[]> {
  return (await linhasComY(pdf)).map((l) => l.texto)
}

// todo o texto numa linha só, NA ORDEM EM QUE O PDF DESENHOU.
// Relatórios de sistema desenham linha por linha, célula por célula, então esta ordem
// não depende da altura de cada célula (que varia e quebra o agrupamento por y).
async function textoCorrido(pdf: PdfDoc): Promise<string> {
  const partes: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p)
    const conteudo = await pagina.getTextContent()
    for (const it of conteudo.items) {
      if ('str' in it && it.str.trim()) partes.push(it.str.trim())
    }
  }
  return partes.join(' ').replace(/\s+/g, ' ')
}

export async function extrairLinhasDoPdf(arquivo: File): Promise<string[]> {
  return linhasDoPdf(await abrirPdf(arquivo))
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
  /^(p[áa]gina\s+\d+\s+de\s+\d+|c[óo]digo\s+descri|c[óo]d\.?\s+qtd|item\s+ref|gerado em|total\s*:|total\s+geral|\d+\s+itens?\s+total|prod\.?\s+(?:em|fora)\s+promo|valor\s+do\s+pedido|prazo\s*\/?\s*desc|retirada\s*:)|ltda\.?$/i

const UNIDADES =
  '(?:caixas?|cx|unidades?|unid|un|pe[çc]as?|pcs?|pacotes?|pct|fardos?|sacos?|rolos?|kits?|latas?)'

function paraValor(s: string): number {
  return s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s)
}

// ---------- formato "Pedido de Venda" (Item | Ref. | Prod. | Qtde. | Valor | Vl.Total) ----------
// "9 T-5336 ALICATE TRAMONTANA UNIVERSAL 8 4 R$ 38,69 R$ 154,76"
// Lê o texto corrido do PDF, então não importa como as células caíram em linhas visuais.

const VALOR = String.raw`\d+(?:\.\d{3})*,\d{2}`
const REGISTRO_TABELA = new RegExp(
  String.raw`(?<!\S)\d{1,3}\s+(?:[A-Za-z]{1,3}-\d+|\d{4,})\s+` + // nº do item + referência
    String.raw`((?:(?!R\$).)+?)\s+` + // descrição (nunca atravessa um "R$")
    String.raw`(\d+(?:,\d+)?)\s+` + // quantidade
    String.raw`R\$\s*(${VALOR})\s+` + // valor unitário
    String.raw`R\$\s*(${VALOR})(?!\d)`, // valor total
  'g'
)

export function interpretarPedidoTabela(texto: string): LinhaPdf[] {
  const itens: LinhaPdf[] = []
  for (const m of texto.matchAll(REGISTRO_TABELA)) {
    const nome = m[1].replace(/\s+/g, ' ').trim()
    if (!/[a-zà-ÿ]{3}/i.test(nome)) continue
    itens.push({
      nome,
      embalagem: null,
      quantidade: paraValor(m[2]),
      unitario: paraValor(m[3]),
      total: paraValor(m[4]),
      unitarioPor: 'peca',
    })
  }
  return itens
}

// ---------- formatos em linha (orçamentos, listas) ----------

// formato "Cód. | Qtd. | Descrição | Qtd. Emb. | Vlr | Vlr Líq. | Endereço":
// "14908 24,00 CASCOLA EXTRA BISNAGA 30g 1,00 9,15 219,58 RUA A2 - BOX 76"
// a quantidade vem antes da descrição e a embalagem (múltiplo de venda) depois dela
const QTD_DESC_EMB = new RegExp(
  String.raw`^\s*(?:\d{3,}\s+)?(${VALOR})\s+(.+?)\s+(${VALOR})\s*$`
)

// "Cimento CP-II  20 caixas  4 caixas  32,50  130,00" -> LinhaPdf
// também entende "Embalagem: 20 caixas" e "Quantidade: 4 caixas"
// e o formato de orçamento "0228199 COLA MADEIRA - 637 24 3,735 89,640"
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

  // formato "cód. qtd descrição emb. vlr vlr.líq": o unitário é sempre por peça;
  // a "embalagem" é só o múltiplo de venda, então não divide o preço
  let tabelaQtdDesc = false
  let qtdTabela = 0
  if (total !== null) {
    const t = resto.match(QTD_DESC_EMB)
    if (t) {
      tabelaQtdDesc = true
      qtdTabela = paraValor(t[1])
      resto = t[2]
    }
  }

  // quantidade solta antes do unitário: "... 24 3,735 89,640"
  if (total !== null && !tabelaQtdDesc) {
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
  if (!tabelaQtdDesc) {
    resto = resto.replace(/embala[gn]em\s*:?\s*(?:c\/|com\s+)?(\d+)(?:\s*[a-zç]+)?/i, (_, n) => {
      achado.embalagem = Number(n)
      return ' '
    })
    resto = resto.replace(/(?:quantidade|qtde?\.?|qtd\.?)\s*:?\s*(\d+)(?:\s*[a-zç]+)?/i, (_, n) => {
      achado.quantidade = Number(n)
      return ' '
    })
  }

  // campos sem rótulo: "20 caixas 4 caixas" (1º = embalagem, 2º = quantidade)
  // não vale para orçamento com código: lá "CAIXA 1000 PEÇAS" faz parte do nome
  if (!formatoOrcamento && !tabelaQtdDesc) {
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
  if (!tabelaQtdDesc && CODIGO.test(nome)) {
    nome = nome.replace(CODIGO, '').replace(/\s+-\s+\S+$/, '').trim()
  }
  // sem nenhuma palavra não é item (ex.: sobrou só "1" de uma linha de números)
  if (!/[a-zà-ÿ]{3}/i.test(nome)) return null

  if (tabelaQtdDesc) {
    return { nome, embalagem: null, quantidade: qtdTabela, unitario, total, unitarioPor: 'peca' }
  }

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

// distância máxima (em y) para uma linha de texto "solta" pertencer a um item:
// metade do espaçamento típico entre itens
function distanciaMax(pos: LinhaY[]): number {
  const difs: number[] = []
  for (let i = 1; i < pos.length; i++) {
    if (pos[i].pag !== pos[i - 1].pag) continue
    const d = Math.abs(pos[i - 1].y - pos[i].y)
    if (d > 2) difs.push(d)
  }
  if (difs.length === 0) return 9
  difs.sort((a, b) => a - b)
  const mediana = difs[Math.floor(difs.length / 2)]
  return Math.min(20, Math.max(5, mediana * 0.5))
}

const COM_QTD_NO_INICIO = new RegExp(String.raw`^(\s*(?:\d{3,}\s+)?${VALOR}\s+)`)

export function itensPorLinha(linhas: LinhaY[]): LinhaPdf[] {
  // cada vaga é um item pronto ou o índice de uma linha só de números (descrição ainda a achar)
  const vagas: (LinhaPdf | number)[] = []
  const orfas: LinhaY[] = [] // linhas com preço mas sem descrição
  const soltas: LinhaY[] = [] // linhas de descrição sem dono
  const resolvidas: LinhaY[] = []
  // pedaços de descrição vistos antes de uma linha que só tem números
  let pendente: LinhaY[] = []

  for (const l of linhas) {
    const bruta = l.texto
    if (LIXO.test(bruta)) continue

    const direto = interpretarLinhaPdf(bruta)
    if (direto) {
      vagas.push(direto)
      resolvidas.push(l)
      pendente = []
      continue
    }

    if ([...bruta.matchAll(MONEY)].length > 0) {
      // linha só com números ("1 17,538 17,538" ou "2 R$ 10,77 R$ 21,54"): a descrição veio antes
      const junto = pendente.length
        ? interpretarLinhaPdf(`${pendente.map((p) => p.texto).join(' ')} ${bruta}`)
        : null
      if (junto) {
        vagas.push(junto)
        resolvidas.push(l)
      } else if (pendente.length === 0) {
        // descrição quebrada em 2 linhas com os números no meio da altura da linha:
        // resolvemos depois, pela posição
        vagas.push(orfas.length)
        orfas.push(l)
      }
      pendente = []
    } else if (CODIGO.test(bruta) || PREFIXO_TABELA.test(bruta)) {
      pendente = [l] // começo de um item
    } else if (pendente.length > 0) {
      pendente.push(l) // continuação da descrição
    } else {
      soltas.push(l)
    }
  }

  // entrega cada linha de descrição solta à linha de números mais próxima
  const dist = distanciaMax(resolvidas)
  const doOrfa: LinhaY[][] = orfas.map(() => [])
  for (const s of soltas) {
    let melhor = -1
    let d = Infinity
    orfas.forEach((o, i) => {
      if (o.pag !== s.pag) return
      const dd = Math.abs(o.y - s.y)
      if (dd < d) {
        d = dd
        melhor = i
      }
    })
    if (melhor < 0 || d > dist) continue
    // se um item já completo está mais perto, a linha é dele, não deste
    const naoEste = resolvidas.some((r) => r.pag === s.pag && Math.abs(r.y - s.y) < d)
    if (!naoEste) doOrfa[melhor].push(s)
  }

  const itens: LinhaPdf[] = []
  for (const v of vagas) {
    if (typeof v !== 'number') {
      itens.push(v)
      continue
    }
    const pedacos = doOrfa[v].sort((a, b) => b.y - a.y)
    if (pedacos.length === 0) continue
    const desc = pedacos.map((p) => p.texto).join(' ')
    const numeros = orfas[v].texto
    // a descrição entra depois do código e da quantidade, como nas outras linhas
    const texto = COM_QTD_NO_INICIO.test(numeros)
      ? numeros.replace(COM_QTD_NO_INICIO, (m) => `${m}${desc} `)
      : `${desc} ${numeros}`
    const item = interpretarLinhaPdf(texto)
    if (item) itens.push(item)
  }
  return itens
}

// ---------- leitor genérico: acha o item pela conta (quantidade × unitário = total) ----------
// Funciona em qualquer layout de tabela, sem depender da ordem das colunas: o que importa é
// existir, na mesma linha, uma quantidade, um unitário e um total que fecham a conta.

interface Tok {
  s: string
  n: number | null
  dinheiro: boolean
}

function tokenizar(texto: string): Tok[] {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((p): Tok => {
      const limpo = p.replace(/^R\$/i, '')
      if (/^\d{1,3}(?:\.\d{3})+,\d{2,4}$|^\d+,\d{2,4}$/.test(limpo))
        return { s: p, n: paraValor(limpo), dinheiro: true }
      if (/^\d+\.\d{2}$/.test(limpo)) return { s: p, n: Number(limpo), dinheiro: true }
      if (/^\d+,\d+$/.test(limpo)) return { s: p, n: paraValor(limpo), dinheiro: false }
      if (/^\d+$/.test(limpo)) return { s: p, n: Number(limpo), dinheiro: false }
      return { s: p, n: null, dinheiro: false }
    })
}

interface Triplo {
  iq: number
  iu: number
  q: number
  u: number
  t: number
}

// primeiro (unitário, total) da linha em que alguma quantidade anterior fecha a conta
function acharTriplo(toks: Tok[]): Triplo | null {
  const din = toks.map((t, i) => (t.dinheiro ? i : -1)).filter((i) => i >= 0)
  for (const iu of din) {
    const u = toks[iu].n as number
    if (u <= 0) continue
    for (const it of din) {
      if (it <= iu) continue
      const t = toks[it].n as number
      if (t <= 0) continue
      for (let iq = iu - 1; iq >= 0; iq--) {
        const q = toks[iq].n
        if (q === null || q <= 0) continue
        if (Math.abs(q * u - t) <= Math.max(0.05, t * 0.02)) return { iq, iu, q, u, t }
      }
    }
  }
  return null
}

const CHAVES_CABECALHO = new Set([
  'item', 'qtd', 'qtde', 'quantidade', 'valor', 'unitário', 'unitario', 'unit', 'total', 'ipi',
  'ncm', 'st', 'descrição', 'descricao', 'código', 'codigo', 'cód', 'cod', 'produto', 'und',
  'un', 'preço', 'preco', 'prods', 'desc', 'ref', 'r$', '%', '#', 'vlr', 'liq', 'líq',
  'endereço', 'endereco', 'emb', 'marca', 'descrição.',
])

function pareceCabecalho(texto: string): boolean {
  if (/\d{2,}/.test(texto)) return false
  const palavras = texto.toLowerCase().split(/\s+/).map((p) => p.replace(/[.:]+$/, ''))
  const achadas = palavras.filter((p) => CHAVES_CABECALHO.has(p)).length
  return achadas >= 3 && achadas >= palavras.length * 0.6
}

const temLetras = (s: string) => /[a-zà-ÿ]{3}/i.test(s)

// "20 caixas 4 caixas" -> embalagem 20 (a quantidade é a que bate com a conta)
function tirarEmbalagem(
  texto: string,
  q: number,
  formatoOrcamento: boolean
): { texto: string; embalagem: number | null } {
  let emb = null as number | null
  let t = texto.replace(/embala[gn]em\s*:?\s*(?:c\/|com\s+)?(\d+)(?:\s*[a-zç]+)?/i, (_, n) => {
    emb = Number(n)
    return ' '
  })
  t = t.replace(/(?:quantidade|qtde?\.?|qtd\.?)\s*:?\s*(\d+)(?:\s*[a-zç]+)?/i, ' ')

  if (!formatoOrcamento) {
    const ach = [...t.matchAll(new RegExp(`(\\d+)\\s*${UNIDADES}\\b`, 'gi'))]
    let iq = -1
    ach.forEach((m, i) => {
      if (Number(m[1]) === q) iq = i
    })
    if (iq >= 0) {
      const tirar = [iq]
      if (iq > 0 && emb === null) {
        emb = Number(ach[iq - 1][1])
        tirar.push(iq - 1)
      }
      tirar
        .sort((a, b) => b - a)
        .forEach((i) => {
          const m = ach[i]
          t = t.slice(0, m.index) + ' ' + t.slice((m.index ?? 0) + m[0].length)
        })
    }
  }
  return { texto: t, embalagem: emb }
}

// tira do começo códigos, nº do item e unidade ("1 264 UN"), e do fim o valor da embalagem ("1,00")
function limparNome(texto: string): string {
  const p = texto.split(/\s+/).filter(Boolean)
  let ini = 0
  while (
    ini < p.length &&
    (/^[#\d.,]+$/.test(p[ini]) || (ini > 0 && /^(?:un|und|unid|cx|pc|pct)\.?$/i.test(p[ini])))
  )
    ini++
  let fim = p.length
  while (fim > ini && /^\d+,\d{2}$/.test(p[fim - 1])) fim--
  return p.slice(ini, fim).join(' ')
}

interface Ancora {
  l: LinhaY
  i: number
  nome: string
  tem: boolean
  item: LinhaPdf | null // pronto (leitura antiga); senão monta com q/u/t
  q: number
  u: number
  t: number
  emb: number | null
}

export function itensGenerico(linhas: LinhaY[]): LinhaPdf[] {
  const ancoras: Ancora[] = []
  const soltas: { l: LinhaY; i: number }[] = []

  linhas.forEach((l, i) => {
    if (LIXO.test(l.texto)) return
    const toks = tokenizar(l.texto)
    const tr = acharTriplo(toks)

    if (tr) {
      const formatoOrcamento = CODIGO.test(l.texto.trim())
      const proximo = (toks[tr.iq + 1]?.s ?? '').replace(/\.$/, '')
      const qComUnidade =
        !formatoOrcamento &&
        tr.iq + 1 < tr.iu &&
        new RegExp(`^${UNIDADES}$`, 'i').test(proximo)
      const partes = toks
        .slice(0, tr.iu)
        .filter((tk, k) => !/^R\$$/i.test(tk.s) && (k !== tr.iq || qComUnidade))
        .map((tk) => tk.s)
      const { texto: semEmb, embalagem } = tirarEmbalagem(partes.join(' '), tr.q, formatoOrcamento)
      const nome = limparNome(semEmb)
      ancoras.push({
        l, i, nome, tem: temLetras(nome), item: null,
        q: tr.q, u: tr.u, t: tr.t, emb: embalagem,
      })
      return
    }

    if (toks.some((t) => t.dinheiro)) {
      // tem preço mas a conta não fecha (desconto, formato antigo): usa a leitura antiga
      const velho = interpretarLinhaPdf(l.texto)
      if (velho) {
        ancoras.push({
          l, i, nome: velho.nome, tem: true, item: velho,
          q: 0, u: velho.unitario, t: velho.total ?? 0, emb: velho.embalagem,
        })
      }
      return
    }

    // linha sem números: pode ser pedaço de descrição
    if (pareceCabecalho(l.texto) || /marca\s*:|barras\s*:/i.test(l.texto)) return
    soltas.push({ l, i })
  })

  if (ancoras.length === 0) return []

  // espaçamento típico entre linhas e coluna da descrição
  const difs: number[] = []
  for (let k = 1; k < linhas.length; k++) {
    if (linhas[k].pag !== linhas[k - 1].pag) continue
    const d = Math.abs(linhas[k - 1].y - linhas[k].y)
    if (d > 2) difs.push(d)
  }
  difs.sort((a, b) => a - b)
  const med = difs.length ? difs[Math.floor(difs.length / 2)] : 12

  const xs = ancoras
    .filter((a) => a.tem && a.l.descX != null)
    .map((a) => a.l.descX as number)
    .sort((a, b) => a - b)
  const descXRef = xs.length ? xs[Math.floor(xs.length / 2)] : null

  // a quem pertence cada linha solta de descrição
  const lead = new Map<Ancora, { l: LinhaY; i: number }[]>()
  const cont = new Map<Ancora, { l: LinhaY; i: number }[]>()
  const guardar = (m: Map<Ancora, { l: LinhaY; i: number }[]>, a: Ancora, s: { l: LinhaY; i: number }) =>
    m.set(a, [...(m.get(a) ?? []), s])

  for (const s of soltas) {
    let P: Ancora | null = null
    let N: Ancora | null = null
    for (const a of ancoras) {
      if (a.l.pag !== s.l.pag) continue
      if (a.i < s.i) P = a
      else if (a.i > s.i && !N) N = a
    }
    let dono: Ancora
    let modo: 'lead' | 'cont'
    if (P && N) {
      if (P.tem && !N.tem) {
        // o de baixo não tem descrição: o mais perto leva
        const naoN = Math.abs(s.l.y - P.l.y) <= Math.abs(s.l.y - N.l.y)
        dono = naoN ? P : N
        modo = naoN ? 'cont' : 'lead'
      } else if (P.tem || N.tem) {
        dono = P
        modo = 'cont'
      } else {
        dono = N
        modo = 'lead' // "descrição em cima, números embaixo"
      }
    } else if (P) {
      dono = P
      modo = 'cont'
    } else if (N && !N.tem) {
      dono = N
      modo = 'lead'
    } else continue

    // continuação só vale se começa na coluna da descrição (não pega rodapé)
    if (
      modo === 'cont' &&
      descXRef !== null &&
      s.l.x0 !== undefined &&
      Math.abs(s.l.x0 - descXRef) > 8
    )
      continue
    guardar(modo === 'cont' ? cont : lead, dono, s)
  }

  const itens: LinhaPdf[] = []
  for (const a of ancoras) {
    // continuação: encadeada, cada linha perto da anterior
    const depois: string[] = []
    let ultimo = a.l.y
    for (const s of (cont.get(a) ?? []).sort((x, y) => x.i - y.i)) {
      if (Math.abs(s.l.y - ultimo) > 1.6 * med) break
      depois.push(s.l.texto)
      ultimo = s.l.y
    }
    // descrição acima dos números: da mais próxima para a mais distante
    const antes: string[] = []
    ultimo = a.l.y
    for (const s of (lead.get(a) ?? []).sort((x, y) => y.i - x.i)) {
      if (Math.abs(s.l.y - ultimo) > 4 * med) break
      antes.unshift(s.l.texto)
      ultimo = s.l.y
    }

    let nome = [...antes, a.nome, ...depois].join(' ').replace(/\s+/g, ' ').trim()
    if (CODIGO.test(a.l.texto.trim())) nome = nome.replace(/\s+-\s+\S+$/, '').trim()
    if (!temLetras(nome)) continue

    if (a.item) {
      itens.push({ ...a.item, nome })
    } else {
      itens.push({
        nome,
        embalagem: a.emb,
        quantidade: a.q,
        unitario: a.u,
        total: a.t,
        unitarioPor: 'caixa', // a conta fecha por quantidade: o unitário é da mesma unidade
      })
    }
  }
  return itens
}

// ---------- escolha da melhor leitura ----------

// item com conta que fecha (quantidade × unitário = total) vale 1; sem conferência vale 0,4
function pontuar(itens: LinhaPdf[]): number {
  return itens.reduce((soma, l) => {
    const fecha =
      l.total !== null &&
      l.quantidade !== null &&
      l.quantidade > 0 &&
      Math.abs(l.quantidade * l.unitario - l.total) <= Math.max(0.05, l.total * 0.02)
    return soma + (fecha ? 1 : 0.4)
  }, 0)
}

// em empate vale a primeira da lista (as leituras antigas), então o que já funcionava continua igual
export function escolherLeitura(
  candidatos: { nome: string; itens: LinhaPdf[] }[]
): { nome: string; itens: LinhaPdf[] } {
  let melhor = candidatos[0]
  let pontos = pontuar(melhor.itens)
  for (const c of candidatos.slice(1)) {
    const p = pontuar(c.itens)
    if (p > pontos + 0.01) {
      melhor = c
      pontos = p
    }
  }
  // mesma quantidade de itens, mesmos preços e embalagens: só o nome pode mudar, então
  // vale o mais completo (ex.: descrição que quebra em 2 linhas)
  const mesmosPrecos = (a: LinhaPdf[], b: LinhaPdf[]) =>
    a.length === b.length &&
    a.every((l, i) => l.unitario === b[i].unitario && l.embalagem === b[i].embalagem)
  const tamanho = (itens: LinhaPdf[]) => itens.reduce((n, l) => n + l.nome.length, 0)
  for (const c of candidatos) {
    // só troca se o nome novo é o antigo com texto a mais no final (continuação da descrição)
    const soCompleta = (a: LinhaPdf[], b: LinhaPdf[]) => a.every((l, i) => l.nome.startsWith(b[i].nome))
    if (
      c !== melhor &&
      mesmosPrecos(c.itens, melhor.itens) &&
      soCompleta(c.itens, melhor.itens) &&
      tamanho(c.itens) > tamanho(melhor.itens)
    )
      melhor = c
  }
  return melhor
}

// lê o PDF e devolve só as linhas que têm preço
export async function extrairItensDoPdf(arquivo: File): Promise<LinhaPdf[]> {
  const pdf = await abrirPdf(arquivo)
  const linhas = await linhasComY(pdf)

  // cada fornecedor monta o PDF de um jeito: tenta todas as leituras e fica com a que
  // fecha mais contas, em vez de aceitar a primeira que achar qualquer coisa
  const candidatos = [
    { nome: 'tabela', itens: interpretarPedidoTabela(await textoCorrido(pdf)) },
    { nome: 'linhas', itens: itensPorLinha(linhas) },
    { nome: 'generico', itens: itensGenerico(linhas) },
  ]
  const escolhida = escolherLeitura(candidatos)

  // para diagnóstico: abra o console do navegador (F12)
  console.debug(
    '[lerPdf] leitura:',
    escolhida.nome,
    candidatos.map((c) => `${c.nome}=${c.itens.length}`).join(' '),
    linhas.map((l) => `${l.pag}|${l.y.toFixed(1)}|${(l.x0 ?? 0).toFixed(0)}|${l.texto}`)
  )
  return escolhida.itens
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