'use client'

import { createContext, useContext } from 'react'
import type { EtapaDaFalta } from '@/features/compras/services/painelService'

// quem fornece (o Body) só preenche quando a pessoa é dona e o SQL do painel existe;
// para o balcão fica null e nenhum selo aparece
const EtapasContext = createContext<Map<string, EtapaDaFalta> | null>(null)

export const EtapasFaltasProvider = EtapasContext.Provider

export const useEtapasDasFaltas = () => useContext(EtapasContext)