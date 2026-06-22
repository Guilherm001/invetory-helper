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
      <div className="flex items-center justify-between py-4 px-4 md:py-0 md:px-10 md:m-10">
        <div>
          <Link href="/">
            <img src="/logo.png" alt="Logo" className="h-30 w-auto" />
          </Link>
        </div>
        <div className="flex justify-end p-4">
          <Button variant="secondary" className="mr-2 px-4 py-2">
            <Link href="/note">Notas</Link>
          </Button>
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
    </div>
  )
}
