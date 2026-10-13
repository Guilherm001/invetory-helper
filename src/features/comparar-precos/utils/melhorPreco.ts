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
  cotacoes: number // quantos fornecedores preencheram preço neste item
}

export interface TotalFornecedor {
  fornecedor: Fornecedor
  total: number // soma dos itens que ele cotou (quantidade x preço)
  cotados: number // quantos itens ele cotou
  faltando: number // quantos itens COM PREÇO de outros fornecedores ele não cotou
  completo: boolean // cotou todos os itens que têm preço
}

export interface PedidoSugerido {
  fornecedor: Fornecedor
  itens: { item: ItemComparacao; preco: number; subtotal: number }[]
  subtotal: number
}

export interface Analise {
  linhas: Map<string, LinhaItem> // por id do item
  ranking: TotalFornecedor[] // completos primeiro (do mais barato), depois os incompletos
  // fornecedor completo mais barato; se ninguém for completo, o que cotou mais itens
  // (empate: o mais barato). Nesse caso a análise é uma estimativa (melhorUnicoParcial).
  melhorUnico: TotalFornecedor | null
  melhorUnicoParcial: boolean // true = o melhor único não cotou todos os itens com preço
  totalMisto: number | null // comprando o menor preço de cada item
  mistoCompleto: boolean // todos os itens têm pelo menos um preço
  itensComPreco: number // itens que pelo menos um fornecedor cotou
  itensSemPreco: number // itens que ninguém cotou (ficam fora dos cálculos)
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

    linhas.set(item.id, { item, menor, vencedores, comparavel: cotacoes >= 2, cotacoes })
  }

  // itens que ninguém cotou são ignorados em todos os cálculos abaixo
  const itensComPreco = [...linhas.values()].filter((l) => l.menor !== null).length
  const itensSemPreco = itens.length - itensComPreco

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
      faltando: itensComPreco - cotados,
      completo: itensComPreco > 0 && cotados === itensComPreco,
    }
  })

  // completos primeiro, do mais barato; depois quem cotou mais itens
  const ranking = [...totais].sort((a, b) => {
    if (a.completo !== b.completo) return a.completo ? -1 : 1
    if (a.completo) return a.total - b.total
    return a.faltando - b.faltando || a.total - b.total
  })

  // o ranking já põe os completos (mais baratos) primeiro e, depois deles, quem cotou mais itens
  const melhorUnico = ranking.find((t) => t.cotados > 0) ?? null

  // 3) comprando o menor preço de cada item (empate fica com o primeiro da lista)
  const pedidosPorFornecedor = new Map<string, PedidoSugerido>()
  let totalMisto = 0

  for (const item of itens) {
    const linha = linhas.get(item.id)!
    if (linha.menor === null) continue

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

  // 4) economia: compara os dois lados só nos itens que o melhor fornecedor único cotou.
  //    Itens que ninguém cotou, ou que ele não cotou, não entram em nenhum dos dois totais.
  const mistoCompleto = itens.length > 0 && itensSemPreco === 0
  let economia: number | null = null
  let economiaPercentual: number | null = null

  if (melhorUnico && itensComPreco > 0) {
    let mistoDosDele = 0
    for (const item of itens) {
      if (mapa.get(chave(item.id, melhorUnico.fornecedor.id)) === undefined) continue
      const menor = linhas.get(item.id)!.menor
      if (menor !== null) mistoDosDele += menor * item.quantity
    }
    mistoDosDele = arredondar(mistoDosDele)

    economia = arredondar(melhorUnico.total - mistoDosDele)
    economiaPercentual =
      melhorUnico.total > 0 ? Math.round((economia / melhorUnico.total) * 1000) / 10 : 0
  }

  return {
    linhas,
    ranking,
    melhorUnico,
    melhorUnicoParcial: melhorUnico !== null && !melhorUnico.completo,
    totalMisto: itensComPreco > 0 ? totalMisto : null,
    mistoCompleto,
    itensComPreco,
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