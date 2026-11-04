'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowDownUp, ArrowLeft, ClipboardPaste, Loader2, Plus, Search, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { useComparacao } from '../hooks/useComparacao'
import type { Fornecedor } from '../types'
import { analisar } from '../utils/melhorPreco'
import TabelaComparativa from './TabelaComparativa'
import ResumoEconomia from './ResumoEconomia'
import FornecedorDialog from './FornecedorDialog'
import ColarPrecosDialog from './ColarPrecosDialog'
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

type Ordem = 'original' | 'nome' | 'sem-preco'

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
  const [ordem, setOrdem] = useState<Ordem>('original')
  // "sem preço primeiro" fica congelado: se reordenasse a cada preço digitado,
  // o item sumiria debaixo do cursor. O botão "Reordenar" atualiza.
  const [ordemSemPreco, setOrdemSemPreco] = useState<string[]>([])
  const buscaRef = useRef<HTMLInputElement>(null)
  const [colarAberto, setColarAberto] = useState(false)

  // a análise usa TODOS os itens: filtro e ordem são só visuais
  const analise = useMemo(
    () => analisar(c.itens, c.fornecedores, c.precos),
    [c.itens, c.fornecedores, c.precos]
  )

  // atalho: "/" ou Ctrl/Cmd+K foca a pesquisa
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      const digitando =
        !!alvo &&
        (alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.tagName === 'SELECT' ||
          alvo.isContentEditable)

      const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'
      const barra = e.key === '/' && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey

      if (ctrlK || barra) {
        const campo = buscaRef.current
        if (!campo) return
        e.preventDefault()
        campo.focus()
        campo.select()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  const itensFiltrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean)
    if (termos.length === 0) return c.itens
    return c.itens.filter((i) => {
      const nome = normalizar(i.name)
      return termos.every((t) => nome.includes(t)) // "cimento cp" acha "Cimento CP-II"
    })
  }, [c.itens, busca])

  const itensExibidos = useMemo(() => {
    if (ordem === 'nome') {
      return [...itensFiltrados].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
      )
    }
    if (ordem === 'sem-preco') {
      const pos = new Map(ordemSemPreco.map((itemId, i) => [itemId, i]))
      // itens novos (adicionados depois de ordenar) vão para o fim
      return [...itensFiltrados].sort(
        (a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9)
      )
    }
    return itensFiltrados
  }, [itensFiltrados, ordem, ordemSemPreco])

  // quem tem mais fornecedores sem preço vem primeiro; completos ficam por último
  const calcularSemPreco = () => {
    const faltando = (itemId: string) =>
      c.fornecedores.length - (analise.linhas.get(itemId)?.cotacoes ?? 0)
    const ids = c.itens
      .map((item, idx) => ({ id: item.id, idx, f: faltando(item.id) }))
      .sort((a, b) => b.f - a.f || a.idx - b.idx)
      .map((x) => x.id)
    setOrdemSemPreco(ids)
  }

  const mudarOrdem = (nova: Ordem) => {
    setOrdem(nova)
    if (nova === 'sem-preco') calcularSemPreco()
  }

  // Enter na pesquisa: vai para o primeiro preço visível
  const irParaPrimeiroPreco = () => {
    const campos = Array.from(
      document.querySelectorAll<HTMLInputElement>('[data-preco-col]')
    ).filter((el) => el.offsetParent !== null)
    campos[0]?.focus()
  }

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
          {/* Pesquisar e ordenar */}
          <div className="space-y-1.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:max-w-3xl">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (busca) setBusca('')
                      else e.currentTarget.blur()
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      irParaPrimeiroPreco()
                    }
                  }}
                  type="search"
                  placeholder="Pesquisar item da lista"
                  aria-label="Pesquisar item da comparação"
                  aria-keyshortcuts="/ Control+K"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 [&::-webkit-search-cancel-button]:hidden"
                />
                {busca ? (
                  <button
                    type="button"
                    aria-label="Limpar pesquisa"
                    onClick={() => {
                      setBusca('')
                      buscaRef.current?.focus()
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 md:block">
                    /
                  </kbd>
                )}
              </div>

              <div className="relative sm:w-52 sm:shrink-0">
                <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={ordem}
                  onChange={(e) => mudarOrdem(e.target.value as Ordem)}
                  aria-label="Ordenar itens"
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
                >
                  <option value="original">Ordem da lista</option>
                  <option value="nome">Nome (A–Z)</option>
                  <option value="sem-preco">Sem preço primeiro</option>
                </select>
              </div>

              {c.fornecedores.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setColarAberto(true)}
                  className="shrink-0 gap-1.5 border-[#079C9C] text-[#079C9C] hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                >
                  <ClipboardPaste className="size-4" />
                  Colar preços
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              {busca.trim() && (
                <span>
                  Mostrando {itensFiltrados.length} de {c.itens.length}{' '}
                  {c.itens.length === 1 ? 'item' : 'itens'}. Os totais abaixo consideram todos.
                </span>
              )}
              {ordem === 'sem-preco' && (
                <>
                  <span>A ordem não muda enquanto você digita os preços.</span>
                  <button
                    type="button"
                    onClick={calcularSemPreco}
                    className="font-semibold text-[#079C9C] hover:underline"
                  >
                    Reordenar
                  </button>
                </>
              )}
            </div>
          </div>

          {itensExibidos.length === 0 ? (
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
              itens={itensExibidos}
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

      <ColarPrecosDialog
        open={colarAberto}
        itens={c.itens}
        fornecedores={c.fornecedores}
        precos={c.precos}
        onClose={() => setColarAberto(false)}
        onAplicar={c.definirPreco}
      />

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