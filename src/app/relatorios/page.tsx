import type { Metadata } from 'next'
import RelatoriosVendas from '@/features/relatorios/components/RelatoriosVendas'

export const metadata: Metadata = { title: 'Relatórios' }

export default function RelatoriosPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-sm text-slate-500">
          Acompanhe as vendas por vendedor, os orçamentos e os itens que mais saem.
        </p>
      </header>

      <RelatoriosVendas />
    </div>
  )
}