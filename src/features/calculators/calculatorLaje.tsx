"use client"

import Image from "next/image"
import CardCalculator, { type ResultadoConfig } from "./card"
import { cima, formatar } from "./calculadora-utils"

const ESPACAMENTO_TRILHOS = 0.43 // m entre trilhos
const LAJOTAS_POR_M2 = 11.5

const calcularTrilhos = (largura: number) => cima(largura / ESPACAMENTO_TRILHOS)

// a laje é cobrada por trilho inteiro, então a área cobrada é maior ou igual à área real
const calcularAreaCobrada = (comprimento: number, largura: number) =>
  calcularTrilhos(largura) * ESPACAMENTO_TRILHOS * comprimento

const resultados: ResultadoConfig[] = [
  {
    label: "Área total a cobrar",
    unidade: "m²",
    casas: 2,
    calcular: ({ comprimento, largura }) => calcularAreaCobrada(comprimento, largura),
    detalhe: ({ comprimento, largura }) =>
      `${calcularTrilhos(largura)} trilhos × ${formatar(ESPACAMENTO_TRILHOS)} m × ${formatar(comprimento)} m`,
  },
  {
    label: "Lajotas",
    unidade: "un.",
    icone: <Image src="/download (1).svg" width={30} height={30} alt="Lajota" />,
    aplicaPerda: true,
    calcular: ({ comprimento, largura }) => calcularAreaCobrada(comprimento, largura) * LAJOTAS_POR_M2,
    detalhe: ({ comprimento, largura }) =>
      `${formatar(calcularAreaCobrada(comprimento, largura))} m² × ${formatar(LAJOTAS_POR_M2)} lajotas/m²`,
  },
  {
    label: "Trilhos",
    unidade: "un.",
    icone: <Image src="/download (2).svg" width={30} height={30} alt="Trilho" />,
    calcular: ({ largura }) => calcularTrilhos(largura),
    detalhe: ({ largura }) => `${formatar(largura)} m ÷ ${formatar(ESPACAMENTO_TRILHOS)} m, arredondado para cima`,
  },
  {
    label: "Trilho em metros lineares",
    unidade: "m",
    casas: 2,
    calcular: ({ comprimento, largura }) => calcularTrilhos(largura) * comprimento,
    detalhe: ({ comprimento, largura }) => `${calcularTrilhos(largura)} trilhos × ${formatar(comprimento)} m`,
  },
]

export default function CalculatorLaje() {
  return (
    <CardCalculator
      titulo="Calculadora de Laje"
      descricao="Calcule a área a cobrar, as lajotas e os trilhos."
      labelComprimento="Comprimento (tamanho dos trilhos)"
      labelLargura="Largura"
      perdaPadrao={5}
      resultados={resultados}
      observacao={`Trilhos a cada ${formatar(ESPACAMENTO_TRILHOS)} m e ${formatar(LAJOTAS_POR_M2)} lajotas por m². A perda se aplica só às lajotas.`}
    />
  )
}