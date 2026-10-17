export const reais = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const numeroTexto = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// "2026-10-18" -> "18/10/2026" (sem converter fuso, para não voltar um dia)
export const dataCurta = (d: string) => {
  const [a, m, dia] = d.slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}

export const FORMA_ROTULO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  credito_cliente: 'Crédito do cliente',
  pendencia: 'A prazo (pendência)',
}

export function statusPedido(d: { documento: string; status: string }) {
  if (d.status === 'cancelada')
    return {
      texto: d.documento === 'orcamento' ? 'Recusado' : 'Cancelado',
      classe: 'bg-red-50 text-red-700',
    }
  if (d.status === 'entregue') return { texto: 'Fechado', classe: 'bg-emerald-50 text-emerald-700' }
  return { texto: 'Em aberto', classe: 'bg-sky-50 text-sky-700' }
}