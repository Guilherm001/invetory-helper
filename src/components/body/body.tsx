'use client'

import { useProducts } from '../../hooks/useProducts'
import BotaoAdd from './addButton'
import Corpo from './corpo'
import Link from 'next/link'
import { Button } from '../ui/button'

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
      <div className="flex justify-end py-4">
        <BotaoAdd addProduct={addProduct} />
      </div>
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
