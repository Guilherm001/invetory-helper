'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Check, ChevronRight, ClipboardList, Loader2, Plus, Search, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import BuscaCatalogo from '@/features/catalogo/components/buscarCatalogo'
import type { Product } from '@/features/body/services/listService'
// ajuste o caminho se a pasta da feature de cotações tiver outro nome
import { listCotacoes, type CotacaoSalva } from '@/features/cotacao/services/cotacaoService'
import type { NovoItemComparacao } from '../types'
import { interpretar, normalizar, numero } from '../utils/formatacao'
import Kbd from './Kbd'

interface Props {
  open: boolean
  produtos: Product[]
  onClose: () => void
  onCriar: (nome: string, itens: NovoItemComparacao[]) => Promise<unknown>
}

type Item = NovoItemComparacao & { key: string }
type Aba = 'produtos' | 'catalogo' | 'cotacoes' | 'digitar'
type CotItem = CotacaoSalva['itens'][number]
type LinhaCot = { key: string; cotacao: CotacaoSalva; item?: CotItem }

const ABAS: { id: Aba; label: string }[] = [
  { id: 'produtos', label: 'Minha lista' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'cotacoes', label: 'Cotações' },
  { id: 'digitar', label: 'Digitar' },
]

const ATALHO_ABA: Record<string, Aba> = {
  Digit1: 'produtos',
  Digit2: 'catalogo',
  Digit3: 'cotacoes',
  Digit4: 'digitar',
  Numpad1: 'produtos',
  Numpad2: 'catalogo',
  Numpad3: 'cotacoes',
  Numpad4: 'digitar',
}

const inputClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

const linhaClass =
  'flex w-full items-center gap-3 px-3 py-2 text-left outline-none transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:shadow-[inset_3px_0_0_#079C9C]'

// quantidade da cotação vem como texto ("10", "2,5")
const lerQtd = (q: string) => {
  const n = Number(String(q).trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 1
}

type Comparavel = { catalog_code: string | null; name: string }
const mesmoItem = (a: Comparavel, b: Comparavel) =>
  a.catalog_code && b.catalog_code
    ? a.catalog_code === b.catalog_code
    : normalizar(a.name) === normalizar(b.name)

// quantidade editável: aceita digitar, "+" e "-"
function QtdInput({
  valor,
  label,
  onCommit,
  onKeyDown,
  refCb,
}: {
  valor: number
  label: string
  onCommit: (n: number) => void
  onKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>, vazio: boolean) => void
  refCb: (el: HTMLInputElement | null) => void
}) {
  const [txt, setTxt] = useState<string | null>(null)
  const mostrado = txt ?? numero(valor)

  return (
    <input
      ref={refCb}
      value={mostrado}
      inputMode="decimal"
      aria-label={label}
      placeholder="Qtd"
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setTxt(null)}
      onChange={(e) => {
        const v = e.target.value
        setTxt(v)
        const n = Number(v.replace(',', '.'))
        if (v.trim() !== '' && Number.isFinite(n) && n > 0) onCommit(n)
      }}
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return
        if (e.key === '+') {
          e.preventDefault()
          setTxt(null)
          onCommit(valor + 1)
          return
        }
        if (e.key === '-') {
          e.preventDefault()
          setTxt(null)
          onCommit(Math.max(1, valor - 1))
          return
        }
        onKeyDown(e, mostrado.trim() === '')
      }}
      className="w-20 shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
    />
  )
}

function Conteudo({ produtos, onClose, onCriar }: Omit<Props, 'open'>) {
  const [nome, setNome] = useState(
    () => `Comparação ${new Date().toLocaleDateString('pt-BR')}`
  )
  const [aba, setAba] = useState<Aba>('produtos')
  const [itens, setItens] = useState<Item[]>([])
  const [aviso, setAviso] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // minha lista
  const [busca, setBusca] = useState('')

  // cotações
  const [cotacoes, setCotacoes] = useState<CotacaoSalva[] | null>(null)
  const [cotErro, setCotErro] = useState('')
  const [buscaCot, setBuscaCot] = useState('')
  const [abertasCot, setAbertasCot] = useState<Set<string>>(new Set())

  // digitar
  const [texto, setTexto] = useState('')

  const contador = useRef(0)
  const painelRef = useRef<HTMLDivElement>(null)
  const navRefs = useRef<Map<string, HTMLElement>>(new Map())
  const qtdRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const abaRefs = useRef<Map<Aba, HTMLButtonElement>>(new Map())
  const focoPendente = useRef<string | null>(null)
  const focoNaAba = useRef(false)
  const abaAnterior = useRef<Aba>('produtos')

  const focarPainel = () =>
    painelRef.current?.querySelector<HTMLElement>('input, textarea')?.focus()

  // ao trocar de aba, o cursor vai para o primeiro campo dela
  useEffect(() => {
    if (abaAnterior.current === aba) return
    abaAnterior.current = aba
    if (focoNaAba.current) {
      focoNaAba.current = false
      abaRefs.current.get(aba)?.focus()
      return
    }
    focarPainel()
  }, [aba])

  // depois que a lista muda, leva o foco para a quantidade pedida
  useEffect(() => {
    const key = focoPendente.current
    if (!key) return
    focoPendente.current = null
    qtdRefs.current.get(key)?.focus()
  }, [itens])

  // carrega as cotações só quando a aba é aberta pela primeira vez
  useEffect(() => {
    if (aba !== 'cotacoes' || cotacoes !== null) return
    let cancelado = false
    listCotacoes()
      .then((l) => {
        if (!cancelado) setCotacoes(l)
      })
      .catch((e) => {
        if (cancelado) return
        setCotErro(e instanceof Error ? e.message : 'Erro ao carregar as cotações')
        setCotacoes([])
      })
    return () => {
      cancelado = true
    }
  }, [aba, cotacoes])

  const trocarAba = (nova: Aba, daAba = false) => {
    if (nova === aba) {
      if (!daAba) focarPainel()
      return
    }
    focoNaAba.current = daAba
    setAviso('')
    setAba(nova)
  }

  // ---------- navegação por setas em listas ----------

  const reg = (key: string) => (el: HTMLElement | null) => {
    if (el) navRefs.current.set(key, el)
    else navRefs.current.delete(key)
  }

  const foco = (key?: string) => {
    if (key) navRefs.current.get(key)?.focus()
  }

  const navegar = (
    e: ReactKeyboardEvent<HTMLElement>,
    chaves: string[],
    i: number
  ): boolean => {
    if (e.ctrlKey || e.metaKey || e.altKey) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      foco(chaves[i + 1])
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (i === 0) focarPainel()
      else foco(chaves[i - 1])
      return true
    }
    if (e.key === 'Home') {
      e.preventDefault()
      foco(chaves[0])
      return true
    }
    if (e.key === 'End') {
      e.preventDefault()
      foco(chaves[chaves.length - 1])
      return true
    }
    return false
  }

  const descerFiltro = (e: ReactKeyboardEvent<HTMLInputElement>, primeira?: string) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      foco(primeira)
    } else if (e.key === 'Escape' && e.currentTarget.value) {
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.value = ''
      e.currentTarget.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  // ---------- minha lista ----------

  // itens já comprados não entram em uma nova comparação
  const disponiveis = useMemo(() => {
    const termo = normalizar(busca)
    return produtos.filter(
      (p) => p.id && p.status !== 'Concluído' && (termo === '' || normalizar(p.name).includes(termo))
    )
  }, [produtos, busca])

  const chaveProduto = (p: Product) => `p:${p.id}`
  const itemDoProduto = (p: Product): Item => ({
    key: chaveProduto(p),
    name: p.name,
    quantity: p.quantity > 0 ? p.quantity : 1,
    unit: p.unit ?? null,
    catalog_code: p.catalog_code ?? null,
  })

  const marcados = new Set(itens.map((i) => i.key))
  const todosMarcados =
    disponiveis.length > 0 && disponiveis.every((p) => marcados.has(chaveProduto(p)))

  const alternarProduto = (p: Product) =>
    setItens((prev) =>
      prev.some((i) => i.key === chaveProduto(p))
        ? prev.filter((i) => i.key !== chaveProduto(p))
        : [...prev, itemDoProduto(p)]
    )

  const alternarTodos = () =>
    setItens((prev) => {
      if (todosMarcados) {
        const sair = new Set(disponiveis.map(chaveProduto))
        return prev.filter((i) => !sair.has(i.key))
      }
      const ja = new Set(prev.map((i) => i.key))
      return [...prev, ...disponiveis.filter((p) => !ja.has(chaveProduto(p))).map(itemDoProduto)]
    })

  const chavesProdutos = disponiveis.map((p) => `prod:${p.id}`)

  // ---------- catálogo ----------

  const adicionarDoCatalogo = (c: { name: string; unit: string | null; code: string }) =>
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.catalog_code === c.code)
      // já está na lista: soma 1 em vez de duplicar
      if (idx >= 0) return prev.map((i, n) => (n === idx ? { ...i, quantity: i.quantity + 1 } : i))
      return [
        ...prev,
        { key: `c:${c.code}`, name: c.name, quantity: 1, unit: c.unit, catalog_code: c.code },
      ]
    })

  // ---------- cotações ----------

  const linhasCot = useMemo(() => {
    const termo = normalizar(buscaCot)
    const lista = (cotacoes ?? []).filter(
      (c) =>
        !termo ||
        normalizar(c.fornecedor).includes(termo) ||
        c.itens.some((i) => normalizar(i.name).includes(termo))
    )
    const out: LinhaCot[] = []
    for (const c of lista) {
      out.push({ key: `cot:${c.id}`, cotacao: c })
      if (abertasCot.has(c.id)) {
        for (const i of c.itens) out.push({ key: `cit:${c.id}:${i.id}`, cotacao: c, item: i })
      }
    }
    return out
  }, [cotacoes, buscaCot, abertasCot])

  const chavesCot = linhasCot.map((l) => l.key)

  const definirAberta = (id: string, abrir: boolean) =>
    setAbertasCot((prev) => {
      const novo = new Set(prev)
      if (abrir) novo.add(id)
      else novo.delete(id)
      return novo
    })

  const naLista = (i: Comparavel) => itens.some((x) => mesmoItem(x, i))

  const adicionarDaCotacao = (c: CotacaoSalva, origem: CotItem[]) => {
    const novos: Item[] = []
    let repetidos = 0
    for (const i of origem) {
      const item: Item = {
        key: `q:${c.id}:${i.id}`,
        name: i.name,
        quantity: lerQtd(i.quantity),
        unit: i.unit,
        catalog_code: i.catalog_code,
      }
      if (naLista(item) || novos.some((x) => mesmoItem(x, item))) repetidos++
      else novos.push(item)
    }
    if (novos.length > 0) setItens((prev) => [...prev, ...novos])

    const add = `${novos.length} ${novos.length === 1 ? 'item adicionado' : 'itens adicionados'}`
    const rep =
      repetidos > 0 ? ` · ${repetidos} já ${repetidos === 1 ? 'estava' : 'estavam'} na lista` : ''
    setAviso(add + rep)
  }

  const teclaCot = (e: ReactKeyboardEvent<HTMLButtonElement>, l: LinhaCot, i: number) => {
    if (navegar(e, chavesCot, i)) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'ArrowRight' && !l.item) {
      e.preventDefault()
      definirAberta(l.cotacao.id, true)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (l.item) foco(`cot:${l.cotacao.id}`)
      else definirAberta(l.cotacao.id, false)
    }
  }

  // ---------- digitar ou colar ----------

  const linhas = texto
    .split('\n')
    .map(interpretar)
    .filter((l) => l.name)

  const adicionarDigitados = () => {
    if (linhas.length === 0) return
    setItens((prev) => [
      ...prev,
      ...linhas.map((l) => ({
        key: `t:${++contador.current}`,
        name: l.name,
        quantity: l.quantity,
        unit: null,
        catalog_code: null,
      })),
    ])
    setTexto('')
  }

  // ---------- lista montada ----------

  const atualizar = (key: string, dados: Partial<Item>) =>
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, ...dados } : i)))

  const remover = (key: string) => setItens((prev) => prev.filter((i) => i.key !== key))

  const teclaQtd = (e: ReactKeyboardEvent<HTMLInputElement>, i: number, vazio: boolean) => {
    const item = itens[i]
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'Enter') {
      e.preventDefault()
      focarPainel()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const prox = itens[i + 1]
      if (prox) qtdRefs.current.get(prox.key)?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const ant = itens[i - 1]
      if (ant) qtdRefs.current.get(ant.key)?.focus()
      else focarPainel()
    } else if (e.key === 'Backspace' && vazio) {
      e.preventDefault()
      const vizinho = itens[i - 1] ?? itens[i + 1]
      if (vizinho) focoPendente.current = vizinho.key
      else focarPainel()
      remover(item.key)
    }
  }

  const handleCriar = async () => {
    if (saving) return
    if (!nome.trim()) {
      setErrorMessage('Dê um nome para a comparação.')
      return
    }

    // o que foi digitado e ainda não adicionado entra junto
    const extras: Item[] = linhas.map((l) => ({
      key: `t:${++contador.current}`,
      name: l.name,
      quantity: l.quantity,
      unit: null,
      catalog_code: null,
    }))
    const lista = [...itens, ...extras]

    if (lista.length === 0) {
      setErrorMessage('Adicione pelo menos um item.')
      return
    }

    setSaving(true)
    setErrorMessage('')
    try {
      await onCriar(
        nome.trim(),
        lista.map(({ key, ...resto }) => {
          void key
          return resto
        })
      )
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao criar a comparação')
      setSaving(false)
    }
  }

  const total = itens.length + linhas.length

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          handleCriar()
          return
        }
        if (!e.altKey || e.ctrlKey || e.metaKey) return

        const destino = ATALHO_ABA[e.code]
        if (destino) {
          e.preventDefault()
          trocarAba(destino)
        } else if (e.code === 'KeyL') {
          e.preventDefault()
          const ultimo = itens[itens.length - 1]
          if (ultimo) qtdRefs.current.get(ultimo.key)?.focus()
        } else if (e.code === 'KeyA' && aba === 'produtos') {
          e.preventDefault()
          alternarTodos()
        }
      }}
    >
      <DialogHeader className="border-b border-slate-100 px-6 py-4 text-left">
        <DialogTitle className="text-base font-semibold text-slate-900">Nova comparação</DialogTitle>
        <DialogDescription className="text-sm text-slate-500">
          Escolha os itens que vão receber preços.
        </DialogDescription>
      </DialogHeader>

      {/* Nome, abas e painel ficam fora da área rolável para a lista de resultados não ser cortada */}
      <div className="relative z-20 space-y-4 px-6 pt-5">
        <div className="space-y-1.5">
          <label htmlFor="comp-nome" className="block text-xs font-medium text-slate-600">
            Nome
          </label>
          <input
            id="comp-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return
              e.preventDefault()
              focarPainel()
            }}
            placeholder="Ex: Material da obra Silva"
            className={`${inputClass} w-full`}
            autoFocus
          />
        </div>

        {/* Abas */}
        <div
          role="tablist"
          aria-label="Como adicionar itens"
          className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1"
        >
          {ABAS.map(({ id, label }, n) => (
            <button
              key={id}
              ref={(el) => {
                if (el) abaRefs.current.set(id, el)
                else abaRefs.current.delete(id)
              }}
              type="button"
              role="tab"
              aria-selected={aba === id}
              tabIndex={aba === id ? 0 : -1}
              onClick={() => trocarAba(id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                e.preventDefault()
                const d = e.key === 'ArrowRight' ? 1 : -1
                trocarAba(ABAS[(n + d + ABAS.length) % ABAS.length].id, true)
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#079C9C]/40 ${
                aba === id
                  ? 'bg-white text-[#079C9C] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
              <span className="hidden text-[10px] font-normal text-slate-400 md:inline">
                {n + 1}
              </span>
            </button>
          ))}
        </div>

        {/* Painel da aba */}
        <div ref={painelRef} role="tabpanel">
          {/* Minha lista */}
          {aba === 'produtos' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => descerFiltro(e, chavesProdutos[0])}
                    placeholder="Filtrar produtos"
                    className={`${inputClass} w-full pl-9`}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disponiveis.length === 0}
                  onClick={alternarTodos}
                  className="shrink-0 gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                >
                  {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
                  <span className="hidden md:inline">
                    <Kbd>Alt A</Kbd>
                  </span>
                </Button>
              </div>

              {disponiveis.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
                  {produtos.length === 0
                    ? 'Sua lista de produtos está vazia.'
                    : 'Nenhum produto encontrado. Itens já comprados ficam de fora.'}
                </p>
              ) : (
                <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {disponiveis.map((p, i) => {
                    const marcado = marcados.has(chaveProduto(p))
                    return (
                      <li key={p.id}>
                        <button
                          ref={reg(`prod:${p.id}`)}
                          type="button"
                          role="checkbox"
                          aria-checked={marcado}
                          onClick={() => alternarProduto(p)}
                          onKeyDown={(e) => navegar(e, chavesProdutos, i)}
                          className={`${linhaClass} ${marcado ? 'bg-[#079C9C]/5' : ''}`}
                        >
                          <span
                            className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                              marcado
                                ? 'border-[#079C9C] bg-[#079C9C] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {marcado && <Check className="size-3" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                            {p.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-500">
                            {numero(p.quantity)}
                            {p.unit ? ` ${p.unit}` : ''}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Catálogo */}
          {aba === 'catalogo' && (
            <div className="space-y-1.5">
              <BuscaCatalogo
                onSelect={adicionarDoCatalogo}
                jaAdicionado={(c) => itens.some((i) => i.catalog_code === c.code)}
              />
              <p className="text-xs text-slate-400">
                Digite, desça com ↓ e aperte Enter. Se o item já estiver na lista, a quantidade
                aumenta em 1.
              </p>
            </div>
          )}

          {/* Cotações */}
          {aba === 'cotacoes' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={buscaCot}
                  onChange={(e) => setBuscaCot(e.target.value)}
                  onKeyDown={(e) => descerFiltro(e, chavesCot[0])}
                  placeholder="Buscar cotação por fornecedor ou item"
                  className={`${inputClass} w-full pl-9`}
                />
              </div>

              {cotacoes === null ? (
                <p className="py-6 text-center text-sm text-slate-400">Carregando cotações...</p>
              ) : cotErro ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
                >
                  {cotErro}
                </p>
              ) : linhasCot.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
                  {cotacoes.length === 0
                    ? 'Nenhuma cotação guardada ainda.'
                    : 'Nenhuma cotação encontrada.'}
                </p>
              ) : (
                <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {linhasCot.map((l, i) => {
                    const c = l.cotacao

                    if (l.item) {
                      const item = l.item
                      const presente = naLista(item)
                      return (
                        <li key={l.key} className="bg-slate-50/60">
                          <button
                            ref={reg(l.key)}
                            type="button"
                            onClick={() => adicionarDaCotacao(c, [item])}
                            onKeyDown={(e) => teclaCot(e, l, i)}
                            className={`${linhaClass} pl-8`}
                          >
                            <span className="w-20 shrink-0 text-xs font-medium tabular-nums text-slate-900">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ''}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                              {item.name}
                            </span>
                            {presente && (
                              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                                <Check className="size-3.5" />
                                Na lista
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    }

                    const aberta = abertasCot.has(c.id)
                    const completa = c.itens.length > 0 && c.itens.every((x) => naLista(x))
                    return (
                      <li key={l.key} className="flex items-stretch">
                        <button
                          ref={reg(l.key)}
                          type="button"
                          aria-expanded={aberta}
                          onClick={() => adicionarDaCotacao(c, c.itens)}
                          onKeyDown={(e) => teclaCot(e, l, i)}
                          className={`${linhaClass} min-w-0 flex-1`}
                        >
                          <span className="min-w-0 flex-1">
                            <span
                              className="block truncate text-sm font-medium text-slate-900"
                              title={c.fornecedor}
                            >
                              {c.fornecedor}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {new Date(c.created_at).toLocaleDateString('pt-BR')} ·{' '}
                              {c.itens.length} {c.itens.length === 1 ? 'item' : 'itens'}
                            </span>
                          </span>
                          {completa && (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                              <Check className="size-3.5" />
                              Na lista
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={aberta ? 'Ocultar itens' : 'Ver itens'}
                          onClick={() => definirAberta(c.id, !aberta)}
                          className="shrink-0 px-3 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                        >
                          <ChevronRight
                            className={`size-4 transition ${aberta ? 'rotate-90' : ''}`}
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              <p className="text-xs text-slate-400">
                Enter adiciona todos os itens da cotação. → mostra os itens para escolher um a um.
              </p>
            </div>
          )}

          {/* Digitar ou colar */}
          {aba === 'digitar' && (
            <div className="space-y-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.altKey && e.key === 'Enter') {
                    e.preventDefault()
                    adicionarDigitados()
                  }
                }}
                className={`${inputClass} min-h-[110px] w-full resize-none`}
                placeholder={'Um item por linha. Ex:\n10 cimento CP-II\n5x tijolo 8 furos\nareia média'}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Dá para colar várias linhas. O que estiver escrito entra junto ao criar.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={linhas.length === 0}
                  onClick={adicionarDigitados}
                  className="shrink-0 gap-1.5 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
                >
                  <Plus className="size-4" />
                  Adicionar {linhas.length > 0 ? linhas.length : ''}{' '}
                  {linhas.length === 1 ? 'item' : 'itens'}
                  <span className="hidden text-[11px] text-white/70 md:inline">Alt Enter</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        <p
          aria-live="polite"
          className={`text-xs font-medium text-emerald-700 ${aviso ? '' : 'hidden'}`}
        >
          {aviso}
        </p>
      </div>

      {/* Lista montada */}
      <div className="min-h-[140px] flex-1 space-y-2 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Na comparação ({itens.length})</span>
          {itens.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setItens([])
                setAviso('')
                focarPainel()
              }}
              className="rounded text-xs font-medium text-slate-500 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
            >
              Limpar tudo
            </button>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 py-6 text-center">
            <ClipboardList className="size-5 text-slate-300" />
            <p className="text-sm text-slate-500">Nenhum item ainda</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {itens.map((item, i) => (
              <li key={item.key} className="flex items-center gap-3 px-3 py-2">
                <input
                  value={item.name}
                  onChange={(e) => atualizar(item.key, { name: e.target.value })}
                  aria-label="Nome do item"
                  className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm text-slate-900 outline-none focus:bg-slate-50 focus:ring-1 focus:ring-[#079C9C]"
                />

                <QtdInput
                  valor={item.quantity}
                  label={`Quantidade de ${item.name}`}
                  onCommit={(n) => atualizar(item.key, { quantity: n })}
                  onKeyDown={(e, vazio) => teclaQtd(e, i, vazio)}
                  refCb={(el) => {
                    if (el) qtdRefs.current.set(item.key, el)
                    else qtdRefs.current.delete(item.key)
                  }}
                />
                <span className="w-8 shrink-0 text-xs text-slate-500">{item.unit ?? ''}</span>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remover ${item.name}`}
                  onClick={() => remover(item.key)}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
        <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 md:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>Alt</Kbd>
            <Kbd>1-4</Kbd> abas
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Alt</Kbd>
            <Kbd>L</Kbd> quantidades
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd> criar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd> fechar
          </span>
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleCriar}
            disabled={saving || total === 0}
            className="min-w-40 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Criando...
              </>
            ) : (
              `Criar com ${total} ${total === 1 ? 'item' : 'itens'}`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NovaComparacaoDialog({ open, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent
        onEscapeKeyDown={(e) => {
          // com texto na busca do catálogo, o Esc só limpa a busca
          const alvo = e.target
          if (
            alvo instanceof HTMLInputElement &&
            alvo.closest('[data-busca-catalogo]') &&
            alvo.value
          ) {
            e.preventDefault()
          }
        }}
        className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[600px]"
      >
        <Conteudo {...resto} />
      </DialogContent>
    </Dialog>
  )
}