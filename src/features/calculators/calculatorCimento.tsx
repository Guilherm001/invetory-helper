"use client"

import CardCalculator, { type Contexto, type OpcaoSelect, type ResultadoConfig } from "./card"
import { cima, formatar } from "./calculadora-utils"

/* ───── valores de referência (ajuste aqui se o seu material for diferente) ───── */

const DENSIDADE_CIMENTO = 1400 // kg por m³ de cimento solto (saco de 50 kg ≈ 36 litros)
const DENSIDADE_AREIA = 1500 // kg por m³ de areia solta
const DENSIDADE_PEDRA = 1400 // kg por m³ de pedra 1 / pedrisco soltos
const KG_SACO_AREIA = 17 // saco de areia e de pedra
const KG_SACO_ARGAMASSA = 20 // saco de argamassa pronta

// m³ de material solto (cimento + areia + pedra) para fazer 1 m³ de massa pronta.
// É menor que a soma simples porque a pasta de cimento preenche os vazios da areia e da pedra.
const RENDIMENTO_ARGAMASSA = 1.3
const RENDIMENTO_CONCRETO = 1.5

const DICA_CAL =
  "Dica: a cal deixa a massa mais macia e fácil de aplicar. Use só se for necessário (traço comum com cal: 1:2:8 de cimento, cal e areia)."
const DICA_ESTRUTURA = "Para laje e peças estruturais, siga sempre o traço e a espessura do projeto do engenheiro."
const DICA_PRONTA =
  "O consumo muda de fabricante para fabricante: confira o rendimento na embalagem e ajuste o valor de consumo no código se precisar."
const DICA_COLANTE =
  "Aqui a espessura é a altura do dente da desempenadeira (6 mm = 0,6 cm, 8 mm = 0,8 cm). Em peças grandes ou pisos externos, aplique também no verso da peça (dupla colagem) e some mais material."

/* ───── serviços: espessura padrão (cm) e traço em volume, ou consumo da argamassa pronta ───── */

interface Aplicacao {
  label: string
  espessura: number
  /** Partes de areia para 1 de cimento (massa feita na obra). */
  areia: number
  pedra?: { tipo: "pedrisco" | "pedra 1"; partes: number }
  /** Argamassa pronta (saco de 20 kg): kg por m² para cada 1 cm de espessura. */
  pronta?: { kgPorM2PorCm: number }
  dica?: string
}

const APLICACOES: Aplicacao[] = [
  /* massa feita na obra */
  { label: "Reboco interno (cimento e areia)", espessura: 2, areia: 6, dica: DICA_CAL },
  { label: "Reboco externo (cimento e areia)", espessura: 2.5, areia: 4, dica: DICA_CAL },
  { label: "Reboco de teto (cimento e areia)", espessura: 1.5, areia: 3, dica: DICA_CAL },
  { label: "Contrapiso / chão (cimento e areia)", espessura: 4, areia: 4 },
  {
    label: "Piso ou calçada de concreto (cimento, areia e pedrisco)",
    espessura: 6,
    areia: 3,
    pedra: { tipo: "pedrisco", partes: 3 },
  },
  {
    label: "Piso ou calçada de concreto (cimento, areia e pedra 1)",
    espessura: 8,
    areia: 3,
    pedra: { tipo: "pedra 1", partes: 3 },
  },
  {
    label: "Laje / concreto estrutural (cimento, areia e pedra 1)",
    espessura: 10,
    areia: 2,
    pedra: { tipo: "pedra 1", partes: 3 },
    dica: DICA_ESTRUTURA,
  },

  /* argamassa pronta (saco de 20 kg) */
  {
    label: "Reboco interno (argamassa pronta de 20 kg)",
    espessura: 2,
    areia: 0,
    pronta: { kgPorM2PorCm: 16 },
    dica: DICA_PRONTA,
  },
  {
    label: "Reboco externo (argamassa pronta de 20 kg)",
    espessura: 2.5,
    areia: 0,
    pronta: { kgPorM2PorCm: 16 },
    dica: DICA_PRONTA,
  },
  {
    label: "Reboco de teto (argamassa pronta de 20 kg)",
    espessura: 1.5,
    areia: 0,
    pronta: { kgPorM2PorCm: 16 },
    dica: DICA_PRONTA,
  },
  {
    label: "Contrapiso / chão (argamassa pronta de 20 kg)",
    espessura: 4,
    areia: 0,
    pronta: { kgPorM2PorCm: 19 },
    dica: DICA_PRONTA,
  },
  {
    label: "Assentar piso ou azulejo (argamassa colante de 20 kg)",
    espessura: 0.6,
    areia: 0,
    pronta: { kgPorM2PorCm: 8 },
    dica: `${DICA_COLANTE} ${DICA_PRONTA}`,
  },
]

// value = posição do serviço na lista acima
const opcoes: OpcaoSelect[] = APLICACOES.map((a, i) => ({ label: a.label, value: i }))

const aplicacaoDe = (opcao?: number): Aplicacao => APLICACOES[opcao ?? 0]
const espessuraDe = (ctx: Contexto) => ctx.espessura ?? aplicacaoDe(ctx.opcao).espessura
const ehPronta = (ctx: Contexto) => Boolean(aplicacaoDe(ctx.opcao).pronta)

/* ───── cálculo ───── */

const receita = (ctx: Contexto) => {
  const a = aplicacaoDe(ctx.opcao)
  const partesPedra = a.pedra?.partes ?? 0

  const volumeLiquido = ctx.area * (espessuraDe(ctx) / 100) // m³ da camada, sem perda
  const volume = volumeLiquido * (1 + ctx.perda / 100) // m³ com perda

  const rendimento = a.pedra ? RENDIMENTO_CONCRETO : RENDIMENTO_ARGAMASSA
  const cimentoM3 = (volume * rendimento) / (1 + a.areia + partesPedra)

  return {
    volumeLiquido,
    volume,
    cimentoKg: cimentoM3 * DENSIDADE_CIMENTO,
    areiaM3: cimentoM3 * a.areia,
    pedraM3: cimentoM3 * partesPedra,
  }
}

/** Argamassa pronta: kg por m² por cm de espessura × espessura × área, já com a perda. */
const prontaKg = (ctx: Contexto) => {
  const consumo = aplicacaoDe(ctx.opcao).pronta?.kgPorM2PorCm ?? 0
  return ctx.area * espessuraDe(ctx) * consumo * (1 + ctx.perda / 100)
}

/* ───── textos de apoio ───── */

const sacos = (qtd: number, kg: number) => `${formatar(qtd, 0)} ${qtd === 1 ? "saco" : "sacos"} de ${kg} kg`

/** Areia e pedra vendidas em carga de 1 m³ e de 1/2 m³: arredonda para cima de meio em meio metro. */
const emMetros = (m3: number): string => {
  const meios = cima(m3 / 0.5)
  const inteiros = Math.floor(meios / 2)
  const partes: string[] = []
  if (inteiros > 0) partes.push(`${inteiros} m³`)
  if (meios % 2 === 1) partes.push("1/2 m³")
  return partes.join(" + ")
}

const detalheAgregado = (m3: number, densidade: number) => {
  const kg = m3 * densidade
  return `Ou ${emMetros(m3)} (por metro) · ou ${sacos(cima(kg / KG_SACO_AREIA), KG_SACO_AREIA)} · ou ${formatar(cima(kg), 0)} kg (venda por kg)`
}

const observacao = (ctx: Contexto): string => {
  const a = aplicacaoDe(ctx.opcao)

  if (a.pronta) {
    const consumo = `Consumo usado: ${formatar(a.pronta.kgPorM2PorCm)} kg por m² a cada 1 cm de espessura.`
    return [consumo, a.dica].filter(Boolean).join(" ")
  }

  const traco = a.pedra
    ? `Traço usado: 1:${formatar(a.areia)}:${formatar(a.pedra.partes)} (1 de cimento, ${formatar(a.areia)} de areia e ${formatar(a.pedra.partes)} de ${a.pedra.tipo}, medidos em volume).`
    : `Traço usado: 1:${formatar(a.areia)} (1 de cimento para ${formatar(a.areia)} de areia, medidos em volume).`
  return [traco, a.dica].filter(Boolean).join(" ")
}

/* ───── resultados ───── */

const resultados: ResultadoConfig[] = [
  /* argamassa pronta (aparece só nos serviços de argamassa pronta) */
  {
    label: "Argamassa pronta",
    unidade: "sacos de 20 kg",
    visivel: ehPronta,
    calcular: (ctx) => prontaKg(ctx) / KG_SACO_ARGAMASSA,
    detalhe: (ctx) => `Ou ${formatar(cima(prontaKg(ctx)), 0)} kg (venda por kg)`,
  },

  /* massa feita na obra (some nos serviços de argamassa pronta) */
  {
    label: "Cimento",
    unidade: "sacos de 50 kg",
    visivel: (ctx) => !ehPronta(ctx),
    calcular: (ctx) => receita(ctx).cimentoKg / 50,
    detalhe: (ctx) => {
      const kg = receita(ctx).cimentoKg
      return `Ou ${sacos(cima(kg / 25), 25)} · ou ${formatar(cima(kg), 0)} kg (venda por kg)`
    },
  },
  {
    label: "Areia",
    unidade: "m³",
    casas: 2,
    visivel: (ctx) => !ehPronta(ctx),
    calcular: (ctx) => receita(ctx).areiaM3,
    detalhe: (ctx) => detalheAgregado(receita(ctx).areiaM3, DENSIDADE_AREIA),
  },
  {
    label: "Pedrisco",
    unidade: "m³",
    casas: 2,
    visivel: (ctx) => aplicacaoDe(ctx.opcao).pedra?.tipo === "pedrisco",
    calcular: (ctx) => receita(ctx).pedraM3,
    detalhe: (ctx) => detalheAgregado(receita(ctx).pedraM3, DENSIDADE_PEDRA),
  },
  {
    label: "Pedra 1",
    unidade: "m³",
    casas: 2,
    visivel: (ctx) => aplicacaoDe(ctx.opcao).pedra?.tipo === "pedra 1",
    calcular: (ctx) => receita(ctx).pedraM3,
    detalhe: (ctx) => detalheAgregado(receita(ctx).pedraM3, DENSIDADE_PEDRA),
  },
  {
    label: "Volume da camada",
    unidade: "m³",
    casas: 2,
    visivel: (ctx) => !ehPronta(ctx),
    calcular: (ctx) => receita(ctx).volumeLiquido,
    detalhe: (ctx) => {
      const base = `${formatar(ctx.area)} m² × ${formatar(espessuraDe(ctx))} cm`
      if (ctx.perda <= 0) return base
      return `${base} · com ${formatar(ctx.perda)}% de perda: ${formatar(receita(ctx).volume)} m³`
    },
  },
]

export default function CalculatorCimento() {
  return (
    <CardCalculator
      titulo="Calculadora de Cimento, Areia, Pedra e Argamassa"
      descricao="Escolha o serviço e as medidas: a calculadora mostra quanto material comprar."
      labelComprimento="Comprimento da área"
      labelLargura="Largura da área (ou altura, se for parede)"
      selectLabel="O que você vai fazer?"
      selectOptions={opcoes}
      labelEspessura="Espessura da camada"
      espessuraPadrao={(opcao) => aplicacaoDe(opcao).espessura}
      labelDesconto="Área a descontar: portas, janelas e vãos (m²)"
      perdaPadrao={5}
      labelPerda="Margem de perda (desperdício)"
      labelBotao="Calcular materiais"
      resultados={resultados}
      observacao={observacao}
    />
  )
}