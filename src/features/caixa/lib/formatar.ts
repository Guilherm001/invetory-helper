export const reais = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const numeroTexto = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')

export const virgula = (n: number) => n.toFixed(2).replace('.', ',')

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export const FORMA_ROTULO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  credito_cliente: 'Crédito de cliente',
  pendencia: 'A prazo (pendência)',
}

export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
// "2026-10-18" -> "18/10/2026" (sem converter fuso, para não voltar um dia)
export const dataCurta = (d: string) => {
  const [a, m, dia] = d.slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}