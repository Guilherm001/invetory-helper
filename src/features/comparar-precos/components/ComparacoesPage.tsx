'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Scale, Trash2, Truck, ListChecks, ChevronRight } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog'
import { useProducts } from '@/features/body/hooks/useProducts'
import { useComparacoes } from '../hooks/useComparacoes'
import type { ComparacaoResumo } from '../types'
import NovaComparacaoDialog from './NovaComparacaoDialog'

export default function ComparacoesPage() {
  const router = useRouter()
  const { comparacoes, loading, error, criar, excluir } = useComparacoes()
  const { products } = useProducts()

  const [novaAberta, setNovaAberta] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<ComparacaoResumo | null>(null)
  const [erroAcao, setErroAcao] = useState('')

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    setErroAcao('')
    try {
      await excluir(paraExcluir.id)
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="w-full pb-10">
      <div className="mt-7 flex flex-col gap-4 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-3xl font-bold">Comparar preços</h3>
          <p className="text-sm text-gray-400">
            Coloque os preços de cada fornecedor lado a lado e veja onde comprar mais barato.
          </p>
        </article>

        <Button
          onClick={() => setNovaAberta(true)}
          className="gap-2 bg-[#079C9C] px-5 py-5 text-white hover:bg-[#079C9C]/90"
        >
          <Plus className="size-5" />
          Nova comparação
        </Button>
      </div>

      {(error || erroAcao) && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || erroAcao}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando comparações...</p>
      ) : comparacoes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#079C9C]/10 text-[#079C9C]">
            <Scale className="size-6" />
          </div>
          <p className="text-base font-semibold text-slate-700">Nenhuma comparação ainda</p>
          <p className="max-w-sm text-sm text-slate-500">
            Crie uma com os itens que você precisa comprar e adicione os fornecedores.
          </p>
          <Button
            onClick={() => setNovaAberta(true)}
            className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            <Plus className="size-4" />
            Nova comparação
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {comparacoes.map((c) => (
            <li
              key={c.id}
              className="group relative rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-px hover:border-[#079C9C]/40 hover:shadow-md"
            >
              <Link
                href={`/comparar-precos/${c.id}`}
                className="flex items-center gap-3 p-4 pr-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] rounded-xl"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#079C9C]/10 text-[#079C9C]">
                  <Scale className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900" title={c.name}>
                    {c.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      <ListChecks className="size-3" />
                      {c.itens_count} {c.itens_count === 1 ? 'item' : 'itens'}
                    </span>
                    <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      <Truck className="size-3" />
                      {c.fornecedores_count}{' '}
                      {c.fornecedores_count === 1 ? 'fornecedor' : 'fornecedores'}
                    </span>
                  </div>
                </div>

                <ChevronRight className="size-5 shrink-0 text-slate-300 transition group-hover:text-[#079C9C]" />
              </Link>

              <button
                type="button"
                aria-label={`Excluir ${c.name}`}
                onClick={() => setParaExcluir(c)}
                className="absolute right-2 top-2 rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <NovaComparacaoDialog
        open={novaAberta}
        produtos={products}
        onClose={() => setNovaAberta(false)}
        onCriar={async (nome, itens) => {
          const nova = await criar(nome, itens)
          router.push(`/comparar-precos/${nova.id}`)
        }}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comparação?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{paraExcluir?.name}</strong> será apagada com todos os preços
              preenchidos. Os fornecedores continuam cadastrados. Essa ação não poderá ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}