'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Scale, Search, Trash2 } from 'lucide-react'
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
import { useProducts } from '@/features/body/hooks/useProducts'
import { useComparacoes } from '../hooks/useComparacoes'
import type { ComparacaoResumo } from '../types'
import NovaComparacaoDialog from './NovaComparacaoDialog'

const COLUNAS = 'md:grid-cols-[minmax(0,1fr)_110px_90px_120px]'

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500">
      {children}
    </kbd>
  )
}

export default function ComparacoesPage() {
  const router = useRouter()
  const { comparacoes, loading, error, criar, excluir } = useComparacoes()
  const { products } = useProducts()

  const [novaAberta, setNovaAberta] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<ComparacaoResumo | null>(null)
  const [erroAcao, setErroAcao] = useState('')
  const [busca, setBusca] = useState('')

  const buscaRef = useRef<HTMLInputElement>(null)
  const linksRef = useRef<(HTMLAnchorElement | null)[]>([])
  const indiceAtual = useRef(0)

  const lista = useMemo(() => {
    const q = normalizar(busca.trim())
    return q ? comparacoes.filter((c) => normalizar(c.name).includes(q)) : comparacoes
  }, [comparacoes, busca])

  const listaRef = useRef(lista)
  listaRef.current = lista

  const focarLinha = (i: number) => {
    const max = listaRef.current.length - 1
    if (max < 0) {
      buscaRef.current?.focus()
      return
    }
    const idx = Math.max(0, Math.min(i, max))
    indiceAtual.current = idx
    linksRef.current[idx]?.focus()
  }

  // Atalhos globais: N = nova comparação, / = buscar
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || novaAberta || paraExcluir) return
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input, textarea, select, [contenteditable="true"]')) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setNovaAberta(true)
      } else if (e.key === '/') {
        e.preventDefault()
        buscaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', aoTeclar as EventListener)
    return () => window.removeEventListener('keydown', aoTeclar as EventListener)
  }, [novaAberta, paraExcluir])

  // Depois de excluir, o foco não pode se perder
  const tamanhoAnterior = useRef(lista.length)
  useEffect(() => {
    if (lista.length < tamanhoAnterior.current && document.activeElement === document.body) {
      focarLinha(indiceAtual.current)
    }
    tamanhoAnterior.current = lista.length
  }, [lista.length])

  const aoTeclarNaBusca = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focarLinha(0)
    } else if (e.key === 'Enter' && lista[0]) {
      e.preventDefault()
      router.push(`/comparar-precos/${lista[0].id}`)
    } else if (e.key === 'Escape') {
      if (busca) setBusca('')
      else e.currentTarget.blur()
    }
  }

  const aoTeclarNaLista = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = indiceAtual.current
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focarLinha(i + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (i === 0) buscaRef.current?.focus()
        else focarLinha(i - 1)
        break
      case 'Home':
        e.preventDefault()
        focarLinha(0)
        break
      case 'End':
        e.preventDefault()
        focarLinha(lista.length - 1)
        break
      case 'Delete':
      case 'Backspace':
        if (lista[i]) {
          e.preventDefault()
          setParaExcluir(lista[i])
        }
        break
    }
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    setErroAcao('')
    try {
      await excluir(paraExcluir.id)
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const vazio = !loading && comparacoes.length === 0
  const semResultado = !loading && comparacoes.length > 0 && lista.length === 0

  return (
    <div className="w-full pb-10">
      {/* Cabeçalho */}
      <div className="mt-7 flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <article>
          <h3 className="text-3xl font-bold">Comparar preços</h3>
          <p className="text-sm text-gray-400">
            Coloque os preços de cada fornecedor lado a lado e veja onde comprar mais barato.
          </p>
        </article>

        <Button
          onClick={() => setNovaAberta(true)}
          className="gap-2 bg-[#079C9C] px-4 text-white hover:bg-[#079C9C]/90 focus-visible:ring-2 focus-visible:ring-[#079C9C] focus-visible:ring-offset-2"
        >
          <Plus className="size-4" />
          Nova comparação
          <span className="ml-1 hidden rounded bg-white/20 px-1.5 text-[11px] font-medium md:inline">
            N
          </span>
        </Button>
      </div>

      {(error || erroAcao) && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {error || erroAcao}
        </p>
      )}

      {/* Busca */}
      {!vazio && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={buscaRef}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={aoTeclarNaBusca}
            placeholder="Buscar comparação"
            aria-label="Buscar comparação"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 md:block">
            <Kbd>/</Kbd>
          </span>
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-14 animate-pulse bg-slate-50/60" />
          ))}
        </div>
      ) : vazio ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#079C9C]/10 text-[#079C9C]">
            <Scale className="size-6" />
          </div>
          <p className="text-base font-semibold text-slate-700">Nenhuma comparação ainda</p>
          <p className="max-w-sm text-sm text-slate-500">
            Crie uma com os itens que você precisa comprar e adicione os fornecedores.
          </p>
          <Button
            onClick={() => setNovaAberta(true)}
            className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            <Plus className="size-4" />
            Nova comparação
          </Button>
        </div>
      ) : semResultado ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Nenhuma comparação encontrada para <strong>{busca}</strong>.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div
            className={`hidden gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 md:grid ${COLUNAS} md:pr-14`}
          >
            <span>Nome</span>
            <span>Criada em</span>
            <span>Itens</span>
            <span>Fornecedores</span>
          </div>

          <ul
            onKeyDown={aoTeclarNaLista}
            aria-label="Comparações"
            className="divide-y divide-slate-100"
          >
            {lista.map((c, i) => (
              <li key={c.id} className="group relative">
                <Link
                  ref={(el) => {
                    linksRef.current[i] = el
                  }}
                  href={`/comparar-precos/${c.id}`}
                  onFocus={() => {
                    indiceAtual.current = i
                  }}
                  className={`grid items-center gap-x-4 gap-y-0.5 px-4 py-3 pr-14 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-[#079C9C]/5 focus-visible:shadow-[inset_3px_0_0_#079C9C] ${COLUNAS}`}
                >
                  <span className="truncate font-medium text-slate-900" title={c.name}>
                    {c.name}
                  </span>

                  {/* Desktop: colunas separadas */}
                  <span className="hidden text-sm text-slate-500 md:block">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="hidden text-sm text-slate-600 md:block">{c.itens_count}</span>
                  <span className="hidden text-sm text-slate-600 md:block">
                    {c.fornecedores_count}
                  </span>

                  {/* Mobile: resumo em uma linha */}
                  <span className="text-xs text-slate-400 md:hidden">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')} · {c.itens_count}{' '}
                    {c.itens_count === 1 ? 'item' : 'itens'} · {c.fornecedores_count}{' '}
                    {c.fornecedores_count === 1 ? 'fornecedor' : 'fornecedores'}
                  </span>
                </Link>

                {/* Fora da ordem do Tab: no teclado, use Delete na linha */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Excluir ${c.name}`}
                  onClick={() => {
                    indiceAtual.current = i
                    setParaExcluir(c)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-600 group-hover:text-slate-400"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dicas de teclado */}
      {!vazio && !loading && (
        <p className="mt-3 hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 md:flex">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar
          </span>
          <span>
            <Kbd>Enter</Kbd> abrir
          </span>
          <span>
            <Kbd>Delete</Kbd> excluir
          </span>
          <span>
            <Kbd>/</Kbd> buscar
          </span>
          <span>
            <Kbd>N</Kbd> nova
          </span>
        </p>
      )}

      <NovaComparacaoDialog
        open={novaAberta}
        produtos={products}
        onClose={() => setNovaAberta(false)}
        onCriar={async (nome, itens) => {
          const nova = await criar(nome, itens)
          router.push(`/comparar-precos/${nova.id}`)
        }}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // devolve o foco para a lista (a linha excluída já não existe)
            e.preventDefault()
            focarLinha(indiceAtual.current)
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comparação?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{paraExcluir?.name}</strong> será apagada com todos os preços
              preenchidos. Os fornecedores continuam cadastrados. Essa ação não poderá ser
              desfeita.
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