'use client'

import { useEffect, useRef, useState } from 'react'
import { ClipboardList, Loader2, Send, X } from 'lucide-react'
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
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

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
  const qtdRefs = useRef<(HTMLInputElement | null)[]>([])

  // carrega a biblioteca do PDF antes do clique
  useEffect(() => {
    preparar()
  }, [])

  const adicionarDoCatalogo = (c: { name: string; unit: string | null; code: string }) => {
    if (itens.some((i) => i.catalog_code === c.code)) {
      setAviso(`"${c.name}" já está na lista.`)
      return
    }
    setAviso('')
    setItens([
      ...itens,
      { key: `c:${c.code}`, name: c.name, quantity: '', unit: c.unit, catalog_code: c.code },
    ])
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

  const avancar = (i: number) => {
    if (i < itens.length - 1) qtdRefs.current[i + 1]?.focus()
    else gerar()
  }

  return (
    <>
      <DialogHeader className="bg-[#079C9C] px-6 py-5 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Send className="size-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-white">Nova cotação</DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              Busque no catálogo e monte a lista
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Fornecedor e busca ficam fora da área rolável para a lista de resultados não ser cortada */}
      <div className="space-y-4 px-6 pt-5">
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Fornecedor</span>
          <input
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            className={inputClass}
            placeholder="Nome do fornecedor"
            autoFocus={!base}
          />
        </div>

        <div className="relative z-10 space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Adicionar do catálogo</span>
          <BuscaCatalogo onSelect={adicionarDoCatalogo} />
          <p className="text-xs text-slate-400">Toque em um resultado para colocar na lista.</p>
          {aviso && <p className="text-xs font-medium text-amber-600">{aviso}</p>}
        </div>
      </div>

      {/* Lista montada */}
      <div className="min-h-[220px] flex-1 space-y-2 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Na cotação ({itens.length})</span>
          {itens.length > 0 && (
            <button
              type="button"
              onClick={() => setItens([])}
              className="text-xs font-medium text-slate-500 hover:text-red-600"
            >
              Limpar tudo
            </button>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ClipboardList className="size-5" />
            </div>
            <p className="text-sm text-slate-500">Nenhum item ainda</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {itens.map((item, i) => (
              <li
                key={item.key}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
              >
                <p className="min-w-0 flex-1 break-words px-1.5 text-sm font-semibold text-slate-900">
                  {item.name}
                </p>

                <input
                  ref={(el) => {
                    qtdRefs.current[i] = el
                  }}
                  value={item.quantity}
                  onChange={(e) => atualizarQtd(item.key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    avancar(i)
                  }}
                  inputMode="decimal"
                  enterKeyHint={i === itens.length - 1 ? 'done' : 'next'}
                  placeholder="Qtd"
                  aria-label={`Quantidade de ${item.name}`}
                  className={`w-20 shrink-0 rounded-lg border bg-white px-2 py-1.5 text-center text-sm outline-none focus:ring-2 focus:ring-[#079C9C]/20 ${
                    item.quantity.trim() === ''
                      ? 'border-amber-300 focus:border-[#079C9C]'
                      : 'border-slate-200 focus:border-[#079C9C]'
                  }`}
                />
                {item.unit && <span className="w-8 shrink-0 text-xs text-slate-500">{item.unit}</span>}

                <button
                  type="button"
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
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
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
          className="min-w-48 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
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
    </>
  )
}

export default function NovaCotacaoDialog({ open, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[560px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <Conteudo {...resto} />
      </DialogContent>
    </Dialog>
  )
}
