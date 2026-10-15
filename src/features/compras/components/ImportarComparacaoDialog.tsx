'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, Loader2, Scale, Search } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import {
  getComparacao,
  listComparacoes,
} from '@/features/comparar-precos/services/comparacaoService'
import type { ComparacaoResumo } from '@/features/comparar-precos/types'
import { analisar, type Analise } from '@/features/comparar-precos/utils/melhorPreco'
import { reais } from '@/features/loja/lib/formatar'
import {
  criarPedidos,
  pedidoDeSugestao,
  pedidosDaComparacao,
  type PedidoDaComparacao,
} from '@/features/compras/services/comprasService'
import { numeroPedido } from '../lib/compras'

interface Revisao {
  id: string
  nome: string
  analise: Analise
  existentes: Map<string, PedidoDaComparacao>
}

function Conteudo({
  onClose,
  onCriados,
}: {
  onClose: () => void
  onCriados: (pedidos: { id: string; numero: number }[]) => void
}) {
  const [comparacoes, setComparacoes] = useState<ComparacaoResumo[] | null>(null)
  const [busca, setBusca] = useState('')
  const [revisao, setRevisao] = useState<Revisao | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    listComparacoes()
      .then(setComparacoes)
      .catch((e) => {
        setComparacoes([])
        setErro(e instanceof Error ? e.message : 'Erro ao carregar as comparações')
      })
  }, [])

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return (comparacoes ?? []).filter((c) => !t || c.name.toLowerCase().includes(t))
  }, [comparacoes, busca])

  const abrir = async (c: ComparacaoResumo) => {
    setCarregando(true)
    setErro('')
    try {
      const [completa, existentes] = await Promise.all([
        getComparacao(c.id),
        pedidosDaComparacao(c.id).catch(() => [] as PedidoDaComparacao[]),
      ])
      const analise = analisar(completa.itens, completa.fornecedores, completa.precos)
      const mapa = new Map(
        existentes
          .filter((p) => p.fornecedor_ref)
          .map((p) => [p.fornecedor_ref as string, p] as const)
      )

      setRevisao({ id: c.id, nome: c.name, analise, existentes: mapa })
      setSelecionados(
        new Set(analise.pedidos.filter((p) => !mapa.has(p.fornecedor.id)).map((p) => p.fornecedor.id))
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao abrir a comparação')
    } finally {
      setCarregando(false)
    }
  }

  const alternar = (id: string) =>
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  const criar = async () => {
    if (!revisao || criando) return
    const escolhidos = revisao.analise.pedidos.filter((p) => selecionados.has(p.fornecedor.id))
    if (escolhidos.length === 0) return

    setCriando(true)
    setErro('')
    try {
      const criados = await criarPedidos(
        escolhidos.map((p) => pedidoDeSugestao(p, { id: revisao.id, nome: revisao.nome }))
      )
      onCriados(criados)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar os pedidos')
      setCriando(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Scale className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              Importar do Comparar preços
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {revisao ? revisao.nome : 'Escolha uma comparação'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {!revisao ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar comparação"
                aria-label="Buscar comparação"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
              />
            </div>

            {comparacoes === null || carregando ? (
              <p className="flex items-center gap-2 py-6 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                Carregando...
              </p>
            ) : filtradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Nenhuma comparação encontrada.
              </p>
            ) : (
              <ul className="space-y-2">
                {filtradas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => abrir(c)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-[#079C9C]/40 hover:shadow-md"
                    >
                      <p className="truncate font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(c.created_at).toLocaleDateString('pt-BR')} · {c.itens_count}{' '}
                        {c.itens_count === 1 ? 'item' : 'itens'} · {c.fornecedores_count}{' '}
                        {c.fornecedores_count === 1 ? 'fornecedor' : 'fornecedores'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setRevisao(null)
                setErro('')
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#079C9C]"
            >
              <ArrowLeft className="size-4" />
              Escolher outra comparação
            </button>

            {revisao.analise.pedidos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                Esta comparação ainda não tem preços preenchidos.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  Cada item vai para o fornecedor de menor preço. Marque os pedidos que quer criar
                  (ficam como rascunho).
                </p>

                <ul className="space-y-2">
                  {revisao.analise.pedidos.map((p) => {
                    const existente = revisao.existentes.get(p.fornecedor.id)
                    const marcado = selecionados.has(p.fornecedor.id)
                    return (
                      <li key={p.fornecedor.id}>
                        <label
                          className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                            existente
                              ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                              : marcado
                                ? 'cursor-pointer border-[#079C9C] bg-[#079C9C]/5'
                                : 'cursor-pointer border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            disabled={!!existente}
                            onChange={() => alternar(p.fornecedor.id)}
                            className="size-5 shrink-0 accent-[#079C9C]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-slate-900">
                              {p.fornecedor.name}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}
                            </span>
                            {existente && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <Check className="size-3" />
                                Já virou o pedido {numeroPedido(existente.numero)}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-base font-bold text-slate-900">
                            {reais(p.subtotal)}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>

                {revisao.analise.itensSemPreco > 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {revisao.analise.itensSemPreco}{' '}
                    {revisao.analise.itensSemPreco === 1 ? 'item sem preço fica' : 'itens sem preço ficam'}{' '}
                    de fora dos pedidos.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50">
        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-3 px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={criando}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </Button>
          {revisao && (
            <Button
              type="button"
              onClick={criar}
              disabled={criando || selecionados.size === 0}
              className="min-w-44 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
            >
              {criando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Criando...
                </>
              ) : (
                `Criar ${selecionados.size} ${selecionados.size === 1 ? 'pedido' : 'pedidos'}`
              )}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

export default function ImportarComparacaoDialog({
  open,
  onClose,
  onCriados,
}: {
  open: boolean
  onClose: () => void
  onCriados: (pedidos: { id: string; numero: number }[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5%] flex max-h-[90dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[560px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {open && <Conteudo onClose={onClose} onCriados={onCriados} />}
      </DialogContent>
    </Dialog>
  )
}