'use client'

import { useEffect, useState } from 'react'
import {
  ClipboardCheck,
  Download,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { dataCurta, reais } from '@/features/loja/lib/formatar'
import {
  listarPedidos,
  obterPedido,
  resumoPedidos,
  type FiltroCompra,
  type PedidoCompra,
  type ResumoCompras,
} from '../services/comprasService'
import { PEDIDO_VAZIO, infoStatus, atrasado, diasDeAtraso, numeroPedido } from '../lib/compras'
import PedidoCompraDialog, { type PedidoInicial } from './PedidoCompraDialog'
import PedidoCompraDetalhe from './PedidoCompraDetalhe'
import ImportarComparacaoDialog from './ImportarComparacaoDialog'

interface Resultado {
  chave: string
  itens: PedidoCompra[]
  total: number
  paginas: number
}

const FILTROS: [FiltroCompra, string][] = [
  ['todos', 'Todos'],
  ['rascunho', 'Rascunhos'],
  ['andamento', 'Em andamento'],
  ['atrasado', 'Atrasados'],
  ['recebido', 'Recebidos'],
  ['cancelado', 'Cancelados'],
]

const COLUNAS = 'lg:grid-cols-[5.5rem_5.5rem_9rem_minmax(0,1fr)_7.5rem]'

export default function PedidosCompraLista({
  abrirId,
  filtroInicial,
}: {
  abrirId: string | null
  filtroInicial?: FiltroCompra
}) {
  const [termo, setTermo] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroCompra>(filtroInicial ?? 'todos')
  const [versao, setVersao] = useState(0)
  const [res, setRes] = useState<Resultado | null>(null)
  const [resumo, setResumo] = useState<ResumoCompras | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)

  const [detalhe, setDetalhe] = useState<PedidoCompra | null>(null)
  const [formulario, setFormulario] = useState<{ chave: number; inicial: PedidoInicial } | null>(null)
  const [importando, setImportando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const chave = `${filtro}|${termoBusca}|${versao}`

  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo), 300)
    return () => clearTimeout(t)
  }, [termo])

  useEffect(() => {
    let cancelado = false
    listarPedidos({ filtro, termo: termoBusca, pagina: 0 })
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
  }, [chave, filtro, termoBusca])

  useEffect(() => {
    let cancelado = false
    resumoPedidos()
      .then((r) => {
        if (!cancelado) setResumo(r)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [versao])

  // veio de um link (por exemplo, do Comparar preços): abre o pedido
  useEffect(() => {
    if (!abrirId) return
    let cancelado = false
    obterPedido(abrirId)
      .then((r) => {
        if (!cancelado && r) setDetalhe(r.pedido)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [abrirId])

  const carregarMais = async () => {
    if (!res || res.chave !== chave || carregandoMais) return
    setCarregandoMais(true)
    try {
      const r = await listarPedidos({ filtro, termo: termoBusca, pagina: res.paginas })
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
      setErro(e instanceof Error ? e.message : 'Erro ao carregar mais pedidos')
    } finally {
      setCarregandoMais(false)
    }
  }

  const abrirFormulario = (inicial: PedidoInicial) =>
    setFormulario({ chave: Date.now(), inicial })

  const abrirPedidoPorId = async (id: string) => {
    try {
      const r = await obterPedido(id)
      if (r) setDetalhe(r.pedido)
    } catch {
      // a lista já mostra o pedido; o detalhe abre ao clicar
    }
  }

  const carregando = res === null && erro === null
  const atualizando = res !== null && res.chave !== chave
  const itens = res?.itens ?? []
  const temMais = res !== null && res.itens.length < res.total

  const cartoes: { filtro: FiltroCompra; titulo: string; n: number; total: number; cor: string }[] = [
    {
      filtro: 'rascunho',
      titulo: 'Rascunhos',
      n: resumo?.rascunhos.n ?? 0,
      total: resumo?.rascunhos.total ?? 0,
      cor: 'text-slate-700',
    },
    {
      filtro: 'andamento',
      titulo: 'Em andamento',
      n: resumo?.andamento.n ?? 0,
      total: resumo?.andamento.total ?? 0,
      cor: 'text-sky-700',
    },
    {
      filtro: 'atrasado',
      titulo: 'Atrasados',
      n: resumo?.atrasados.n ?? 0,
      total: resumo?.atrasados.total ?? 0,
      cor: 'text-amber-700',
    },
  ]

  return (
    <div className="w-full pb-16">
      <div className="mt-7 flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-2xl font-bold md:text-3xl">Pedidos de compra</h3>
          <p className="text-sm text-gray-400">
            Compras feitas aos fornecedores, do rascunho até a entrega.
          </p>
        </article>

        <div className="grid grid-cols-2 gap-2 md:flex">
          <button
            type="button"
            onClick={() => setImportando(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#079C9C] bg-white px-4 py-3 text-sm font-semibold text-[#079C9C] shadow-sm transition hover:bg-[#079C9C]/10 active:scale-95"
          >
            <Download className="size-5" />
            Importar
          </button>
          <button
            type="button"
            onClick={() => abrirFormulario(PEDIDO_VAZIO)}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#079C9C] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95"
          >
            <Plus className="size-5" />
            Novo pedido
          </button>
        </div>
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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {cartoes.map((c) => (
          <button
            key={c.filtro}
            type="button"
            onClick={() => setFiltro(filtro === c.filtro ? 'todos' : c.filtro)}
            aria-pressed={filtro === c.filtro}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              filtro === c.filtro
                ? 'border-[#079C9C] bg-[#079C9C]/5 ring-1 ring-[#079C9C]/30'
                : 'border-slate-200 bg-white hover:border-[#079C9C]/40'
            }`}
          >
            <p className="text-sm text-slate-500">{c.titulo}</p>
            <p className={`mt-1 text-3xl font-bold ${c.cor}`}>{c.n}</p>
            <p className="text-xs text-slate-400">{reais(c.total)}</p>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="relative md:max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por fornecedor ou número (PC-12)"
            aria-label="Buscar pedido de compra"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
          />
          {termo && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setTermo('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Filtrar" className="flex flex-wrap gap-2">
            {FILTROS.map(([valor, rotulo]) => {
              const ativo = filtro === valor
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setFiltro(valor)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    ativo
                      ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {rotulo}
                </button>
              )
            })}
          </div>

          <p className="flex items-center gap-2 text-sm text-slate-500">
            {atualizando && <Loader2 className="size-4 animate-spin" />}
            {res && `${res.total} ${res.total === 1 ? 'pedido' : 'pedidos'}`}
          </p>
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 && !erro ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <ClipboardCheck className="size-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nenhum pedido encontrado</p>
          <p className="max-w-xs text-xs text-slate-400">
            Crie um pedido novo ou importe os pedidos de uma comparação de preços.
          </p>
        </div>
            ) : (
        <div className={`mt-4 ${atualizando ? 'opacity-60' : ''}`}>
          {/* cabeçalho das colunas (só no PC) */}
          <div
            className={`mb-1 hidden gap-x-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:grid ${COLUNAS}`}
          >
            <span>Pedido</span>
            <span>Data</span>
            <span>Status</span>
            <span>Fornecedor</span>
            <span className="text-right">Valor</span>
          </div>

          <ul className="space-y-2">
            {itens.map((p) => {
              const info = infoStatus(p)
              const atraso = atrasado(p)
              const detalhes = [
                p.previsao_entrega ? `Entrega ${dataCurta(p.previsao_entrega)}` : '',
                p.condicao_pagamento ?? '',
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setDetalhe(p)}
                    title={detalhes || undefined}
                    className={`grid w-full grid-cols-2 items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-px hover:border-[#079C9C]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C] ${COLUNAS}`}
                  >
                    {/* pedido */}
                    <span className="order-1 text-sm font-bold text-[#079C9C] lg:order-none">
                      {numeroPedido(p.numero)}
                    </span>

                    {/* data */}
                    <span className="order-4 text-xs text-slate-500 lg:order-none lg:text-sm">
                      {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                    </span>

                    {/* status */}
                    <span className="order-5 flex flex-wrap items-center justify-end gap-1 lg:order-none lg:justify-start">
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
                    </span>

                    {/* fornecedor */}
                    <span className="order-3 col-span-2 truncate font-semibold text-slate-900 lg:order-none lg:col-span-1">
                      {p.fornecedor_nome}
                    </span>

                    {/* valor */}
                    <span className="order-2 justify-self-end text-base font-bold tabular-nums text-slate-900 lg:order-none lg:justify-self-auto lg:text-right">
                      {reais(p.total)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      
      {temMais && (
        <div className="mt-4 flex justify-center">
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

      <PedidoCompraDetalhe
        pedido={detalhe}
        onClose={() => setDetalhe(null)}
        onMudou={(a) => {
          setDetalhe(null)
          setVersao((v) => v + 1)
          if (a) setAviso(a)
        }}
        onEditar={(inicial) => {
          setDetalhe(null)
          abrirFormulario(inicial)
        }}
        onDuplicar={(inicial) => {
          setDetalhe(null)
          abrirFormulario(inicial)
        }}
      />

      <PedidoCompraDialog
        key={formulario?.chave ?? 0}
        open={formulario !== null}
        inicial={formulario?.inicial ?? PEDIDO_VAZIO}
        onClose={() => setFormulario(null)}
        onSalvo={(id, numero) => {
          setFormulario(null)
          setVersao((v) => v + 1)
          setAviso(`Pedido ${numeroPedido(numero)} salvo.`)
          abrirPedidoPorId(id)
        }}
      />

      <ImportarComparacaoDialog
        open={importando}
        onClose={() => setImportando(false)}
        onCriados={(criados) => {
          setImportando(false)
          setVersao((v) => v + 1)
          setAviso(
            `${criados.length} ${criados.length === 1 ? 'pedido criado' : 'pedidos criados'} como rascunho: ${criados
              .map((c) => numeroPedido(c.numero))
              .join(', ')}.`
          )
        }}
      />
    </div>
  )
}