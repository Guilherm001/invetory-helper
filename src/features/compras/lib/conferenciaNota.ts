import { normalizar } from '@/features/historico-precos/utils/estatisticas'
import { formatarCnpj, formatarCpf } from '@/features/clientes/lib/documentos'
import { numeroTexto, reais } from '@/features/loja/lib/formatar'
import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import type { DivergenciaAceita, NotaCompra } from '../services/notasService'
import type { ItemNota } from './nfe'
import {
  agruparItensNota,
  casar,
  chaveNota,
  similaridade,
  type ComoCasou,
} from './casamento'

const arred2 = (n: number) => Math.round(n * 100) / 100
const arred3 = (n: number) => Math.round(n * 1000) / 1000
const soAlfanum = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')
const fmtDoc = (d: string) => (d.length <= 11 ? formatarCpf(d) : formatarCnpj(d))

// ---------- valor: nota contra pedido ----------

export function diferencaDeValor(
  pedido: PedidoCompra,
  itens: ItemPedidoCompra[],
  notas: NotaCompra[]
) {
  const totalNotas = arred2(notas.reduce((s, n) => s + n.valor, 0))
  const algumRecebido = itens.some((i) => i.quantidade_recebida > 0)
  const valorRecebido = itens.reduce((s, i) => s + i.quantidade_recebida * i.preco_unitario, 0)

  // pedido todo ou, se só chegou uma parte, só o que já foi recebido
  const esperado = algumRecebido
    ? arred2(valorRecebido + (pedido.status === 'recebido' ? pedido.frete - pedido.desconto : 0))
    : pedido.total

  return {
    totalNotas,
    esperado,
    dif: arred2(totalNotas - esperado),
    parcial: algumRecebido && pedido.status !== 'recebido',
  }
}

// ---------- avisos (valor e emitente) ----------

export interface AlertaNota {
  nivel: 'ok' | 'aviso'
  texto: string
  acao?: 'aceitar' | 'desfazer'
}

export function alertasDasNotas(
  pedido: PedidoCompra,
  itens: ItemPedidoCompra[],
  notas: NotaCompra[],
  docFornecedor: string | null,
  aceita: DivergenciaAceita | null = null
): AlertaNota[] {
  if (notas.length === 0) return []
  const alertas: AlertaNota[] = []

  const v = diferencaDeValor(pedido, itens, notas)

  if (Math.abs(v.dif) > 0.05) {
    const sentido = v.dif > 0 ? 'a mais' : 'a menos'

    if (aceita && Math.abs(v.dif - aceita.dif) <= 0.05) {
      alertas.push({
        nivel: 'ok',
        acao: 'desfazer',
        texto: `Diferença de ${reais(Math.abs(v.dif))} ${sentido} na nota, aceita${
          aceita.por ? ` por ${aceita.por}` : ''
        }${aceita.em ? ` em ${new Date(aceita.em).toLocaleDateString('pt-BR')}` : ''}${
          aceita.obs ? `: ${aceita.obs}` : ''
        }.`,
      })
    } else {
      alertas.push({
        nivel: 'aviso',
        acao: 'aceitar',
        texto: `O valor das notas (${reais(v.totalNotas)}) é ${reais(Math.abs(v.dif))} ${
          v.dif > 0 ? 'maior' : 'menor'
        } que o esperado (${reais(v.esperado)}${
          v.parcial ? ', só do que já foi recebido' : ''
        }). Frete, impostos ou itens fora do pedido costumam explicar a diferença.`,
      })
    }
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
  pedido: ItemPedidoCompra
  nota: ItemNota
  como: ComoCasou
  notaChave: string
  difPreco: number | null // % da nota contra o pedido
  difQtd: number | null // nota - pedido
  recebidoDiferente: boolean
  unidadeDiferente: boolean
}

export interface Sugestao {
  pedido: ItemPedidoCompra
  nota: ItemNota
  motivos: string[]
  pontos: number
}

export interface ResultadoConferencia {
  pares: LinhaConferencia[] // reconhecidos com segurança
  soPedido: ItemPedidoCompra[]
  soNota: ItemNota[]
  sugestoes: Sugestao[] // prováveis pares entre os que sobraram
  precoDifere: number
  qtdDifere: number
  notasSemXml: number
}

// entre os itens sem par, acha os que provavelmente são o mesmo produto:
// pelo nome, pela mesma quantidade com preço parecido e pelo mesmo valor total
function sugerirPares(soPedido: ItemPedidoCompra[], soNota: ItemNota[]): Sugestao[] {
  const candidatos: Sugestao[] = []

  for (const p of soPedido) {
    for (const n of soNota) {
      const nome = similaridade(p.produto_nome, n.nome)

      const mesmoTotal =
        p.subtotal > 0 &&
        n.subtotal > 0 &&
        Math.abs(p.subtotal - n.subtotal) / Math.max(p.subtotal, n.subtotal) <= 0.015

      const mesmaQtdPreco =
        p.preco_unitario > 0 &&
        Math.abs(p.quantidade - n.quantidade) < 0.0005 &&
        Math.abs(n.preco - p.preco_unitario) / p.preco_unitario <= 0.05

      const pontos = nome + (mesmoTotal ? 0.6 : 0) + (mesmaQtdPreco ? 0.4 : 0)
      const aceita =
        nome >= 0.6 || (pontos >= 0.8 && (nome >= 0.2 || (mesmoTotal && mesmaQtdPreco)))
      if (!aceita) continue

      const motivos: string[] = []
      if (nome >= 0.3) motivos.push('nomes parecidos')
      if (mesmaQtdPreco) motivos.push('mesma quantidade e preço parecido')
      if (mesmoTotal) motivos.push('mesmo valor total')

      candidatos.push({ pedido: p, nota: n, motivos, pontos })
    }
  }

  // os mais prováveis primeiro; cada item entra em um par só
  candidatos.sort((a, b) => b.pontos - a.pontos)
  const usadosPedido = new Set<string>()
  const usadosNota = new Set<string>()
  const saida: Sugestao[] = []

  for (const c of candidatos) {
    const chave = chaveNota(c.nota)
    if (usadosPedido.has(c.pedido.id) || usadosNota.has(chave)) continue
    usadosPedido.add(c.pedido.id)
    usadosNota.add(chave)
    saida.push(c)
  }

  return saida
}

export function conferirItens(
  pedidoItens: ItemPedidoCompra[],
  notas: NotaCompra[],
  barcodes: Map<string, string>,
  vinculos: Map<string, string>
): ResultadoConferencia {
  const daNota = agruparItensNota(notas.flatMap((n) => n.itens))
  // nome parecido NÃO liga sozinho aqui: vira sugestão, porque a ligação pode alterar o pedido
  const mapaPares = casar(pedidoItens, daNota, barcodes, vinculos, { parecido: false })
  const usadasNota = new Set([...mapaPares.values()].map((p) => p.ni))

  const algumRecebido = pedidoItens.some((i) => i.quantidade_recebida > 0)

  const pares: LinhaConferencia[] = []
  pedidoItens.forEach((p, pi) => {
    const par = mapaPares.get(pi)
    if (!par) return
    const n = daNota[par.ni]

    const difPreco =
      p.preco_unitario > 0 && Math.abs(n.preco - p.preco_unitario) >= 0.01
        ? Math.round(((n.preco - p.preco_unitario) / p.preco_unitario) * 1000) / 10
        : null
    const difQtd =
      Math.abs(n.quantidade - p.quantidade) > 0.0005 ? arred3(n.quantidade - p.quantidade) : null

    pares.push({
      id: `p:${p.id}`,
      pedido: p,
      nota: n,
      como: par.como,
      notaChave: chaveNota(n),
      difPreco,
      difQtd,
      recebidoDiferente: algumRecebido && Math.abs(p.quantidade_recebida - n.quantidade) > 0.0005,
      unidadeDiferente:
        !!n.unidade && !!p.unidade && normalizar(n.unidade) !== normalizar(p.unidade),
    })
  })

  const soPedido = pedidoItens.filter((_, pi) => !mapaPares.has(pi))
  const soNota = daNota.filter((_, ni) => !usadasNota.has(ni))

  // o que tem diferença aparece primeiro
  const problema = (l: LinhaConferencia) =>
    l.difPreco !== null || l.difQtd !== null || l.recebidoDiferente
  const ordenadas = pares
    .map((l, i) => ({ l, i }))
    .sort((a, b) => Number(problema(b.l)) - Number(problema(a.l)) || a.i - b.i)
    .map((x) => x.l)

  return {
    pares: ordenadas,
    soPedido,
    soNota,
    sugestoes: sugerirPares(soPedido, soNota),
    precoDifere: pares.filter((l) => l.difPreco !== null).length,
    qtdDifere: pares.filter((l) => l.difQtd !== null).length,
    notasSemXml: notas.filter((n) => n.itens.length === 0).length,
  }
}

// ---------- ajuste do pedido pela nota ----------

export interface Ajuste {
  itemId: string
  nome: string
  de: { quantidade: number; preco: number; subtotal: number; unidade: string | null }
  para: { quantidade: number; preco: number; subtotal: number }
  aviso: string | null
}

// o que mudaria em cada item reconhecido para o pedido ficar igual à nota
export function calcularAjustes(pares: LinhaConferencia[]): Ajuste[] {
  const lista: Ajuste[] = []

  for (const l of pares) {
    const p = l.pedido
    const n = l.nota

    // unidade diferente (pedido em PC, nota em PT): mantém a quantidade do pedido
    // e acerta só o preço, para o total ficar igual ao da nota
    const quantidade = l.unidadeDiferente && p.quantidade > 0 ? p.quantidade : n.quantidade
    const precoExato = quantidade > 0 ? n.subtotal / quantidade : n.preco
    const preco = Math.round(precoExato * 1e6) / 1e6
    const subtotal = arred2(quantidade * preco)

    const mudou =
      Math.abs(quantidade - p.quantidade) > 0.0005 || Math.abs(subtotal - p.subtotal) > 0.005
    if (!mudou) continue

    const avisos: string[] = []
    if (l.unidadeDiferente)
      avisos.push(
        `Unidade diferente (pedido em ${p.unidade}, nota em ${n.unidade}): a quantidade do pedido foi mantida e o preço acertado para o total da nota.`
      )
    if (p.quantidade_recebida > 0 && Math.abs(p.quantidade_recebida - quantidade) > 0.0005)
      avisos.push(
        `Você recebeu ${numeroTexto(p.quantidade_recebida)}, e o pedido ficará com ${numeroTexto(quantidade)}.`
      )

    lista.push({
      itemId: p.id,
      nome: p.produto_nome,
      de: {
        quantidade: p.quantidade,
        preco: p.preco_unitario,
        subtotal: p.subtotal,
        unidade: p.unidade,
      },
      para: { quantidade, preco, subtotal },
      aviso: avisos.length > 0 ? avisos.join(' ') : null,
    })
  }

  return lista
}