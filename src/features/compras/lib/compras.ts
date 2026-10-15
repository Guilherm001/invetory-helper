import type {
  DadosPedidoCompra,
  ItemEntrada,
  ItemPedidoCompra,
  PedidoCompra,
  StatusCompra,
} from '../services/comprasService'
import { dataCurta, hoje, numeroTexto, reais } from '@/features/loja/lib/formatar'

export const numeroPedido = (n: number) => `PC-${String(n).padStart(4, '0')}`

// "2026-10-18" + 3 dias = "2026-10-21", sem depender do fuso
export function somarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

export const STATUS_INFO: Record<StatusCompra, { texto: string; classe: string }> = {
  rascunho: { texto: 'Rascunho', classe: 'bg-slate-100 text-slate-600' },
  enviado: { texto: 'Enviado', classe: 'bg-sky-50 text-sky-700' },
  confirmado: { texto: 'Confirmado', classe: 'bg-violet-50 text-violet-700' },
  recebido: { texto: 'Recebido', classe: 'bg-emerald-50 text-emerald-700' },
  cancelado: { texto: 'Cancelado', classe: 'bg-red-50 text-red-700' },
}

export function atrasado(p: Pick<PedidoCompra, 'status' | 'previsao_entrega'>) {
  return (
    (p.status === 'enviado' || p.status === 'confirmado') &&
    !!p.previsao_entrega &&
    p.previsao_entrega < hoje()
  )
}

export function diasDeAtraso(previsao: string) {
  const dia = 86_400_000
  const a = Date.parse(`${hoje()}T00:00:00Z`)
  const b = Date.parse(`${previsao}T00:00:00Z`)
  return Math.max(0, Math.round((a - b) / dia))
}

export const PEDIDO_VAZIO: { dados: DadosPedidoCompra; itens: ItemEntrada[] } = {
  dados: {
    fornecedor_ref: null,
    fornecedor_nome: '',
    fornecedor_contato: null,
    prazo_dias: null,
    comparacao_ref: null,
    comparacao_nome: null,
    condicao_pagamento: null,
    previsao_entrega: null,
    frete: 0,
    desconto: 0,
    observacao: null,
  },
  itens: [],
}

export const dadosDoPedido = (p: PedidoCompra): DadosPedidoCompra => ({
  fornecedor_ref: p.fornecedor_ref,
  fornecedor_nome: p.fornecedor_nome,
  fornecedor_contato: p.fornecedor_contato,
  prazo_dias: p.prazo_dias,
  comparacao_ref: p.comparacao_ref,
  comparacao_nome: p.comparacao_nome,
  condicao_pagamento: p.condicao_pagamento,
  previsao_entrega: p.previsao_entrega,
  frete: p.frete,
  desconto: p.desconto,
  observacao: p.observacao,
})

export const itemParaEntrada = (i: ItemPedidoCompra): ItemEntrada => ({
  codigo: i.produto_codigo ?? '',
  nome: i.produto_nome,
  unidade: i.unidade,
  quantidade: i.quantidade,
  preco: i.preco_unitario,
  observacao: i.observacao ?? '',
})

// como o produto é reconhecido nas compras anteriores: pelo código ou, sem ele, pelo nome
export const chaveItem = (codigo: string | null | undefined, nome: string) =>
  codigo && codigo.trim() ? codigo.trim() : nome.trim().toLowerCase()

// texto pronto para o WhatsApp
export function textoWhatsApp(p: PedidoCompra, itens: ItemPedidoCompra[], empresa: string) {
  const L: string[] = [`*Pedido de compra ${numeroPedido(p.numero)}*${empresa ? ` · ${empresa}` : ''}`]
  L.push(`Fornecedor: ${p.fornecedor_nome}`)
  if (p.previsao_entrega) L.push(`Entrega prevista: ${dataCurta(p.previsao_entrega)}`)
  if (p.condicao_pagamento) L.push(`Pagamento: ${p.condicao_pagamento}`)

  L.push('', 'Itens:')
  for (const i of itens) {
    const qtd = `${numeroTexto(i.quantidade)}${i.unidade ? ` ${i.unidade}` : ''}`
    L.push(`• ${qtd} ${i.produto_nome} (${reais(i.preco_unitario)} cada) = ${reais(i.subtotal)}`)
    if (i.observacao?.trim()) L.push(`   obs: ${i.observacao.trim()}`)
  }

  const soma = itens.reduce((s, i) => s + i.subtotal, 0)
  L.push('', `Subtotal: ${reais(soma)}`)
  if (p.frete > 0) L.push(`Frete: ${reais(p.frete)}`)
  if (p.desconto > 0) L.push(`Desconto: - ${reais(p.desconto)}`)
  L.push(`*Total: ${reais(p.total)}*`)
  if (p.observacao?.trim()) L.push('', `Obs: ${p.observacao.trim()}`)
  return L.join('\n')
}