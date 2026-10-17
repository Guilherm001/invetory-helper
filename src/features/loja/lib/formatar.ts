import type { DocumentoResumo, ItemDocumento } from '../services/documentosService'

export const reais = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const numeroTexto = (n: number) =>
  String(Math.round(n * 1000) / 1000).replace('.', ',')

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// "2026-10-18" -> "18/10/2026" (sem converter fuso, para não voltar um dia)
export const dataCurta = (d: string) => {
  const [ano, mes, dia] = d.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

// data de hoje (AAAA-MM-DD) no horário de Brasília
export const hoje = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

// valor final do documento: total dos itens menos o desconto
export const totalFinal = (d: {
  total: number
  desconto?: number | null
  total_liquido?: number | null
}) => d.total_liquido ?? d.total - (d.desconto ?? 0)

export function statusInfo(
  v: Pick<DocumentoResumo, 'documento' | 'status' | 'tipo' | 'validade'>
) {
  if (v.status === 'cancelada')
    return {
      texto: v.documento === 'orcamento' ? 'Recusado' : 'Cancelado',
      classe: 'bg-red-50 text-red-700',
    }
  if (v.status === 'entregue')
    return {
      texto: v.tipo === 'entrega' ? 'Entregue' : 'Retirado',
      classe: 'bg-emerald-50 text-emerald-700',
    }
  if (v.documento === 'orcamento' && v.validade && v.validade < hoje())
    return { texto: 'Vencido', classe: 'bg-amber-50 text-amber-700' }
  return { texto: 'Em aberto', classe: 'bg-sky-50 text-sky-700' }
}

// texto pronto para colar no WhatsApp
export function resumoDocumento(v: DocumentoResumo, itens: ItemDocumento[]) {
  const orc = v.documento === 'orcamento'
  const desconto = Number(v.desconto ?? 0)
  const L: string[] = [`${orc ? 'Orçamento' : 'Pedido'} nº ${v.numero}`]

  if (orc && v.validade) L.push(`Válido até ${dataCurta(v.validade)}`)
  if (v.cliente_nome)
    L.push(
      `Cliente: ${v.cliente_nome}${v.cliente_telefone ? ` (${v.cliente_telefone})` : ''}`
    )

  if (v.tipo === 'entrega') {
    const end = [v.endereco, v.bairro, v.cidade, v.complemento]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(', ')
    L.push(`Entrega: ${end}`)
  } else {
    L.push('Retirada na loja')
  }

  L.push('', 'Itens:')
  for (const i of itens) {
    L.push(
      `• ${numeroTexto(i.quantidade)}${i.unidade ? ` ${i.unidade}` : ''} ${i.produto_nome} — ${reais(i.subtotal)}`
    )
    if (i.observacao?.trim()) L.push(`   obs: ${i.observacao.trim()}`)
  }

  L.push('')
  if (desconto > 0) {
    L.push(`Subtotal: ${reais(v.total)}`, `Desconto: -${reais(desconto)}`)
  }
  L.push(`Total: ${reais(totalFinal(v))}`)

  if (v.pagamento) L.push(`Pagamento: ${v.pagamento}`)
  if (v.observacao?.trim()) L.push(`Obs: ${v.observacao.trim()}`)
  return L.join('\n')
}