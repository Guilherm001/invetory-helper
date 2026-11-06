'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CheckCheck, Loader2, Search, Trash2, X } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import { useSelection } from '../hooks/useSelection'
import { useEhDono } from '../hooks/useEhDono'
import { useEtapasFaltas } from '../hooks/useEtapasFaltas'
import { dialogoAberto, digitando } from '../lib/teclado'
import type { Product } from '../services/listService'
import BotaoAdd from './addButton'
import Corpo from './corpo'
import ExcluirComprados from './excluirComprados'
import QuantidadesCotacao from '@/features/cotacao/components/QuantidadesCotacao'
import { emitirCotacao } from '@/features/cotacao/services/emitirCotacao'
import PedidoCompraDialog, {
  type PedidoInicial,
} from '@/features/compras/components/PedidoCompraDialog'
import { PEDIDO_VAZIO, numeroPedido } from '@/features/compras/lib/compras'
import {
  vincularFaltas,
  type EtapaDaFalta,
  type EtapaFalta,
} from '@/features/compras/services/painelService'
import { EtapasFaltasProvider } from './etapasFaltas'
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

type Filtro = 'todos' | 'pendentes' | 'alta'
type ModoSelecao = 'cotacao' | 'excluir'

// true: um produto já comprado (Concluído) não bloqueia adicionar o mesmo de novo
// false: qualquer produto que já está na lista bloqueia
const IGNORAR_COMPRADOS = false

// sem acento, minúsculo, espaços normalizados
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

type Comparavel = { name: string; catalog_code?: string | null }

// mesmo código do catálogo ou, na falta dele, mesmo nome
function mesmoProduto(a: Comparavel, b: Comparavel) {
  if (a.catalog_code && b.catalog_code) return a.catalog_code === b.catalog_code
  return normalizar(a.name) === normalizar(b.name)
}

type FiltroEtapa = 'todas' | EtapaFalta

const ETAPAS: { id: EtapaFalta; rotulo: string }[] = [
  { id: 'pendente', rotulo: 'Sem cotação ou pedido' },
  { id: 'em_cotacao', rotulo: 'Em cotação' },
  { id: 'em_pedido', rotulo: 'Em pedido' },
  { id: 'recebido', rotulo: 'Recebidos' },
]

// null = já comprado (não tem etapa)
function etapaDe(p: Product, etapas: Map<string, EtapaDaFalta>): EtapaFalta | null {
  if (p.status === 'Concluído') return null
  return etapas.get(p.id ?? '')?.etapa ?? 'pendente'
}

interface Aviso {
  texto: string
  href?: string
}

// dica de atalho; só aparece em telas com teclado
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-px font-sans text-[11px] font-medium leading-4 text-slate-500 md:inline-block">
      {children}
    </kbd>
  )
}

const focoVisivel =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]'

export function Body() {
  const {
    products,
    loading,
    error,
    deleteProduct,
    deleteMany,
    updateProduct,
    addProducts,
  } = useProducts()

  // sempre aponta para a lista mais recente, mesmo dentro de funções async
  const productsRef = useRef(products)
  productsRef.current = products

  // não deixa entrar na lista o que já está nela
  const addProductsSemDuplicar: typeof addProducts = async (novos) => {
    const existentes = productsRef.current.filter(
      (p) => !(IGNORAR_COMPRADOS && p.status === 'Concluído')
    )

    const aceitos: typeof novos = []
    for (const n of novos) {
      const repetido =
        existentes.some((e) => mesmoProduto(e, n)) ||
        aceitos.some((a) => mesmoProduto(a, n))
      if (!repetido) aceitos.push(n)
    }

    // tudo já existia: não salva nada
    if (aceitos.length === 0) return []

    return addProducts(aceitos)
  }

  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [filtroEtapa, setFiltroEtapa] = useState<FiltroEtapa>('todas')
  const [busca, setBusca] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)

  const buscaRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLDivElement>(null)

  // etapas (só o dono vê): cotação, pedido, recebido
  const ehDono = useEhDono() === true
  const chaveEtapas = `${products.length}|${products.filter((p) => p.status !== 'Concluído').length}`
  const { etapas, disponivel, recarregar: recarregarEtapas } = useEtapasFaltas(
    ehDono,
    chaveEtapas
  )
  const mostrarEtapas = ehDono && disponivel

  // seleção (cotação ou exclusão)
  const sel = useSelection()
  const [modo, setModo] = useState<ModoSelecao>('cotacao')
  const [showQtd, setShowQtd] = useState(false)
  const [gerando, setGerando] = useState(false)

  // exclusão em massa
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const iniciarSelecao = (m: ModoSelecao) => {
    setModo(m)
    sel.start()
  }

  // pedido de compra a partir das faltas selecionadas
  const [pedidoForm, setPedidoForm] = useState<{
    chave: number
    inicial: PedidoInicial
    faltaIds: string[]
  } | null>(null)
  const [concluindo, setConcluindo] = useState(false)

  // contagens dos filtros
  const contagemFiltros = useMemo(
    () => ({
      todos: products.length,
      pendentes: products.filter((p) => p.status === 'Pendente').length,
      alta: products.filter((p) => p.priority === 'Alta' && p.status !== 'Concluído').length,
    }),
    [products]
  )

  // 1) filtro por situação
  const porFiltro = useMemo(() => {
    if (filtro === 'pendentes') return products.filter((p) => p.status === 'Pendente')
    if (filtro === 'alta')
      return products.filter((p) => p.priority === 'Alta' && p.status !== 'Concluído')
    return products
  }, [products, filtro])

  // 2) filtro por etapa (só quando as etapas estão disponíveis)
  const etapaAtiva: FiltroEtapa = mostrarEtapas ? filtroEtapa : 'todas'
  const porEtapa = useMemo(() => {
    if (etapaAtiva === 'todas') return porFiltro
    return porFiltro.filter((p) => etapaDe(p, etapas) === etapaAtiva)
  }, [porFiltro, etapaAtiva, etapas])

  // 3) busca por texto: todas as palavras precisam aparecer (nome, notas, código ou unidade)
  const buscaAtiva = busca.trim() !== ''
  const produtosVisiveis = useMemo(() => {
    const palavras = normalizar(busca).split(' ').filter(Boolean)
    if (palavras.length === 0) return porEtapa

    return porEtapa.filter((p) => {
      const texto = normalizar(
        [p.name, p.notes, p.catalog_code, p.unit].filter(Boolean).join(' ')
      )
      return palavras.every((palavra) => texto.includes(palavra))
    })
  }, [porEtapa, busca])

  const contagemEtapas = useMemo(() => {
    const c: Record<EtapaFalta, number> = {
      pendente: 0,
      em_cotacao: 0,
      em_pedido: 0,
      recebido: 0,
    }
    for (const p of products) {
      const e = etapaDe(p, etapas)
      if (e) c[e]++
    }
    return c
  }, [products, etapas])

  // faltas cujo pedido já foi recebido: podem virar "comprado"
  const recebidas = useMemo(
    () => products.filter((p) => p.id && etapaDe(p, etapas) === 'recebido'),
    [products, etapas]
  )

  const comprados = useMemo(
    () => products.filter((p) => p.status === 'Concluído'),
    [products]
  )

  // se um item for apagado (realtime), ele sai sozinho da seleção
  const selecionados = useMemo(
    () => products.filter((p) => p.id && sel.ids.has(p.id)),
    [products, sel.ids]
  )

  // "todos" = todos que estão listados agora (respeita filtros e busca)
  const idsVisiveis = useMemo(
    () => produtosVisiveis.map((p) => p.id).filter((id): id is string => !!id),
    [produtosVisiveis]
  )
  const todosMarcados =
    idsVisiveis.length > 0 && idsVisiveis.every((id) => sel.ids.has(id))

  const alternarTodos = () => {
    if (todosMarcados) sel.removeMany(idsVisiveis)
    else sel.addMany(idsVisiveis)
  }

  const semResultado =
    buscaAtiva && !loading && !error && produtosVisiveis.length === 0

  const excluirSelecionados = async () => {
    if (excluindo || selecionados.length === 0) return
    setExcluindo(true)
    const n = selecionados.length
    try {
      await deleteMany(selecionados.map((p) => p.id!))
      setAviso({ texto: `${n} ${n === 1 ? 'item excluído' : 'itens excluídos'}.` })
      setConfirmarExcluir(false)
      sel.cancel()
    } catch (e) {
      setConfirmarExcluir(false)
      setAviso({
        texto: `Não foi possível excluir: ${e instanceof Error ? e.message : 'erro desconhecido'}`,
      })
    } finally {
      setExcluindo(false)
      recarregarEtapas()
    }
  }

  const concluirRecebidas = async () => {
    if (concluindo || recebidas.length === 0) return
    setConcluindo(true)
    const n = recebidas.length
    try {
      await Promise.all(recebidas.map((p) => updateProduct(p.id!, { status: 'Concluído' })))
      setAviso({ texto: `${n} ${n === 1 ? 'item marcado' : 'itens marcados'} como comprado.` })
    } catch (e) {
      setAviso({
        texto: `Não foi possível concluir todos: ${e instanceof Error ? e.message : 'erro desconhecido'}`,
      })
    } finally {
      setConcluindo(false)
      recarregarEtapas()
    }
  }

  const criarPedidoDasFaltas = () => {
    let lista = selecionados

    // evita comprar duas vezes o que já está em um pedido ativo
    const jaEmPedido = lista.filter((p) => etapas.get(p.id ?? '')?.etapa === 'em_pedido')
    if (jaEmPedido.length > 0) {
      const numeros = Array.from(
        new Set(
          jaEmPedido
            .map((p) => etapas.get(p.id ?? '')?.pedido_numero)
            .filter((n): n is number => typeof n === 'number')
            .map(numeroPedido)
        )
      ).join(', ')
      const incluir = window.confirm(
        `${jaEmPedido.length} ${
          jaEmPedido.length === 1 ? 'item já está' : 'itens já estão'
        } em pedido${numeros ? ` (${numeros})` : ''}.\n\nOK: incluir mesmo assim\nCancelar: deixar de fora`
      )
      if (!incluir) lista = lista.filter((p) => !jaEmPedido.includes(p))
    }

    if (lista.length === 0) return

    setPedidoForm({
      chave: Date.now(),
      faltaIds: lista.map((p) => p.id!),
      inicial: {
        dados: { ...PEDIDO_VAZIO.dados },
        itens: lista.map((p) => ({
          codigo: p.catalog_code ?? '',
          nome: p.name,
          unidade: p.unit ?? null,
          quantidade: p.quantity > 0 ? p.quantity : 1,
          preco: 0, // o preço de compra é digitado no pedido
          observacao: '',
        })),
      },
    })
  }

  // atalhos da página (sempre usa o estado mais recente)
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e) => {
    // telas abertas por cima cuidam do próprio teclado
    if (showQtd || pedidoForm !== null || confirmarExcluir) return
    if (dialogoAberto()) return
    if (digitando(e.target)) return

    // Ctrl/Cmd + Enter: enviar a seleção para o fornecedor
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (sel.selecting && modo === 'cotacao' && selecionados.length > 0) {
        e.preventDefault()
        setShowQtd(true)
      }
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return

    switch (e.key) {
      case '/':
        e.preventDefault()
        buscaRef.current?.focus()
        break
      case 'Escape':
        if (sel.selecting) sel.cancel()
        else if (buscaAtiva) setBusca('')
        break
      case 'n':
        e.preventDefault()
        addRef.current?.querySelector('button')?.click()
        break
      case 'c':
        if (sel.selecting) sel.cancel()
        else iniciarSelecao('cotacao')
        break
      case 'a':
        if (sel.selecting) {
          e.preventDefault()
          alternarTodos()
        }
        break
      case 'Delete':
        if (sel.selecting && modo === 'excluir' && selecionados.length > 0) {
          e.preventDefault()
          setConfirmarExcluir(true)
        }
        break
      case 'p':
        if (ehDono && sel.selecting && modo === 'cotacao' && selecionados.length > 0)
          criarPedidoDasFaltas()
        break
      case '1':
        setFiltro('todos')
        break
      case '2':
        setFiltro('pendentes')
        break
      case '3':
        setFiltro('alta')
        break
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const FILTROS: { id: Filtro; rotulo: string; tecla: string }[] = [
    { id: 'todos', rotulo: 'Todos', tecla: '1' },
    { id: 'pendentes', rotulo: 'Pendentes', tecla: '2' },
    { id: 'alta', rotulo: 'Alta prioridade', tecla: '3' },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-40 pt-6 md:px-6 md:pb-24">
      {/* Cabeçalho */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Lista de produtos
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading
              ? 'Carregando…'
              : `${contagemFiltros.todos} ${contagemFiltros.todos === 1 ? 'produto' : 'produtos'} na lista, ${contagemFiltros.pendentes} ${contagemFiltros.pendentes === 1 ? 'pendente' : 'pendentes'}`}
          </p>
        </div>
        <div ref={addRef} className="hidden items-center gap-2 md:flex">
          <Kbd>N</Kbd>
          <BotaoAdd addProducts={addProductsSemDuplicar} />
        </div>
      </header>

      {/* Aviso */}
      {aviso && (
        <div
          role="status"
          className="mt-4 flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          <p>
            {aviso.texto}{' '}
            {aviso.href && (
              <Link href={aviso.href} className="font-medium underline">
                Abrir pedido
              </Link>
            )}
          </p>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setAviso(null)}
            className={`shrink-0 rounded text-emerald-700 hover:text-emerald-900 ${focoVisivel}`}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Barra de ferramentas */}
      <div className="sticky top-0 z-10 -mx-4 mt-5 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca */}
          <div className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  if (busca) setBusca('')
                  else e.currentTarget.blur()
                }
                // passa o foco para a lista
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Buscar por nome, observação ou código"
              aria-label="Buscar na lista de produtos"
              aria-keyshortcuts="/"
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-16 text-base outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {buscaAtiva ? (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => {
                    setBusca('')
                    buscaRef.current?.focus()
                  }}
                  className={`rounded p-1 text-slate-400 hover:text-slate-700 ${focoVisivel}`}
                >
                  <X className="size-4" />
                </button>
              ) : (
                <Kbd>/</Kbd>
              )}
            </div>
          </div>

          {/* Etapa (só o dono) */}
          {mostrarEtapas && (
            <select
              value={etapaAtiva}
              onChange={(e) => {
                setFiltroEtapa(e.target.value as FiltroEtapa)
                // devolve o foco à página para os atalhos continuarem valendo
                e.currentTarget.blur()
              }}
              aria-label="Etapa da compra"
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
            >
              <option value="todas">Todas as etapas</option>
              {ETAPAS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.rotulo} ({contagemEtapas[e.id]})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* Filtros */}
          <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-1">
            {FILTROS.map((f) => {
              const ativo = filtro === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={ativo}
                  aria-keyshortcuts={f.tecla}
                  onClick={() => setFiltro(f.id)}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition ${focoVisivel} ${
                    ativo
                      ? 'bg-[#079C9C]/10 text-[#067f7f]'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.rotulo}
                  <span
                    className={`tabular-nums text-xs ${ativo ? 'text-[#067f7f]' : 'text-slate-400'}`}
                  >
                    {loading ? '–' : contagemFiltros[f.id]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            {!sel.selecting && (
              <ExcluirComprados
                count={comprados.length}
                onConfirm={() => deleteMany(comprados.map((p) => p.id!))}
              />
            )}
            {sel.selecting ? (
              <button
                type="button"
                onClick={sel.cancel}
                className={`flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 ${focoVisivel}`}
              >
                Cancelar <Kbd>Esc</Kbd>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => iniciarSelecao('excluir')}
                  className={`flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-red-400 hover:text-red-600 ${focoVisivel}`}
                >
                  <Trash2 className="size-4" />
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => iniciarSelecao('cotacao')}
                  aria-keyshortcuts="c"
                  className={`flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-[#079C9C] hover:text-[#079C9C] ${focoVisivel}`}
                >
                  Cotação <Kbd>C</Kbd>
                </button>
              </>
            )}
          </div>
        </div>

        {buscaAtiva && !loading && (
          <p className="mt-2 text-xs text-slate-500" role="status">
            {produtosVisiveis.length} de {porEtapa.length}{' '}
            {porEtapa.length === 1 ? 'produto' : 'produtos'}
          </p>
        )}
      </div>

      {/* Itens recebidos em pedido de compra */}
      {mostrarEtapas && recebidas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>
            {recebidas.length}{' '}
            {recebidas.length === 1 ? 'item já foi recebido' : 'itens já foram recebidos'} em
            pedido de compra.
          </span>
          <button
            type="button"
            onClick={concluirRecebidas}
            disabled={concluindo}
            className={`flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 ${focoVisivel}`}
          >
            {concluindo ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            Marcar como comprados
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="mt-2">
        {semResultado ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm text-slate-600">
              Nenhum produto encontrado para &ldquo;{busca.trim()}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setBusca('')}
              className={`rounded text-sm font-medium text-[#079C9C] hover:underline ${focoVisivel}`}
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <EtapasFaltasProvider value={mostrarEtapas ? etapas : null}>
            <Corpo
              products={produtosVisiveis}
              loading={loading}
              error={error}
              deleteProduct={deleteProduct}
              updateProduct={updateProduct}
              selecting={sel.selecting}
              selectedIds={sel.ids}
              onSelect={sel.toggle}
            />
          </EtapasFaltasProvider>
        )}
      </div>

      {/* Atalhos (só no desktop) */}
      <p className="mt-4 hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 md:flex">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar
        </span>
        <span>
          <Kbd>Espaço</Kbd> {sel.selecting ? 'selecionar' : 'marcar comprado'}
        </span>
        <span>
          <Kbd>Enter</Kbd> {sel.selecting ? 'selecionar' : 'editar'}
        </span>
        {sel.selecting ? (
          <span>
            <Kbd>A</Kbd> selecionar todos
          </span>
        ) : (
          <span>
            <Kbd>Del</Kbd> excluir
          </span>
        )}
        <span>
          <Kbd>/</Kbd> buscar
        </span>
        <span>
          <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> filtros
        </span>
      </p>

      {/* Adicionar (celular): logo acima da barra de baixo, some durante a seleção */}
      {!sel.selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-20 border-t border-slate-200 bg-white p-3 md:hidden">
          <BotaoAdd addProducts={addProductsSemDuplicar} />
        </div>
      )}

      {/* Barra da seleção */}
      {sel.selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 md:bottom-0 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={alternarTodos}
              disabled={idsVisiveis.length === 0}
              aria-keyshortcuts="a"
              className={`flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-[#079C9C] hover:text-[#079C9C] disabled:opacity-40 ${focoVisivel}`}
            >
              {todosMarcados ? 'Desmarcar todos' : 'Selecionar todos'}
              <Kbd>A</Kbd>
            </button>
            <span className="text-sm text-slate-700" role="status">
              {selecionados.length}{' '}
              {selecionados.length === 1 ? 'selecionado' : 'selecionados'}
            </span>
          </div>

          <div className="flex gap-2">
            {modo === 'excluir' ? (
              <button
                type="button"
                disabled={selecionados.length === 0}
                onClick={() => setConfirmarExcluir(true)}
                aria-keyshortcuts="Delete"
                className={`flex h-9 items-center gap-2 rounded-md bg-red-600 px-3.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40 ${focoVisivel}`}
              >
                <Trash2 className="size-4" />
                Excluir selecionados
                <span className="hidden rounded border border-white/30 px-1.5 py-px font-sans text-[11px] leading-4 text-white/80 md:inline-block">
                  Del
                </span>
              </button>
            ) : (
              <>
                {ehDono && (
                  <button
                    type="button"
                    disabled={selecionados.length === 0}
                    onClick={criarPedidoDasFaltas}
                    aria-keyshortcuts="p"
                    className={`flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-[#079C9C] hover:text-[#079C9C] disabled:opacity-40 ${focoVisivel}`}
                  >
                    <span className="hidden sm:inline">Criar pedido de compra</span>
                    <span className="sm:hidden">Criar pedido</span>
                    <Kbd>P</Kbd>
                  </button>
                )}
                <button
                  type="button"
                  disabled={selecionados.length === 0}
                  onClick={() => setShowQtd(true)}
                  aria-keyshortcuts="Control+Enter"
                  className={`flex h-9 items-center gap-2 rounded-md bg-[#079C9C] px-3.5 text-sm font-medium text-white transition hover:bg-[#068a8a] disabled:opacity-40 ${focoVisivel}`}
                >
                  Enviar para fornecedor
                  <span className="hidden rounded border border-white/30 px-1.5 py-px font-sans text-[11px] leading-4 text-white/80 md:inline-block">
                    Ctrl Enter
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmação de exclusão em massa */}
      <AlertDialog
        open={confirmarExcluir}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindo) setConfirmarExcluir(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selecionados.length}{' '}
              {selecionados.length === 1 ? 'produto' : 'produtos'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os itens selecionados serão removidos da lista. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault() // mantém aberto até terminar
                excluirSelecionados()
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {excluindo ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tela de quantidades */}
      {showQtd && (
        <QuantidadesCotacao
          products={selecionados}
          onClose={() => setShowQtd(false)}
          onConfirm={async (data) => {
            if (gerando) return
            setGerando(true)
            // a ordem dos itens é a mesma dos produtos selecionados
            const codigos = selecionados.map((p) => p.catalog_code ?? null)
            try {
              // gera o PDF e guarda a cotação no histórico
              const { avisoHistorico } = await emitirCotacao(data, codigos)
              setShowQtd(false)
              sel.cancel()
              recarregarEtapas()
              if (avisoHistorico) {
                alert(
                  `O PDF foi gerado, mas não consegui guardar no histórico: ${avisoHistorico}`
                )
              }
            } catch (err) {
              console.error(err)
              alert(
                `Não foi possível gerar o PDF: ${
                  err instanceof Error ? err.message : 'erro desconhecido'
                }`
              )
            } finally {
              setGerando(false)
            }
          }}
        />
      )}

      {/* Pedido de compra criado a partir das faltas (só o dono) */}
      {ehDono && (
        <PedidoCompraDialog
          key={pedidoForm?.chave ?? 0}
          open={pedidoForm !== null}
          inicial={pedidoForm?.inicial ?? PEDIDO_VAZIO}
          onClose={() => setPedidoForm(null)}
          onSalvo={async (id, numero) => {
            const ids = pedidoForm?.faltaIds ?? []
            setPedidoForm(null)
            sel.cancel()
            try {
              await vincularFaltas(id, ids)
              setAviso({
                texto: `Pedido ${numeroPedido(numero)} criado com ${ids.length} ${
                  ids.length === 1 ? 'item' : 'itens'
                } da lista.`,
                href: `/pedidos-compra?abrir=${id}`,
              })
            } catch (e) {
              setAviso({
                texto: `Pedido ${numeroPedido(numero)} criado, mas não consegui ligar os itens da lista a ele: ${
                  e instanceof Error ? e.message : 'erro desconhecido'
                }`,
                href: `/pedidos-compra?abrir=${id}`,
              })
            } finally {
              recarregarEtapas()
            }
          }}
        />
      )}
    </div>
  )
}