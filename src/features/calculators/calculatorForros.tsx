"use client"

import CardCalculator, { type ComparacaoResultado, type Contexto, type ResultadoConfig } from "./card"
import { baixo, cima, formatar } from "./calculadora-utils"

const LARGURA_REGUA = 0.2 // régua de forro PVC: 20 cm de largura
const COMPRIMENTO_RODAFORRO = 6 // barra de roda-forro (perfil U): 6 m
const COMPRIMENTOS_REGUA = [3, 4, 5, 6] // tamanhos que você trabalha

interface Plano {
  comprimentoRegua: number
  barras: number
  /** Metros comprados que não viram forro. */
  sobra: number
  /** A fileira não cabe numa régua só (precisa emendar). */
  emenda: boolean
}

/**
 * Cada fileira precisa de uma peça do tamanho do ambiente.
 * - Se a régua é maior, cortamos várias peças da mesma régua (ex.: 2 m de ambiente
 *   em régua de 4 m → 2 peças por régua, sem sobra).
 * - Se a régua é menor, usamos forros inteiros e completamos o resto com sobras de corte.
 */
const planejar = (comprimento: number, fileiras: number, regua: number, perda: number): Plano => {
  const inteiras = baixo(comprimento / regua)
  const resto = comprimento - inteiras * regua
  let barras = inteiras * fileiras

  if (resto > 1e-6) {
    const pecasPorBarra = baixo(regua / resto)
    barras += cima(fileiras / pecasPorBarra)
  }

  barras = cima(barras * (1 + perda / 100)) // margem extra para quebras (padrão 0%)
  const sobra = Math.max(0, barras * regua - comprimento * fileiras)

  return { comprimentoRegua: regua, barras, sobra, emenda: comprimento > regua + 1e-6 }
}

const compararReguas = ({ comprimento, largura, perda }: Contexto & { perda: number }): ComparacaoResultado => {
  const fileiras = cima(largura / LARGURA_REGUA)
  const planos = COMPRIMENTOS_REGUA.map((r) => planejar(comprimento, fileiras, r, perda))

  // 1º sem emenda, 2º menor sobra, 3º menos barras
  const ordenados = [...planos].sort(
    (a, b) =>
      Number(a.emenda) - Number(b.emenda) ||
      Math.round(a.sobra * 100) - Math.round(b.sobra * 100) ||
      a.barras - b.barras,
  )
  const melhor = ordenados[0]

  const unidade = (n: number) => (n === 1 ? "forro" : "forros")
  const comprado = (p: Plano) => p.barras * p.comprimentoRegua
  const pct = (p: Plano) => Math.round((p.sobra / comprado(p)) * 100)

  const partes: string[] = [
    melhor.sobra < 0.005
      ? "Sem sobra: aproveitamento total."
      : `Sobra de ${formatar(melhor.sobra)} m (${pct(melhor)}% do material).`,
  ]
  if (melhor.emenda) partes.push("Nenhuma régua cobre o ambiente de ponta a ponta: haverá emenda.")

  const referencia = planos[0] // menor régua
  const economia = comprado(referencia) - comprado(melhor)
  if (melhor !== referencia && economia > 0.005) {
    partes.push(
      `Compra ${formatar(economia)} m a menos do que com ${referencia.barras} ${unidade(referencia.barras)} de ${referencia.comprimentoRegua} m.`,
    )
  }

  return {
    titulo: "Melhor opção de forros",
    destaque: `${melhor.barras} ${unidade(melhor.barras)} de ${melhor.comprimentoRegua} m`,
    destaqueDetalhe: partes.join(" "),
    colunas: ["Régua", "Quantidade", "Sobra"],
    linhas: planos.map((p) => ({
      label: `${p.comprimentoRegua} m`,
      valores: [
        String(p.barras),
        `${p.sobra < 0.005 ? "nenhuma" : `${formatar(p.sobra)} m`}${p.emenda ? " · com emenda" : ""}`,
      ],
      melhor: p === melhor,
    })),
  }
}

const resultados: ResultadoConfig[] = [
  {
    label: "Área total",
    unidade: "m²",
    casas: 2,
    calcular: ({ area }) => area,
    detalhe: ({ comprimento, largura }) => `${formatar(comprimento)} m × ${formatar(largura)} m`,
  },
  {
    label: "Roda-forro (perfil U)",
    unidade: "barras",
    aplicaPerda: true,
    calcular: ({ comprimento, largura }) => (2 * (comprimento + largura)) / COMPRIMENTO_RODAFORRO,
    detalhe: ({ comprimento, largura }) =>
      `Perímetro de ${formatar(2 * (comprimento + largura))} m ÷ barras de ${COMPRIMENTO_RODAFORRO} m`,
  },
]

export default function CalculatorForros() {
  return (
    <CardCalculator
      titulo="Calculadora de Forro PVC"
      descricao="Compara os forros de 3, 4, 5 e 6 m e indica a que menos desperdiça."
      labelComprimento="Comprimento (sentido dos forros)"
      labelLargura="Largura"
      labelLargura2="Segunda largura (ambiente em trapézio)"
      perdaPadrao={0}
      labelPerda="Margem extra para quebras (%)"
      comparar={compararReguas}
      resultados={resultados}
      observacao="Régua de 20 cm de largura; os cortes já entram no cálculo das sobras. Com duas larguras, usa a média."
    />
  )
}