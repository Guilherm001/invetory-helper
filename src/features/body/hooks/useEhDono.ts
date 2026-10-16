'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// null = ainda descobrindo
export function useEhDono() {
  const [ehDono, setEhDono] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelado = false

    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        if (!cancelado) setEhDono(false)
        return
      }
      const { data } = await supabase
        .from('perfis')
        .select('papel')
        .eq('id', auth.user.id)
        .maybeSingle()
      if (!cancelado) setEhDono(data?.papel === 'dono')
    })().catch(() => {
      if (!cancelado) setEhDono(false)
    })

    return () => {
      cancelado = true
    }
  }, [])

  return ehDono
}