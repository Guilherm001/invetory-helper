'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, FileText, Loader2 } from 'lucide-react'
import {
  pedidosDoCliente,
  type PedidoCliente,
} from '../services/fichaService'
import { dataHora, reais, statusPedido } from '../lib/formatar'
import PedidoClienteDialog from './PedidoClienteDialog'

type Filtro = 'todos' | 'pedido' | 'orcamento'

interface Resultado {
  chave: string
  itens: PedidoCliente[]
  total: number
  paginas: number
}

const FILTROS: [Filtro, string][] = [
  ['pedido', 'Pedidos'],
  ['orcamento', 'Orçamentos'],
  ['todos', 'Todos'],
]

export default function TabPedidos({ clienteId }: { clienteId: string }) {
  const [filtro, setFiltro] = useState<Filtro>('pedido')
  const [res, setRes] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)

  const chave = `${clienteId}|${filtro}`

  useEffect(() => {
    let cancelado = false
    pedidosDoCliente(clienteId, filtro, 0)
      .then((r) => {
        if (cancelado) return
        setRes({ chave, itens: r.itens, total: r.total, paginas: 1 })
        setErro(null)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar os pedidos')
      })
    return () => {
      cancelado = true
    }
  }, [chave, clienteId, filtro])

  const carregarMais = async () => {
    if (!res || res.chave !== chave || carregandoMais) return
    setCarregandoMais(true)
    try {
      const r = await pedidosDoCliente(clienteId, filtro, res.paginas)
      setRes((atual) =>
        atual && atual.chave === chave
          ? {
              ...atual,
              itens: [...atual.itens, ...r.itens],
              total: r.itens.length > 0 ? r.total : atual.itens.length,
              paginas: atual.paginas + 1,
            }
          : atual
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar mais')
    } finally {
      setCarregandoMais(false)
    }
  }

  const carregando = res === null && erro === null
  const atualizando = res !== null && res.chave !== chave
  const itens = res?.itens ?? []
  const temMais = res !== null && res.itens.length < res.total

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Filtrar" className="flex flex-wrap gap-2">
          {FILTROS.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={filtro === valor}
              onClick={() => setFiltro(valor)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                filtro === valor
                  ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <p className="flex items-center gap-2 text-sm text-slate-500">
          {atualizando && <Loader2 className="size-4 animate-spin" />}
          {res && `${res.total} ${res.total === 1 ? 'resultado' : 'resultados'}`}
        </p>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
      )}

      {carregando ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 && !erro ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-center">
          <ClipboardList className="size-8 text-slate-300" />
          <p className="text-sm text-slate-500">Nenhum registro para este cliente.</p>
          <p className="max-w-xs text-xs text-slate-400">
            Só aparecem os pedidos feitos depois que o cliente foi vinculado ao pedido.
          </p>
        </div>
      ) : (
        <ul className={`space-y-2 ${atualizando ? 'opacity-60' : ''}`}>
          {itens.map((p) => {
            const st = statusPedido(p)
            const orc = p.documento === 'orcamento'
            const valor = p.total_liquido ?? p.total - p.desconto
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setAberto(p.id)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-px hover:border-[#079C9C]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-sm font-bold text-[#079C9C]">
                          {orc ? <FileText className="size-4" /> : <ClipboardList className="size-4" />}
                          {orc ? 'Orçamento' : 'Pedido'} nº {p.numero}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.classe}`}>
                          {st.texto}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {dataHora(p.criado_em)} · {p.tipo === 'entrega' ? 'Entrega' : 'Retirada'}
                        {p.vendedor_nome ? ` · ${p.vendedor_nome}` : ''}
                      </p>
                      {p.pagamento && p.status === 'entregue' && (
                        <p className="text-xs text-slate-500">Pago em {p.pagamento}</p>
                      )}
                    </div>
                    <p className="shrink-0 text-lg font-bold text-slate-900">{reais(valor)}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {temMais && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={carregarMais}
            disabled={carregandoMais}
            className="flex items-center gap-2 rounded-lg border border-[#079C9C] px-5 py-2.5 text-sm font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 disabled:opacity-60"
          >
            {carregandoMais && <Loader2 className="size-4 animate-spin" />}
            Ver mais
          </button>
        </div>
      )}

      <PedidoClienteDialog vendaId={aberto} onClose={() => setAberto(null)} />
    </div>
  )
}