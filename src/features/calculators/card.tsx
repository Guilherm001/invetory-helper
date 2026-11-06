"use client"

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { Calculator, Check, Copy, MessageCircle, RotateCcw } from "lucide-react"
import { cima, formatar, parseNumero } from "./calculadora-utils"

/* ───────────────────────── tipos públicos ───────────────────────── */

export interface OpcaoSelect {
  label: string
  value: number
}

/** Dados já validados que cada calculadora recebe. */
export interface Contexto {
  comprimento: number
  /** Largura (média das duas, quando o usuário informa a segunda largura). */
  largura: number
  /** comprimento × largura − desconto */
  area: number
  /** Área descontada (vãos). 0 se não houver. */
  desconto: number
  /** Valor da opção escolhida no select (se existir). */
  opcao?: number
  /** Margem de perda em % (0 se não houver). */
  perda: number
  /** Espessura da camada em cm (só nas calculadoras que pedem espessura). */
  espessura?: number
}

export interface ResultadoConfig {
  label: string
  unidade?: string
  icone?: ReactNode
  /** 0 (padrão) = quantidade inteira, sempre arredondada PARA CIMA. >0 = casas decimais. */
  casas?: number
  /** Aplica a margem de perda (só vale para quantidades inteiras). */
  aplicaPerda?: boolean
  /** Se retornar false, este resultado não aparece. */
  visivel?: (ctx: Contexto) => boolean
  calcular: (ctx: Contexto) => number
  /** "Memória de cálculo" mostrada abaixo do resultado. */
  detalhe?: (ctx: Contexto) => string
}

export interface ComparacaoResultado {
  titulo: string
  /** Ex.: "5 réguas de 4 m" */
  destaque: string
  destaqueDetalhe?: string
  /** Cabeçalhos, incluindo a primeira coluna (nome da linha). */
  colunas: string[]
  linhas: { label: string; valores: string[]; melhor: boolean }[]
}

interface CardProps {
  titulo: string
  descricao?: string

  labelComprimento: string
  labelLargura: string
  /** Se informado, mostra a 2ª largura (opcional) e usa a média — ambientes em trapézio. */
  labelLargura2?: string
  placeholderComprimento?: string
  placeholderLargura?: string
  placeholderLargura2?: string

  selectLabel?: string
  selectOptions?: OpcaoSelect[]
  /** Índice da opção já selecionada. Sem isso, o usuário é obrigado a escolher. */
  selectPadrao?: number

  /** Mostra o campo opcional "espessura (cm)". */
  labelEspessura?: string
  /** Espessura padrão (cm) quando o campo fica em branco. Recebe o `value` da opção escolhida. */
  espessuraPadrao?: (opcao?: number) => number

  /** Se informado, mostra o campo "área a descontar" (portas, janelas...). */
  labelDesconto?: string
  /** Se informado, mostra a margem de perda (%) com esse valor inicial. */
  perdaPadrao?: number

  /** O primeiro item visível é o resultado principal (destaque). */
  resultados: ResultadoConfig[]
  labelBotao?: string
  /** Premissas da calculadora, exibidas junto ao resultado. */
  observacao?: string | ((ctx: Contexto) => string)
  /** Rótulo do campo de perda (padrão: "Margem de perda (quebras e cortes)"). */
  labelPerda?: string
  /** Bloco de comparação entre alternativas (ex.: tamanhos de régua). */
  comparar?: (ctx: Contexto & { perda: number }) => ComparacaoResultado
}

/* ───────────────────────── internos ───────────────────────── */

type Campo = "comprimento" | "largura" | "largura2" | "opcao" | "espessura" | "desconto" | "perda"
type Form = Record<Campo, string>
type Erros = Partial<Record<Campo, string>>

interface ItemResultado {
  label: string
  texto: string
  unidade?: string
  icone?: ReactNode
  detalhe?: string
}

interface Calculo {
  comparacao?: ComparacaoResultado
  itens: ItemResultado[]
  resumo: string
  observacao?: string
}

const LIMITE = 10000
const LIMITE_ESPESSURA = 100 // cm

const inputBase =
  "w-full rounded-md border bg-white px-3 py-2.5 text-base shadow-sm focus:outline-none focus:ring-1 sm:text-sm"
const inputOk = "border-slate-200 focus:border-[#079C9C] focus:ring-[#079C9C]"
const inputErro = "border-red-400 focus:border-red-500 focus:ring-red-500"

interface CampoProps {
  id: string
  label: string
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  sufixo?: string
  opcional?: boolean
  erro?: string
  enterKeyHint: "next" | "done"
}

function CampoNumerico({
  id,
  label,
  value,
  onChange,
  placeholder,
  sufixo,
  opcional,
  erro,
  enterKeyHint,
}: CampoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {opcional && <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint={enterKeyHint}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className={`${inputBase} ${sufixo ? "pr-10" : ""} ${erro ? inputErro : inputOk}`}
        />
        {sufixo && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
            {sufixo}
          </span>
        )}
      </div>
      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}
    </div>
  )
}

/* ───────────────────────── componente ───────────────────────── */

export default function CardCalculator({
  titulo,
  descricao,
  labelComprimento,
  labelLargura,
  labelLargura2,
  placeholderComprimento = "Ex: 4",
  placeholderLargura = "Ex: 3",
  placeholderLargura2 = "Ex: 3,5",
  selectLabel,
  selectOptions,
  selectPadrao,
  labelEspessura,
  espessuraPadrao,
  labelDesconto,
  perdaPadrao,
  resultados,
  labelBotao = "Calcular",
  observacao,
  labelPerda = "Margem de perda (quebras e cortes)",
  comparar,
}: CardProps) {
  const uid = useId()
  const idDe = (campo: Campo) => `${uid}-${campo}`

  const temAjustes = Boolean(labelDesconto) || perdaPadrao !== undefined
  const rotuloAjustes = [labelDesconto ? "descontos" : null, perdaPadrao !== undefined ? "perda" : null]
    .filter(Boolean)
    .join(" e ")

  // último campo do formulário (só para o teclado do celular mostrar "ok" em vez de "próximo")
  const ultimoCampo: Campo =
    perdaPadrao !== undefined
      ? "perda"
      : labelDesconto
        ? "desconto"
        : labelEspessura
          ? "espessura"
          : selectOptions
            ? "opcao"
            : labelLargura2
              ? "largura2"
              : "largura"
  const hint = (campo: Campo) => (campo === ultimoCampo ? "done" : "next")

  const formInicial = (): Form => ({
    comprimento: "",
    largura: "",
    largura2: "",
    desconto: "",
    espessura: "",
    perda: perdaPadrao !== undefined ? String(perdaPadrao) : "",
    opcao: selectPadrao !== undefined ? String(selectPadrao) : "",
  })

  const [form, setForm] = useState<Form>(formInicial)
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [calculo, setCalculo] = useState<Calculo | null>(null)
  const [ajustesAbertos, setAjustesAbertos] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // espessura padrão do serviço escolhido (aparece como dica no campo de espessura)
  const opcaoAtual = form.opcao !== "" ? selectOptions?.[Number(form.opcao)]?.value : undefined
  const espessuraAtual =
    labelEspessura && (!selectOptions || opcaoAtual !== undefined) ? espessuraPadrao?.(opcaoAtual) : undefined

  const painelRef = useRef<HTMLDivElement>(null)

  // celular/tablet: depois de calcular, rola até o resultado
  useEffect(() => {
    if (!calculo) return
    if (!window.matchMedia("(max-width: 1023px)").matches) return
    painelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [calculo])

  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 2000)
    return () => clearTimeout(t)
  }, [copiado])

  const atualizar = (campo: Campo, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
    setErroGeral(null)
  }

  const validar = () => {
    const erros: Erros = {}

    const verificar = (campo: Campo, n: number) => {
      if (Number.isNaN(n)) erros[campo] = "Informe um número válido."
      else if (n <= 0) erros[campo] = "Use um valor maior que zero."
      else if (n > LIMITE) erros[campo] = "Valor muito alto. Confira a medida."
    }

    const comprimento = parseNumero(form.comprimento)
    const largura = parseNumero(form.largura)
    verificar("comprimento", comprimento)
    verificar("largura", largura)

    // 2ª largura é opcional: se preenchida, vira área irregular (trapézio)
    let larguraMedia = largura
    const usaLargura2 = Boolean(labelLargura2) && form.largura2.trim() !== ""
    if (usaLargura2) {
      const l2 = parseNumero(form.largura2)
      verificar("largura2", l2)
      larguraMedia = (largura + l2) / 2
    }

    let desconto = 0
    if (labelDesconto && form.desconto.trim() !== "") {
      desconto = parseNumero(form.desconto)
      if (Number.isNaN(desconto) || desconto < 0) erros.desconto = "Informe um valor válido (0 ou mais)."
    }

    let perda = 0
    if (perdaPadrao !== undefined && form.perda.trim() !== "") {
      perda = parseNumero(form.perda)
      if (Number.isNaN(perda) || perda < 0 || perda > 100) erros.perda = "Use um valor entre 0 e 100."
    }

    if (selectOptions && (form.opcao === "" || !selectOptions[Number(form.opcao)])) {
      erros.opcao = "Selecione uma opção."
    }

    // espessura é opcional: em branco usa a padrão do serviço
    let espessura = espessuraAtual
    if (labelEspessura && form.espessura.trim() !== "") {
      espessura = parseNumero(form.espessura)
      if (Number.isNaN(espessura) || espessura <= 0) erros.espessura = "Use um valor maior que zero."
      else if (espessura > LIMITE_ESPESSURA) erros.espessura = "Valor muito alto. Informe a espessura em centímetros."
    }

    const area = comprimento * larguraMedia
    if (
      desconto > 0 &&
      !erros.desconto &&
      !erros.comprimento &&
      !erros.largura &&
      !erros.largura2 &&
      desconto >= area
    ) {
      erros.desconto = "O desconto deve ser menor que a área."
    }

    return { erros, comprimento, larguraMedia, desconto, perda, usaLargura2, area, espessura }
  }

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = validar()
    setErros(v.erros)
    setErroGeral(null)

    const ordem: Campo[] = ["comprimento", "largura", "largura2", "opcao", "espessura", "desconto", "perda"]
    const primeiroErro = ordem.find((c) => v.erros[c])
    if (primeiroErro) {
      setCalculo(null)
      if (v.erros.desconto || v.erros.perda) setAjustesAbertos(true)
      setTimeout(() => document.getElementById(idDe(primeiroErro))?.focus(), 50)
      return
    }

    const opcaoSelecionada = selectOptions?.[Number(form.opcao)]
    const ctx: Contexto = {
      comprimento: v.comprimento,
      largura: v.larguraMedia,
      area: v.area - v.desconto,
      desconto: v.desconto,
      opcao: opcaoSelecionada?.value,
      perda: v.perda,
      espessura: v.espessura,
    }

    try {
      const itens: ItemResultado[] = resultados
        .filter((r) => r.visivel?.(ctx) ?? true)
        .map((r) => {
          const casas = r.casas ?? 0
          const bruto = r.calcular(ctx)
          if (!Number.isFinite(bruto)) throw new Error("valor inválido")

          const detalhes: string[] = []
          const base = r.detalhe?.(ctx)
          if (base) detalhes.push(base)

          let valor: number
          if (casas > 0) {
            valor = Math.round(bruto * 10 ** casas) / 10 ** casas
          } else if (r.aplicaPerda && v.perda > 0) {
            const semPerda = cima(bruto)
            valor = cima(bruto * (1 + v.perda / 100))
            detalhes.push(`${formatar(semPerda, 0)} + ${v.perda.toLocaleString("pt-BR")}% de perda`)
          } else {
            valor = cima(bruto)
          }

          return {
            label: r.label,
            texto: formatar(valor, casas, true),
            unidade: r.unidade,
            icone: r.icone,
            detalhe: detalhes.join(" · ") || undefined,
          }
        })

      const partes = [
        `Medidas: ${formatar(v.comprimento)} m × ${formatar(v.larguraMedia)} m${v.usaLargura2 ? " (largura média)" : ""}`,
      ]
      if (v.desconto > 0) partes.push(`desconto de ${formatar(v.desconto)} m²`)
      if (opcaoSelecionada) partes.push(opcaoSelecionada.label)
      if (labelEspessura && v.espessura !== undefined) partes.push(`espessura de ${formatar(v.espessura)} cm`)
      if (perdaPadrao !== undefined && v.perda > 0) partes.push(`perda de ${v.perda.toLocaleString("pt-BR")}%`)

      const comparacao = comparar?.({ ...ctx, perda: v.perda })
      const obs = typeof observacao === "function" ? observacao(ctx) : observacao

      setCalculo({ itens, comparacao, resumo: partes.join(" · "), observacao: obs })
    } catch {
      setCalculo(null)
      setErroGeral("Não foi possível calcular. Confira os valores informados.")
    }
  }

  const limpar = () => {
    setForm(formInicial())
    setErros({})
    setErroGeral(null)
    setCalculo(null)
    setAjustesAbertos(false)
  }

  // Enter pula para o próximo campo visível; no último, envia o formulário
  const aoTeclar = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return
    const alvo = e.target as HTMLElement
    if (alvo.tagName !== "INPUT") return
    const campos = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("input, select")).filter(
      (el) => el.getClientRects().length > 0,
    )
    const i = campos.indexOf(alvo)
    if (i >= 0 && i < campos.length - 1) {
      e.preventDefault()
      campos[i + 1].focus()
    }
  }

  const textoCompartilhar = calculo
    ? [
        `*${titulo}*`,
        calculo.resumo,
        "",
        ...calculo.itens.map((i) => `${i.label}: ${i.texto}${i.unidade ? ` ${i.unidade}` : ""}`),
        ...(calculo.comparacao
          ? [
              "",
              `${calculo.comparacao.titulo}: ${calculo.comparacao.destaque}`,
              ...(calculo.comparacao.destaqueDetalhe ? [calculo.comparacao.destaqueDetalhe] : []),
            ]
          : []),
      ].join("\n")
    : ""

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCompartilhar)
      setCopiado(true)
    } catch {
      // clipboard indisponível (http, permissão negada): ignora em silêncio
    }
  }

  const [principal, ...demais] = calculo?.itens ?? []

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">{titulo}</h2>
          {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
        </div>

        {/* abaixo de 1024px: um embaixo do outro | desktop: lado a lado */}
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
          {/* ─────────── formulário ─────────── */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:basis-1/3">
            <form onSubmit={aoEnviar} onKeyDown={aoTeclar} noValidate className="flex flex-col gap-4">
              <CampoNumerico
                id={idDe("comprimento")}
                label={labelComprimento}
                value={form.comprimento}
                onChange={(v) => atualizar("comprimento", v)}
                placeholder={placeholderComprimento}
                sufixo="m"
                erro={erros.comprimento}
                enterKeyHint={hint("comprimento")}
              />

              <CampoNumerico
                id={idDe("largura")}
                label={labelLargura}
                value={form.largura}
                onChange={(v) => atualizar("largura", v)}
                placeholder={placeholderLargura}
                sufixo="m"
                erro={erros.largura}
                enterKeyHint={hint("largura")}
              />

              {labelLargura2 && (
                <CampoNumerico
                  id={idDe("largura2")}
                  label={labelLargura2}
                  value={form.largura2}
                  onChange={(v) => atualizar("largura2", v)}
                  placeholder={placeholderLargura2}
                  sufixo="m"
                  opcional
                  erro={erros.largura2}
                  enterKeyHint={hint("largura2")}
                />
              )}

              {selectOptions && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={idDe("opcao")} className="text-sm font-medium text-slate-700">
                    {selectLabel}
                  </label>
                  <select
                    id={idDe("opcao")}
                    value={form.opcao}
                    onChange={(e) => atualizar("opcao", e.target.value)}
                    aria-invalid={Boolean(erros.opcao)}
                    aria-describedby={erros.opcao ? `${idDe("opcao")}-erro` : undefined}
                    className={`${inputBase} ${erros.opcao ? inputErro : inputOk}`}
                  >
                    <option value="">Selecione uma opção</option>
                    {selectOptions.map((option, i) => (
                      <option key={option.label} value={i}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {erros.opcao && (
                    <p id={`${idDe("opcao")}-erro`} role="alert" className="text-sm text-red-600">
                      {erros.opcao}
                    </p>
                  )}
                </div>
              )}

              {labelEspessura && (
                <CampoNumerico
                  id={idDe("espessura")}
                  label={labelEspessura}
                  value={form.espessura}
                  onChange={(v) => atualizar("espessura", v)}
                  placeholder={espessuraAtual !== undefined ? `Padrão: ${formatar(espessuraAtual)}` : "Ex: 2"}
                  sufixo="cm"
                  opcional
                  erro={erros.espessura}
                  enterKeyHint={hint("espessura")}
                />
              )}

              {temAjustes && (
                <details
                  open={ajustesAbertos}
                  onToggle={(e) => setAjustesAbertos(e.currentTarget.open)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">
                    Ajustes opcionais: {rotuloAjustes}
                  </summary>
                  <div className="mt-3 flex flex-col gap-4 pb-1">
                    {labelDesconto && (
                      <CampoNumerico
                        id={idDe("desconto")}
                        label={labelDesconto}
                        value={form.desconto}
                        onChange={(v) => atualizar("desconto", v)}
                        placeholder="Ex: 3,6"
                        sufixo="m²"
                        opcional
                        erro={erros.desconto}
                        enterKeyHint={hint("desconto")}
                      />
                    )}
                    {perdaPadrao !== undefined && (
                      <CampoNumerico
                        id={idDe("perda")}
                        label={labelPerda}
                        value={form.perda}
                        onChange={(v) => atualizar("perda", v)}
                        placeholder="Ex: 10"
                        sufixo="%"
                        erro={erros.perda}
                        enterKeyHint={hint("perda")}
                      />
                    )}
                  </div>
                </details>
              )}

              {erroGeral && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erroGeral}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-[#079C9C] px-3 py-3 font-medium text-white shadow-sm hover:bg-[#079C9C]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] active:bg-[#079C9C]/80"
                >
                  {labelBotao}
                </button>
                <button
                  type="button"
                  onClick={limpar}
                  aria-label="Limpar campos"
                  title="Limpar campos"
                  className="rounded-md border border-slate-200 bg-white px-3 text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]"
                >
                  <RotateCcw className="size-5" aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>

          {/* ─────────── resultado ─────────── */}
          {/* no celular o painel só aparece depois de calcular */}
          <div
            ref={painelRef}
            aria-live="polite"
            className={`w-full scroll-mt-40 rounded-xl border border-slate-200 bg-gray-100 p-4 shadow-sm lg:basis-2/3 lg:p-6 ${
              calculo ? "" : "hidden lg:flex lg:items-center lg:justify-center"
            }`}
          >
            {!calculo || !principal ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
                <Calculator className="size-10" aria-hidden="true" />
                <p className="text-sm">Preencha as medidas e clique em “{labelBotao}”.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-500">{calculo.resumo}</p>

                {/* resultado principal */}
                <div className="min-w-0 rounded-lg bg-white p-4 shadow-sm">
                  <p className="font-semibold text-slate-600">{principal.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="break-words text-4xl font-semibold tabular-nums text-[#079C9C] sm:text-5xl lg:text-6xl">
                      {principal.texto}
                    </span>
                    {principal.unidade && (
                      <span className="text-xl font-bold sm:text-2xl">{principal.unidade}</span>
                    )}
                    {principal.icone && <span className="shrink-0">{principal.icone}</span>}
                  </div>
                  {principal.detalhe && <p className="mt-2 text-sm text-slate-500">{principal.detalhe}</p>}
                </div>

                {/* comparação entre alternativas (ex.: tamanhos de régua) */}
                {calculo.comparacao && (
                  <div className="rounded-lg border-2 border-[#079C9C] bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-wide text-[#079C9C]">
                      {calculo.comparacao.titulo}
                    </p>
                    <p className="mt-1 text-3xl font-semibold sm:text-4xl">{calculo.comparacao.destaque}</p>
                    {calculo.comparacao.destaqueDetalhe && (
                      <p className="mt-1 text-sm text-slate-600">{calculo.comparacao.destaqueDetalhe}</p>
                    )}

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-slate-500">
                            {calculo.comparacao.colunas.map((c) => (
                              <th key={c} className="py-1.5 pl-2 pr-3 font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {calculo.comparacao.linhas.map((l) => (
                            <tr key={l.label} className={l.melhor ? "bg-[#079C9C]/10 font-semibold" : ""}>
                              <td className="whitespace-nowrap py-2 pl-2 pr-3">
                                {l.label}
                                {l.melhor && (
                                  <span className="ml-2 rounded-full bg-[#079C9C] px-2 py-0.5 text-xs font-medium text-white">
                                    Melhor
                                  </span>
                                )}
                              </td>
                              {l.valores.map((valor, i) => (
                                <td key={i} className="py-2 pl-2 pr-3 tabular-nums">
                                  {valor}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* demais resultados */}
                {demais.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {demais.map((item) => (
                      <div key={item.label} className="min-w-0 rounded-lg bg-white p-4 shadow-sm">
                        <p className="font-semibold text-slate-600">{item.label}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {item.icone && <span className="shrink-0">{item.icone}</span>}
                          <span className="text-2xl font-semibold tabular-nums sm:text-3xl">{item.texto}</span>
                          {item.unidade && <span className="text-lg font-bold">{item.unidade}</span>}
                        </div>
                        {item.detalhe && <p className="mt-2 text-sm text-slate-500">{item.detalhe}</p>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copiar}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]"
                  >
                    {copiado ? (
                      <Check className="size-4 text-[#079C9C]" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" aria-hidden="true" />
                    )}
                    {copiado ? "Copiado!" : "Copiar resultado"}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(textoCompartilhar)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]"
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    Enviar no WhatsApp
                  </a>
                </div>

                <p className="text-xs text-slate-500">
                  {calculo.observacao ? `${calculo.observacao} ` : ""}
                  Valores estimados: confirme as quantidades com seu fornecedor antes de comprar.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}