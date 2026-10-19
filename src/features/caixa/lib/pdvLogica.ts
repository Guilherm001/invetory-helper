import {
  arredonda,
  resolverPagamentos,
  type Forma,
  type Limites,
  type LinhaPagamento,
} from './calculos'

export interface Lancado {
  forma: Forma
  valor: number
  recebido: number | null
  parcelas: number | null
}

// o caixa aceita até 2 formas no mesmo pedido (o banco aceita até 4)
export const MAX_FORMAS = 2

const virgula = (n: number) => n.toFixed(2).replace('.', ',')

export const totalLancado = (l: Lancado[]) => arredonda(l.reduce((s, x) => s + x.valor, 0))

const paraLinha = (l: Lancado): LinhaPagamento => ({
  forma: l.forma,
  valor: virgula(l.valor),
  recebido: l.recebido === null ? '' : virgula(l.recebido),
  parcelas: l.parcelas ?? 1,
})

export type ResultadoLancamento = { ok: true; lancado: Lancado } | { ok: false; erro: string }

// confere se dá para lançar este pagamento agora (valor, limite de formas, troco, parcelas, crédito e prazo)
export function validarLancamento(p: {
  liquido: number
  lancados: Lancado[]
  forma: Forma
  valor: number
  recebido?: number | null // dinheiro: quanto o cliente deu (vazio = valor exato)
  parcelas?: number | null // crédito
  limites: Limites
}): ResultadoLancamento {
  const erro = (texto: string): ResultadoLancamento => ({ ok: false, erro: texto })

  const pago = totalLancado(p.lancados)
  const falta = arredonda(p.liquido - pago)
  const valor = arredonda(p.valor)

  if (!(valor > 0)) return erro('Informe o valor.')
  if (p.lancados.length >= MAX_FORMAS) return erro(`No máximo ${MAX_FORMAS} formas de pagamento.`)
  if (valor > falta + 0.0001) return erro(`O valor passa do que falta (R$ ${virgula(falta)}).`)
  if (p.lancados.length + 1 >= MAX_FORMAS && valor < falta - 0.0001) {
    return erro(`A última forma precisa cobrir o que falta (R$ ${virgula(falta)}).`)
  }

  const linha: LinhaPagamento = {
    forma: p.forma,
    valor: virgula(valor),
    recebido: p.recebido == null ? '' : virgula(p.recebido),
    parcelas: p.parcelas ?? 1,
  }
  // as regras de troco, parcelas, crédito e pendência são as mesmas do caixa clássico
  const r = resolverPagamentos(arredonda(pago + valor), [...p.lancados.map(paraLinha), linha], p.limites)
  if (r.erro) return erro(r.erro)

  const novo = r.pagamentos[r.pagamentos.length - 1]
  return {
    ok: true,
    lancado: { forma: novo.forma, valor: novo.valor, recebido: novo.recebido, parcelas: novo.parcelas },
  }
}

// notas que o cliente costuma entregar para pagar este valor
export function opcoesDinheiro(valor: number): number[] {
  const s = new Set<number>()
  for (const nota of [10, 20, 50, 100, 200]) {
    const m = Math.ceil(valor / nota) * nota
    if (m > valor) s.add(m)
  }
  return [...s].sort((a, b) => a - b).slice(0, 4)
}