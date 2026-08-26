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
      <div className="flex justify-end py-4 hidden md:block justify-self-end mr-10 ">
        <BotaoAdd addProduct={addProduct} />
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
