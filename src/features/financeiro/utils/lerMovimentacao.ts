import { arredondar, decodificarWindows1252, lerNumero } from './decodificar'
import type { ItemMovimento, ResultadoMovimentacao } from './tipos'

const COLUNAS = [
  'CODIGO',
  'DESCRICAO',
  'VENDIDOS',
  'ICMS',
  'CST',
  'SUBSTITUICAO',
  'TOTAL CUSTO',
  'TOTAL VENDIDO',
] as const

type Coluna = (typeof COLUNAS)[number]
type Indices = Record<Coluna, number>

// célula de texto (csv) ou de planilha (xlsx, onde o número já vem como número)
type Celula = string | number | null | undefined

interface LinhaBruta {
  campos: Celula[]
  alternativa?: Celula[] // 2ª tentativa de leitura (só no csv)
  original: string // para mostrar nos avisos
}

const texto = (v: Celula) => (v === null || v === undefined ? '' : String(v)).trim()
const numero = (v: Celula) => (typeof v === 'number' ? v : lerNumero(texto(v)))

// tira acento, espaços repetidos e deixa em maiúsculo
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

// descobre o separador pelo cabeçalho (";" tem preferência em caso de empate)
function detectarSeparador(cabecalho: string): string {
  let melhor = ';'
  let max = -1
  for (const op of [';', '\t', ',']) {
    const n = cabecalho.split(op).length - 1
    if (n > max) {
      max = n
      melhor = op
    }
  }
  return melhor
}

// CSV com aspas ("" dentro de aspas = uma aspa).
// Aspa no meio de um campo sem aspas (ex.: TUBO 3/4") é só um caractere do texto.
function dividirLinha(linha: string, sep: string): string[] {
  const campos: string[] = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (aspas) {
      if (ch === '"') {
        const prox = linha[i + 1]
        if (prox === '"') {
          atual += '"'
          i++
        } else if (prox === undefined || prox === sep) {
          aspas = false // aspa que fecha o campo
        } else {
          atual += '"' // aspa solta dentro do campo: é só texto
        }
      } else atual += ch
    } else if (ch === '"' && atual === '') {
      aspas = true // só abre campo entre aspas se estiver no começo do campo
    } else if (ch === sep) {
      campos.push(atual)
      atual = ''
    } else atual += ch
  }
  campos.push(atual)
  return campos
}

// devolve o item se a linha tiver o formato esperado, senão null
function interpretar(c: Celula[], idx: Indices): ItemMovimento | null {
  if (c.length <= Math.max(...Object.values(idx))) return null

  const codigo = texto(c[idx['CODIGO']])
  const vendidos = numero(c[idx['VENDIDOS']])
  const totalCusto = numero(c[idx['TOTAL CUSTO']])
  const totalVendido = numero(c[idx['TOTAL VENDIDO']])
  if (!codigo || [vendidos, totalCusto, totalVendido].some(Number.isNaN)) return null

  return {
    codigo,
    descricao: texto(c[idx['DESCRICAO']]),
    vendidos,
    icms: texto(c[idx['ICMS']]),
    cst: texto(c[idx['CST']]),
    substituicao: texto(c[idx['SUBSTITUICAO']]),
    totalCusto,
    totalVendido,
  }
}

// parte comum: csv e xlsx chegam aqui com o cabeçalho e as linhas já separadas em campos
function montarResultado(cabecalho: Celula[], linhas: LinhaBruta[]): ResultadoMovimentacao {
  const avisos: string[] = []
  const nomes = cabecalho.map((c) => normalizar(texto(c)))

  const faltando = COLUNAS.filter((nome) => !nomes.includes(nome))
  if (faltando.length > 0) {
    throw new Error(
      `Este arquivo não parece ser o relatório certo. Faltam as colunas: ${faltando.join(', ')}.`
    )
  }

  const idx = Object.fromEntries(COLUNAS.map((nome) => [nome, nomes.indexOf(nome)])) as Indices

  const porCodigo = new Map<string, ItemMovimento>()

  for (const linha of linhas) {
    // 1ª tentativa: leitura principal. 2ª: divisão simples pelo separador (só csv)
    const lido =
      interpretar(linha.campos, idx) ??
      (linha.alternativa ? interpretar(linha.alternativa, idx) : null)
    if (!lido) {
      avisos.push(`Linha ignorada (não consegui ler): ${linha.original.slice(0, 80)}`)
      continue
    }

    if (lido.vendidos === 0 && lido.totalCusto === 0 && lido.totalVendido === 0) continue

    const existente = porCodigo.get(lido.codigo)
    if (existente) {
      existente.vendidos += lido.vendidos
      existente.totalCusto += lido.totalCusto
      existente.totalVendido += lido.totalVendido
      avisos.push(`Código ${lido.codigo} aparece mais de uma vez. Os valores foram somados.`)
    } else {
      porCodigo.set(lido.codigo, lido)
    }
  }

  const itens = [...porCodigo.values()]
  if (itens.length === 0) throw new Error('Nenhuma venda encontrada no arquivo.')

  return {
    itens,
    custoTotal: arredondar(itens.reduce((s, i) => s + i.totalCusto, 0)),
    vendaTotal: arredondar(itens.reduce((s, i) => s + i.totalVendido, 0)),
    unidadesVendidas: arredondar(itens.reduce((s, i) => s + i.vendidos, 0)),
    avisos,
  }
}

// ---------- texto delimitado (.csv, ou .txt no mesmo formato) ----------

export function lerMovimentacao(buffer: ArrayBuffer): ResultadoMovimentacao {
  const linhas = decodificarWindows1252(buffer)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')

  const cabecalho = linhas[0] ?? ''
  const sep = detectarSeparador(cabecalho)

  return montarResultado(
    dividirLinha(cabecalho, sep),
    linhas.slice(1).map((linha) => ({
      campos: dividirLinha(linha, sep),
      alternativa: linha.split(sep),
      original: linha,
    }))
  )
}

// ---------- planilha (.xlsx / .xls) ----------

// a biblioteca só é carregada quando alguém importa uma planilha
export async function lerMovimentacaoXlsx(buffer: ArrayBuffer): Promise<ResultadoMovimentacao> {
  const XLSX = await import('xlsx')

  let pasta
  try {
    pasta = XLSX.read(buffer, { type: 'array' })
  } catch {
    throw new Error('Não consegui abrir a planilha.')
  }

  for (const nomeAba of pasta.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json<Celula[]>(pasta.Sheets[nomeAba], {
      header: 1,
      raw: true,
      defval: '',
    })

    // o cabeçalho pode não estar na primeira linha (títulos acima da tabela)
    const posCabecalho = linhas.slice(0, 20).findIndex((l) => {
      const nomes = l.map((c) => normalizar(texto(c)))
      return COLUNAS.every((nome) => nomes.includes(nome))
    })
    if (posCabecalho === -1) continue

    const cabecalho = linhas[posCabecalho]
    const largura = cabecalho.length
    const posCodigo = cabecalho.map((c) => normalizar(texto(c))).indexOf('CODIGO')

    // linhas em branco e linhas de total (sem código) são ignoradas em silêncio
    const dados: LinhaBruta[] = linhas
      .slice(posCabecalho + 1)
      .filter((l) => l.some((c) => texto(c) !== '') && texto(l[posCodigo]) !== '')
      .map((l) => {
        const campos = [...l]
        while (campos.length < largura) campos.push('')
        return { campos, original: campos.join(' ; ') }
      })

    return montarResultado(cabecalho, dados)
  }

  throw new Error(
    `Não encontrei as colunas do relatório na planilha (${COLUNAS.join(', ')}).`
  )
}