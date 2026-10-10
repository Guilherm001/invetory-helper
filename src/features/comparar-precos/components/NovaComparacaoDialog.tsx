'use client'

import { useMemo, useRef, useState } from 'react'
import {
  ClipboardList,
  Library,
  ListChecks,
  Loader2,
  Minus,
  Plus,
  Scale,
  Search,
  Type,
  X,
} from 'lucide-react'
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
import type { NovoItemComparacao } from '../types'

interface Props {
  open: boolean
  produtos: Product[]
  onClose: () => void
  onCriar: (nome: string, itens: NovoItemComparacao[]) => Promise<unknown>
}

type Item = NovoItemComparacao & { key: string }
type Aba = 'produtos' | 'catalogo' | 'digitar'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

const stepperClass =
  'flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#079C9C] hover:text-[#079C9C] active:scale-90'

const ABAS: { id: Aba; label: string; icon: typeof ListChecks }[] = [
  { id: 'produtos', label: 'Minha lista', icon: ListChecks },
  { id: 'catalogo', label: 'Catálogo', icon: Library },
  { id: 'digitar', label: 'Digitar', icon: Type },
]

// "10 cimento" ou "10x cimento" -> quantidade 10
function interpretar(texto: string): { name: string; quantity: number } {
  const t = texto.trim().replace(/^[-•*]\s*/, '')
  const m = t.match(/^(\d+)\s*x\s*(.+)$/i) || t.match(/^(\d+)\s+(.+)$/)
  if (m) {
    const q = Number(m[1])
    if (q >= 1) return { name: m[2].trim(), quantity: q }
  }
  return { name: t, quantity: 1 }
}

const numero = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','))

function Conteudo({ produtos, onClose, onCriar }: Omit<Props, 'open'>) {
  const [nome, setNome] = useState(
    () => `Comparação ${new Date().toLocaleDateString('pt-BR')}`
  )
  const [aba, setAba] = useState<Aba>('produtos')
  const [itens, setItens] = useState<Item[]>([])
  const [busca, setBusca] = useState('')
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const contador = useRef(0)

  // ---------- produtos da lista ----------

  // itens já comprados não entram em uma nova cotação
  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return produtos.filter(
      (p) =>
        p.id &&
        p.status !== 'Concluído' &&
        (termo === '' || p.name.toLowerCase().includes(termo))
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

  // ---------- catálogo ----------

  const adicionarDoCatalogo = (c: { name: string; unit: string | null; code: string }) =>
    setItens((prev) => {
      const key = `c:${c.code}`
      // já está na lista: soma 1 em vez de duplicar
      if (prev.some((i) => i.key === key)) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { key, name: c.name, quantity: 1, unit: c.unit, catalog_code: c.code }]
    })

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

  const handleCriar = async () => {
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
    <>
      <DialogHeader className="bg-[#079C9C] px-6 py-5 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Scale className="size-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-white">Nova comparação</DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              Escolha os itens que vão receber preços
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {/* Nome */}
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={inputClass}
            placeholder="Ex: Material da obra Silva"
          />
        </div>

        {/* Abas */}
        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Como adicionar itens"
            className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
          >
            {ABAS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition ${
                  aba === id
                    ? 'bg-white text-[#079C9C] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Minha lista */}
          {aba === 'produtos' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Filtrar produtos"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disponiveis.length === 0}
                  onClick={alternarTodos}
                  className="shrink-0 border-[#079C9C] text-[#079C9C] hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                >
                  {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              </div>

              {disponiveis.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
                  {produtos.length === 0
                    ? 'Sua lista de produtos está vazia.'
                    : 'Nenhum produto encontrado. Itens já comprados ficam de fora.'}
                </p>
              ) : (
                <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {disponiveis.map((p) => {
                    const marcado = marcados.has(chaveProduto(p))
                    return (
                      <li key={p.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition ${
                            marcado ? 'bg-[#079C9C]/5' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternarProduto(p)}
                            className="size-5 shrink-0 accent-[#079C9C]"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                            {p.name}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {numero(p.quantity)}
                            {p.unit ? ` ${p.unit}` : ''}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Catálogo (altura mínima para a lista de resultados não ser cortada) */}
          {aba === 'catalogo' && (
            <div className="min-h-[300px] space-y-2">
              <BuscaCatalogo onSelect={adicionarDoCatalogo} />
              <p className="text-xs text-slate-400">
                Toque em um resultado para adicionar. Se ele já estiver na lista, a quantidade
                aumenta em 1.
              </p>
            </div>
          )}

          {/* Digitar ou colar */}
          {aba === 'digitar' && (
            <div className="space-y-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className={`${inputClass} min-h-[120px] resize-none`}
                placeholder={'Um item por linha. Ex:\n10 cimento CP-II\n5x tijolo 8 furos\nareia média'}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Dá para colar várias linhas de uma vez.
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
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Lista montada */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              Na comparação ({itens.length})
            </span>
            {itens.length > 0 && (
              <button
                type="button"
                onClick={() => setItens([])}
                className="text-xs font-medium text-slate-500 hover:text-red-600"
              >
                Limpar tudo
              </button>
            )}
          </div>

          {itens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ClipboardList className="size-5" />
              </div>
              <p className="text-sm text-slate-500">Nenhum item ainda</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {itens.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                >
                  <input
                    value={item.name}
                    onChange={(e) => atualizar(item.key, { name: e.target.value })}
                    aria-label="Nome do item"
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 outline-none focus:bg-slate-50 focus:ring-1 focus:ring-[#079C9C]"
                  />

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Diminuir ${item.name}`}
                      onClick={() =>
                        atualizar(item.key, { quantity: Math.max(1, item.quantity - 1) })
                      }
                      className={stepperClass}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="min-w-[2.75rem] text-center text-sm font-semibold text-[#079C9C]">
                      {numero(item.quantity)}
                      {item.unit ? ` ${item.unit}` : ''}
                    </span>
                    <button
                      type="button"
                      aria-label={`Aumentar ${item.name}`}
                      onClick={() => atualizar(item.key, { quantity: item.quantity + 1 })}
                      className={stepperClass}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
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
        </div>

        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
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
          className="min-w-48 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
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
    </>
  )
}

export default function NovaComparacaoDialog({ open, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[560px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <Conteudo {...resto} />
      </DialogContent>
    </Dialog>
  )
}