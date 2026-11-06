'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import type { Product } from '../services/listService'
import { useEtapasDasFaltas } from './etapasFaltas'
import SeloEtapa from './SeloEtapa'
import { dialogoAberto, digitando } from '../lib/teclado'
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

interface ProductsTableProps {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onToggle: (product: Product) => void
  selecting: boolean
  selectedIds: Set<string>
  onSelect: (id: string) => void
}

const PONTO_PRIORIDADE: Record<string, string> = {
  Alta: 'bg-red-500',
  Média: 'bg-amber-500',
  Baixa: 'bg-slate-300',
}

const PONTO_STATUS: Record<string, string> = {
  Pendente: 'bg-slate-400',
  'Em progresso': 'bg-amber-500',
  Concluído: 'bg-emerald-500',
}

// mesma grade no cabeçalho e nas linhas
const GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 md:grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_6rem_7.5rem_4.5rem] md:gap-4'

export function ProductsTable({
  products,
  onEdit,
  onDelete,
  onToggle,
  selecting,
  selectedIds,
  onSelect,
}: ProductsTableProps) {
  // etapa de cada falta: só o dono recebe esse mapa
  const etapas = useEtapasDasFaltas()

  const [active, setActive] = useState(0)
  const [excluir, setExcluir] = useState<Product | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // linha ativa sempre dentro do intervalo, mesmo se a lista encolher
  const idx = Math.min(active, Math.max(products.length - 1, 0))

  // mantém a linha ativa visível ao navegar
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${idx}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const acionar = (p: Product) => {
    if (!p.id) return
    if (selecting) onSelect(p.id)
    else onToggle(p)
  }

  // atalhos de teclado (sempre usa o estado mais recente)
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (products.length === 0) return

    const alvo = e.target as HTMLElement | null
    // não atrapalha quem está digitando
    if (digitando(alvo)) return
    // nem quando há um diálogo realmente aberto
    if (excluir !== null || dialogoAberto()) return

    const emBotao = !!alvo?.closest('button, a')
    const atual = products[idx]

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        setActive(Math.min(idx + 1, products.length - 1))
        break
      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        setActive(Math.max(idx - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(products.length - 1)
        break
      case ' ':
        if (emBotao) return
        e.preventDefault()
        acionar(atual)
        break
      case 'x':
        e.preventDefault()
        acionar(atual)
        break
      case 'Enter':
        if (emBotao) return
        e.preventDefault()
        if (selecting) acionar(atual)
        else onEdit(atual)
        break
      case 'e':
        if (!selecting) {
          e.preventDefault()
          onEdit(atual)
        }
        break
      case 'Delete':
      case 'Backspace':
      case 'd':
        if (!selecting) {
          e.preventDefault()
          setExcluir(atual)
        }
        break
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (products.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        Nenhum produto na lista.
      </p>
    )
  }

  return (
    <>
      <div role="grid" aria-label="Lista de produtos" ref={listRef}>
        {/* Cabeçalho */}
        <div
          role="row"
          className={`${GRID} hidden border-b border-slate-200 pb-2 text-xs font-medium text-slate-500 md:grid`}
        >
          <span role="columnheader" className="sr-only">
            {selecting ? 'Selecionar' : 'Comprado'}
          </span>
          <span role="columnheader">Produto</span>
          <span role="columnheader">Qtd</span>
          <span role="columnheader">Prioridade</span>
          <span role="columnheader">Status</span>
          <span role="columnheader" className="sr-only">
            Ações
          </span>
        </div>

        {products.map((product, i) => {
          const id = product.id!
          const comprado = product.status === 'Concluído'
          const marcado = selecting ? selectedIds.has(id) : comprado
          const ativo = i === idx
          const notas = product.notes?.trim() ?? ''
          const etapa = etapas?.get(id)
          const temSelo = !!etapa && etapa.etapa !== 'pendente'
          const apagado = !selecting && comprado

          return (
            <div
              key={id}
              role="row"
              data-row={i}
              data-active={ativo}
              aria-selected={selecting ? marcado : undefined}
              onClick={() => {
                setActive(i)
                if (selecting) onSelect(id)
                else onEdit(product)
              }}
              className={`group scroll-mb-28 scroll-mt-32 ${GRID} min-h-[3.25rem] cursor-pointer border-b border-slate-100 py-2 transition-colors ${
                ativo ? 'shadow-[inset_2px_0_0_#079C9C]' : ''
              } ${
                selecting && marcado
                  ? 'bg-[#079C9C]/5'
                  : ativo
                    ? 'bg-slate-50'
                    : 'hover:bg-slate-50/70'
              }`}
            >
              {/* Marcar */}
              <div role="gridcell">
                <button
                  type="button"
                  tabIndex={-1}
                  role="checkbox"
                  aria-checked={marcado}
                  aria-label={
                    selecting
                      ? `Selecionar ${product.name}`
                      : `Marcar ${product.name} como comprado`
                  }
                  // não rouba o foco, para o teclado continuar na lista
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActive(i)
                    acionar(product)
                  }}
                  className={`flex size-[18px] items-center justify-center rounded-[5px] border transition ${
                    marcado
                      ? 'border-[#079C9C] bg-[#079C9C] text-white'
                      : 'border-slate-300 bg-white text-transparent hover:border-[#079C9C]'
                  }`}
                >
                  <Check className="size-3" strokeWidth={3.5} />
                </button>
              </div>

              {/* Produto */}
              <div role="gridcell" className={`min-w-0 ${apagado ? 'opacity-50' : ''}`}>
                <p
                  className={`flex min-w-0 items-center gap-2 text-sm font-medium text-slate-900 ${
                    apagado ? 'line-through' : ''
                  }`}
                >
                  <span
                    aria-hidden
                    className={`size-1.5 shrink-0 rounded-full md:hidden ${
                      PONTO_PRIORIDADE[product.priority] ?? 'bg-slate-300'
                    }`}
                  />
                  <span className="truncate">{product.name}</span>
                </p>
                {(temSelo || notas) && (
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    {temSelo && etapa && <SeloEtapa etapa={etapa} link />}
                    {notas && (
                      <p className="min-w-0 truncate text-xs text-slate-500" title={notas}>
                        {notas}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Quantidade */}
              <div
                role="gridcell"
                className="text-sm tabular-nums text-slate-700 md:text-left"
              >
                {product.quantity}
                {product.unit ? ` ${product.unit}` : ''}
              </div>

              {/* Prioridade (desktop) */}
              <div role="gridcell" className="hidden items-center gap-2 text-sm text-slate-600 md:flex">
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    PONTO_PRIORIDADE[product.priority] ?? 'bg-slate-300'
                  }`}
                />
                {product.priority}
              </div>

              {/* Status (desktop) */}
              <div role="gridcell" className="hidden items-center gap-2 text-sm text-slate-600 md:flex">
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    PONTO_STATUS[product.status] ?? 'bg-slate-400'
                  }`}
                />
                {product.status}
              </div>

              {/* Ações: no desktop aparecem na linha ativa ou ao passar o mouse */}
              <div
                role="gridcell"
                className={`flex justify-end gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-data-[active=true]:opacity-100 ${
                  selecting ? 'invisible' : ''
                }`}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Editar ${product.name}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(product)
                  }}
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Excluir ${product.name}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExcluir(product)
                  }}
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmação de exclusão (um só diálogo, aberto por mouse ou teclado) */}
      <AlertDialog
        open={excluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setExcluir(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{excluir?.name}</strong> será removido da lista. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluir?.id) onDelete(excluir.id)
                else alert('Erro: ID do produto não encontrado.')
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}