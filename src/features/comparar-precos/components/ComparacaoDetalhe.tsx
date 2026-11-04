'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, Search, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { useComparacao } from '../hooks/useComparacao'
import type { Fornecedor } from '../types'
import { analisar } from '../utils/melhorPreco'
import TabelaComparativa from './TabelaComparativa'
import ResumoEconomia from './ResumoEconomia'
import FornecedorDialog from './FornecedorDialog'
import { useReferencias } from '@/features/historico-precos/hooks/useReferencias'

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

// ignora maiúsculas e acentos: "areia media" encontra "Areia Média"
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export default function ComparacaoDetalhe({ id }: { id: string }) {
  const c = useComparacao(id)
  const referencias = useReferencias(id)

  const [dialogFornecedor, setDialogFornecedor] = useState<{
    open: boolean
    fornecedor: Fornecedor | null
  }>({ open: false, fornecedor: null })

  const [novoItem, setNovoItem] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [erroItem, setErroItem] = useState('')
  const [busca, setBusca] = useState('')

  // a análise usa TODOS os itens: o filtro é só visual
  const analise = useMemo(
    () => analisar(c.itens, c.fornecedores, c.precos),
    [c.itens, c.fornecedores, c.precos]
  )

  const itensFiltrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean)
    if (termos.length === 0) return c.itens
    return c.itens.filter((i) => {
      const nome = normalizar(i.name)
      return termos.every((t) => nome.includes(t)) // "cimento cp" acha "Cimento CP-II"
    })
  }, [c.itens, busca])

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
          {/* Pesquisar item */}
          <div className="space-y-1.5">
            <div className="relative md:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setBusca('')
                }}
                type="search"
                placeholder="Pesquisar item da lista"
                aria-label="Pesquisar item da comparação"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 [&::-webkit-search-cancel-button]:hidden"
              />
              {busca && (
                <button
                  type="button"
                  aria-label="Limpar pesquisa"
                  onClick={() => setBusca('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {busca.trim() && (
              <p className="text-xs text-slate-400">
                Mostrando {itensFiltrados.length} de {c.itens.length}{' '}
                {c.itens.length === 1 ? 'item' : 'itens'}. Os totais abaixo consideram todos.
              </p>
            )}
          </div>

          {itensFiltrados.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
              Nenhum item encontrado para “{busca}”.{' '}
              <button
                type="button"
                onClick={() => setBusca('')}
                className="font-semibold text-[#079C9C] hover:underline"
              >
                Limpar pesquisa
              </button>
            </p>
          ) : (
            <TabelaComparativa
              referencias={referencias}
              itens={itensFiltrados}
              fornecedores={c.fornecedores}
              precos={c.precos}
              analise={analise}
              onDefinirPreco={c.definirPreco}
              onAlterarQuantidade={c.alterarQuantidade}
              onRemoverItem={c.removerItem}
              onEditarFornecedor={(f) => setDialogFornecedor({ open: true, fornecedor: f })}
              onRemoverFornecedor={c.removerFornecedor}
              onAdicionarFornecedor={() =>
                setDialogFornecedor({ open: true, fornecedor: null })
              }
            />
          )}

          <ResumoEconomia
            itens={c.itens}
            fornecedores={c.fornecedores}
            analise={analise}
            nomeComparacao={c.comparacao.name}
            comparacaoId={id}
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
