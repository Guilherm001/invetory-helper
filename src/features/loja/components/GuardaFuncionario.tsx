'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function GuardaFuncionario({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const fora = !pathname.startsWith('/loja')

  useEffect(() => {
    if (fora) router.replace('/loja/catalogo')
  }, [fora, router])

  return fora ? null : <>{children}</>
}