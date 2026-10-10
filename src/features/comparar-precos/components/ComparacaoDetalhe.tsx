'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { useComparacao } from '../hooks/useComparacao'
import type { Fornecedor } from '../types'
import { analisar } from '../utils/melhorPreco'
import TabelaComparativa from './TabelaComparativa'
import ResumoEconomia from './ResumoEconomia'
import FornecedorDialog from './FornecedorDialog'

// "10 cimento" ou "10x cimento" -> quantidade 10
function interpretar(texto: string): { name: string; quantity: number } {
  const t = texto.trim()
  const m = t.match(/^(\d+)\s*x\s*(.+)$/i) || t.match(/^(\d+)\s+(.+)$/)
  if (m) {
    const q = Number(m[1])
    if (q >= 1) return { name: m[2].trim(), quantity: q }
  }
  return { name: t, quantity: 1 }
}

export default function ComparacaoDetalhe({ id }: { id: string }) {
  const c = useComparacao(id)

  const [dialogFornecedor, setDialogFornecedor] = useState<{
    open: boolean
    fornecedor: Fornecedor | null
  }>({ open: false, fornecedor: null })

  const [novoItem, setNovoItem] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [erroItem, setErroItem] = useState('')

  const analise = useMemo(
    () => analisar(c.itens, c.fornecedores, c.precos),
    [c.itens, c.fornecedores, c.precos]
  )

  const adicionarItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoItem.trim()) return

    const { name, quantity } = interpretar(novoItem)
    if (!name) return

    setAdicionando(true)
    setErroItem('')
    try {
      await c.adicionarItens([{ name, quantity, unit: null, catalog_code: null }])
      setNovoItem('')
    } catch (err) {
      setErroItem(err instanceof Error ? err.message : 'Erro ao adicionar o item')
    } finally {
      setAdicionando(false)
    }
  }

  const voltar = (
    <Link
      href="/comparar-precos"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#079C9C]"
    >
      <ArrowLeft className="size-4" />
      Todas as comparações
    </Link>
  )

  if (c.loading) {
    return <p className="py-16 text-center text-sm text-slate-400">Carregando comparação...</p>
  }

  if (c.error || !c.comparacao) {
    return (
      <div className="space-y-4 py-8">
        {voltar}
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {c.error ?? 'Comparação não encontrada.'}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-16">
      <div className="mt-7 space-y-3">
        {voltar}
        <div>
          <h3 className="text-2xl font-bold md:text-3xl">{c.comparacao.name}</h3>
          <p className="text-sm text-gray-400">
            Criada em {new Date(c.comparacao.created_at).toLocaleDateString('pt-BR')} ·{' '}
            {c.itens.length} {c.itens.length === 1 ? 'item' : 'itens'} ·{' '}
            {c.fornecedores.length}{' '}
            {c.fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}
          </p>
        </div>
      </div>

      {/* Adicionar item */}
      <form onSubmit={adicionarItem} className="space-y-1.5 md:max-w-xl">
        <div className="flex items-center gap-2">
          <input
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            placeholder="Adicionar item: 10 cimento"
            aria-label="Adicionar item à comparação"
            disabled={adicionando}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 disabled:opacity-60"
          />
          <Button
            type="submit"
            disabled={adicionando || !novoItem.trim()}
            className="shrink-0 gap-1.5 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {adicionando ? (
  <Loader2 className="size-4 animate-spin" />
) : (
  <Plus className="size-4" />
)}
<span className="hidden sm:inline">Adicionar</span>
            Adicionar
          </Button>
        </div>
        {erroItem && <p className="text-sm text-red-600">{erroItem}</p>}
      </form>

      {c.itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
          Esta comparação não tem itens. Adicione o primeiro acima.
        </p>
      ) : (
        <>
          <TabelaComparativa
            itens={c.itens}
            fornecedores={c.fornecedores}
            precos={c.precos}
            analise={analise}
            onDefinirPreco={c.definirPreco}
            onAlterarQuantidade={c.alterarQuantidade}
            onRemoverItem={c.removerItem}
            onEditarFornecedor={(f) => setDialogFornecedor({ open: true, fornecedor: f })}
            onRemoverFornecedor={c.removerFornecedor}
            onAdicionarFornecedor={() => setDialogFornecedor({ open: true, fornecedor: null })}
          />

          <ResumoEconomia
  itens={c.itens}
  fornecedores={c.fornecedores}
  analise={analise}
  nomeComparacao={c.comparacao.name}
/>
        </>
      )}

      <FornecedorDialog
        open={dialogFornecedor.open}
        fornecedor={dialogFornecedor.fornecedor}
        disponiveis={c.fornecedoresDisponiveis}
        onClose={() => setDialogFornecedor((d) => ({ ...d, open: false }))}
        onCriar={c.criarEAdicionarFornecedor}
        onEditar={c.editarFornecedor}
        onAdicionarExistente={c.adicionarFornecedor}
      />
    </div>
  )
}