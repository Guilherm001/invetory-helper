'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { ArrowDownUp, ArrowLeft, ClipboardPaste, Loader2, Plus, Search, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { useComparacao } from '../hooks/useComparacao'
import type { Fornecedor } from '../types'
import { analisar, chave, montarMapa } from '../utils/melhorPreco'
import { interpretar, normalizar } from '../utils/formatacao'
import { FOCO } from '../utils/estilos'
import TabelaComparativa from './TabelaComparativa'
import PreencherPorFornecedor from './PreencherPorFornecedor'
import BarraResumo from './BarraResumo'
import ResumoEconomia from './ResumoEconomia'
import FornecedorDialog from './FornecedorDialog'
import ColarPrecosDialog from './ColarPrecosDialog'
import { camposDePreco } from './CelulaPreco'
import Kbd from './Kbd'
import { useReferencias } from '@/features/historico-precos/hooks/useReferencias'

type Ordem = 'original' | 'nome' | 'sem-preco'
type Modo = 'tabela' | 'fornecedor'

const CAMPO =
  'w-full rounded-md border border-slate-200 bg-white text-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

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
  const [colarAberto, setColarAberto] = useState(false)

  const [modo, setModo] = useState<Modo>('tabela')
  const [ativoId, setAtivoId] = useState<string | null>(null)
  const [focoSolicitado, setFocoSolicitado] = useState(0)
  const [resumoVisivel, setResumoVisivel] = useState(false)

  const buscaRef = useRef<HTMLInputElement>(null)
  const itemRef = useRef<HTMLInputElement>(null)
  const resumoRef = useRef<HTMLDivElement>(null)

  // a análise usa TODOS os itens: filtro e ordem são só visuais
  const analise = useMemo(
    () => analisar(c.itens, c.fornecedores, c.precos),
    [c.itens, c.fornecedores, c.precos]
  )
  const mapaPrecos = useMemo(() => montarMapa(c.precos), [c.precos])

  const ativo = c.fornecedores.find((f) => f.id === ativoId) ?? c.fornecedores[0] ?? null
  const porFornecedor = modo === 'fornecedor' && ativo !== null

  // "Colar preços" e o modo por fornecedor só fazem sentido com itens e fornecedores
  const podeColar = c.itens.length > 0 && c.fornecedores.length > 0

  const preenchidos = useMemo(
    () => c.itens.reduce((soma, i) => soma + (analise.linhas.get(i.id)?.cotacoes ?? 0), 0),
    [c.itens, analise]
  )

  // valores lidos pelo ouvinte de teclado (que é registrado uma única vez)
  const podeColarRef = useRef(podeColar)
  podeColarRef.current = podeColar
  const fornecedoresRef = useRef(c.fornecedores)
  fornecedoresRef.current = c.fornecedores
  const dialogAbertoRef = useRef(false)
  dialogAbertoRef.current = dialogFornecedor.open || colarAberto
  const ultimoPrecoRef = useRef<HTMLInputElement | null>(null)

  const rolarParaResumo = () => {
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    resumoRef.current?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' })
  }

  // No celular, preencher um fornecedor por vez é bem mais prático
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setModo('fornecedor')
  }, [])

  // Atalhos: / ou Ctrl/Cmd+K = pesquisar · I = novo item · F = fornecedor · C = colar preços
  //          M = alternar modo · 1–9 = preencher o fornecedor N · R = ver resumo
  //          ↑ ↓ ← → ou Enter, sem nada focado = entrar nos preços
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!e.key) return // o autofill do navegador dispara keydown sem tecla

      // com um diálogo ABERTO, nenhum atalho da página vale. Só conta o que está aberto:
      // qualquer elemento role="dialog" escondido na página não pode travar os atalhos.
      if (
        dialogAbertoRef.current ||
        document.querySelector(
          '[role="alertdialog"][data-state="open"], [role="dialog"][data-state="open"]'
        )
      ) {
        return
      }

      // AltGr (teclados ABNT2) conta como Ctrl+Alt: não é um modificador de verdade
      const modificador =
        e.metaKey || ((e.ctrlKey || e.altKey) && !e.getModifierState('AltGraph'))

      if (modificador && e.key.toLowerCase() === 'k') {
        const campo = buscaRef.current
        if (!campo) return
        e.preventDefault()
        campo.focus()
        campo.select()
        return
      }
      if (modificador) return

      const alvo = e.target as HTMLElement | null
      const digitando =
        !!alvo &&
        (alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.tagName === 'SELECT' ||
          alvo.isContentEditable)
      if (digitando) return

      // Sem nada focado, as setas só rolariam a página: levam para os preços.
      // Volta à última célula usada; se não houver, vai para o primeiro preço vazio.
      const semFoco = !document.activeElement || document.activeElement === document.body
      if (
        semFoco &&
        !e.shiftKey &&
        ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)
      ) {
        const campos = camposDePreco()
        if (campos.length > 0) {
          e.preventDefault()
          const anterior = ultimoPrecoRef.current
          const alvo =
            anterior && campos.includes(anterior)
              ? anterior
              : (campos.find((el) => el.value === '') ?? campos[0])
          alvo.focus()
        }
        return
      }

      // 1–9: abre o modo por fornecedor já no fornecedor escolhido
      if (/^[1-9]$/.test(e.key)) {
        const f = fornecedoresRef.current[Number(e.key) - 1]
        if (f) {
          e.preventDefault()
          setModo('fornecedor')
          setAtivoId(f.id)
          setFocoSolicitado((n) => n + 1)
        }
        return
      }

      switch (e.key.toLowerCase()) {
        case '/':
          if (buscaRef.current) {
            e.preventDefault()
            buscaRef.current.focus()
            buscaRef.current.select()
          }
          break
        case 'i':
          if (itemRef.current) {
            e.preventDefault()
            itemRef.current.focus()
          }
          break
        case 'f':
          e.preventDefault()
          setDialogFornecedor({ open: true, fornecedor: null })
          break
        case 'c':
          if (podeColarRef.current) {
            e.preventDefault()
            setColarAberto(true)
          }
          break
        case 'm':
          if (podeColarRef.current) {
            e.preventDefault()
            setModo((m) => (m === 'tabela' ? 'fornecedor' : 'tabela'))
          }
          break
        case 'r':
          if (podeColarRef.current) {
            e.preventDefault()
            rolarParaResumo()
          }
          break
      }
    }
    const aoFocar = (e: FocusEvent) => {
      const el = e.target
      if (el instanceof HTMLInputElement && el.dataset.precoCol) ultimoPrecoRef.current = el
    }
    window.addEventListener('keydown', aoTeclar)
    document.addEventListener('focusin', aoFocar)
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('focusin', aoFocar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // depois de trocar de fornecedor pelo teclado, o foco vai para o primeiro preço vazio
  useEffect(() => {
    if (focoSolicitado === 0) return
    const campos = camposDePreco()
    ;(campos.find((el) => el.value === '') ?? campos[0])?.focus()
  }, [focoSolicitado])

  // se o item/fornecedor focado for removido, o foco volta para a tabela
  const totalAnterior = useRef(c.itens.length + c.fornecedores.length)
  useEffect(() => {
    const total = c.itens.length + c.fornecedores.length
    if (total < totalAnterior.current && document.activeElement === document.body) {
      const alvo = camposDePreco()[0] ?? buscaRef.current ?? itemRef.current
      alvo?.focus()
    }
    totalAnterior.current = total
  }, [c.itens.length, c.fornecedores.length])

  // a barra de resumo some quando o resumo completo já está na tela
  useEffect(() => {
    const el = resumoRef.current
    if (!el) return
    const observador = new IntersectionObserver(
      ([entrada]) => setResumoVisivel(entrada.isIntersecting),
      { threshold: 0.15 }
    )
    observador.observe(el)
    return () => observador.disconnect()
  }, [podeColar, c.loading])

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

  // Na tabela: quem tem mais fornecedores sem preço vem primeiro.
  // Por fornecedor: os itens sem preço NO fornecedor ativo vêm primeiro.
  const calcularSemPreco = () => {
    const faltando = (itemId: string) => {
      if (modo === 'fornecedor' && ativo) {
        return mapaPrecos.get(chave(itemId, ativo.id)) === undefined ? 1 : 0
      }
      return c.fornecedores.length - (analise.linhas.get(itemId)?.cotacoes ?? 0)
    }
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

  // ao trocar de modo ou de fornecedor, a ordem "sem preço" é recalculada
  useEffect(() => {
    if (ordem === 'sem-preco') calcularSemPreco()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, ativo?.id])

  const irParaPrimeiroPreco = () => {
    camposDePreco()[0]?.focus()
  }

  const adicionarItem = async (e: FormEvent) => {
    e.preventDefault()
    if (adicionando || !novoItem.trim()) return

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
      // o campo não é desabilitado: o foco fica nele para cadastrar vários itens seguidos
      itemRef.current?.focus()
    }
  }

  const voltar = (
    <Link
      href="/comparar-precos"
      className={`inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 transition hover:text-[#079C9C] focus-visible:ring-offset-2 ${FOCO}`}
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
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {c.error ?? 'Comparação não encontrada.'}
        </p>
      </div>
    )
  }

  const abrirNovoFornecedor = () => setDialogFornecedor({ open: true, fornecedor: null })

  return (
    <div className="w-full space-y-5 pb-16">
      <header className="mt-7 space-y-3">
        {voltar}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-2xl font-bold md:text-3xl">{c.comparacao.name}</h3>
            <p className="text-sm text-gray-400">
              Criada em {new Date(c.comparacao.created_at).toLocaleDateString('pt-BR')} ·{' '}
              {c.itens.length} {c.itens.length === 1 ? 'item' : 'itens'} ·{' '}
              {c.fornecedores.length}{' '}
              {c.fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={abrirNovoFornecedor}
              aria-keyshortcuts="F"
              className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#079C9C]"
            >
              <Plus className="size-4" />
              Fornecedor
              <span className="hidden md:inline">
                <Kbd>F</Kbd>
              </span>
            </Button>

            {podeColar && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setColarAberto(true)}
                aria-keyshortcuts="C"
                className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#079C9C]"
              >
                <ClipboardPaste className="size-4" />
                Colar preços
                <span className="hidden md:inline">
                  <Kbd>C</Kbd>
                </span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Barra de ferramentas */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={adicionarItem}
            className="flex min-w-[16rem] flex-1 items-center gap-2 md:max-w-md"
          >
            <div className="relative flex-1">
              <input
                ref={itemRef}
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') e.currentTarget.blur()
                }}
                placeholder="Novo item (ex.: 10 cimento)"
                aria-label="Adicionar item à comparação"
                aria-keyshortcuts="I"
                aria-busy={adicionando}
                className={`${CAMPO} py-2 pl-3 pr-9`}
              />
              {!novoItem && (
                <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 md:block">
                  <Kbd>I</Kbd>
                </span>
              )}
            </div>
            <Button
              type="submit"
              disabled={adicionando || !novoItem.trim()}
              className="shrink-0 gap-1.5 bg-[#079C9C] text-white hover:bg-[#079C9C]/90 focus-visible:ring-2 focus-visible:ring-[#079C9C] focus-visible:ring-offset-2"
            >
              {adicionando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          </form>

          {c.itens.length > 0 && (
            <>
              <div className="relative w-full sm:w-56">
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
                    if (e.key === 'Enter' || e.key === 'ArrowDown') {
                      e.preventDefault()
                      irParaPrimeiroPreco()
                    }
                  }}
                  type="search"
                  placeholder="Pesquisar item"
                  aria-label="Pesquisar item da comparação"
                  aria-keyshortcuts="/ Control+K"
                  className={`${CAMPO} py-2 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden`}
                />
                {busca ? (
                  <button
                    type="button"
                    aria-label="Limpar pesquisa"
                    onClick={() => {
                      setBusca('')
                      buscaRef.current?.focus()
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCO}`}
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 md:block">
                    <Kbd>/</Kbd>
                  </span>
                )}
              </div>

              <div className="relative w-full sm:w-48">
                <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={ordem}
                  onChange={(e) => mudarOrdem(e.target.value as Ordem)}
                  aria-label="Ordenar itens"
                  className={`${CAMPO} appearance-none py-2 pl-9 pr-3`}
                >
                  <option value="original">Ordem da lista</option>
                  <option value="nome">Nome (A–Z)</option>
                  <option value="sem-preco">Sem preço primeiro</option>
                </select>
              </div>
            </>
          )}

          {podeColar && (
            <div
              role="group"
              aria-label="Modo de preenchimento"
              className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 sm:ml-auto"
            >
              {(['tabela', 'fornecedor'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={modo === m}
                  aria-keyshortcuts="M"
                  title="Alternar modo (M)"
                  onClick={() => setModo(m)}
                  className={`rounded px-3 py-1.5 text-sm transition ${FOCO} ${
                    modo === m
                      ? 'bg-white font-medium text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {m === 'tabela' ? 'Tabela' : 'Por fornecedor'}
                </button>
              ))}
            </div>
          )}
        </div>

        {erroItem && (
          <p role="alert" className="text-sm text-red-600">
            {erroItem}
          </p>
        )}

        {(busca.trim() || ordem === 'sem-preco') && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            {busca.trim() && (
              <span>
                Mostrando {itensFiltrados.length} de {c.itens.length}{' '}
                {c.itens.length === 1 ? 'item' : 'itens'}. Os totais consideram todos.
              </span>
            )}
            {ordem === 'sem-preco' && (
              <>
                <span>A ordem não muda enquanto você digita os preços.</span>
                <button
                  type="button"
                  onClick={calcularSemPreco}
                  className={`rounded font-semibold text-[#079C9C] hover:underline ${FOCO}`}
                >
                  Reordenar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {c.itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
          Esta comparação não tem itens. Digite o primeiro no campo acima e aperte Enter.
        </p>
      ) : (
        <>
          {itensExibidos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
              Nenhum item encontrado para “{busca}”.{' '}
              <button
                type="button"
                onClick={() => setBusca('')}
                className={`rounded font-semibold text-[#079C9C] hover:underline ${FOCO}`}
              >
                Limpar pesquisa
              </button>
            </p>
          ) : porFornecedor && ativo ? (
            <PreencherPorFornecedor
              itens={itensExibidos}
              todosItens={c.itens}
              fornecedores={c.fornecedores}
              precos={c.precos}
              analise={analise}
              referencias={referencias}
              ativoId={ativo.id}
              onAtivar={setAtivoId}
              onDefinirPreco={c.definirPreco}
              onEditarFornecedor={(f) => setDialogFornecedor({ open: true, fornecedor: f })}
              onAdicionarFornecedor={abrirNovoFornecedor}
            />
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
              onAdicionarFornecedor={abrirNovoFornecedor}
            />
          )}

          <div ref={resumoRef}>
            <ResumoEconomia
              itens={c.itens}
              fornecedores={c.fornecedores}
              analise={analise}
              nomeComparacao={c.comparacao.name}
              comparacaoId={id}
            />
          </div>

          {/* Fica no fluxo (só invisível) para a página não "pular" quando o resumo aparece */}
          {podeColar && (
            <div
              className={`sticky bottom-0 z-30 ${resumoVisivel ? 'invisible' : ''}`}
              aria-hidden={resumoVisivel}
            >
              <BarraResumo
                analise={analise}
                preenchidos={preenchidos}
                total={c.itens.length * c.fornecedores.length}
                onVerResumo={rolarParaResumo}
              />
            </div>
          )}
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