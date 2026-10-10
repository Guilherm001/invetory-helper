'use client'

import { useMemo, useState } from 'react'
import { useProducts } from '../hooks/useProducts'
import { useSelection } from '../hooks/useSelection'
import BotaoAdd from './addButton'
import Corpo from './corpo'
import { InputDemo } from './input'
import { SelectDemo } from './select'
import Resumo, { type Filtro } from './resumo'
import ExcluirComprados from './excluirComprados'
import QuantidadesCotacao from '@/features/cotacao/components/QuantidadesCotacao'
import { gerarCotacao } from '@/features/cotacao/services/gerarCotacao'

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

  const [filtro, setFiltro] = useState<Filtro>('todos')

  // cotação
  const sel = useSelection()
  const [showQtd, setShowQtd] = useState(false)
  const [gerando, setGerando] = useState(false)

  const produtosVisiveis = useMemo(() => {
    if (filtro === 'pendentes')
      return products.filter((p) => p.status === 'Pendente')
    if (filtro === 'alta')
      return products.filter(
        (p) => p.priority === 'Alta' && p.status !== 'Concluído'
      )
    return products
  }, [products, filtro])

  const comprados = useMemo(
    () => products.filter((p) => p.status === 'Concluído'),
    [products]
  )

  // se um item for apagado (realtime), ele sai sozinho da seleção
  const selecionados = useMemo(
    () => products.filter((p) => p.id && sel.ids.has(p.id)),
    [products, sel.ids]
  )

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
          <BotaoAdd addProducts={addProducts} />
        </div>
      </div>

      <Resumo
        products={products}
        loading={loading}
        filtro={filtro}
        onFiltroChange={setFiltro}
      />

      <div className="shadow-xl/20 p-6 rounded-lg">
        <div className="flex items-center gap-4 max-w-150">
          <InputDemo />
          <SelectDemo />
          <SelectDemo />
        </div>

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
        </div>
      </div>

      {/* botão de adicionar (celular): fica logo acima da barra de navegação */}
      {!sel.selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 border-t border-gray-100 bg-white p-3 md:hidden">
          <BotaoAdd addProducts={addProducts} />
        </div>
      )}

      {/* barra da cotação: no celular também sobe acima da barra de navegação */}
      {sel.selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between border-t bg-white p-3 md:bottom-0">
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