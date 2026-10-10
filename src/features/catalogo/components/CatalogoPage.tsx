'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Library,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
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
import { useCatalogo } from '../hooks/useCatalogSearch'
import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItems,
  registrarEntrada,
  lastImportDate,
  type CatalogItem,
  type NovoCatalogItem,
} from '../services/catalogService'
import CatalogItemDialog from './CatalogItemDialog'
import EntradaDialog from './EntradaDialog'
import ImportarCatalogo from './importarCatalogo'

const COLUNAS = 'md:grid-cols-[2.5rem_6rem_minmax(0,1fr)_4rem_7rem_6.5rem_8.5rem]'

const GRID = `md:grid ${COLUNAS} md:items-center md:gap-4`

const thClass = 'text-xs font-semibold uppercase tracking-wide text-slate-400'

const preco = (p: number | null) =>
  p == null ? '—' : `R$ ${p.toFixed(2).replace('.', ',')}`

const numero = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')

function Estoque({ valor }: { valor: number | null }) {
  const vazio = valor == null || valor <= 0
  return (
    <span
      className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-semibold ${
        vazio ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {valor == null ? '—' : numero(valor)}
    </span>
  )
}

export default function CatalogoPage() {
  const c = useCatalogo()

  const [dialogItem, setDialogItem] = useState<{ open: boolean; item: CatalogItem | null }>({
    open: false,
    item: null,
  })
  const [entradaItem, setEntradaItem] = useState<CatalogItem | null>(null)
  const [paraExcluir, setParaExcluir] = useState<CatalogItem[] | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [erroAcao, setErroAcao] = useState('')

  // data da última atualização do catálogo
  const [ultimaImportacao, setUltimaImportacao] = useState<string | null>(null)

  const carregarImportacao = useCallback(() => {
    lastImportDate().then(setUltimaImportacao)
  }, [])

  useEffect(() => {
    carregarImportacao()
  }, [carregarImportacao])

  // só conta o que ainda está na página atual
  // (ids de outras páginas ou itens apagados são ignorados, sem precisar de effect)
  const selecionadosVisiveis = c.items.filter((i) => selecionados.has(i.id))
  const qtdSelecionados = selecionadosVisiveis.length
  const todosMarcados = c.items.length > 0 && qtdSelecionados === c.items.length

  const alternar = (id: string) =>
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  const salvarItem = async (data: NovoCatalogItem) => {
    if (dialogItem.item) await updateCatalogItem(dialogItem.item.id, data)
    else await createCatalogItem(data)
    await c.recarregar()
    carregarImportacao()
  }

  const confirmarEntrada = async (id: string, quantidade: number, nota: string) => {
    await registrarEntrada(id, quantidade, nota)
    await c.recarregar()
    carregarImportacao()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    setErroAcao('')
    try {
      await deleteCatalogItems(paraExcluir.map((i) => i.id))
      setSelecionados(new Set())
      await c.recarregar()
      carregarImportacao()
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="w-full pb-28">
      {/* Título e ações */}
      <div className="mt-7 flex flex-col gap-4 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-3xl font-bold">Catálogo</h3>
          <p className="text-sm text-gray-400">
            Gerencie os produtos, preços e o estoque de cada item. Reimportar a planilha
            atualiza os itens existentes e adiciona os novos.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Última atualização do catálogo:{' '}
            {ultimaImportacao
              ? new Date(ultimaImportacao).toLocaleString('pt-BR')
              : 'nenhuma ainda'}
          </p>
        </article>

        <div className="flex flex-wrap items-center gap-3">
          <ImportarCatalogo
            onDone={() => {
              c.recarregar()
              carregarImportacao()
            }}
          />
          <Button
            onClick={() => setDialogItem({ open: true, item: null })}
            className="gap-2 bg-[#079C9C] px-5 py-5 text-white hover:bg-[#079C9C]/90"
          >
            <Plus className="size-5" />
            Novo item
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:max-w-xl">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Library className="size-4 text-[#079C9C]" />
            Itens no catálogo
          </div>
          <p className="mt-1 text-3xl font-bold text-slate-900">{c.stats.total}</p>
        </div>

        <button
          type="button"
          onClick={c.alternarSemEstoque}
          aria-pressed={c.semEstoque}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            c.semEstoque
              ? 'border-red-300 bg-red-50 ring-1 ring-red-200'
              : 'border-slate-200 bg-white hover:border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <AlertTriangle className="size-4 text-red-500" />
            Sem estoque
          </div>
          <p className="mt-1 text-3xl font-bold text-red-600">{c.stats.semEstoque}</p>
        </button>
      </div>

      {/* Busca */}
      <div className="relative mb-4 md:max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={c.termo}
          onChange={(e) => c.setTermo(e.target.value)}
          placeholder="Buscar por descrição, código ou código de barras"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
        />
        {c.termo && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => c.setTermo('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {(c.error || erroAcao) && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {c.error || erroAcao}
        </p>
      )}

      {/* Cabeçalho da lista (desktop) */}
      <div className={`hidden px-5 pb-3 md:grid ${COLUNAS} md:items-center md:gap-4`}>
        <button
          type="button"
          role="checkbox"
          aria-checked={todosMarcados}
          aria-label="Selecionar todos desta página"
          onClick={() =>
            setSelecionados(todosMarcados ? new Set() : new Set(c.items.map((i) => i.id)))
          }
          className={`flex size-6 items-center justify-center rounded-full border-2 transition ${
            todosMarcados
              ? 'border-[#079C9C] bg-[#079C9C] text-white'
              : 'border-slate-300 bg-white text-transparent hover:border-[#079C9C]'
          }`}
        >
          <Check className="size-4" strokeWidth={3} />
        </button>
        <span className={thClass}>Código</span>
        <span className={thClass}>Descrição</span>
        <span className={thClass}>Un</span>
        <span className={thClass}>Preço</span>
        <span className={thClass}>Estoque</span>
        <span className={`${thClass} text-right`}>Ação</span>
      </div>

      {/* Linhas */}
      <div className="space-y-2">
        {c.loading && c.items.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Carregando catálogo...</p>
        )}

        {!c.loading && c.items.length === 0 && !c.error && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center">
            <Library className="size-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Nenhum item encontrado</p>
            <p className="text-xs text-slate-400">
              Crie um item novo ou importe uma planilha.
            </p>
          </div>
        )}

        {c.items.map((item) => {
          const marcado = selecionados.has(item.id)
          return (
            <div
              key={item.id}
              className={`${GRID} rounded-xl border px-4 py-3 shadow-sm transition ${
                marcado
                  ? 'border-[#079C9C] bg-[#079C9C]/5 ring-1 ring-[#079C9C]/30'
                  : 'border-slate-200 bg-white hover:shadow-md'
              } ${c.loading ? 'opacity-60' : ''}`}
            >
              <div className="mb-2 flex items-start gap-3 md:contents">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  aria-label={`Selecionar ${item.name}`}
                  onClick={() => alternar(item.id)}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition md:size-6 ${
                    marcado
                      ? 'border-[#079C9C] bg-[#079C9C] text-white'
                      : 'border-slate-300 bg-white text-transparent hover:border-[#079C9C]'
                  }`}
                >
                  <Check className="size-4" strokeWidth={3} />
                </button>

                {/* código: só no desktop */}
                <span className="hidden truncate text-sm text-slate-500 md:block">
                  {item.code}
                </span>

                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="font-semibold text-slate-900 md:truncate">{item.name}</p>
                  {/* resumo: só no celular */}
                  <p className="mt-0.5 text-xs text-slate-500 md:hidden">
                    Cód. {item.code}
                    {item.unit ? ` · ${item.unit}` : ''} · {preco(item.price)}
                  </p>
                  {item.barcode && (
                    <p className="hidden truncate text-xs text-slate-400 md:block">
                      {item.barcode}
                    </p>
                  )}
                </div>

                <span className="hidden text-sm text-slate-600 md:block">
                  {item.unit ?? '—'}
                </span>
                <span className="hidden text-sm font-medium text-slate-700 md:block">
                  {preco(item.price)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 md:contents">
                <div className="md:block">
                  <Estoque valor={item.stock} />
                </div>

                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    aria-label={`Dar entrada em ${item.name}`}
                    title="Dar entrada"
                    onClick={() => setEntradaItem(item)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <ArrowDownToLine className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Editar ${item.name}`}
                    title="Editar"
                    onClick={() => setDialogItem({ open: true, item })}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                  >
                    <Pencil className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir ${item.name}`}
                    title="Excluir"
                    onClick={() => setParaExcluir([item])}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Paginação */}
      {c.total > 0 && (
        <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
          <span>
            {c.total} {c.total === 1 ? 'item' : 'itens'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={c.page === 0 || c.loading}
              onClick={() => c.setPage(c.page - 1)}
              className="gap-1"
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span>
              Página {c.page + 1} de {c.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={c.page + 1 >= c.totalPages || c.loading}
              onClick={() => c.setPage(c.page + 1)}
              className="gap-1"
            >
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Barra de seleção */}
      {qtdSelecionados > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between border-t bg-white p-3 shadow-lg md:bottom-0 md:px-10">
          <span className="text-sm text-gray-700">{qtdSelecionados} selecionado(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelecionados(new Set())}>
              Limpar
            </Button>
            <Button
              onClick={() => setParaExcluir(selecionadosVisiveis)}
              className="gap-2 bg-red-600 text-white hover:bg-red-700"
            >
              <Trash2 className="size-4" />
              Excluir
            </Button>
          </div>
        </div>
      )}

      {/* Modais */}
      <CatalogItemDialog
        open={dialogItem.open}
        item={dialogItem.item}
        onClose={() => setDialogItem((d) => ({ ...d, open: false }))}
        onSave={salvarItem}
      />

      <EntradaDialog
        item={entradaItem}
        onClose={() => setEntradaItem(null)}
        onConfirm={confirmarEntrada}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paraExcluir && paraExcluir.length > 1
                ? `Excluir ${paraExcluir.length} itens?`
                : 'Excluir item?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paraExcluir && paraExcluir.length === 1 ? (
                <>
                  Tem certeza que deseja excluir <strong>{paraExcluir[0].name}</strong> do
                  catálogo? O histórico de entradas dele também será apagado. Essa ação não
                  poderá ser desfeita.
                </>
              ) : (
                <>
                  Os itens selecionados e o histórico de entradas deles serão apagados do
                  catálogo. Essa ação não poderá ser desfeita.
                </>
              )}
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