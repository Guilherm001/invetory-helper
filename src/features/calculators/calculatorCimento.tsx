"use client"

import CardCalculator, { type Contexto, type OpcaoSelect, type ResultadoConfig } from "./card"
import { cima, formatar } from "./calculadora-utils"

/* ───── valores de referência (ajuste aqui se o seu material for diferente) ───── */

const DENSIDADE_CIMENTO = 1400 // kg por m³ de cimento solto (saco de 50 kg ≈ 36 litros)
const DENSIDADE_AREIA = 1500 // kg por m³ de areia solta
const DENSIDADE_PEDRA = 1400 // kg por m³ de pedra 1 / pedrisco soltos
const KG_SACO_AREIA = 17 // saco de areia e de pedra (confirme com o seu fornecedor)
const KG_SACO_ARGAMASSA = 20 // saco de argamassa pronta

// m³ de material solto (cimento + areia + pedra) para fazer 1 m³ de massa pronta.
// É menor que a soma simples porque a pasta de cimento preenche os vazios da areia e da pedra.
// Conferido com SINAPI/TCPO: traço 1:3 ≈ 420-460 kg de cimento por m³ de massa; concreto 1:2:3 ≈ 7 sacos por m³.
const RENDIMENTO_ARGAMASSA = 1.3
const RENDIMENTO_CONCRETO = 1.5

// Chapisco lançado com colher: parte da massa cai no chão e ricocheteia na parede.
// Com +25% o consumo fecha em ≈ 3 kg de cimento por m² (referência de mercado para 1:3, 5 mm).
const PERDA_CHAPISCO = 25

const DICA_CAL =
  "Dica: a cal deixa a massa mais macia e fácil de aplicar. Use só se for necessário (traço comum com cal: 1:2:8 de cimento, cal e areia)."
const DICA_ESTRUTURA = "Para laje e peças estruturais, siga sempre o traço e a espessura do projeto do engenheiro."
const DICA_PRONTA =
  "O consumo muda de fabricante para fabricante: confira o rendimento na embalagem e ajuste o valor de consumo no código se precisar."
const DICA_CHAPISCO =
  "Use areia grossa, sem peneirar, e massa bem líquida. A espessura do chapisco é de 3 a 5 mm (NBR 7200) e fica fixa no cálculo. Umedeça a parede antes de aplicar."
const DICA_CHAPISCO_PRONTO =
  "Consumo de referência do chapisco rolado: 1,2 kg/m² em concreto liso, 1,4 kg/m² em alvenaria e 1,8 kg/m² em fachada. Para laje e concreto liso, o chapisco colante gasta mais (≈ 4,2 kg/m²)."
const DICA_COLANTE =
  "O consumo depende do tamanho da peça, não da espessura: até 400 cm² (20×20 cm) ≈ 4 kg/m²; de 400 a 900 cm² (até 30×30 cm) ≈ 4,5 a 5 kg/m²; acima de 900 cm², com dupla colagem (massa no piso e no verso da peça), ≈ 8 kg/m². Em área externa, fachada e porcelanato grande, use sempre a dupla colagem."

/* ───── serviços: espessura padrão (cm) e traço em volume, ou consumo da argamassa pronta ───── */

interface Aplicacao {
  label: string
  /** Espessura padrão em cm (usada quando o cliente deixa o campo em branco). */
  espessura: number
  /** Partes de areia para 1 de cimento (massa feita na obra). */
  areia: number
  /** Mostra "Areia grossa" no resultado (chapisco). */
  areiaGrossa?: boolean
  pedra?: { tipo: "pedrisco" | "pedra 1"; partes: number }
  /**
   * Argamassa pronta (saco de 20 kg).
   * - kgPorM2PorCm: consumo que cresce com a espessura (reboco, contrapiso).
   * - kgPorM2: consumo fixo por m² (chapisco, argamassa colante), que não depende da espessura.
   */
  pronta?: { kgPorM2PorCm?: number; kgPorM2?: number }
  /** Esconde o campo de espessura (a espessura do serviço é fixa). */
  espessuraFixa?: boolean
  /** Perda do próprio serviço, em % (ex.: chapisco lançado). Soma-se à margem de perda do cliente. */
  perdaProcesso?: number
  dica?: string
}

const APLICACOES: Aplicacao[] = [
  /* massa feita na obra */
  {
    label: "Chapisco (cimento e areia grossa)",
    espessura: 0.5,
    areia: 3,
    areiaGrossa: true,
    espessuraFixa: true,
    perdaProcesso: PERDA_CHAPISCO,
    dica: DICA_CHAPISCO,
  },
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
    label: "Chapisco rolado em parede (argamassa pronta de 20 kg)",
    espessura: 0,
    areia: 0,
    espessuraFixa: true,
    pronta: { kgPorM2: 1.4 },
    dica: `${DICA_CHAPISCO_PRONTO} ${DICA_PRONTA}`,
  },
  {
    label: "Chapisco rolado em fachada (argamassa pronta de 20 kg)",
    espessura: 0,
    areia: 0,
    espessuraFixa: true,
    pronta: { kgPorM2: 1.8 },
    dica: `${DICA_CHAPISCO_PRONTO} ${DICA_PRONTA}`,
  },
  {
    label: "Chapisco colante em laje ou concreto liso (saco de 20 kg)",
    espessura: 0,
    areia: 0,
    espessuraFixa: true,
    pronta: { kgPorM2: 4.2 },
    dica: `${DICA_CHAPISCO_PRONTO} ${DICA_PRONTA}`,
  },
  {
    label: "Reboco interno (argamassa pronta de 20 kg)",
    espessura: 2,
    areia: 0,
    pronta: { kgPorM2PorCm: 17 },
    dica: DICA_PRONTA,
  },
  {
    label: "Reboco externo (argamassa pronta de 20 kg)",
    espessura: 2.5,
    areia: 0,
    pronta: { kgPorM2PorCm: 17 },
    dica: DICA_PRONTA,
  },
  {
    label: "Reboco de teto (argamassa pronta de 20 kg)",
    espessura: 1.5,
    areia: 0,
    pronta: { kgPorM2PorCm: 17 },
    dica: DICA_PRONTA,
  },
  {
    label: "Contrapiso / chão (argamassa pronta de 20 kg)",
    espessura: 4,
    areia: 0,
    pronta: { kgPorM2PorCm: 20 },
    dica: DICA_PRONTA,
  },
  {
    label: "Assentar piso ou azulejo até 900 cm² (argamassa colante de 20 kg)",
    espessura: 0,
    areia: 0,
    espessuraFixa: true,
    pronta: { kgPorM2: 5 },
    dica: `${DICA_COLANTE} ${DICA_PRONTA}`,
  },
  {
    label: "Assentar porcelanato ou peça acima de 900 cm², dupla colagem (argamassa colante de 20 kg)",
    espessura: 0,
    areia: 0,
    espessuraFixa: true,
    pronta: { kgPorM2: 8 },
    dica: `${DICA_COLANTE} ${DICA_PRONTA}`,
  },
]

// value = posição do serviço na lista acima
const opcoes: OpcaoSelect[] = APLICACOES.map((a, i) => ({ label: a.label, value: i }))

const aplicacaoDe = (opcao?: number): Aplicacao => APLICACOES[opcao ?? 0]
const espessuraDe = (ctx: Contexto) => ctx.espessura ?? aplicacaoDe(ctx.opcao).espessura
const ehPronta = (ctx: Contexto) => Boolean(aplicacaoDe(ctx.opcao).pronta)
const espessuraVisivel = (opcao?: number) => !aplicacaoDe(opcao).espessuraFixa

/* ───── cálculo ───── */

const receita = (ctx: Contexto) => {
  const a = aplicacaoDe(ctx.opcao)
  const partesPedra = a.pedra?.partes ?? 0
  const perdaProcesso = a.perdaProcesso ?? 0

  const volumeLiquido = ctx.area * (espessuraDe(ctx) / 100) // m³ da camada, sem perda
  // margem de perda do cliente × perda própria do serviço (ex.: chapisco lançado)
  const volume = volumeLiquido * (1 + ctx.perda / 100) * (1 + perdaProcesso / 100)

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

/**
 * Argamassa pronta, já com a perda.
 * Consumo por cm de espessura × espessura, ou consumo fixo por m² (chapisco, colante).
 */
const prontaKg = (ctx: Contexto) => {
  const p = aplicacaoDe(ctx.opcao).pronta
  const porM2 = p?.kgPorM2 ?? (p?.kgPorM2PorCm ?? 0) * espessuraDe(ctx)
  return ctx.area * porM2 * (1 + ctx.perda / 100)
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
    const consumo =
      a.pronta.kgPorM2 !== undefined
        ? `Consumo usado: ${formatar(a.pronta.kgPorM2)} kg por m² (valor fixo, não depende da espessura).`
        : `Consumo usado: ${formatar(a.pronta.kgPorM2PorCm ?? 0)} kg por m² a cada 1 cm de espessura.`
    return [consumo, a.dica].filter(Boolean).join(" ")
  }

  const traco = a.pedra
    ? `Traço usado: 1:${formatar(a.areia)}:${formatar(a.pedra.partes)} (1 de cimento, ${formatar(a.areia)} de areia e ${formatar(a.pedra.partes)} de ${a.pedra.tipo}, medidos em volume).`
    : `Traço usado: 1:${formatar(a.areia)} (1 de cimento para ${formatar(a.areia)} de ${a.areiaGrossa ? "areia grossa" : "areia"}, medidos em volume).`
  const processo = a.perdaProcesso
    ? `Já inclui ${formatar(a.perdaProcesso)}% a mais de massa, porque no chapisco lançado parte do material cai e ricocheteia.`
    : undefined
  return [traco, processo, a.dica].filter(Boolean).join(" ")
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
    visivel: (ctx) => !ehPronta(ctx) && !aplicacaoDe(ctx.opcao).areiaGrossa,
    calcular: (ctx) => receita(ctx).areiaM3,
    detalhe: (ctx) => detalheAgregado(receita(ctx).areiaM3, DENSIDADE_AREIA),
  },
  {
    label: "Areia grossa",
    unidade: "m³",
    casas: 2,
    visivel: (ctx) => Boolean(aplicacaoDe(ctx.opcao).areiaGrossa),
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
    casas: 3,
    visivel: (ctx) => !ehPronta(ctx),
    calcular: (ctx) => receita(ctx).volumeLiquido,
    detalhe: (ctx) => {
      const processo = aplicacaoDe(ctx.opcao).perdaProcesso ?? 0
      const base = `${formatar(ctx.area)} m² × ${formatar(espessuraDe(ctx))} cm`
      if (ctx.perda <= 0 && processo <= 0) return base
      const perdaTotal = ((1 + ctx.perda / 100) * (1 + processo / 100) - 1) * 100
      return `${base} · com ${formatar(perdaTotal, 1)}% de perdas: ${formatar(receita(ctx).volume, 3)} m³`
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
      espessuraVisivel={espessuraVisivel}
      labelDesconto="Área a descontar: portas, janelas e vãos (m²)"
      perdaPadrao={5}
      labelPerda="Margem de perda (desperdício)"
      labelBotao="Calcular materiais"
      resultados={resultados}
      observacao={observacao}
    />
  )
}