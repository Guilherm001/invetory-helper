'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCheck, Loader2, Search, X } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import { useSelection } from '../hooks/useSelection'
import { useEhDono } from '../hooks/useEhDono'
import { useEtapasFaltas } from '../hooks/useEtapasFaltas'
import type { Product } from '../services/listService'
import BotaoAdd from './addButton'
import Corpo from './corpo'
import Resumo, { type Filtro } from './resumo'
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

  // etapas (só o dono vê): cotação, pedido, recebido
  const ehDono = useEhDono() === true
  const chaveEtapas = `${products.length}|${products.filter((p) => p.status !== 'Concluído').length}`
  const { etapas, disponivel, recarregar: recarregarEtapas } = useEtapasFaltas(
    ehDono,
    chaveEtapas
  )
  const mostrarEtapas = ehDono && disponivel

  // cotação
  const sel = useSelection()
  const [showQtd, setShowQtd] = useState(false)
  const [gerando, setGerando] = useState(false)

  // pedido de compra a partir das faltas selecionadas
  const [pedidoForm, setPedidoForm] = useState<{
    chave: number
    inicial: PedidoInicial
    faltaIds: string[]
  } | null>(null)
  const [concluindo, setConcluindo] = useState(false)

  // 1) filtro por situação (Todos / Pendentes / Alta prioridade)
  const porFiltro = useMemo(() => {
    if (filtro === 'pendentes')
      return products.filter((p) => p.status === 'Pendente')
    if (filtro === 'alta')
      return products.filter(
        (p) => p.priority === 'Alta' && p.status !== 'Concluído'
      )
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

  const semResultado =
    buscaAtiva && !loading && !error && produtosVisiveis.length === 0

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

  return (
    <div className="w-full">
      <div className="flex py-4 justify-between px-4 mt-7">
        <article>
          <h3 className="font-bold text-3xl">Lista de produtos</h3>
          <p className="text-gray-400 text-sm">
            Gerencie e acompanhe todos os produtos Cadastrados.
          </p>
        </article>
        <div className="justify-end hidden md:block mr-10">
          <BotaoAdd addProducts={addProductsSemDuplicar} />
        </div>
      </div>

      <Resumo
        products={products}
        loading={loading}
        filtro={filtro}
        onFiltroChange={setFiltro}
      />

      <div className="shadow-xl/20 p-6 rounded-lg">
        {aviso && (
          <div
            role="status"
            className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
          >
            <p>
              {aviso.texto}{' '}
              {aviso.href && (
                <Link href={aviso.href} className="font-semibold underline">
                  Abrir pedido
                </Link>
              )}
            </p>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setAviso(null)}
              className="shrink-0 text-emerald-600 hover:text-emerald-800"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* busca */}
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setBusca('')
            }}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Buscar produto, observação ou código"
            aria-label="Buscar na lista de produtos"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
          />
          {buscaAtiva && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {buscaAtiva && !loading && (
          <p className="mt-2 text-sm text-slate-500" role="status">
            {produtosVisiveis.length} de {porEtapa.length}{' '}
            {porEtapa.length === 1 ? 'produto' : 'produtos'}
          </p>
        )}

        {/* etapas: só o dono vê */}
        {mostrarEtapas && (
          <div
            role="radiogroup"
            aria-label="Etapa da compra"
            className="mt-3 flex flex-wrap gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={etapaAtiva === 'todas'}
              onClick={() => setFiltroEtapa('todas')}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                etapaAtiva === 'todas'
                  ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Todas as etapas
            </button>
            {ETAPAS.map((e) => (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={etapaAtiva === e.id}
                onClick={() => setFiltroEtapa(etapaAtiva === e.id ? 'todas' : e.id)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  etapaAtiva === e.id
                    ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {e.rotulo} {contagemEtapas[e.id]}
              </button>
            ))}
          </div>
        )}

        {/* já recebidos em pedido de compra */}
        {mostrarEtapas && recebidas.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <span>
              {recebidas.length}{' '}
              {recebidas.length === 1
                ? 'item já foi recebido'
                : 'itens já foram recebidos'}{' '}
              em pedido de compra.
            </span>
            <button
              type="button"
              onClick={concluirRecebidas}
              disabled={concluindo}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95 disabled:opacity-60"
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

        <div className="flex items-center justify-between md:justify-end gap-3 mt-4">
          {/* botão Cotação / Cancelar */}
          <div>
            {sel.selecting ? (
              <button onClick={sel.cancel} className="text-sm text-gray-600">
                Cancelar
              </button>
            ) : (
              <button
                onClick={sel.start}
                className="px-3 py-2 rounded-md border border-[#079C9C] text-[#079C9C] text-sm font-medium"
              >
                Cotação
              </button>
            )}
          </div>

          {!sel.selecting && (
            <ExcluirComprados
              count={comprados.length}
              onConfirm={() => deleteMany(comprados.map((p) => p.id!))}
            />
          )}
        </div>

        <div>
          {semResultado ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <Search className="size-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                Nenhum produto encontrado para &ldquo;{busca.trim()}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setBusca('')}
                className="text-sm font-semibold text-[#079C9C] hover:underline"
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
      </div>

      {/* botão de adicionar (celular): fica logo acima da barra de baixo e some durante a seleção */}
      {!sel.selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-20 border-t border-gray-200 bg-white p-3 md:hidden">
          <BotaoAdd addProducts={addProductsSemDuplicar} />
        </div>
      )}

      {/* barra da seleção: no celular fica acima da barra de baixo, no desktop no rodapé */}
      {sel.selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-2 border-t border-gray-200 bg-white p-3 md:bottom-0">
          <span className="text-sm text-gray-700">
            {selecionados.length} selecionado(s)
          </span>
          <div className="flex gap-2">
            {ehDono && (
              <button
                disabled={selecionados.length === 0}
                onClick={criarPedidoDasFaltas}
                className="px-3 py-2 rounded-md border border-[#079C9C] text-[#079C9C] text-sm font-medium disabled:opacity-40"
              >
                <span className="hidden sm:inline">Criar pedido de compra</span>
                <span className="sm:hidden">Criar pedido</span>
              </button>
            )}
            <button
              disabled={selecionados.length === 0}
              onClick={() => setShowQtd(true)}
              className="px-4 py-2 rounded-md bg-[#079C9C] text-white text-sm font-medium disabled:opacity-40"
            >
              Enviar para fornecedor
            </button>
          </div>
        </div>
      )}

      {/* tela de quantidades */}
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

      {/* pedido de compra criado a partir das faltas (só o dono) */}
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