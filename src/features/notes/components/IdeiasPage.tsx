'use client'

import { useMemo, useRef, useState } from 'react'
import {
  Check,
  ClipboardCopy,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog'
import { useIdeias } from '../hooks/useIdeias'
import {
  AREAS,
  AREA_ROTULO,
  EM_ABERTO,
  STATUS,
  STATUS_INFO,
  TIPOS,
  TIPO_INFO,
  textoParaCopiar,
  type AreaIdeia,
  type Ideia,
  type NovaIdeia,
  type StatusIdeia,
  type TipoIdeia,
} from '../lib/ideias'
import IdeiaDialog from './Ideiadialog'

type FiltroStatus = 'abertas' | 'todas' | StatusIdeia

const selectClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

// sem acento, minúsculo
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

// ---------- cartão de uma ideia ----------

function Cartao({
  ideia,
  onEditar,
  onExcluir,
  onStatus,
  onDestaque,
}: {
  ideia: Ideia
  onEditar: () => void
  onExcluir: () => void
  onStatus: (s: StatusIdeia) => void
  onDestaque: () => void
}) {
  const encerrada = ideia.status === 'feita' || ideia.status === 'descartada'
  const tipo = TIPO_INFO[ideia.tipo]

  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm transition ${
        ideia.destaque && !encerrada ? 'border-amber-300' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tipo.classe}`}>
            {tipo.rotulo}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {AREA_ROTULO[ideia.area]}
          </span>
        </div>

        <button
          type="button"
          aria-label={ideia.destaque ? 'Tirar de importante' : 'Marcar como importante'}
          aria-pressed={ideia.destaque}
          onClick={onDestaque}
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 transition hover:bg-amber-50"
        >
          <Star
            className={`size-[18px] ${
              ideia.destaque ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
            }`}
          />
        </button>
      </div>

      <p
        className={`whitespace-pre-wrap break-words font-semibold ${
          encerrada ? 'text-slate-400' : 'text-slate-900'
        } ${ideia.status === 'feita' ? 'line-through' : ''}`}
      >
        {ideia.texto}
      </p>

      {ideia.detalhes && (
        <p
          className={`whitespace-pre-wrap break-words text-sm ${
            encerrada ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          {ideia.detalhes}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <select
            value={ideia.status}
            onChange={(e) => onStatus(e.target.value as StatusIdeia)}
            aria-label="Situação da ideia"
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold outline-none ${
              STATUS_INFO[ideia.status].classe
            }`}
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_INFO[s].rotulo}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">{dataCurta(ideia.created_at)}</span>
        </div>

        <div className="flex">
          <button
            type="button"
            aria-label="Editar ideia"
            title="Editar"
            onClick={onEditar}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
          >
            <Pencil className="size-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Excluir ideia"
            title="Excluir"
            onClick={onExcluir}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="size-[18px]" />
          </button>
        </div>
      </div>
    </li>
  )
}

// ---------- página ----------

export default function IdeiasPage() {
  const { ideias, loading, error, adicionar, atualizar, excluir } = useIdeias()

  // barra de captura rápida
  const [texto, setTexto] = useState('')
  const [areaRapida, setAreaRapida] = useState<AreaIdeia>('geral')
  const [tipoRapido, setTipoRapido] = useState<TipoIdeia>('recurso')
  const [adicionando, setAdicionando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // lista
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('abertas')
  const [filtroArea, setFiltroArea] = useState<AreaIdeia | 'todas'>('todas')
  const [busca, setBusca] = useState('')

  const [dialog, setDialog] = useState<{
    open: boolean
    ideia: Ideia | null
    textoInicial: string
  }>({ open: false, ideia: null, textoInicial: '' })
  const [paraExcluir, setParaExcluir] = useState<Ideia | null>(null)
  const [aviso, setAviso] = useState('')
  const [erroAcao, setErroAcao] = useState('')

  const mostrarAviso = (msg: string) => {
    setAviso(msg)
    setTimeout(() => setAviso((atual) => (atual === msg ? '' : atual)), 2500)
  }

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todas: ideias.length, abertas: 0 }
    for (const s of STATUS) c[s] = 0
    for (const i of ideias) {
      c[i.status]++
      if (EM_ABERTO.includes(i.status)) c.abertas++
    }
    return c
  }, [ideias])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim())

    return ideias
      .filter((i) => {
        if (filtroStatus === 'abertas') {
          if (!EM_ABERTO.includes(i.status)) return false
        } else if (filtroStatus !== 'todas' && i.status !== filtroStatus) {
          return false
        }
        if (filtroArea !== 'todas' && i.area !== filtroArea) return false
        if (termo && !normalizar(`${i.texto} ${i.detalhes ?? ''}`).includes(termo)) return false
        return true
      })
      .sort((a, b) => Number(b.destaque) - Number(a.destaque)) // importantes primeiro
  }, [ideias, filtroStatus, filtroArea, busca])

  // ---------- ações ----------

  const guardarRapido = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t || adicionando) return

    setAdicionando(true)
    setErroAcao('')
    try {
      await adicionar({ texto: t, area: areaRapida, tipo: tipoRapido })
      setTexto('')
      mostrarAviso('Ideia guardada.')
      inputRef.current?.focus()
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível guardar a ideia')
    } finally {
      setAdicionando(false)
    }
  }

  const tentar = async (acao: () => Promise<unknown>) => {
    setErroAcao('')
    try {
      await acao()
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Ocorreu um erro')
    }
  }

  const salvarDoDialog = async (dados: NovaIdeia) => {
    if (dialog.ideia) {
      await atualizar(dialog.ideia.id, dados)
    } else {
      await adicionar(dados)
      setTexto('')
      mostrarAviso('Ideia guardada.')
    }
  }

  const copiarEmAberto = async () => {
    const lista = ideias.filter((i) => EM_ABERTO.includes(i.status))
    try {
      await navigator.clipboard.writeText(textoParaCopiar(lista))
      mostrarAviso(`${lista.length} ${lista.length === 1 ? 'ideia copiada' : 'ideias copiadas'}.`)
    } catch {
      setErroAcao('Não foi possível copiar. Seu navegador bloqueou a área de transferência.')
    }
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    await tentar(() => excluir(alvo.id))
  }

  const filtros: [FiltroStatus, string][] = [
    ['abertas', 'Em aberto'],
    ['nova', 'Novas'],
    ['planejada', 'Planejadas'],
    ['fazendo', 'Fazendo'],
    ['feita', 'Feitas'],
    ['descartada', 'Descartadas'],
    ['todas', 'Todas'],
  ]

  const temEmAberto = contagem.abertas > 0

  return (
    <div className="w-full pb-16">
      <div className="mt-7 flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
        <article className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#079C9C]/10 text-[#079C9C]">
            <Lightbulb className="size-6" />
          </span>
          <div>
            <h3 className="text-2xl font-bold md:text-3xl">Ideias</h3>
            <p className="text-sm text-gray-400">
              Anote aqui tudo que pensar sobre o site, assim que pensar. Depois você organiza.
            </p>
          </div>
        </article>

        <Button
          type="button"
          variant="outline"
          onClick={copiarEmAberto}
          disabled={!temEmAberto}
          className="gap-2 border-[#079C9C] text-[#079C9C] hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
        >
          <ClipboardCopy className="size-4" />
          Copiar as em aberto
        </Button>
      </div>

      {/* captura rápida */}
      <form
        onSubmit={guardarRapido}
        className="mb-5 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            maxLength={300}
            enterKeyHint="send"
            autoComplete="off"
            placeholder="Teve uma ideia? Escreva e aperte Enter"
            aria-label="Nova ideia"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
          />
          <Button
            type="submit"
            disabled={!texto.trim() || adicionando}
            className="shrink-0 gap-2 bg-[#079C9C] px-5 text-white hover:bg-[#079C9C]/90"
          >
            {adicionando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            <span className="hidden sm:inline">Guardar</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tipoRapido}
            onChange={(e) => setTipoRapido(e.target.value as TipoIdeia)}
            aria-label="Tipo da ideia"
            className={selectClass}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_INFO[t].rotulo}
              </option>
            ))}
          </select>

          <select
            value={areaRapida}
            onChange={(e) => setAreaRapida(e.target.value as AreaIdeia)}
            aria-label="Parte do site"
            className={selectClass}
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_ROTULO[a]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setDialog({ open: true, ideia: null, textoInicial: texto })}
            className="ml-auto text-sm font-semibold text-[#079C9C] hover:underline"
          >
            Adicionar com detalhes
          </button>
        </div>
      </form>

      {aviso && (
        <p
          role="status"
          className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <Check className="size-4 shrink-0" />
          {aviso}
        </p>
      )}

      {(error || erroAcao) && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || erroAcao}
        </p>
      )}

      {/* filtros */}
      {ideias.length > 0 && (
        <div className="mb-4 space-y-3">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div role="radiogroup" aria-label="Filtrar por situação" className="flex gap-2">
              {filtros.map(([valor, rotulo]) => {
                const ativo = filtroStatus === valor
                return (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setFiltroStatus(valor)}
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      ativo
                        ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {rotulo}
                    <span
                      className={`rounded-full px-1.5 text-xs ${
                        ativo ? 'bg-[#079C9C]/15' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {contagem[valor]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1 md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nas ideias"
                aria-label="Buscar nas ideias"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
              />
              {busca && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setBusca('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value as AreaIdeia | 'todas')}
              aria-label="Filtrar por parte do site"
              className={selectClass}
            >
              <option value="todas">Todas as partes</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {AREA_ROTULO[a]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* lista */}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando ideias...</p>
      ) : ideias.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#079C9C]/10 text-[#079C9C]">
            <Lightbulb className="size-6" />
          </div>
          <p className="text-base font-semibold text-slate-700">Nenhuma ideia guardada ainda</p>
          <p className="max-w-sm text-sm text-slate-500">
            Escreva a primeira na barra acima. Uma frase já basta, os detalhes você completa
            quando quiser.
          </p>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          Nenhuma ideia com esses filtros.
        </p>
      ) : (
        <ul className="grid items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {visiveis.map((i) => (
            <Cartao
              key={i.id}
              ideia={i}
              onEditar={() => setDialog({ open: true, ideia: i, textoInicial: '' })}
              onExcluir={() => setParaExcluir(i)}
              onStatus={(s) => tentar(() => atualizar(i.id, { status: s }))}
              onDestaque={() => tentar(() => atualizar(i.id, { destaque: !i.destaque }))}
            />
          ))}
        </ul>
      )}

      <IdeiaDialog
        open={dialog.open}
        ideia={dialog.ideia}
        textoInicial={dialog.textoInicial}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSalvar={salvarDoDialog}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ideia?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{paraExcluir?.texto}</strong> será apagada. Se só não quer mais vê-la na
              lista, mude a situação para &ldquo;Descartada&rdquo; em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
