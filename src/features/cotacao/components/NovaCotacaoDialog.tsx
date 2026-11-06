'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ClipboardList, Loader2, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import BuscaCatalogo from '@/features/catalogo/components/buscarCatalogo'
import type { CotacaoData } from '../types'
import { preparar } from '../services/gerarCotacao'
import { emitirCotacao } from '../services/emitirCotacao'
import type { CotacaoSalva } from '../services/cotacaoService'

interface Props {
  open: boolean
  base?: CotacaoSalva | null // cotação antiga usada como ponto de partida
  onClose: () => void
  onCriada: () => void
}

interface Item {
  key: string
  name: string
  quantity: string
  unit: string | null
  catalog_code: string | null
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium leading-none text-slate-500">
      {children}
    </kbd>
  )
}

function Conteudo({ base, onClose, onCriada }: Omit<Props, 'open'>) {
  const [fornecedor, setFornecedor] = useState(base?.fornecedor ?? '')
  const [itens, setItens] = useState<Item[]>(() =>
    (base?.itens ?? []).map((i) => ({
      key: `b:${i.id}`,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      catalog_code: i.catalog_code,
    }))
  )
  const [aviso, setAviso] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const buscaWrapRef = useRef<HTMLDivElement>(null)
  const qtdRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const focoPendente = useRef<string | null>(null)

  // carrega a biblioteca do PDF antes do clique
  useEffect(() => {
    preparar()
  }, [])

  // depois que a lista muda, leva o foco para a quantidade pedida
  useEffect(() => {
    const key = focoPendente.current
    if (!key) return
    focoPendente.current = null
    const el = qtdRefs.current.get(key)
    el?.focus()
    el?.select()
  }, [itens])

  const focarBusca = () => {
    const input = buscaWrapRef.current?.querySelector('input')
    input?.focus()
    input?.select()
  }

  const adicionarDoCatalogo = (c: { name: string; unit: string | null; code: string }) => {
    const existente = itens.find((i) => i.catalog_code === c.code)
    if (existente) {
      setAviso(`"${c.name}" já está na lista.`)
      qtdRefs.current.get(existente.key)?.focus()
      return
    }
    setAviso('')
    const key = `c:${c.code}`
    focoPendente.current = key
    setItens([...itens, { key, name: c.name, quantity: '', unit: c.unit, catalog_code: c.code }])
  }

  const atualizarQtd = (key: string, quantity: string) =>
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, quantity } : i)))

  const remover = (key: string) => setItens((prev) => prev.filter((i) => i.key !== key))

  const completo =
    fornecedor.trim().length > 0 &&
    itens.length > 0 &&
    itens.every((i) => i.quantity.trim() !== '')

  const gerar = async () => {
    if (!completo || saving) return

    const data: CotacaoData = {
      fornecedor: fornecedor.trim(),
      itens: itens.map((i) => ({
        name: i.name,
        quantity: i.quantity.trim(),
        unit: i.unit,
      })),
    }

    setSaving(true)
    setErrorMessage('')
    try {
      const { avisoHistorico } = await emitirCotacao(
        data,
        itens.map((i) => i.catalog_code)
      )
      onCriada()
      onClose()
      if (avisoHistorico) {
        alert(`O PDF foi gerado, mas não consegui guardar no histórico: ${avisoHistorico}`)
      }
    } catch (err) {
      setErrorMessage(
        `Não foi possível gerar o PDF: ${err instanceof Error ? err.message : 'erro desconhecido'}`
      )
      setSaving(false)
    }
  }

  const teclaQtd = (e: ReactKeyboardEvent<HTMLInputElement>, i: number) => {
    const item = itens[i]
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'Enter') {
      e.preventDefault()
      if (item.quantity.trim() !== '') focarBusca()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const prox = itens[i + 1]
      if (prox) qtdRefs.current.get(prox.key)?.focus()
      else focarBusca()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const ant = itens[i - 1]
      if (ant) qtdRefs.current.get(ant.key)?.focus()
      else focarBusca()
    } else if (e.key === 'Backspace' && item.quantity === '') {
      e.preventDefault()
      const vizinho = itens[i - 1] ?? itens[i + 1]
      if (vizinho) focoPendente.current = vizinho.key
      else focarBusca()
      remover(item.key)
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          gerar()
        }
      }}
    >
      <DialogHeader className="border-b border-slate-100 px-6 py-4 text-left">
        <DialogTitle className="text-base font-semibold text-slate-900">Nova cotação</DialogTitle>
        <DialogDescription className="text-sm text-slate-500">
          Busque no catálogo e monte a lista.
        </DialogDescription>
      </DialogHeader>

      {/* Fornecedor e busca ficam fora da área rolável para a lista de resultados não ser cortada */}
      <div className="space-y-4 px-6 pt-5">
        <div className="space-y-1.5">
          <label htmlFor="cotacao-fornecedor" className="block text-xs font-medium text-slate-600">
            Fornecedor
          </label>
          <input
            id="cotacao-fornecedor"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return
              e.preventDefault()
              focarBusca()
            }}
            className={inputClass}
            placeholder="Nome do fornecedor"
            autoFocus
          />
        </div>

        <div ref={buscaWrapRef} className="relative z-10 space-y-1.5">
          <span className="block text-xs font-medium text-slate-600">Adicionar do catálogo</span>
          <BuscaCatalogo onSelect={adicionarDoCatalogo} />
          {aviso && <p className="text-xs font-medium text-amber-600">{aviso}</p>}
        </div>
      </div>

      {/* Lista montada */}
      <div className="min-h-[200px] flex-1 space-y-2 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Na cotação ({itens.length})</span>
          {itens.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setItens([])
                focarBusca()
              }}
              className="rounded text-xs font-medium text-slate-500 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
            >
              Limpar tudo
            </button>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 py-8 text-center">
            <ClipboardList className="size-5 text-slate-300" />
            <p className="text-sm text-slate-500">Nenhum item ainda</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {itens.map((item, i) => (
              <li key={item.key} className="flex items-center gap-3 px-3 py-2">
                <p className="min-w-0 flex-1 break-words text-sm text-slate-900">{item.name}</p>

                <input
                  ref={(el) => {
                    if (el) qtdRefs.current.set(item.key, el)
                    else qtdRefs.current.delete(item.key)
                  }}
                  value={item.quantity}
                  onChange={(e) => atualizarQtd(item.key, e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => teclaQtd(e, i)}
                  inputMode="decimal"
                  enterKeyHint="next"
                  placeholder="Qtd"
                  aria-label={`Quantidade de ${item.name}`}
                  className={`w-20 shrink-0 rounded-md border bg-white px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 ${
                    item.quantity.trim() === '' ? 'border-amber-300' : 'border-slate-200'
                  }`}
                />
                <span className="w-8 shrink-0 text-xs text-slate-500">{item.unit ?? ''}</span>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remover ${item.name}`}
                  onClick={() => remover(item.key)}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
        <div className="hidden items-center gap-x-4 gap-y-1 text-xs text-slate-400 md:flex md:flex-wrap">
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd> próximo
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd> gerar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd> fechar
          </span>
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={gerar}
            disabled={!completo || saving}
            className="min-w-40 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Gerando...
              </>
            ) : (
              `Gerar PDF (${itens.length} ${itens.length === 1 ? 'item' : 'itens'})`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NovaCotacaoDialog({ open, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[560px]">
        <Conteudo {...resto} />
      </DialogContent>
    </Dialog>
  )
}