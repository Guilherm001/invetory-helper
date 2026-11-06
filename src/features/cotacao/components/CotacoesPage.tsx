'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import {
  ChevronDown,
  Copy,
  FileDown,
  FileText,
  Loader2,
  Plus,
  Search,
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
import { gerarCotacao } from '../services/gerarCotacao'
import type { CotacaoSalva } from '../services/cotacaoService'
import { useCotacoes } from '../hooks/useCotacoes'
import NovaCotacaoDialog from './NovaCotacaoDialog'

// sem acento, minúsculo
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// true quando o foco está num campo de digitação
const digitando = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

const atalhos: { teclas: string[]; texto: string }[] = [
  { teclas: ['↑', '↓'], texto: 'navegar' },
  { teclas: ['→', '←'], texto: 'abrir / fechar' },
  { teclas: ['P'], texto: 'gerar PDF' },
  { teclas: ['B'], texto: 'usar como base' },
  { teclas: ['Del'], texto: 'excluir' },
  { teclas: ['N'], texto: 'nova' },
  { teclas: ['/'], texto: 'buscar' },
]

function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium leading-none text-slate-500 ${className}`}
    >
      {children}
    </kbd>
  )
}

export default function CotacoesPage() {
  const { cotacoes, loading, error, excluir, recarregar } = useCotacoes()

  const [dialog, setDialog] = useState<{ open: boolean; base: CotacaoSalva | null }>({
    open: false,
    base: null,
  })
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [paraExcluir, setParaExcluir] = useState<CotacaoSalva | null>(null)
  const [gerandoId, setGerandoId] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')
  const [busca, setBusca] = useState('')

  const buscaRef = useRef<HTMLInputElement>(null)
  const linhas = useRef<Map<string, HTMLButtonElement>>(new Map())
  const focoAposExcluir = useRef<string | null>(null)

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return cotacoes
    return cotacoes.filter(
      (c) =>
        normalizar(c.fornecedor).includes(termo) ||
        c.itens.some((i) => normalizar(i.name).includes(termo))
    )
  }, [cotacoes, busca])

  const focarIndice = (i: number) => {
    if (visiveis.length === 0) return
    const alvo = visiveis[Math.min(Math.max(i, 0), visiveis.length - 1)]
    linhas.current.get(alvo.id)?.focus()
  }

  const definirAberta = (id: string, abrir: boolean) =>
    setAbertas((prev) => {
      const novo = new Set(prev)
      if (abrir) novo.add(id)
      else novo.delete(id)
      return novo
    })

  const alternar = (id: string) => definirAberta(id, !abertas.has(id))

  // atalhos globais (só quando não está digitando e nenhum diálogo está aberto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (dialog.open || paraExcluir) return
      if (digitando(e.target)) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setDialog({ open: true, base: null })
      } else if (e.key === '/') {
        if (cotacoes.length === 0) return
        e.preventDefault()
        buscaRef.current?.focus()
      } else if (e.key === 'ArrowDown' && document.activeElement === document.body) {
        if (visiveis.length === 0) return
        e.preventDefault()
        linhas.current.get(visiveis[0].id)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog.open, paraExcluir, cotacoes.length, visiveis])

  // gera o PDF de novo a partir do que ficou guardado (não cria outra entrada no histórico)
  const gerarPdf = async (c: CotacaoSalva) => {
    if (gerandoId !== null) return
    setErroAcao('')
    setGerandoId(c.id)
    try {
      await gerarCotacao({
        fornecedor: c.fornecedor,
        itens: c.itens.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
      })
    } catch (e) {
      setErroAcao(
        `Não foi possível gerar o PDF: ${e instanceof Error ? e.message : 'erro desconhecido'}`
      )
    } finally {
      setGerandoId(null)
    }
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const idx = visiveis.findIndex((c) => c.id === paraExcluir.id)
    focoAposExcluir.current = (visiveis[idx + 1] ?? visiveis[idx - 1])?.id ?? null
    setErroAcao('')
    try {
      await excluir(paraExcluir.id)
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro ao excluir')
    }
  }

  const teclaLinha = (e: ReactKeyboardEvent<HTMLButtonElement>, c: CotacaoSalva, i: number) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focarIndice(i + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (i === 0) buscaRef.current?.focus()
        else focarIndice(i - 1)
        break
      case 'Home':
        e.preventDefault()
        focarIndice(0)
        break
      case 'End':
        e.preventDefault()
        focarIndice(visiveis.length - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        definirAberta(c.id, true)
        break
      case 'ArrowLeft':
        e.preventDefault()
        definirAberta(c.id, false)
        break
      case 'p':
      case 'P':
        e.preventDefault()
        gerarPdf(c)
        break
      case 'b':
      case 'B':
        e.preventDefault()
        setDialog({ open: true, base: c })
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        setParaExcluir(c)
        break
    }
  }

  return (
    <div className="w-full pb-10">
      <div className="mt-7 flex flex-col gap-4 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Cotações</h3>
          <p className="mt-1 text-sm text-slate-500">
            Histórico do que foi enviado aos fornecedores.
          </p>
        </article>

        <Button
          onClick={() => setDialog({ open: true, base: null })}
          aria-keyshortcuts="N"
          className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
        >
          <Plus className="size-4" />
          Nova cotação
          <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 py-0.5 font-sans text-[11px] leading-none md:inline">
            N
          </kbd>
        </Button>
      </div>

      {cotacoes.length > 0 && (
        <div className="relative mb-4 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={buscaRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault()
                focarIndice(0)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                if (busca) setBusca('')
                else e.currentTarget.blur()
              }
            }}
            placeholder="Buscar por fornecedor ou item"
            aria-keyshortcuts="/"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-base outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
          />
          {busca ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Limpar busca"
              onClick={() => {
                setBusca('')
                buscaRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          ) : (
            <Kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 md:block">
              /
            </Kbd>
          )}
        </div>
      )}

      {(error || erroAcao) && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {error || erroAcao}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando cotações...</p>
      ) : cotacoes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center">
          <FileText className="size-8 text-slate-300" />
          <p className="text-base font-medium text-slate-700">Nenhuma cotação guardada</p>
          <p className="max-w-sm text-sm text-slate-500">
            As cotações geradas aqui ou na lista de produtos aparecem nesta tela.
          </p>
          <Button
            onClick={() => setDialog({ open: true, base: null })}
            className="mt-1 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            <Plus className="size-4" />
            Nova cotação
          </Button>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          Nenhuma cotação encontrada.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white xl:max-w-4xl">
            {visiveis.map((c, i) => {
              const aberta = abertas.has(c.id)
              return (
                <li key={c.id}>
                  <button
                    ref={(el) => {
                      if (el) linhas.current.set(c.id, el)
                      else linhas.current.delete(c.id)
                    }}
                    type="button"
                    aria-expanded={aberta}
                    aria-controls={`cotacao-${c.id}`}
                    onClick={() => alternar(c.id)}
                    onKeyDown={(e) => teclaLinha(e, c, i)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left outline-none transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:shadow-[inset_3px_0_0_#079C9C]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900" title={c.fornecedor}>
                        {c.fornecedor}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{dataHora(c.created_at)}</p>
                    </div>

                    <span className="shrink-0 text-xs text-slate-500">
                      {c.itens.length} {c.itens.length === 1 ? 'item' : 'itens'}
                    </span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-slate-400 transition ${aberta ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {aberta && (
                    <div
                      id={`cotacao-${c.id}`}
                      className="border-t border-slate-100 bg-slate-50/60 px-4 py-3"
                    >
                      <ul className="divide-y divide-slate-100 text-sm">
                        {c.itens.map((it) => (
                          <li key={it.id} className="flex items-baseline gap-3 py-1.5">
                            <span className="w-24 shrink-0 font-medium tabular-nums text-slate-900">
                              {it.quantity}
                              {it.unit ? ` ${it.unit}` : ''}
                            </span>
                            <span className="min-w-0 break-words text-slate-600">{it.name}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => gerarPdf(c)}
                          disabled={gerandoId !== null}
                          aria-keyshortcuts="P"
                          className="flex items-center gap-2 rounded-lg bg-[#079C9C] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#079C9C]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] disabled:opacity-60"
                        >
                          {gerandoId === c.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <FileDown className="size-4" />
                          )}
                          Gerar PDF
                          <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 font-sans text-[11px] leading-none md:inline">
                            P
                          </kbd>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDialog({ open: true, base: c })}
                          aria-keyshortcuts="B"
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]"
                        >
                          <Copy className="size-4" />
                          Usar como base
                          <Kbd className="hidden md:inline-block">B</Kbd>
                        </button>
                        <button
                          type="button"
                          onClick={() => setParaExcluir(c)}
                          aria-keyshortcuts="Delete"
                          className="ml-auto flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                        >
                          <Trash2 className="size-4" />
                          Excluir
                          <Kbd className="hidden md:inline-block">Del</Kbd>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="mt-4 hidden flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 md:flex">
            {atalhos.map((a) => (
              <span key={a.texto} className="flex items-center gap-1.5">
                {a.teclas.map((t) => (
                  <Kbd key={t}>{t}</Kbd>
                ))}
                {a.texto}
              </span>
            ))}
          </div>
        </>
      )}

      <NovaCotacaoDialog
        open={dialog.open}
        base={dialog.base}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onCriada={recarregar}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // depois de excluir, o foco vai para a cotação vizinha
            const id = focoAposExcluir.current
            focoAposExcluir.current = null
            if (id) {
              e.preventDefault()
              linhas.current.get(id)?.focus()
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
            <AlertDialogDescription>
              A cotação de <strong>{paraExcluir?.fornecedor}</strong> será apagada do histórico.
              Essa ação não poderá ser desfeita.
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