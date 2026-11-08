"use client"

import CardCalculator, { type Contexto, type OpcaoSelect, type ResultadoConfig } from "./card"
import { formatar } from "./calculadora-utils"

// value = blocos por m² de parede
// extra = litros de massa por m² de parede (junta de 1 cm), usado só para estimar a areia
const blocos: OpcaoSelect[] = [
  { label: "Cerâmico 09 x 19 x 19", value: 25, extra: 8.8 },
  { label: "Cerâmico 11,5 x 14 x 24", value: 27, extra: 10.7 },
  { label: "Cerâmico 14 x 19 x 29", value: 17, extra: 8.9 },
  { label: "Cimento 09 x 19 x 39", value: 12.5, extra: 6.6 },
  { label: "Cimento 14 x 19 x 39", value: 12.5, extra: 10.3 },
  { label: "Cimento 19 x 19 x 39", value: 12.5, extra: 14 },
]

/* ───────── sua proporção de venda (fácil de ajustar) ───────── */
const SACO_AREIA_KG = 18 // 1 saco de areia = 18 kg
const CIMENTO_POR_SACO_AREIA_KG = 5 // para cada saco de areia, 5 kg de cimento

// estimativa de areia por m² de parede
const MARGEM_PERDA = 1.2 // +20% para perdas na obra
const AREIA_M3_POR_M3_MASSA = 1.1 // m³ de areia para 1 m³ de massa pronta
const AREIA_KG_POR_M3 = 1500

// até esse total (kg) recomenda o saco de 25 kg; acima, o de 50 kg
const LIMITE_SACO_PEQUENO_KG = 25

const areiaKg = ({ area, opcaoExtra }: Contexto) =>
  ((area * (opcaoExtra ?? 0) * MARGEM_PERDA) / 1000) * AREIA_M3_POR_M3_MASSA * AREIA_KG_POR_M3

const sacosAreia = (ctx: Contexto) => areiaKg(ctx) / SACO_AREIA_KG
const cimentoKg = (ctx: Contexto) => sacosAreia(ctx) * CIMENTO_POR_SACO_AREIA_KG

const detalheCimento = (ctx: Contexto) =>
  `${formatar(cimentoKg(ctx), 1)} kg no total · ${formatar(CIMENTO_POR_SACO_AREIA_KG)} kg para cada saco de areia`

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
  // cimento: só um dos dois cards aparece, conforme o total em kg
  {
    label: "Cimento",
    unidade: "sacos de 25 kg",
    visivel: (ctx) => cimentoKg(ctx) <= LIMITE_SACO_PEQUENO_KG,
    calcular: (ctx) => cimentoKg(ctx) / 25,
    detalhe: detalheCimento,
  },
  {
    label: "Cimento",
    unidade: "sacos de 50 kg",
    visivel: (ctx) => cimentoKg(ctx) > LIMITE_SACO_PEQUENO_KG,
    calcular: (ctx) => cimentoKg(ctx) / 50,
    detalhe: detalheCimento,
  },
  {
    label: "Areia",
    unidade: "sacos",
    calcular: (ctx) => sacosAreia(ctx),
    detalhe: (ctx) => `${formatar(areiaKg(ctx), 0)} kg de areia · sacos de ${formatar(SACO_AREIA_KG)} kg`,
  },
]

export default function CalculatorTijolo() {
  return (
    <CardCalculator
      titulo="Calculadora de Blocos"
      descricao="Descubra quantos blocos, sacos de cimento e areia comprar para a sua parede."
      labelComprimento="Comprimento da parede"
      labelLargura="Altura da parede"
      selectLabel="Tipo de bloco"
      selectOptions={blocos}
      labelDesconto="Vãos de portas e janelas (m²)"
      perdaPadrao={10}
      resultados={resultados}
      observacao={`Areia e cimento na proporção de ${formatar(CIMENTO_POR_SACO_AREIA_KG)} kg de cimento para cada saco de areia de ${formatar(SACO_AREIA_KG)} kg, com margem de 20% para perdas. A perda de blocos não altera esses valores.`}
    />
  )
}