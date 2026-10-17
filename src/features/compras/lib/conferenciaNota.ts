import { normalizar } from '@/features/historico-precos/utils/estatisticas'
import { formatarCnpj, formatarCpf } from '@/features/clientes/lib/documentos'
import { reais } from '@/features/loja/lib/formatar'
import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import type { NotaCompra } from '../services/notasService'
import type { ItemNota } from './nfe'

const arred2 = (n: number) => Math.round(n * 100) / 100
const arred3 = (n: number) => Math.round(n * 1000) / 1000
const soAlfanum = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')
const fmtDoc = (d: string) => (d.length <= 11 ? formatarCpf(d) : formatarCnpj(d))

// ---------- avisos (valor e emitente) ----------

export interface AlertaNota {
  nivel: 'ok' | 'aviso'
  texto: string
}

export function alertasDasNotas(
  pedido: PedidoCompra,
  itens: ItemPedidoCompra[],
  notas: NotaCompra[],
  docFornecedor: string | null
): AlertaNota[] {
  if (notas.length === 0) return []
  const alertas: AlertaNota[] = []

  // valor: contra o pedido todo ou, se só chegou uma parte, contra o que já foi recebido
  const totalNotas = arred2(notas.reduce((s, n) => s + n.valor, 0))
  const algumRecebido = itens.some((i) => i.quantidade_recebida > 0)
  const valorRecebido = itens.reduce((s, i) => s + i.quantidade_recebida * i.preco_unitario, 0)
  const esperado = algumRecebido
    ? arred2(valorRecebido + (pedido.status === 'recebido' ? pedido.frete - pedido.desconto : 0))
    : pedido.total
  const dif = arred2(totalNotas - esperado)

  if (Math.abs(dif) > 0.05) {
    alertas.push({
      nivel: 'aviso',
      texto: `O valor das notas (${reais(totalNotas)}) é ${reais(Math.abs(dif))} ${
        dif > 0 ? 'maior' : 'menor'
      } que o esperado (${reais(esperado)}${
        algumRecebido && pedido.status !== 'recebido' ? ', só do que já foi recebido' : ''
      }). Frete, impostos ou itens fora do pedido costumam explicar a diferença.`,
    })
  } else {
    alertas.push({ nivel: 'ok', texto: 'O valor das notas confere com o pedido.' })
  }

  // emitente: contra o CNPJ cadastrado no fornecedor
  const alvo = soAlfanum(docFornecedor ?? '')
  if (alvo) {
    for (const n of notas) {
      const doc = soAlfanum(n.emitente_doc ?? '')
      if (!doc || doc === alvo) continue

      const mesmaRaiz = doc.length === 14 && alvo.length === 14 && doc.slice(0, 8) === alvo.slice(0, 8)
      alertas.push({
        nivel: 'aviso',
        texto: mesmaRaiz
          ? `A nota ${n.numero} foi emitida por outra filial do fornecedor (${fmtDoc(doc)}; cadastrado: ${fmtDoc(alvo)}).`
          : `O CNPJ do emitente da nota ${n.numero} (${fmtDoc(doc)}) é diferente do cadastrado no fornecedor (${fmtDoc(alvo)}).`,
      })
    }
  }

  return alertas
}

// ---------- conferência item a item (pedido x nota x recebido) ----------

export interface LinhaConferencia {
  id: string
  pedido: ItemPedidoCompra | null
  nota: ItemNota | null
  como: 'ean' | 'nome' | 'parecido' | null
  difPreco: number | null // % da nota contra o pedido
  difQtd: number | null // nota - pedido
  recebidoDiferente: boolean
  unidadeDiferente: boolean
}

export interface ResultadoConferencia {
  linhas: LinhaConferencia[]
  precoDifere: number
  qtdDifere: number
  soNota: number
  soPedido: number
  notasSemXml: number
}

const palavras = (s: string) =>
  new Set(normalizar(s).split(' ').filter((t) => t.length > 1 || /\d/.test(t)))

function parecido(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0
  let comuns = 0
  for (const t of a) if (b.has(t)) comuns++
  return comuns / (a.size + b.size - comuns)
}

export function conferirItens(
  pedidoItens: ItemPedidoCompra[],
  notas: NotaCompra[],
  barcodes: Map<string, string>
): ResultadoConferencia {
  // junta o mesmo produto de várias notas (entrega em partes)
  const juntos = new Map<string, ItemNota>()
  for (const n of notas) {
    for (const i of n.itens) {
      const k = i.ean ? `e:${i.ean}` : `n:${normalizar(i.nome)}`
      const atual = juntos.get(k)
      if (atual) {
        const q = atual.quantidade + i.quantidade
        const sub = atual.subtotal + i.subtotal
        juntos.set(k, {
          ...atual,
          quantidade: q,
          subtotal: arred2(sub),
          preco: q > 0 ? Math.round((sub / q) * 10000) / 10000 : atual.preco,
        })
      } else {
        juntos.set(k, { ...i })
      }
    }
  }
  const daNota = [...juntos.values()]

  const pares = new Map<number, { ni: number; como: 'ean' | 'nome' | 'parecido' }>()
  const usadas = new Set<number>()

  // 1) código de barras
  pedidoItens.forEach((p, pi) => {
    const barras = p.produto_codigo ? barcodes.get(p.produto_codigo) : undefined
    if (!barras) return
    const ni = daNota.findIndex((n, i) => !usadas.has(i) && n.ean === barras)
    if (ni >= 0) {
      pares.set(pi, { ni, como: 'ean' })
      usadas.add(ni)
    }
  })

  // 2) nome igual
  pedidoItens.forEach((p, pi) => {
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
  pedidoItens.forEach((p, pi) => {
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

  const algumRecebido = pedidoItens.some((i) => i.quantidade_recebida > 0)

  const linhas: LinhaConferencia[] = pedidoItens.map((p, pi) => {
    const par = pares.get(pi)
    const n = par ? daNota[par.ni] : null

    const difPreco =
      n && p.preco_unitario > 0 && Math.abs(n.preco - p.preco_unitario) >= 0.01
        ? Math.round(((n.preco - p.preco_unitario) / p.preco_unitario) * 1000) / 10
        : null
    const difQtd = n && Math.abs(n.quantidade - p.quantidade) > 0.0005 ? arred3(n.quantidade - p.quantidade) : null

    return {
      id: `p:${p.id}`,
      pedido: p,
      nota: n,
      como: par?.como ?? null,
      difPreco,
      difQtd,
      recebidoDiferente: !!n && algumRecebido && Math.abs(p.quantidade_recebida - n.quantidade) > 0.0005,
      unidadeDiferente: !!n && !!n.unidade && !!p.unidade && normalizar(n.unidade) !== normalizar(p.unidade),
    }
  })

  daNota.forEach((n, ni) => {
    if (usadas.has(ni)) return
    linhas.push({
      id: `n:${ni}`,
      pedido: null,
      nota: n,
      como: null,
      difPreco: null,
      difQtd: null,
      recebidoDiferente: false,
      unidadeDiferente: false,
    })
  })

  // o que tem problema aparece primeiro
  const problema = (l: LinhaConferencia) =>
    l.difPreco !== null || l.difQtd !== null || l.recebidoDiferente || !l.pedido || !l.nota
  const ordenadas = linhas
    .map((l, i) => ({ l, i }))
    .sort((a, b) => Number(problema(b.l)) - Number(problema(a.l)) || a.i - b.i)
    .map((x) => x.l)

  return {
    linhas: ordenadas,
    precoDifere: linhas.filter((l) => l.difPreco !== null).length,
    qtdDifere: linhas.filter((l) => l.difQtd !== null).length,
    soNota: linhas.filter((l) => !l.pedido).length,
    soPedido: linhas.filter((l) => !l.nota).length,
    notasSemXml: notas.filter((n) => n.itens.length === 0).length,
  }
}