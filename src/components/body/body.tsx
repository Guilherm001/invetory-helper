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
    <div>
      
      <Corpo
        products={products}
        loading={loading}
        error={error}
        deleteProduct={deleteProduct}
        updateProduct={updateProduct}
      />

      
    </div>

    
  )
}
