'use client'

import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import { useSelection } from '../hooks/useSelection'
import BotaoAdd from './addButton'
import Corpo from './corpo'
import Resumo, { type Filtro } from './resumo'
import ExcluirComprados from './excluirComprados'
import QuantidadesCotacao from '@/features/cotacao/components/QuantidadesCotacao'
import { gerarCotacao } from '@/features/cotacao/services/gerarCotacao'

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
  const [busca, setBusca] = useState('')

  // cotação
  const sel = useSelection()
  const [showQtd, setShowQtd] = useState(false)
  const [gerando, setGerando] = useState(false)

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

  // 2) busca por texto: todas as palavras precisam aparecer (nome, notas, código ou unidade)
  const buscaAtiva = busca.trim() !== ''
  const produtosVisiveis = useMemo(() => {
    const palavras = normalizar(busca).split(' ').filter(Boolean)
    if (palavras.length === 0) return porFiltro

    return porFiltro.filter((p) => {
      const texto = normalizar(
        [p.name, p.notes, p.catalog_code, p.unit].filter(Boolean).join(' ')
      )
      return palavras.every((palavra) => texto.includes(palavra))
    })
  }, [porFiltro, busca])

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
            {produtosVisiveis.length} de {porFiltro.length}{' '}
            {porFiltro.length === 1 ? 'produto' : 'produtos'}
          </p>
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
          )}
        </div>
      </div>

      {/* botão de adicionar (celular): fica logo acima da barra de baixo e some durante a seleção */}
      {!sel.selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-20 border-t border-gray-200 bg-white p-3 md:hidden">
          <BotaoAdd addProducts={addProductsSemDuplicar} />
        </div>
      )}

      {/* barra da cotação: no celular fica acima da barra de baixo, no desktop no rodapé */}
      {sel.selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-20 flex items-center justify-between border-t border-gray-200 bg-white p-3 md:bottom-0">
          <span className="text-sm text-gray-700">
            {selecionados.length} selecionado(s)
          </span>
          <button
            disabled={selecionados.length === 0}
            onClick={() => setShowQtd(true)}
            className="px-4 py-2 rounded-md bg-[#079C9C] text-white text-sm font-medium disabled:opacity-40"
          >
            Enviar para fornecedor
          </button>
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
            try {
              await gerarCotacao(data)
              setShowQtd(false)
              sel.cancel()
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
    </div>
  )
}