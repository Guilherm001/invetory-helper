import { normalizar } from '@/features/historico-precos/utils/estatisticas'
import type { ImpostosNota, ItemNota } from './nfe'
import { chaveItem } from './compras'

export type ComoCasou = 'manual' | 'ean' | 'nome' | 'parecido'

const arred2 = (n: number) => Math.round(n * 100) / 100

// soma dois valores opcionais: se nenhum dos dois existe (nota antiga), continua sem valor
const somar = (a?: number, b?: number) =>
  a === undefined && b === undefined ? undefined : arred2((a ?? 0) + (b ?? 0))

// como o item da nota é guardado nos vínculos: pelo código do fornecedor ou, sem ele, pelo nome
export const chaveNota = (i: Pick<ItemNota, 'codigo' | 'nome'>) =>
  i.codigo.trim() ? `c:${i.codigo.trim()}` : `n:${normalizar(i.nome)}`

// ---------- rateio de impostos (notas salvas antes da leitura por linha) ----------

// Se os itens não trazem imposto próprio (nota antiga), divide o IPI, o ICMS-ST e o
// imposto de importação do cabeçalho entre os itens, proporcional ao subtotal.
// O ICMS próprio NÃO entra (já está dentro do preço) e o frete de rodapé também não:
// ele continua indo para o frete do pedido.
export function ratearImpostos(
  itens: ItemNota[],
  imp: Pick<ImpostosNota, 'ipi' | 'icmsSt' | 'importacao' | 'ipiDevolvido'> | null | undefined
): ItemNota[] {
  if (!imp) return itens
  // já tem imposto por linha: nada a ratear
  if (itens.some((i) => i.totalComImpostos !== undefined)) return itens

  const extra = arred2(
    (imp.ipi ?? 0) + (imp.icmsSt ?? 0) + (imp.importacao ?? 0) + (imp.ipiDevolvido ?? 0)
  )
  const base = itens.reduce((s, i) => s + i.subtotal, 0)
  if (extra <= 0 || base <= 0) return itens

  let restante = extra
  return itens.map((i, idx) => {
    // o último item leva o resto, para a soma fechar no centavo
    const parte = idx === itens.length - 1 ? restante : arred2((i.subtotal / base) * extra)
    restante = arred2(restante - parte)
    return { ...i, totalComImpostos: arred2(i.subtotal + parte) }
  })
}

// itens da nota já com o imposto rateado quando for nota antiga.
// Aceita qualquer nota que tenha `itens` e, opcionalmente, `impostos`.
export function itensDaNota(n: { itens: ItemNota[] }): ItemNota[] {
  const imp = (n as { impostos?: ImpostosNota | null }).impostos
  return ratearImpostos(n.itens, imp)
}

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
      icms: somar(atual.icms, i.icms),
      ipi: somar(atual.ipi, i.ipi),
      icmsSt: somar(atual.icmsSt, i.icmsSt),
      outros: somar(atual.outros, i.outros),
      totalComImpostos: somar(
        atual.totalComImpostos ?? atual.subtotal,
        i.totalComImpostos ?? i.subtotal
      ),
    })
  }

  return [...juntos.values()]
}

const palavras = (s: string) =>
  new Set(normalizar(s).split(' ').filter((t) => t.length > 1 || /\d/.test(t)))

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0
  let comuns = 0
  for (const t of a) if (b.has(t)) comuns++
  return comuns / (a.size + b.size - comuns)
}

// de 0 a 1: quanto dois nomes de produto se parecem
export const similaridade = (a: string, b: string) => jaccard(palavras(a), palavras(b))

interface ItemDoPedido {
  produto_codigo: string | null
  produto_nome: string
}

// liga cada item do pedido ao item da nota. Devolve: posição no pedido -> posição na nota.
// Ordem de confiança: ligação manual, código de barras, nome igual e, por último, nome parecido
// (esse último pode ser desligado com { parecido: false }).
export function casar(
  pedido: ItemDoPedido[],
  daNota: ItemNota[],
  barcodes: Map<string, string>, // código do catálogo -> código de barras
  vinculos: Map<string, string>, // chave do item da nota -> chave do item do pedido
  opcoes: { parecido?: boolean } = {}
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
  if (opcoes.parecido !== false) {
    const candidatos: { pi: number; ni: number; nota: number }[] = []
    pedido.forEach((p, pi) => {
      if (pares.has(pi)) return
      daNota.forEach((n, ni) => {
        if (usadas.has(ni)) return
        const nota = similaridade(p.produto_nome, n.nome)
        if (nota >= 0.6) candidatos.push({ pi, ni, nota })
      })
    })
    candidatos.sort((x, y) => y.nota - x.nota)

    for (const c of candidatos) {
      if (pares.has(c.pi) || usadas.has(c.ni)) continue
      pares.set(c.pi, { ni: c.ni, como: 'parecido' })
      usadas.add(c.ni)
    }
  }

  return pares
}