// Contas do caixa: desconto, divisão do pagamento, troco e parcelas.
// Fica separado da tela para ser testado sozinho.

export type Forma = 'dinheiro' | 'pix' | 'debito' | 'credito'
export type TipoDesconto = 'valor' | 'percentual'

export const arredonda = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// "1.234,56" ou "1234.56" -> número | vazio -> NaN
export function paraNumero(v: string): number {
  const t = v.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (t === '') return NaN
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return Number(normal)
}

// ---------- desconto ----------

export interface Desconto {
  desconto: number // em reais
  percentual: number | null // preenchido só quando foi dado em %
  erro: string | null
}

export function calcularDesconto(total: number, tipo: TipoDesconto, bruto: string): Desconto {
  if (bruto.trim() === '') return { desconto: 0, percentual: null, erro: null }

  const n = paraNumero(bruto)
  if (!Number.isFinite(n) || n < 0) return { desconto: 0, percentual: null, erro: 'Desconto inválido.' }

  if (tipo === 'percentual') {
    if (n > 100) return { desconto: 0, percentual: null, erro: 'O desconto não pode passar de 100%.' }
    return { desconto: arredonda((total * n) / 100), percentual: n, erro: null }
  }

  if (arredonda(n) > total) {
    return { desconto: 0, percentual: null, erro: 'O desconto não pode ser maior que o total.' }
  }
  return { desconto: arredonda(n), percentual: null, erro: null }
}

// ---------- pagamentos ----------

export interface LinhaPagamento {
  forma: Forma
  valor: string
  recebido: string // só dinheiro: quanto o cliente entregou
  parcelas: number // só crédito
}

export interface PagamentoCalculado {
  forma: Forma
  valor: number
  recebido: number | null
  troco: number
  parcelas: number | null
}

export interface ResultadoPagamento {
  pagamentos: PagamentoCalculado[]
  restante: number // quanto ainda falta (positivo) ou passou (negativo)
  troco: number
  erro: string | null
}

export const MAX_PARCELAS = 12

export function resolverPagamentos(totalLiquido: number, linhas: LinhaPagamento[]): ResultadoPagamento {
  const pagamentos: PagamentoCalculado[] = []
  let erro: string | null = null

  for (const l of linhas) {
    const valor = arredonda(paraNumero(l.valor))
    if (!Number.isFinite(valor) || valor <= 0) {
      erro ??= 'Informe o valor de cada forma de pagamento.'
      continue
    }

    let recebido: number | null = null
    let troco = 0
    if (l.forma === 'dinheiro') {
      recebido = l.recebido.trim() === '' ? valor : arredonda(paraNumero(l.recebido))
      if (!Number.isFinite(recebido)) {
        erro ??= 'Valor recebido em dinheiro inválido.'
        continue
      }
      if (recebido < valor) {
        erro ??= 'O dinheiro recebido é menor que o valor a pagar em dinheiro.'
        continue
      }
      troco = arredonda(recebido - valor)
    }

    const parcelas =
      l.forma === 'credito' ? Math.min(MAX_PARCELAS, Math.max(1, Math.trunc(l.parcelas) || 1)) : null

    pagamentos.push({ forma: l.forma, valor, recebido, troco, parcelas })
  }

  const soma = arredonda(pagamentos.reduce((s, p) => s + p.valor, 0))
  const restante = arredonda(totalLiquido - soma)
  const troco = arredonda(pagamentos.reduce((s, p) => s + p.troco, 0))

  if (!erro && restante > 0) erro = `Faltam ${restante.toFixed(2).replace('.', ',')} para fechar.`
  if (!erro && restante < 0) erro = `Passou ${Math.abs(restante).toFixed(2).replace('.', ',')} do total.`

  return { pagamentos, restante, troco, erro }
}

// valor de cada parcela (a última absorve a diferença de centavos)
export function valorParcela(valor: number, parcelas: number) {
  const base = Math.floor((valor / parcelas) * 100) / 100
  const ultima = arredonda(valor - base * (parcelas - 1))
  return { base: arredonda(base), ultima }
}

// quanto falta para a segunda forma, dado o valor da primeira
export const restanteDaSegunda = (totalLiquido: number, primeira: string) => {
  const n = paraNumero(primeira)
  return Number.isFinite(n) ? Math.max(0, arredonda(totalLiquido - n)) : totalLiquido
}