'use client'

import { useProducts } from '../../hooks/useProducts'
import BotaoAdd from './addButton'
import Corpo from './corpo'

export function Body() {
  const {
    products,
    loading,
    error,
    deleteProduct,
    updateProduct,
    addProduct,
  } = useProducts()

  return (
    <div className='w-sceen' >
      <div className=' flex py-4 justify-between'>
        <article>
          <h3 className="font-bold text-2xl">Lista de produtos</h3>
          <p className='text-gray-400 text-sm'>Gerencie e acompanhe todos os produtos Cadastrados.</p>
        </article>
        <div className="flex justify-end  hidden md:block  mr-10 ">
          <BotaoAdd addProduct={addProduct} />
         </div>
      </div>
      
      <Corpo
        products={products}
        loading={loading}
        error={error}
        deleteProduct={deleteProduct}
        updateProduct={updateProduct}
      />

      <div className="fixed bottom-0 left-0 w-full p-4 md:hidden mb-4 bg-white">
            <BotaoAdd addProduct={addProduct} />
      </div>
      
    </div>

    
  )
}
