'use client'

import { useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import { lerRelatorioCaixa } from '../utils/lerRelatorioCaixa'
import { lerMovimentacao } from '../utils/lerMovimentacao'
import { calcularResumo } from '../utils/calcularDia'
import type { DiaPendente } from '../utils/diasPendentes'
import type { DiaCaixa, ResultadoCaixa, ResultadoMovimentacao } from '../utils/tipos'
import {
  gravarCaixa,
  gravarItens,
  precosDoCatalogo,
  verificarDias,
} from '../services/financeiroService'

interface ArquivoCaixa {
  id: number
  nome: string
  resultado: ResultadoCaixa
}

interface ArquivoMov {
  id: number
  nome: string
  resultado: ResultadoMovimentacao
  dia: string // AAAA-MM-DD (vazio = ainda não escolhido)
  sugerido: boolean // a data foi sugerida pelo sistema, não escolhida por você
  ordem: number // quando o arquivo foi exportado
}

const reais = (n: number | null) => (n === null ? '—' : formatarReais(n))

const formatarDia = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const rotuloDia = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
}

function ontem() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "excel_10102026_122904.csv" -> momento da exportação (senão, a data do arquivo)
function ordemDoArquivo(f: File) {
  const m = /(\d{2})(\d{2})(\d{4})_(\d{2})(\d{2})(\d{2})/.exec(f.name)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]).getTime()
  return f.lastModified
}

// sugere a data de cada movimentação nova, sem nunca decidir sozinho quando há dúvida
function sugerir(
  novos: ArquivoMov[],
  caixas: ArquivoCaixa[],
  jaTem: ArquivoMov[],
  pendentes: DiaPendente[]
): ArquivoMov[] {
  if (novos.length === 0) return novos

  const ocupados = new Set(jaTem.map((m) => m.dia).filter(Boolean))
  const ordenados = [...novos].sort((a, b) => a.ordem - b.ordem)

  const doCaixa = [...new Set(caixas.flatMap((a) => a.resultado.dias.map((d) => d.dia)))]
    .filter((d) => !ocupados.has(d))
    .sort()
  const dosPendentes = pendentes
    .filter((p) => p.faltaItens && !ocupados.has(p.dia))
    .map((p) => p.dia)
    .sort()

  const candidatos =
    doCaixa.length === ordenados.length
      ? doCaixa
      : dosPendentes.length === ordenados.length
        ? dosPendentes
        : ordenados.length === 1
          ? [ontem()]
          : []

  const mapa = new Map<number, string>()
  ordenados.forEach((m, i) => {
    if (candidatos[i]) mapa.set(m.id, candidatos[i])
  })

  return novos.map((m) => (mapa.has(m.id) ? { ...m, dia: mapa.get(m.id)!, sugerido: true } : m))
}

function Celula({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`text-sm font-semibold md:text-base ${tom ?? 'text-slate-800'}`}>{valor}</p>
    </div>
  )
}

export default function ImportarDia({
  onSalvo,
  pendentes = [],
}: {
  onSalvo: () => void
  pendentes?: DiaPendente[]
}) {
  const [caixas, setCaixas] = useState<ArquivoCaixa[]>([])
  const [movs, setMovs] = useState<ArquivoMov[]>([])
  const [precos, setPrecos] = useState<Map<string, number | null> | null>(null)
  const [existentes, setExistentes] = useState<{ caixa: string[]; itens: string[] }>({
    caixa: [],
    itens: [],
  })
  const [erros, setErros] = useState<string[]>([])
  const [sucesso, setSucesso] = useState('')
  const [lendo, setLendo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const contador = useRef(0)

  // preços do catálogo e dias que já existem (para avisar da substituição)
  const verificar = async (cx: ArquivoCaixa[], mv: ArquivoMov[]) => {
    try {
      const codigos = mv.flatMap((m) => m.resultado.itens.map((i) => i.codigo))
      const diasCx = [...new Set(cx.flatMap((a) => a.resultado.dias.map((d) => d.dia)))]
      const diasIt = [...new Set(mv.map((m) => m.dia).filter(Boolean))]

      const [p, ex] = await Promise.all([
        codigos.length > 0 ? precosDoCatalogo(codigos) : Promise.resolve(null),
        verificarDias(diasCx, diasIt),
      ])
      setPrecos(p)
      setExistentes(ex)
    } catch (e) {
      setErros((prev) => [...prev, e instanceof Error ? e.message : 'Erro ao conferir os dados'])
    }
  }

  const aoEscolher = async (arquivos: File[]) => {
    if (arquivos.length === 0) return
    setSucesso('')
    setLendo(true)

    const novosErros: string[] = []
    let cx = [...caixas]
    const novosMovs: ArquivoMov[] = []

    for (const f of arquivos) {
      try {
        const buffer = await f.arrayBuffer()
        const nome = f.name.toLowerCase()
        if (nome.endsWith('.csv')) {
          novosMovs.push({
            id: ++contador.current,
            nome: f.name,
            resultado: lerMovimentacao(buffer),
            dia: '',
            sugerido: false,
            ordem: ordemDoArquivo(f),
          })
        } else if (nome.endsWith('.txt')) {
          cx = [...cx, { id: ++contador.current, nome: f.name, resultado: lerRelatorioCaixa(buffer) }]
        } else {
          throw new Error('Use o .txt do caixa ou o .csv de movimentação.')
        }
      } catch (e) {
        novosErros.push(`${f.name}: ${e instanceof Error ? e.message : 'não consegui ler o arquivo'}`)
      }
    }

    const mv = [...movs, ...sugerir(novosMovs, cx, movs, pendentes)]
    setCaixas(cx)
    setMovs(mv)
    setErros(novosErros)
    await verificar(cx, mv)
    setLendo(false)
  }

  const limpar = () => {
    setCaixas([])
    setMovs([])
    setPrecos(null)
    setExistentes({ caixa: [], itens: [] })
    setErros([])
  }

  const removerCaixa = async (id: number) => {
    const cx = caixas.filter((a) => a.id !== id)
    setCaixas(cx)
    await verificar(cx, movs)
  }

  const removerMov = async (id: number) => {
    const mv = movs.filter((m) => m.id !== id)
    setMovs(mv)
    await verificar(caixas, mv)
  }

  const mudarDiaMov = async (id: number, dia: string) => {
    const mv = movs.map((m) => (m.id === id ? { ...m, dia, sugerido: false } : m))
    setMovs(mv)
    await verificar(caixas, mv)
  }

  // dias do caixa: se o mesmo dia vier em dois arquivos, vale o último
  const mapaCaixa = new Map<string, DiaCaixa>()
  const diasRepetidos: string[] = []
  for (const a of caixas) {
    for (const d of a.resultado.dias) {
      if (mapaCaixa.has(d.dia)) diasRepetidos.push(d.dia)
      mapaCaixa.set(d.dia, d)
    }
  }

  const diasLista = [
    ...new Set([...mapaCaixa.keys(), ...movs.map((m) => m.dia).filter(Boolean)]),
  ].sort()

  const salvar = async () => {
    if (movs.some((m) => !m.dia)) {
      setErros(['Escolha a data de cada movimentação.'])
      return
    }
    const diasMov = movs.map((m) => m.dia)
    if (new Set(diasMov).size !== diasMov.length) {
      setErros(['Há dois arquivos de movimentação no mesmo dia.'])
      return
    }

    setSaving(true)
    setErros([])
    setSucesso('')
    try {
      const diasCaixa = [...mapaCaixa.values()]
      if (diasCaixa.length > 0) await gravarCaixa(diasCaixa)
      for (const m of movs) await gravarItens(m.dia, m.resultado.itens, precos ?? new Map())

      const partes: string[] = []
      if (diasCaixa.length > 0)
        partes.push(`caixa de ${diasCaixa.length} ${diasCaixa.length === 1 ? 'dia' : 'dias'}`)
      if (movs.length > 0)
        partes.push(`movimentação de ${movs.length} ${movs.length === 1 ? 'dia' : 'dias'}`)
      setSucesso(`Importação salva: ${partes.join(' e ')}.`)
      limpar()
      onSalvo()
    } catch (e) {
      setErros([e instanceof Error ? e.message : 'Erro ao salvar a importação'])
    } finally {
      setSaving(false)
    }
  }

  const naoEncontrados = precos
    ? [
        ...new Map(
          movs
            .flatMap((m) => m.resultado.itens)
            .filter((i) => !precos.has(i.codigo))
            .map((i) => [i.codigo, i])
        ).values(),
      ]
    : []

  const avisos = [
    ...caixas.flatMap((a) => a.resultado.avisos),
    ...movs.flatMap((m) => m.resultado.avisos),
    ...[...new Set(diasRepetidos)].map(
      (d) => `O dia ${formatarDia(d)} está em mais de um arquivo de caixa. Vale o último.`
    ),
  ]

  const temArquivo = caixas.length > 0 || movs.length > 0
  const faltaData = movs.some((m) => !m.dia)

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div>
        <h4 className="text-lg font-bold text-slate-900">Importar fechamentos</h4>
        <p className="text-sm text-slate-500">
          Solte o relatório do caixa (.txt) e a movimentação de estoque (.csv). Para mais de um
          dia, exporte um arquivo de cada dia e solte todos de uma vez.
        </p>
      </div>

      {/* Área de envio */}
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          aoEscolher(Array.from(e.dataTransfer.files))
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          arrastando
            ? 'border-[#079C9C] bg-[#079C9C]/5'
            : 'border-slate-300 bg-slate-50 hover:border-[#079C9C] hover:bg-[#079C9C]/5'
        }`}
      >
        {lendo ? (
          <Loader2 className="size-7 animate-spin text-[#079C9C]" />
        ) : (
          <Upload className="size-7 text-[#079C9C]" />
        )}
        <p className="text-sm font-semibold text-slate-700">
          {lendo ? 'Lendo os arquivos...' : 'Solte os arquivos aqui ou toque para escolher'}
        </p>
        <p className="text-xs text-slate-400">Caixa (.txt) e movimentação (.csv), de um ou mais dias</p>
        <input
          type="file"
          accept=".txt,.csv"
          multiple
          className="hidden"
          onChange={(e) => {
            const arquivos = Array.from(e.target.files ?? [])
            e.target.value = ''
            aoEscolher(arquivos)
          }}
        />
      </label>

      {sucesso && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" />
          {sucesso}
        </p>
      )}

      {erros.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erros.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {temArquivo && (
        <div className="space-y-4">
          {/* Arquivos lidos */}
          <ul className="space-y-2">
            {caixas.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
              >
                <FileText className="size-5 shrink-0 text-[#079C9C]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{a.nome}</p>
                  <p className="text-xs text-slate-500">
                    Caixa de{' '}
                    {a.resultado.dias.length === 1
                      ? formatarDia(a.resultado.dias[0].dia)
                      : `${a.resultado.dias.length} dias`}
                    {' · '}
                    {a.resultado.dias.reduce((s, d) => s + d.pedidos, 0)} vendas
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remover ${a.nome}`}
                  onClick={() => removerCaixa(a.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}

            {movs.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
              >
                <FileSpreadsheet className="size-5 shrink-0 text-[#079C9C]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{m.nome}</p>
                  <p className="text-xs text-slate-500">
                    {m.resultado.itens.length} itens movimentados
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    Dia
                    <input
                      type="date"
                      value={m.dia}
                      onChange={(e) => mudarDiaMov(m.id, e.target.value)}
                      className={`rounded-md border bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 ${
                        m.dia ? 'border-slate-200' : 'border-amber-400'
                      }`}
                    />
                  </label>
                  {m.sugerido && (
                    <span className="text-[11px] text-amber-600">sugerida, confira</span>
                  )}
                  {!m.dia && (
                    <span className="text-[11px] text-amber-600">escolha o dia</span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remover ${m.nome}`}
                  onClick={() => removerMov(m.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          {/* Avisos de substituição */}
          {(existentes.caixa.length > 0 || existentes.itens.length > 0) && (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {existentes.caixa.length > 0 && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  O caixa de {existentes.caixa.map(formatarDia).join(', ')} já estava importado e
                  será substituído.
                </p>
              )}
              {existentes.itens.length > 0 && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  A movimentação de {existentes.itens.map(formatarDia).join(', ')} já estava
                  importada e será substituída.
                </p>
              )}
            </div>
          )}

          {/* Conferência, um cartão por dia */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Conferência</p>

            {diasLista.map((dia) => {
              const cx = mapaCaixa.get(dia) ?? null
              const mv = movs.find((m) => m.dia === dia) ?? null
              const r = calcularResumo(cx, mv?.resultado ?? null, precos ?? new Map())
              const estranha = r.margem !== null && (r.margem < 10 || r.margem > 70)
              const devolvidos = mv ? mv.resultado.itens.filter((i) => i.entrada > 0) : []

              return (
                <div key={dia} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="font-semibold capitalize text-slate-900">{rotuloDia(dia)}</p>
                    {!cx && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        sem caixa
                      </span>
                    )}
                    {!mv && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        sem movimentação
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Celula rotulo="Vendas" valor={reais(r.vendas)} />
                    <Celula rotulo="Recebido" valor={reais(r.recebido)} />
                    <Celula rotulo="Custo" valor={reais(r.custoLiquido)} />
                    <Celula
                      rotulo="Lucro"
                      valor={
                        r.lucro === null
                          ? '—'
                          : `${formatarReais(r.lucro)}${r.margem !== null ? ` (${String(r.margem).replace('.', ',')}%)` : ''}`
                      }
                      tom={
                        r.lucro === null ? undefined : r.lucro >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }
                    />
                  </div>

                  {estranha && (
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      A margem está fora do comum. Confira se a movimentação é mesmo deste dia.
                    </p>
                  )}

                  {(cx || devolvidos.length > 0) && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-xs font-medium text-[#079C9C]">
                        Ver detalhes
                      </summary>
                      {cx && (
                        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-slate-50 px-3 py-3 md:grid-cols-3">
                          {(
                            [
                              ['Dinheiro', cx.dinheiro],
                              ['PIX', cx.pix],
                              ['Cartão', cx.cartao],
                              ['Crédito do cliente usado', cx.creditoConta],
                              ['Fiado de hoje', cx.pendencia ?? 0],
                              ['Fiado antigo pago', cx.pendenciasPagas],
                            ] as [string, number][]
                          ).map(([nome, valor]) => (
                            <div key={nome} className="flex justify-between gap-3">
                              <dt className="text-slate-500">{nome}</dt>
                              <dd className="font-medium text-slate-800">{formatarReais(valor)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {devolvidos.length > 0 && mv && (
                        <p className="mt-2 text-xs text-slate-500">
                          <strong className="text-slate-700">Devoluções:</strong>{' '}
                          {devolvidos.length} {devolvidos.length === 1 ? 'item' : 'itens'} (custo{' '}
                          {formatarReais(mv.resultado.custoEntradas)}, venda estimada em{' '}
                          {reais(r.devolucoesVenda)}). Entram abatendo vendas e custo.
                        </p>
                      )}
                    </details>
                  )}
                </div>
              )
            })}

            {naoEncontrados.length > 0 && (
              <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <summary className="cursor-pointer font-medium">
                  {naoEncontrados.length}{' '}
                  {naoEncontrados.length === 1 ? 'item não está' : 'itens não estão'} no catálogo
                </summary>
                <p className="mt-1 text-xs">
                  Eles serão salvos mesmo assim, só ficam sem o preço do catálogo.
                </p>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {naoEncontrados.map((i) => (
                    <li key={i.codigo}>
                      {i.codigo} · {i.descricao}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {avisos.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {avisos.slice(0, 5).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
                {avisos.length > 5 && <li>... e mais {avisos.length - 5} avisos.</li>}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={limpar}
              disabled={saving}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={salvar}
              disabled={saving || lendo || faltaData}
              className="min-w-44 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar importação'
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}