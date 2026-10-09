'use client'

import { useMemo, useState } from 'react'
import { useProducts } from '../hooks/useProducts'
import BotaoAdd from './addButton'
import Corpo from './corpo'
import { InputDemo } from './input'
import { SelectDemo } from './select'
import Resumo, { type Filtro } from './resumo'
import ExcluirComprados from './excluirComprados'

export function Body() {
  const {
    products,
    loading,
    error,
    deleteProduct,
    deleteMany,
    updateProduct,
    addProduct,
  } = useProducts()

  const [filtro, setFiltro] = useState<Filtro>('todos')

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
          <BotaoAdd addProduct={addProduct} />
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

        <div className="flex justify-end mt-4">
          <ExcluirComprados
            count={comprados.length}
            onConfirm={() => deleteMany(comprados.map((p) => p.id!))}
          />
        </div>

        <div>
          <Corpo
            products={produtosVisiveis}
            loading={loading}
            error={error}
            deleteProduct={deleteProduct}
            updateProduct={updateProduct}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 md:hidden mb-4 bg-white">
        <BotaoAdd addProduct={addProduct} />
      </div>
    </div>
  )
}