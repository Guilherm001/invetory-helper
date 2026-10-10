'use client'

import { useCallback, useEffect, useState } from 'react'
import ImportarCatalogo from '@/features/catalogo/components/importarCatalogo'
import { lastImportDate } from '@/features/catalogo/services/catalogService'

export default function CatalogoPage() {
  const [data, setData] = useState<string | null>(null)

  const carregar = useCallback(() => {
    lastImportDate().then(setData)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <div className="py-8 space-y-4">
      <h1 className="text-3xl font-bold">Catálogo</h1>
      <p className="text-gray-500 text-sm">
        Importe a planilha exportada do seu sistema. Reimportar atualiza os itens
        existentes e adiciona os novos.
      </p>
      <p className="text-sm text-gray-600">
        Última importação:{' '}
        {data ? new Date(data).toLocaleString('pt-BR') : 'nenhuma ainda'}
      </p>
      <ImportarCatalogo onDone={carregar} />
    </div>
  )
}