"use client"

import CardCalculator, { type OpcaoSelect, type ResultadoConfig } from "./card"
import { formatar } from "./calculadora-utils"

// value = blocos por m² de parede
const blocos: OpcaoSelect[] = [
  { label: "Cerâmico 09 x 19 x 19", value: 25 },
  { label: "Cerâmico 11,5 x 14 x 24", value: 27 },
  { label: "Cerâmico 14 x 19 x 29", value: 17 },
  { label: "Cimento 09 x 19 x 39", value: 12.5 },
  { label: "Cimento 14 x 19 x 39", value: 12.5 },
  { label: "Cimento 19 x 19 x 39", value: 12.5 },
]

const resultados: ResultadoConfig[] = [
  {
    label: "Área da parede",
    unidade: "m²",
    casas: 2,
    calcular: ({ area }) => area,
    detalhe: ({ comprimento, largura, desconto }) =>
      `${formatar(comprimento)} m × ${formatar(largura)} m${desconto > 0 ? ` − ${formatar(desconto)} m² de vãos` : ""}`,
  },
  {
    label: "Quantidade necessária",
    unidade: "blocos",
    aplicaPerda: true,
    calcular: ({ area, opcao }) => area * (opcao ?? 0),
    detalhe: ({ area, opcao }) => `${formatar(area)} m² × ${formatar(opcao ?? 0)} blocos/m²`,
  },
]

export default function CalculatorTijolo() {
  return (
    <CardCalculator
      titulo="Calculadora de Blocos"
      descricao="Descubra quantos blocos ou tijolos comprar para a sua parede."
      labelComprimento="Comprimento da parede"
      labelLargura="Altura da parede"
      selectLabel="Tipo de bloco"
      selectOptions={blocos}
      labelDesconto="Vãos de portas e janelas (m²)"
      perdaPadrao={10}
      resultados={resultados}
    />
  )
}