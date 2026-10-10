import type { Fornecedor, ItemComparacao, Preco } from '../types'

// evita 0,1 + 0,2 = 0,30000000000000004
const arredondar = (n: number) => Math.round(n * 100) / 100

export const chave = (itemId: string, fornecedorId: string) => `${itemId}|${fornecedorId}`

export type MapaPrecos = Map<string, number>

export function montarMapa(precos: Preco[]): MapaPrecos {
  return new Map(precos.map((p) => [chave(p.item_id, p.supplier_id), Number(p.price)]))
}

// ---------- tipos do resultado ----------

export interface LinhaItem {
  item: ItemComparacao
  menor: number | null // menor preço desta linha
  vencedores: string[] // fornecedores com o menor preço (pode haver empate)
  comparavel: boolean // só destaca quando há pelo menos 2 preços para comparar
}

export interface TotalFornecedor {
  fornecedor: Fornecedor
  total: number // soma dos itens que ele cotou (quantidade x preço)
  cotados: number // quantos itens ele cotou
  faltando: number // quantos itens ele não cotou
  completo: boolean // cotou todos os itens
}

export interface PedidoSugerido {
  fornecedor: Fornecedor
  itens: { item: ItemComparacao; preco: number; subtotal: number }[]
  subtotal: number
}

export interface Analise {
  linhas: Map<string, LinhaItem> // por id do item
  ranking: TotalFornecedor[] // completos primeiro (do mais barato), depois os incompletos
  melhorUnico: TotalFornecedor | null // fornecedor completo mais barato
  totalMisto: number | null // comprando o menor preço de cada item
  mistoCompleto: boolean // todos os itens têm pelo menos um preço
  itensSemPreco: number
  economia: number | null // melhorUnico - totalMisto
  economiaPercentual: number | null
  pedidos: PedidoSugerido[] // como dividir a compra entre fornecedores
}

// ---------- cálculo ----------

export function analisar(
  itens: ItemComparacao[],
  fornecedores: Fornecedor[],
  precos: Preco[]
): Analise {
  const mapa = montarMapa(precos)
  const linhas = new Map<string, LinhaItem>()

  // 1) menor preço de cada item
  for (const item of itens) {
    let menor: number | null = null
    let vencedores: string[] = []
    let cotacoes = 0

    for (const f of fornecedores) {
      const p = mapa.get(chave(item.id, f.id))
      if (p === undefined) continue
      cotacoes++

      if (menor === null || p < menor) {
        menor = p
        vencedores = [f.id]
      } else if (p === menor) {
        vencedores.push(f.id)
      }
    }

    linhas.set(item.id, { item, menor, vencedores, comparavel: cotacoes >= 2 })
  }

  // 2) total de cada fornecedor
  const totais: TotalFornecedor[] = fornecedores.map((fornecedor) => {
    let total = 0
    let cotados = 0

    for (const item of itens) {
      const p = mapa.get(chave(item.id, fornecedor.id))
      if (p === undefined) continue
      total += p * item.quantity
      cotados++
    }

    return {
      fornecedor,
      total: arredondar(total),
      cotados,
      faltando: itens.length - cotados,
      completo: itens.length > 0 && cotados === itens.length,
    }
  })

  // completos primeiro, do mais barato; depois quem cotou mais itens
  const ranking = [...totais].sort((a, b) => {
    if (a.completo !== b.completo) return a.completo ? -1 : 1
    if (a.completo) return a.total - b.total
    return a.faltando - b.faltando || a.total - b.total
  })

  const melhorUnico = ranking.find((t) => t.completo) ?? null

  // 3) comprando o menor preço de cada item (empate fica com o primeiro da lista)
  const pedidosPorFornecedor = new Map<string, PedidoSugerido>()
  let totalMisto = 0
  let itensSemPreco = 0

  for (const item of itens) {
    const linha = linhas.get(item.id)!
    if (linha.menor === null) {
      itensSemPreco++
      continue
    }

    const fornecedor = fornecedores.find((f) => f.id === linha.vencedores[0])!
    const subtotal = arredondar(linha.menor * item.quantity)
    totalMisto += subtotal

    const pedido = pedidosPorFornecedor.get(fornecedor.id) ?? {
      fornecedor,
      itens: [],
      subtotal: 0,
    }
    pedido.itens.push({ item, preco: linha.menor, subtotal })
    pedido.subtotal = arredondar(pedido.subtotal + subtotal)
    pedidosPorFornecedor.set(fornecedor.id, pedido)
  }

  totalMisto = arredondar(totalMisto)

  const pedidos = [...pedidosPorFornecedor.values()].sort((a, b) => b.subtotal - a.subtotal)

  // 4) economia: só é justa quando os dois lados cobrem todos os itens
  const mistoCompleto = itens.length > 0 && itensSemPreco === 0
  let economia: number | null = null
  let economiaPercentual: number | null = null

  if (mistoCompleto && melhorUnico) {
    economia = arredondar(melhorUnico.total - totalMisto)
    economiaPercentual =
      melhorUnico.total > 0 ? Math.round((economia / melhorUnico.total) * 1000) / 10 : 0
  }

  return {
    linhas,
    ranking,
    melhorUnico,
    totalMisto: itens.length > 0 && itensSemPreco < itens.length ? totalMisto : null,
    mistoCompleto,
    itensSemPreco,
    economia,
    economiaPercentual,
    pedidos,
  }
}

// ---------- formatação ----------

export const formatarReais = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// "12,50" ou "1.234,56" -> número | vazio -> null | inválido -> NaN
export function lerPreco(texto: string): number | null {
  const t = texto.trim().replace(/[R$\s]/g, '')
  if (t === '') return null
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return Number(normal)
}