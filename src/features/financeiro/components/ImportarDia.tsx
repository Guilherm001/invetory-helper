'use client'

import { useState } from 'react'
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
import type { ResultadoCaixa, ResultadoMovimentacao } from '../utils/tipos'
import {
  gravarCaixa,
  gravarItens,
  precosDoCatalogo,
  verificarDias,
} from '../services/financeiroService'

const reais = (n: number | null) => (n === null ? '—' : formatarReais(n))

const formatarDia = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function ontem() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Stat({
  rotulo,
  valor,
  sub,
  tom,
}: {
  rotulo: string
  valor: string
  sub?: string
  tom?: 'verde' | 'vermelho'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p
        className={`mt-0.5 text-lg font-bold md:text-xl ${
          tom === 'verde' ? 'text-emerald-700' : tom === 'vermelho' ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {valor}
      </p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

export default function ImportarDia({ onSalvo }: { onSalvo: () => void }) {
  const [caixa, setCaixa] = useState<ResultadoCaixa | null>(null)
  const [nomeCaixa, setNomeCaixa] = useState('')
  const [mov, setMov] = useState<ResultadoMovimentacao | null>(null)
  const [nomeMov, setNomeMov] = useState('')
  const [diaMov, setDiaMov] = useState('')
  const [diaEditado, setDiaEditado] = useState(false)
  const [precos, setPrecos] = useState<Map<string, number | null> | null>(null)
  const [existentes, setExistentes] = useState<{ caixa: string[]; itens: boolean }>({
    caixa: [],
    itens: false,
  })
  const [erros, setErros] = useState<string[]>([])
  const [sucesso, setSucesso] = useState('')
  const [lendo, setLendo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [arrastando, setArrastando] = useState(false)

  // preços do catálogo e dias que já existem (para avisar da substituição)
  const verificar = async (
    cx: ResultadoCaixa | null,
    mv: ResultadoMovimentacao | null,
    dMov: string
  ) => {
    try {
      const [p, ex] = await Promise.all([
        mv ? precosDoCatalogo(mv.itens.map((i) => i.codigo)) : Promise.resolve(null),
        verificarDias(cx ? cx.dias.map((d) => d.dia) : [], mv && dMov ? dMov : null),
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
    let cx = caixa
    let nc = nomeCaixa
    let mv = mov
    let nm = nomeMov

    for (const f of arquivos) {
      try {
        const buffer = await f.arrayBuffer()
        const nome = f.name.toLowerCase()
        if (nome.endsWith('.csv')) {
          mv = lerMovimentacao(buffer)
          nm = f.name
        } else if (nome.endsWith('.txt')) {
          cx = lerRelatorioCaixa(buffer)
          nc = f.name
        } else {
          throw new Error('Use o .txt do caixa ou o .csv de movimentação.')
        }
      } catch (e) {
        novosErros.push(`${f.name}: ${e instanceof Error ? e.message : 'não consegui ler o arquivo'}`)
      }
    }

    // a movimentação não tem data: segue a do caixa (se for de um dia só), senão ontem
    let d = diaMov
    if (mv && !diaEditado) {
      const unico = cx && cx.dias.length === 1 ? cx.dias[0].dia : null
      d = unico ?? (diaMov || ontem())
    }

    setCaixa(cx)
    setNomeCaixa(nc)
    setMov(mv)
    setNomeMov(nm)
    setDiaMov(d)
    setErros(novosErros)
    await verificar(cx, mv, d)
    setLendo(false)
  }

  const limpar = () => {
    setCaixa(null)
    setNomeCaixa('')
    setMov(null)
    setNomeMov('')
    setDiaMov('')
    setDiaEditado(false)
    setPrecos(null)
    setExistentes({ caixa: [], itens: false })
    setErros([])
  }

  const removerCaixa = async () => {
    setCaixa(null)
    setNomeCaixa('')
    await verificar(null, mov, diaMov)
  }

  const removerMov = async () => {
    setMov(null)
    setNomeMov('')
    setPrecos(null)
    await verificar(caixa, null, '')
  }

  const salvar = async () => {
    if (mov && !diaMov) {
      setErros(['Escolha a data da movimentação.'])
      return
    }
    setSaving(true)
    setErros([])
    setSucesso('')
    try {
      if (caixa) await gravarCaixa(caixa.dias)
      if (mov) await gravarItens(diaMov, mov.itens, precos ?? new Map())

      const partes: string[] = []
      if (caixa) partes.push(`caixa de ${caixa.dias.length} ${caixa.dias.length === 1 ? 'dia' : 'dias'}`)
      if (mov) partes.push(`${mov.itens.length} itens de ${formatarDia(diaMov)}`)
      setSucesso(`Importação salva: ${partes.join(' e ')}.`)
      limpar()
      onSalvo()
    } catch (e) {
      setErros([e instanceof Error ? e.message : 'Erro ao salvar a importação'])
    } finally {
      setSaving(false)
    }
  }

  const diaCaixa = caixa && caixa.dias.length === 1 ? caixa.dias[0] : null
  const resumo = calcularResumo(diaCaixa, mov, precos ?? new Map())
  const naoEncontrados = mov && precos ? mov.itens.filter((i) => !precos.has(i.codigo)) : []
  const devolvidos = mov ? mov.itens.filter((i) => i.entrada > 0) : []
  const avisos = [...(caixa?.avisos ?? []), ...(mov?.avisos ?? [])]
  const dataDiferente = !!diaCaixa && !!mov && !!diaMov && diaCaixa.dia !== diaMov
  const temArquivo = !!caixa || !!mov

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div>
        <h4 className="text-lg font-bold text-slate-900">Importar o dia</h4>
        <p className="text-sm text-slate-500">
          Solte o relatório do caixa (.txt) e a movimentação de estoque (.csv). Dá para enviar um
          de cada vez.
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
        <p className="text-xs text-slate-400">Relatório do caixa (.txt) e movimentação (.csv)</p>
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
            {caixa && (
              <li className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <FileText className="size-5 shrink-0 text-[#079C9C]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{nomeCaixa}</p>
                  <p className="text-xs text-slate-500">
                    {caixa.dias.length === 1
                      ? `Caixa de ${formatarDia(caixa.dias[0].dia)}`
                      : `Caixa de ${caixa.dias.length} dias`}
                    {' · '}
                    {caixa.dias.reduce((s, d) => s + d.pedidos, 0)} vendas
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Remover relatório do caixa"
                  onClick={removerCaixa}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              </li>
            )}

            {mov && (
              <li className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <FileSpreadsheet className="size-5 shrink-0 text-[#079C9C]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{nomeMov}</p>
                  <p className="text-xs text-slate-500">{mov.itens.length} itens movimentados</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  Dia
                  <input
                    type="date"
                    value={diaMov}
                    onChange={(e) => {
                      setDiaMov(e.target.value)
                      setDiaEditado(true)
                      verificar(caixa, mov, e.target.value)
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Remover movimentação"
                  onClick={removerMov}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              </li>
            )}
          </ul>

          {/* Avisos de substituição e de data */}
          {(existentes.caixa.length > 0 || existentes.itens || dataDiferente) && (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {existentes.caixa.length > 0 && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  O caixa de {existentes.caixa.map(formatarDia).join(', ')} já estava importado e
                  será substituído.
                </p>
              )}
              {existentes.itens && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  A movimentação de {formatarDia(diaMov)} já estava importada e será substituída.
                </p>
              )}
              {dataDiferente && diaCaixa && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  A movimentação está no dia {formatarDia(diaMov)}, mas o caixa é de{' '}
                  {formatarDia(diaCaixa.dia)}. Confira a data.
                </p>
              )}
            </div>
          )}

          {/* Conferência */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              Conferência
              {diaCaixa && ` · ${formatarDia(diaCaixa.dia)}`}
            </p>

            {caixa && !diaCaixa && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                O relatório tem vários dias. Cada dia será gravado separadamente, mas o lucro só
                é calculado depois de salvar, e o fiado não é atribuído a nenhum deles.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                rotulo="Vendas do dia"
                valor={reais(resumo.vendas)}
                sub={diaCaixa ? 'caixa − fiado antigo + fiado de hoje' : 'falta o relatório do caixa'}
              />
              <Stat
                rotulo="Recebido"
                valor={reais(resumo.recebido)}
                sub={diaCaixa ? 'dinheiro + PIX + cartão' : 'falta o relatório do caixa'}
              />
              <Stat
                rotulo="Custo das saídas"
                valor={reais(resumo.custoLiquido)}
                sub={mov ? 'já sem as devoluções' : 'falta a movimentação'}
              />
              <Stat
                rotulo="Lucro bruto"
                valor={reais(resumo.lucro)}
                sub={resumo.margem !== null ? `margem de ${String(resumo.margem).replace('.', ',')}%` : 'precisa dos dois arquivos'}
                tom={resumo.lucro === null ? undefined : resumo.lucro >= 0 ? 'verde' : 'vermelho'}
              />
            </div>

            {diaCaixa && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-slate-50 px-3 py-3 text-sm md:grid-cols-3">
                {[
                  ['Dinheiro', diaCaixa.dinheiro],
                  ['PIX', diaCaixa.pix],
                  ['Cartão', diaCaixa.cartao],
                  ['Crédito do cliente usado', diaCaixa.creditoConta],
                  ['Fiado de hoje', diaCaixa.pendencia ?? 0],
                  ['Fiado antigo pago', diaCaixa.pendenciasPagas],
                ].map(([nome, valor]) => (
                  <div key={nome as string} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{nome}</dt>
                    <dd className="font-medium text-slate-800">{formatarReais(valor as number)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {devolvidos.length > 0 && (
              <p className="text-sm text-slate-500">
                <strong className="text-slate-700">Devoluções:</strong> {devolvidos.length}{' '}
                {devolvidos.length === 1 ? 'item voltou' : 'itens voltaram'} ao estoque (custo{' '}
                {formatarReais(mov!.custoEntradas)}, venda estimada em{' '}
                {reais(resumo.devolucoesVenda)}). Entram abatendo vendas e custo.
              </p>
            )}

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
              disabled={saving || lendo || (!!mov && !diaMov)}
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