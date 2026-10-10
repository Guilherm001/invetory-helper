import type {
  Cotacao,
  PontoGrafico,
  ProdutoHistorico,
  Rodada,
  SerieFornecedor,
} from '../types'

// variação a partir da qual o item ganha o selo "Preço subiu"
export const LIMITE_ALTA = 5

const arredondar = (n: number) => Math.round(n * 100) / 100
const umaCasa = (n: number) => Math.round(n * 10) / 10

// "Cimento  CP-II" e "cimento cp ii" viram a mesma coisa
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// com código do catálogo é confiável; sem ele, vale o nome normalizado
export function chaveDoProduto(c: Pick<Cotacao, 'codigo' | 'itemNome'>) {
  return c.codigo ? `c:${c.codigo}` : `n:${normalizar(c.itemNome)}`
}

const tempo = (iso: string) => new Date(iso).getTime()

function percentual(de: number, para: number): number | null {
  if (!(de > 0)) return null
  return umaCasa(((para - de) / de) * 100)
}

// ---------- agrupar cotações por produto ----------

export function agrupar(cotacoes: Cotacao[]): ProdutoHistorico[] {
  const grupos = new Map<string, Cotacao[]>()

  for (const c of cotacoes) {
    const chave = chaveDoProduto(c)
    const lista = grupos.get(chave)
    if (lista) lista.push(c)
    else grupos.set(chave, [c])
  }

  const produtos: ProdutoHistorico[] = []

  for (const [chave, lista] of grupos) {
    const ordenadas = [...lista].sort((a, b) => tempo(a.data) - tempo(b.data))
    const maisRecente = ordenadas[ordenadas.length - 1]

    // uma rodada por comparação: vale o menor preço que o item teve nela
    const porComparacao = new Map<string, Rodada>()
    for (const c of ordenadas) {
      const atual = porComparacao.get(c.comparacaoId)
      if (!atual) {
        porComparacao.set(c.comparacaoId, {
          comparacaoId: c.comparacaoId,
          comparacaoNome: c.comparacaoNome,
          data: c.data,
          menor: c.preco,
          fornecedorNome: c.fornecedorNome,
        })
        continue
      }
      // a data da rodada é a da cotação mais recente dela
      if (tempo(c.data) > tempo(atual.data)) atual.data = c.data
      if (c.preco < atual.menor) {
        atual.menor = c.preco
        atual.fornecedorNome = c.fornecedorNome
      }
    }

    const rodadas = [...porComparacao.values()].sort((a, b) => tempo(a.data) - tempo(b.data))
    const ultimaRodada = rodadas[rodadas.length - 1]
    const rodadaAnterior = rodadas.length >= 2 ? rodadas[rodadas.length - 2] : null
    const primeiraRodada = rodadas[0]

    // menor preço de todos os tempos (empate fica com o mais antigo)
    let menorCotacao = ordenadas[0]
    let soma = 0
    for (const c of ordenadas) {
      soma += c.preco
      if (c.preco < menorCotacao.preco) menorCotacao = c
    }

    const variacao = rodadaAnterior ? percentual(rodadaAnterior.menor, ultimaRodada.menor) : null
    const variacaoTotal =
      rodadas.length >= 2 ? percentual(primeiraRodada.menor, ultimaRodada.menor) : null

    produtos.push({
      chave,
      nome: maisRecente.itemNome,
      unidade: [...ordenadas].reverse().find((c) => c.unidade)?.unidade ?? null,
      codigo: [...ordenadas].reverse().find((c) => c.codigo)?.codigo ?? null,

      cotacoes: ordenadas,
      rodadas,

      ultimo: ultimaRodada.menor,
      anterior: rodadaAnterior?.menor ?? null,
      variacao,
      variacaoTotal,
      menor: {
        preco: menorCotacao.preco,
        fornecedorNome: menorCotacao.fornecedorNome,
        data: menorCotacao.data,
      },
      media: arredondar(soma / ordenadas.length),
      ultimaData: maisRecente.data,

      ehMenorHistorico: rodadas.length >= 2 && ultimaRodada.menor <= menorCotacao.preco,
      subiu: variacao !== null && variacao >= LIMITE_ALTA,
    })
  }

  // quem foi cotado há pouco aparece primeiro
  return produtos.sort(
    (a, b) => tempo(b.ultimaData) - tempo(a.ultimaData) || a.nome.localeCompare(b.nome, 'pt-BR')
  )
}

// ---------- busca ----------

// todas as palavras precisam aparecer no nome ou no código
export function filtrar(produtos: ProdutoHistorico[], termo: string) {
  const palavras = normalizar(termo).split(' ').filter(Boolean)
  if (palavras.length === 0) return produtos

  return produtos.filter((p) => {
    const alvo = `${normalizar(p.nome)} ${p.codigo ?? ''}`.toLowerCase()
    return palavras.every((palavra) => alvo.includes(palavra))
  })
}

// ---------- dados do gráfico ----------

// uma linha por fornecedor; no mesmo dia, a última cotação vale
export function seriePorFornecedor(cotacoes: Cotacao[]): {
  fornecedores: SerieFornecedor[]
  pontos: PontoGrafico[]
} {
  const nomes = new Map<string, string>()
  const porDia = new Map<number, PontoGrafico>()

  const ordenadas = [...cotacoes].sort((a, b) => tempo(a.data) - tempo(b.data))

  for (const c of ordenadas) {
    const d = new Date(c.data)
    const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const chave = `f_${c.fornecedorId}`

    nomes.set(chave, c.fornecedorNome)

    const ponto = porDia.get(dia) ?? ({ data: dia } as PontoGrafico)
    ponto[chave] = c.preco
    porDia.set(dia, ponto)
  }

  return {
    fornecedores: [...nomes].map(([chave, nome]) => ({ chave, nome })),
    pontos: [...porDia.values()].sort((a, b) => a.data - b.data),
  }
}

// ---------- formatação ----------

export const formatarVariacao = (v: number) =>
  `${v > 0 ? '+' : ''}${String(v).replace('.', ',')}%`