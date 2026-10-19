// cálculo do preço de venda: custo + ICMS + IPI (+ ST) + margem

export interface EntradaPreco {
  custo: number // custo bruto
  icms: number // %
  ipi: number // %
  st: number // % substituição tributária
  margem: number // % sobre o custo com impostos (150 = custo x 2,5)
}

export interface ResultadoPreco {
  icmsValor: number
  ipiValor: number
  stValor: number
  custoComImpostos: number
  lucro: number
  preco: number // sem arredondar
  margemSobreVenda: number | null // % do preço que é lucro
}

const r4 = (n: number) => Math.round(n * 10000) / 10000

// cada imposto é calculado sobre o custo bruto e somado a ele
export function calcularPreco(e: EntradaPreco): ResultadoPreco {
  const icmsValor = r4((e.custo * e.icms) / 100)
  const ipiValor = r4((e.custo * e.ipi) / 100)
  const stValor = r4((e.custo * e.st) / 100)
  const custoComImpostos = r4(e.custo + icmsValor + ipiValor + stValor)
  const lucro = r4((custoComImpostos * e.margem) / 100)
  const preco = r4(custoComImpostos + lucro)

  return {
    icmsValor,
    ipiValor,
    stValor,
    custoComImpostos,
    lucro,
    preco,
    margemSobreVenda: preco > 0 ? r4((lucro / preco) * 100) : null,
  }
}

export const PASSOS_ARREDONDAMENTO: { valor: number; rotulo: string }[] = [
  { valor: 0.01, rotulo: 'Centavo' },
  { valor: 0.05, rotulo: 'R$ 0,05' },
  { valor: 0.1, rotulo: 'R$ 0,10' },
  { valor: 0.5, rotulo: 'R$ 0,50' },
  { valor: 1, rotulo: 'R$ 1,00' },
]

// arredonda para cima, para o preço nunca ficar abaixo do calculado
export function arredondarAcima(valor: number, passo: number) {
  const n = Math.ceil(valor / passo - 1e-9)
  return Math.round(n * passo * 100) / 100
}