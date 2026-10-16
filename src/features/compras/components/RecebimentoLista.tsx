'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, PackageCheck, Search, X } from 'lucide-react'
import { dataCurta } from '@/features/loja/lib/formatar'
import { listarPedidosAReceber, type PedidoAReceber } from '../services/comprasService'
import { atrasado, diasDeAtraso, infoStatus, numeroPedido } from '../lib/compras'
import ReceberPedidoDialog from './ReceberPedidoDialog'

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export default function RecebimentoLista({ ehDono }: { ehDono: boolean }) {
  const [lista, setLista] = useState<PedidoAReceber[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<PedidoAReceber | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    listarPedidosAReceber()
      .then((l) => {
        if (cancelado) return
        setLista(l)
        setErro(null)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar os pedidos')
      })
    return () => {
      cancelado = true
    }
  }, [versao])

  const filtrada = useMemo(() => {
    const t = normalizar(busca).replace(/^pc[-\s]*/, '')
    if (!t) return lista ?? []
    return (lista ?? []).filter(
      (p) =>
        normalizar(p.fornecedor_nome).includes(normalizar(busca)) ||
        String(p.numero) === t.replace(/^0+/, '')
    )
  }, [lista, busca])

  return (
    <div className="w-full pb-16">
      <div className="mt-7 py-4">
        <h3 className="text-2xl font-bold md:text-3xl">Recebimento</h3>
        <p className="text-sm text-gray-400">
          Confira a mercadoria que chegou. Aqui só aparecem pedidos já enviados ao fornecedor.
        </p>
      </div>

      {aviso && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
        >
          <p>{aviso}</p>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setAviso(null)}
            className="shrink-0 text-emerald-600 hover:text-emerald-800"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="relative md:max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por fornecedor ou número (PC-12)"
          aria-label="Buscar pedido"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
        />
        {busca && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => setBusca('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {erro && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      )}

      {lista === null && !erro ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Carregando...
        </p>
      ) : filtrada.length === 0 && !erro ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <PackageCheck className="size-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nenhum pedido esperando chegar</p>
          <p className="max-w-xs text-xs text-slate-400">
            Quando um pedido de compra for marcado como enviado, ele aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtrada.map((p) => {
            const info = infoStatus(p)
            const atraso = atrasado(p)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setAberto(p)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-px hover:border-[#079C9C]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#079C9C]">
                          {numeroPedido(p.numero)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${info.classe}`}
                        >
                          {info.texto}
                        </span>
                        {atraso && p.previsao_entrega && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            Atrasado {diasDeAtraso(p.previsao_entrega)}d
                          </span>
                        )}
                      </p>
                      <p className="mt-1 truncate font-semibold text-slate-900">
                        {p.fornecedor_nome}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {p.itens} {p.itens === 1 ? 'item' : 'itens'}
                        {p.previsao_entrega ? ` · previsto para ${dataCurta(p.previsao_entrega)}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-[#079C9C] px-3 py-2 text-sm font-semibold text-white">
                      Receber
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <ReceberPedidoDialog
        pedido={aberto}
        ehDono={ehDono}
        onClose={() => setAberto(null)}
        onRecebido={(a) => {
          setAberto(null)
          setVersao((v) => v + 1)
          setAviso(a)
        }}
      />
    </div>
  )
}