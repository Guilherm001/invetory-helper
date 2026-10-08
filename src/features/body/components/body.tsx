'use client'

import { useProducts } from '../hooks/useProducts'
import BotaoAdd from './addButton'
import Corpo from './corpo'
import { InputDemo } from './input'
import {  SelectDemo } from './select'
import { useMemo, useState } from 'react'
import Resumo, { type Filtro } from './resumo'

export function Body() {
  const {
    products,
    loading,
    error,
    deleteProduct,
    updateProduct,
    addProduct,
  } = useProducts()

  const [filtro, setFiltro] = useState<Filtro>('todos')

const produtosVisiveis = useMemo(() => {
  if (filtro === 'pendentes') return products.filter((p) => p.status === 'Pendente')
  if (filtro === 'alta')
    return products.filter((p) => p.priority === 'Alta' && p.status !== 'Concluído')
  return products
}, [products, filtro])

  return (
    <div className='w-sceen' >
      <div className=' flex py-4 justify-between px-4 s mt-7'>
        <article>
          <h3 className="font-bold text-3xl">Lista de produtos</h3>
          <p className='text-gray-400 text-sm'>Gerencie e acompanhe todos os produtos Cadastrados.</p>
        </article>
        <div className="flex justify-end  hidden md:block  mr-10 ">
          <BotaoAdd addProduct={addProduct} />
         </div>
      </div>
<Resumo
  products={products}
  loading={loading}
  filtro={filtro}
  onFiltroChange={setFiltro}
/>

      
      <div className='shadow-xl/20 p-6 rounded-lg'>
        <div className='flex items-center gap-4 max-w-150  '>
          <InputDemo/>
          <SelectDemo />
          <SelectDemo/>

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
