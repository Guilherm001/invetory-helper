'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  Copy,
  FileDown,
  Loader2,
  Plus,
  Search,
  Send,
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
import { gerarCotacao } from '../services/gerarCotacao'
import type { CotacaoSalva } from '../services/cotacaoService'
import { useCotacoes } from '../hooks/useCotacoes'
import NovaCotacaoDialog from './NovaCotacaoDialog'

// sem acento, minúsculo
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function CotacoesPage() {
  const { cotacoes, loading, error, excluir, recarregar } = useCotacoes()

  const [dialog, setDialog] = useState<{ open: boolean; base: CotacaoSalva | null }>({
    open: false,
    base: null,
  })
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [paraExcluir, setParaExcluir] = useState<CotacaoSalva | null>(null)
  const [gerandoId, setGerandoId] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')
  const [busca, setBusca] = useState('')

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return cotacoes
    return cotacoes.filter(
      (c) =>
        normalizar(c.fornecedor).includes(termo) ||
        c.itens.some((i) => normalizar(i.name).includes(termo))
    )
  }, [cotacoes, busca])

  const alternar = (id: string) =>
    setAbertas((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  // gera o PDF de novo a partir do que ficou guardado (não cria outra entrada no histórico)
  const gerarPdf = async (c: CotacaoSalva) => {
    setErroAcao('')
    setGerandoId(c.id)
    try {
      await gerarCotacao({
        fornecedor: c.fornecedor,
        itens: c.itens.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
      })
    } catch (e) {
      setErroAcao(
        `Não foi possível gerar o PDF: ${e instanceof Error ? e.message : 'erro desconhecido'}`
      )
    } finally {
      setGerandoId(null)
    }
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    setErroAcao('')
    try {
      await excluir(paraExcluir.id)
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="w-full pb-10">
      <div className="mt-7 flex flex-col gap-4 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-3xl font-bold">Cotações</h3>
          <p className="text-sm text-gray-400">
            Tudo que você já enviou para os fornecedores. Monte uma nova buscando no catálogo.
          </p>
        </article>

        <Button
          onClick={() => setDialog({ open: true, base: null })}
          className="gap-2 bg-[#079C9C] px-5 py-5 text-white hover:bg-[#079C9C]/90"
        >
          <Plus className="size-5" />
          Nova cotação
        </Button>
      </div>

      {cotacoes.length > 0 && (
        <div className="relative mb-4 md:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por fornecedor ou item"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
          />
          {busca && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {(error || erroAcao) && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || erroAcao}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando cotações...</p>
      ) : cotacoes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#079C9C]/10 text-[#079C9C]">
            <Send className="size-6" />
          </div>
          <p className="text-base font-semibold text-slate-700">Nenhuma cotação guardada ainda</p>
          <p className="max-w-sm text-sm text-slate-500">
            As cotações que você gerar, aqui ou na lista de produtos, ficam guardadas nesta tela.
          </p>
          <Button
            onClick={() => setDialog({ open: true, base: null })}
            className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            <Plus className="size-4" />
            Nova cotação
          </Button>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          Nenhuma cotação encontrada.
        </p>
      ) : (
        <ul className="space-y-3 xl:max-w-4xl">
          {visiveis.map((c) => {
            const aberta = abertas.has(c.id)
            return (
              <li key={c.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  aria-expanded={aberta}
                  onClick={() => alternar(c.id)}
                  className="flex w-full items-center gap-3 rounded-xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#079C9C]/10 text-[#079C9C]">
                    <Send className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900" title={c.fornecedor}>
                      {c.fornecedor}
                    </p>
                    <p className="text-xs text-slate-400">{dataHora(c.created_at)}</p>
                  </div>

                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {c.itens.length} {c.itens.length === 1 ? 'item' : 'itens'}
                  </span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-slate-300 transition ${aberta ? 'rotate-180' : ''}`}
                  />
                </button>

                {aberta && (
                  <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                    <ul className="divide-y divide-slate-100 text-sm">
                      {c.itens.map((i) => (
                        <li key={i.id} className="flex items-baseline gap-2 py-1.5">
                          <span className="w-20 shrink-0 font-semibold text-[#079C9C]">
                            {i.quantity}
                            {i.unit ? ` ${i.unit}` : ''}
                          </span>
                          <span className="min-w-0 break-words text-slate-700">{i.name}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => gerarPdf(c)}
                        disabled={gerandoId !== null}
                        className="flex items-center gap-1.5 rounded-lg bg-[#079C9C] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95 disabled:opacity-60"
                      >
                        {gerandoId === c.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileDown className="size-4" />
                        )}
                        Gerar PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ open: true, base: c })}
                        className="flex items-center gap-1.5 rounded-lg border border-[#079C9C] px-3 py-2 text-sm font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 active:scale-95"
                      >
                        <Copy className="size-4" />
                        Usar como base
                      </button>
                      <button
                        type="button"
                        onClick={() => setParaExcluir(c)}
                        className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <NovaCotacaoDialog
        open={dialog.open}
        base={dialog.base}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onCriada={recarregar}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
            <AlertDialogDescription>
              A cotação de <strong>{paraExcluir?.fornecedor}</strong> será apagada do histórico.
              Essa ação não poderá ser desfeita.
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
