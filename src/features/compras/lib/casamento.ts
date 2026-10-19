import { normalizar } from '@/features/historico-precos/utils/estatisticas'
import type { ItemNota } from './nfe'
import { chaveItem } from './compras'

export type ComoCasou = 'manual' | 'ean' | 'nome' | 'parecido'

const arred2 = (n: number) => Math.round(n * 100) / 100

// como o item da nota é guardado nos vínculos: pelo código do fornecedor ou, sem ele, pelo nome
export const chaveNota = (i: Pick<ItemNota, 'codigo' | 'nome'>) =>
  i.codigo.trim() ? `c:${i.codigo.trim()}` : `n:${normalizar(i.nome)}`

// junta o mesmo produto quando aparece em mais de uma linha ou em mais de uma nota
export function agruparItensNota(itens: ItemNota[]): ItemNota[] {
  const juntos = new Map<string, ItemNota>()

  for (const i of itens) {
    const chave = chaveNota(i)
    const atual = juntos.get(chave)

    if (!atual) {
      juntos.set(chave, { ...i })
      continue
    }

    const q = atual.quantidade + i.quantidade
    const sub = atual.subtotal + i.subtotal
    juntos.set(chave, {
      ...atual,
      ean: atual.ean || i.ean,
      quantidade: q,
      subtotal: arred2(sub),
      preco: q > 0 ? Math.round((sub / q) * 10000) / 10000 : atual.preco,
    })
  }

  return [...juntos.values()]
}

const palavras = (s: string) =>
  new Set(normalizar(s).split(' ').filter((t) => t.length > 1 || /\d/.test(t)))

function parecido(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0
  let comuns = 0
  for (const t of a) if (b.has(t)) comuns++
  return comuns / (a.size + b.size - comuns)
}

interface ItemDoPedido {
  produto_codigo: string | null
  produto_nome: string
}

// liga cada item do pedido ao item da nota. Devolve: posição no pedido -> posição na nota.
// Ordem de confiança: ligação manual, código de barras, nome igual e, por último, nome parecido.
export function casar(
  pedido: ItemDoPedido[],
  daNota: ItemNota[],
  barcodes: Map<string, string>, // código do catálogo -> código de barras
  vinculos: Map<string, string> // chave do item da nota -> chave do item do pedido
): Map<number, { ni: number; como: ComoCasou }> {
  const pares = new Map<number, { ni: number; como: ComoCasou }>()
  const usadas = new Set<number>()
  const chavesPedido = pedido.map((p) => chaveItem(p.produto_codigo, p.produto_nome))

  // 0) ligações que o dono fez à mão
  daNota.forEach((n, ni) => {
    const alvo = vinculos.get(chaveNota(n))
    if (!alvo) return
    const pi = chavesPedido.findIndex((k, i) => k === alvo && !pares.has(i))
    if (pi >= 0) {
      pares.set(pi, { ni, como: 'manual' })
      usadas.add(ni)
    }
  })

  // 1) código de barras
  pedido.forEach((p, pi) => {
    if (pares.has(pi)) return
    const barras = p.produto_codigo ? barcodes.get(p.produto_codigo) : undefined
    if (!barras) return
    const ni = daNota.findIndex((n, i) => !usadas.has(i) && n.ean === barras)
    if (ni >= 0) {
      pares.set(pi, { ni, como: 'ean' })
      usadas.add(ni)
    }
  })

  // 2) nome igual
  pedido.forEach((p, pi) => {
    if (pares.has(pi)) return
    const alvo = normalizar(p.produto_nome)
    const ni = daNota.findIndex((n, i) => !usadas.has(i) && normalizar(n.nome) === alvo)
    if (ni >= 0) {
      pares.set(pi, { ni, como: 'nome' })
      usadas.add(ni)
    }
  })

  // 3) nome parecido (os pares mais parecidos primeiro)
  const candidatos: { pi: number; ni: number; nota: number }[] = []
  pedido.forEach((p, pi) => {
    if (pares.has(pi)) return
    const a = palavras(p.produto_nome)
    daNota.forEach((n, ni) => {
      if (usadas.has(ni)) return
      const nota = parecido(a, palavras(n.nome))
      if (nota >= 0.6) candidatos.push({ pi, ni, nota })
    })
  })
  candidatos.sort((x, y) => y.nota - x.nota)

  for (const c of candidatos) {
    if (pares.has(c.pi) || usadas.has(c.ni)) continue
    pares.set(c.pi, { ni: c.ni, como: 'parecido' })
    usadas.add(c.ni)
  }

  return pares
}