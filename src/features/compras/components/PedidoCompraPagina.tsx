'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardCopy,
  Copy,
  FileDown,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { dataCurta, dataHora, hoje, numeroTexto, reais } from '@/features/loja/lib/formatar'
import {
  alterarStatus,
  excluirPedido,
  listarRecebimentos,
  nomeDaEmpresa,
  obterPedido,
  type ItemPedidoCompra,
  type PedidoCompra,
  type Recebimento,
  type StatusCompra,
} from '../services/comprasService'
import {
  PEDIDO_VAZIO,
  atrasado,
  dadosDoPedido,
  diasDeAtraso,
  infoStatus,
  itemParaEntrada,
  numeroPedido,
  somarDias,
  textoWhatsApp,
} from '../lib/compras'
import { gerarPdfCompra, precarregarPdfCompra } from '../utils/gerarPdfCompra'
import PedidoCompraDialog, { type PedidoInicial } from './PedidoCompraDialog'
import ReceberPedidoDialog from './ReceberPedidoDialog'
import NotasDoPedido from './NotasDoPedido'

const reais4 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

interface Acao {
  status: StatusCompra
  rotulo: string
  tipo: 'principal' | 'normal' | 'perigo'
  confirmar?: string
  aviso: string
}

// "recebido" não está aqui: ele só vem da conferência (botão Receber mercadoria)
const ACOES: Record<StatusCompra, Acao[]> = {
  rascunho: [
    { status: 'enviado', rotulo: 'Marcar como enviado', tipo: 'principal', aviso: 'marcado como enviado' },
    { status: 'cancelado', rotulo: 'Cancelar pedido', tipo: 'perigo', confirmar: 'Cancelar este pedido?', aviso: 'cancelado' },
  ],
  enviado: [
    { status: 'confirmado', rotulo: 'Fornecedor confirmou', tipo: 'normal', aviso: 'confirmado pelo fornecedor' },
    { status: 'rascunho', rotulo: 'Voltar para rascunho', tipo: 'normal', aviso: 'voltou para rascunho' },
    { status: 'cancelado', rotulo: 'Cancelar pedido', tipo: 'perigo', confirmar: 'Cancelar este pedido?', aviso: 'cancelado' },
  ],
  confirmado: [
    { status: 'enviado', rotulo: 'Voltar para enviado', tipo: 'normal', aviso: 'voltou para enviado' },
    { status: 'cancelado', rotulo: 'Cancelar pedido', tipo: 'perigo', confirmar: 'Cancelar este pedido?', aviso: 'cancelado' },
  ],
  recebido: [
    { status: 'confirmado', rotulo: 'Reabrir pedido', tipo: 'normal', confirmar: 'Reabrir este pedido para receber o que faltou?', aviso: 'reaberto' },
  ],
  cancelado: [
    { status: 'rascunho', rotulo: 'Reabrir como rascunho', tipo: 'normal', aviso: 'reaberto como rascunho' },
  ],
}

// ---------- peças ----------

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-500">{rotulo}</span>
      <span className="text-right font-medium text-slate-800">{valor}</span>
    </div>
  )
}

function Cartao({
  titulo,
  children,
  className = '',
}: {
  titulo?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {titulo && (
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</h4>
      )}
      {children}
    </section>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-sans text-[10px] font-semibold text-slate-500">
      {children}
    </kbd>
  )
}

const ETAPAS: { status: StatusCompra; rotulo: string }[] = [
  { status: 'rascunho', rotulo: 'Rascunho' },
  { status: 'enviado', rotulo: 'Enviado' },
  { status: 'confirmado', rotulo: 'Confirmado' },
  { status: 'recebido', rotulo: 'Recebido' },
]

// linha do tempo: onde o pedido está e quando passou por cada etapa
function Etapas({ pedido }: { pedido: PedidoCompra }) {
  if (pedido.status === 'cancelado') {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
        <X className="size-4" />
        Pedido cancelado{pedido.cancelado_em ? ` em ${dataHora(pedido.cancelado_em)}` : ''}
      </p>
    )
  }

  const datas: Partial<Record<StatusCompra, string | null>> = {
    rascunho: pedido.criado_em,
    enviado: pedido.enviado_em,
    confirmado: pedido.confirmado_em,
    recebido: pedido.recebido_em,
  }
  const atual = ETAPAS.findIndex((e) => e.status === pedido.status)

  return (
    <ol className="flex">
      {ETAPAS.map((e, i) => {
        const feita = i < atual || (pedido.status === 'recebido' && i === atual)
        const agora = i === atual && pedido.status !== 'recebido'
        const data = datas[e.status]

        return (
          <li key={e.status} className="relative flex flex-1 flex-col items-center text-center">
            {i < ETAPAS.length - 1 && (
              <span
                className={`absolute left-1/2 top-3 h-0.5 w-full ${i < atual ? 'bg-[#079C9C]' : 'bg-slate-200'}`}
              />
            )}
            <span
              className={`relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                feita
                  ? 'border-[#079C9C] bg-[#079C9C] text-white'
                  : agora
                    ? 'border-[#079C9C] bg-white text-[#079C9C]'
                    : 'border-slate-200 bg-white text-slate-300'
              }`}
            >
              {feita ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={`mt-1 text-xs font-semibold ${
                feita || agora ? 'text-slate-800' : 'text-slate-400'
              }`}
            >
              {e.rotulo}
              {agora && pedido.recebido_parcial ? ' (parcial)' : ''}
            </span>
            <span className="text-[11px] text-slate-400">
              {data ? new Date(data).toLocaleDateString('pt-BR') : '—'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ---------- menu "Mais ações" (abre e navega por teclado) ----------

interface ItemMenu {
  chave: string
  rotulo: string
  icone: LucideIcon
  onClick: () => void
  atalho?: string
  perigo?: boolean
  desabilitado?: boolean
  separador?: boolean // linha antes deste item
}

function MenuAcoes({ itens, ocupado }: { itens: ItemMenu[]; ocupado: boolean }) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  useEffect(() => {
    if (aberto) raiz.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [aberto])

  const fechar = () => {
    setAberto(false)
    botao.current?.focus()
  }

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      fechar()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const lista = Array.from(
      raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []
    )
    const i = lista.indexOf(document.activeElement as HTMLElement)
    const prox = e.key === 'ArrowDown' ? (i + 1) % lista.length : (i - 1 + lista.length) % lista.length
    lista[prox]?.focus()
  }

  return (
    <div ref={raiz} className="relative" onKeyDown={teclas}>
      <Button
        ref={botao}
        type="button"
        variant="outline"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
      >
        {ocupado ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
        Mais
      </Button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {itens.map((it) => {
            const Icone = it.icone
            return (
              <div key={it.chave}>
                {it.separador && <div className="my-1 border-t border-slate-100" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={it.desabilitado}
                  onClick={() => {
                    setAberto(false)
                    it.onClick()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm outline-none transition focus:bg-slate-100 disabled:opacity-50 ${
                    it.perigo ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icone className="size-4 shrink-0" />
                  <span className="flex-1">{it.rotulo}</span>
                  {it.atalho && <Kbd>{it.atalho}</Kbd>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- página ----------

export default function PedidoCompraPagina({ id }: { id: string }) {
  const router = useRouter()

  const [pedido, setPedido] = useState<PedidoCompra | null>(null)
  const [itens, setItens] = useState<ItemPedidoCompra[] | null>(null)
  const [recebimentos, setRecebimentos] = useState<Recebimento[] | null>(null)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [empresa, setEmpresa] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const [agindo, setAgindo] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [recebendo, setRecebendo] = useState(false)
  const [formulario, setFormulario] = useState<{ chave: number; inicial: PedidoInicial } | null>(null)

  // atalhos de teclado: o efeito lê sempre a versão mais recente daqui
  const atalhos = useRef<{ receber: (() => void) | null; editar: (() => void) | null }>({
    receber: null,
    editar: null,
  })

  const carregar = useCallback(async () => {
    try {
      const [r, rec] = await Promise.all([
        obterPedido(id),
        listarRecebimentos(id).catch(() => [] as Recebimento[]),
      ])
      if (!r) {
        setNaoEncontrado(true)
        return
      }
      setPedido(r.pedido)
      setItens(r.itens)
      setRecebimentos(rec)
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o pedido')
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    precarregarPdfCompra()
    let cancelado = false
    nomeDaEmpresa()
      .then((n) => {
        if (!cancelado) setEmpresa(n)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  // R = receber mercadoria, E = editar (só fora de campos e sem janela aberta)
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.closest('input, textarea, select, [contenteditable="true"]') || alvo.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return

      const k = e.key.toLowerCase()
      if (k === 'r' && atalhos.current.receber) {
        e.preventDefault()
        atalhos.current.receber()
      } else if (k === 'e' && atalhos.current.editar) {
        e.preventDefault()
        atalhos.current.editar()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  // recarrega o pedido e mostra o aviso (usado depois de receber, ajustar, mudar status...)
  const mudou = async (a?: string) => {
    await carregar()
    setVersao((v) => v + 1)
    if (a) setAviso(a)
  }

  // ---------- estados de carregamento ----------

  if (naoEncontrado) {
    return (
      <div className="w-full pb-16">
        <div className="mt-7 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-16 text-center">
          <p className="text-sm font-medium text-slate-600">Pedido não encontrado.</p>
          <Link href="/pedidos-compra" className="text-sm font-semibold text-[#079C9C] hover:underline">
            Voltar para os pedidos
          </Link>
        </div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="w-full pb-16">
        {erro ? (
          <div className="mt-7 space-y-3">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {erro}
            </p>
            <Link href="/pedidos-compra" className="text-sm font-semibold text-[#079C9C] hover:underline">
              Voltar para os pedidos
            </Link>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Carregando pedido...
          </p>
        )}
      </div>
    )
  }

  // ---------- valores derivados ----------

  const info = infoStatus(pedido)
  const atrasoEntrega = atrasado(pedido)
  const temRecebimento = (recebimentos?.length ?? 0) > 0
  const podeReceber = pedido.status === 'enviado' || pedido.status === 'confirmado'
  const podeEditar =
    ['rascunho', 'enviado', 'confirmado'].includes(pedido.status) &&
    recebimentos !== null &&
    !temRecebimento
  const podeExcluir =
    (pedido.status === 'rascunho' || pedido.status === 'cancelado') && !temRecebimento
  const recebidoCompleto =
    !!itens && itens.length > 0 && itens.every((i) => i.quantidade_recebida >= i.quantidade)

  const acoes = ACOES[pedido.status].filter((a) => {
    // depois do primeiro recebimento não dá para voltar nem cancelar
    if (temRecebimento && (a.status === 'rascunho' || a.status === 'cancelado')) return false
    // recebido por completo não reabre
    if (pedido.status === 'recebido' && recebidoCompleto) return false
    return true
  })

  const soma = (itens ?? []).reduce((s, i) => s + i.subtotal, 0)
  const valorRecebido = (itens ?? []).reduce((s, i) => s + i.quantidade_recebida * i.preco_unitario, 0)
  const pctRecebido = soma > 0 ? Math.round((valorRecebido / soma) * 100) : 0
  const itemPorId = new Map((itens ?? []).map((i) => [i.id, i]))

  // ---------- ações ----------

  const executar = async (fn: () => Promise<void>, textoAviso: string) => {
    setAgindo(true)
    setErro('')
    try {
      await fn()
      await mudou(textoAviso)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a ação')
    } finally {
      setAgindo(false)
    }
  }

  const mudarStatus = (a: Acao) => {
    if (a.confirmar && !window.confirm(a.confirmar)) return
    executar(
      () => alterarStatus(pedido.id, a.status),
      `Pedido ${numeroPedido(pedido.numero)} ${a.aviso}.`
    )
  }

  const excluir = async () => {
    if (!window.confirm(`Excluir o pedido ${numeroPedido(pedido.numero)}? Não dá para desfazer.`))
      return
    setAgindo(true)
    setErro('')
    try {
      await excluirPedido(pedido.id)
      router.push('/pedidos-compra')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir o pedido')
      setAgindo(false)
    }
  }

  const copiar = async () => {
    if (!itens) return
    try {
      await navigator.clipboard.writeText(textoWhatsApp(pedido, itens, empresa))
      setAviso('Pedido copiado: é só colar no WhatsApp.')
    } catch {
      setErro('Não foi possível copiar o texto.')
    }
  }

  const pdf = async () => {
    if (!itens) return
    setGerandoPdf(true)
    setErro('')
    try {
      await gerarPdfCompra(pedido, itens, empresa)
    } catch (e) {
      setErro(`Não foi possível gerar o PDF: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
    } finally {
      setGerandoPdf(false)
    }
  }

  const editar = () =>
    setFormulario({
      chave: Date.now(),
      inicial: {
        id: pedido.id,
        dados: dadosDoPedido(pedido),
        itens: (itens ?? []).map(itemParaEntrada),
      },
    })

  const duplicar = () => {
    const dados = dadosDoPedido(pedido)
    setFormulario({
      chave: Date.now(),
      inicial: {
        dados: {
          ...dados,
          comparacao_ref: null, // é um pedido novo, sem ligação com a comparação
          comparacao_nome: null,
          previsao_entrega: pedido.prazo_dias != null ? somarDias(hoje(), pedido.prazo_dias) : null,
        },
        itens: (itens ?? []).map(itemParaEntrada),
      },
    })
  }

  // ---------- quais botões ficam à vista e quais vão para o menu ----------

  const principal = podeReceber ? null : (acoes.find((a) => a.tipo === 'principal') ?? null)
  const confirmou =
    pedido.status === 'enviado' ? (acoes.find((a) => a.status === 'confirmado') ?? null) : null
  const noMenu = acoes.filter((a) => a !== principal && a !== confirmou)
  const noMenuNormais = noMenu.filter((a) => a.tipo !== 'perigo')
  const noMenuPerigo = noMenu.filter((a) => a.tipo === 'perigo')

  atalhos.current = {
    receber: podeReceber && !agindo ? () => setRecebendo(true) : null,
    editar: podeEditar && !!itens && !agindo ? editar : null,
  }

  const menu: ItemMenu[] = [
    ...(podeEditar
      ? [{ chave: 'editar', rotulo: 'Editar pedido', icone: Pencil, atalho: 'E', onClick: editar, desabilitado: !itens || agindo }]
      : []),
    { chave: 'duplicar', rotulo: 'Duplicar pedido', icone: Copy, onClick: duplicar, desabilitado: !itens || agindo },
    { chave: 'whats', rotulo: 'Copiar para o WhatsApp', icone: ClipboardCopy, onClick: copiar, desabilitado: !itens || agindo },
    { chave: 'pdf', rotulo: 'Baixar ou compartilhar PDF', icone: FileDown, onClick: pdf, desabilitado: !itens || agindo || gerandoPdf },
    ...noMenuNormais.map((a, idx) => ({
      chave: `s-${a.status}`,
      rotulo: a.rotulo,
      icone: Undo2,
      onClick: () => mudarStatus(a),
      desabilitado: agindo,
      separador: idx === 0,
    })),
    ...noMenuPerigo.map((a, idx) => ({
      chave: `p-${a.status}`,
      rotulo: a.rotulo,
      icone: X,
      onClick: () => mudarStatus(a),
      perigo: true,
      desabilitado: agindo,
      separador: idx === 0,
    })),
    ...(podeExcluir
      ? [{ chave: 'excluir', rotulo: 'Excluir pedido', icone: Trash2, onClick: excluir, perigo: true, desabilitado: agindo, separador: noMenuPerigo.length === 0 }]
      : []),
  ]

  return (
    <div className="w-full pb-16">
      {/* topo: título e as ações principais sempre à vista */}
      <div className="sticky top-0 z-20 mt-4 border-b border-slate-200 bg-white/95 py-3 backdrop-blur">
        <Link
          href="/pedidos-compra"
          className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#079C9C]"
        >
          <ArrowLeft className="size-4" />
          Pedidos de compra
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h3 className="text-2xl font-bold text-slate-900 md:text-3xl">
                {numeroPedido(pedido.numero)}
              </h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${info.classe}`}>
                {info.texto}
              </span>
              {atrasoEntrega && pedido.previsao_entrega && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Atrasado {diasDeAtraso(pedido.previsao_entrega)}{' '}
                  {diasDeAtraso(pedido.previsao_entrega) === 1 ? 'dia' : 'dias'}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {pedido.fornecedor_nome}
              {pedido.criado_em
                ? ` · criado${pedido.criado_por_nome ? ` por ${pedido.criado_por_nome}` : ''} em ${new Date(
                    pedido.criado_em
                  ).toLocaleDateString('pt-BR')}`
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {podeReceber && (
              <Button
                type="button"
                onClick={() => setRecebendo(true)}
                disabled={agindo}
                className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
              >
                <PackageCheck className="size-4" />
                Receber mercadoria
                <span className="rounded bg-white/20 px-1 text-[10px] font-semibold">R</span>
              </Button>
            )}

            {principal && (
              <Button
                type="button"
                onClick={() => mudarStatus(principal)}
                disabled={agindo}
                className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
              >
                {agindo && <Loader2 className="size-4 animate-spin" />}
                {principal.rotulo}
              </Button>
            )}

            {confirmou && (
              <Button
                type="button"
                variant="outline"
                onClick={() => mudarStatus(confirmou)}
                disabled={agindo}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              >
                {confirmou.rotulo}
              </Button>
            )}

            <MenuAcoes itens={menu} ocupado={gerandoPdf || agindo} />
          </div>
        </div>
      </div>

      {/* avisos */}
      {aviso && (
        <div
          role="status"
          className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
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

      {erro && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      {pedido.comparacao_nome && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Veio da comparação{' '}
          {pedido.comparacao_ref ? (
            <Link
              href={`/comparar-precos/${pedido.comparacao_ref}`}
              className="font-semibold text-[#079C9C] hover:underline"
            >
              {pedido.comparacao_nome}
            </Link>
          ) : (
            <strong>{pedido.comparacao_nome}</strong>
          )}
          .
        </p>
      )}

      {/* onde o pedido está */}
      <Cartao className="mt-4">
        <Etapas pedido={pedido} />
      </Cartao>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        {/* ---------- coluna principal ---------- */}
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Itens{itens ? ` (${itens.length})` : ''}
              </h4>
              {valorRecebido > 0 && (
                <span className="text-xs font-semibold text-slate-500">{pctRecebido}% recebido</span>
              )}
            </div>

            {itens === null ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                Carregando itens...
              </p>
            ) : (
              <>
                <div className="hidden grid-cols-[6rem_minmax(0,1fr)_7rem_8rem_7rem] gap-x-3 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
                  <span>Qtd</span>
                  <span>Item</span>
                  <span className="text-right">Preço un.</span>
                  <span className="text-right">Recebido</span>
                  <span className="text-right">Subtotal</span>
                </div>

                <ul className="divide-y divide-slate-100">
                  {itens.map((i) => {
                    const un = i.unidade ? ` ${i.unidade}` : ''
                    const completo = i.quantidade_recebida >= i.quantidade
                    const textoRecebido = `${numeroTexto(i.quantidade_recebida)} de ${numeroTexto(i.quantidade)}${
                      i.quantidade_recebida > i.quantidade ? ' (a mais)' : ''
                    }`
                    const corRecebido = completo ? 'text-emerald-600' : 'text-amber-600'

                    return (
                      <li
                        key={i.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-3 md:grid-cols-[6rem_minmax(0,1fr)_7rem_8rem_7rem] md:items-center"
                      >
                        <span className="hidden text-sm font-bold text-[#079C9C] md:block">
                          {numeroTexto(i.quantidade)}
                          {un}
                        </span>

                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{i.produto_nome}</p>
                          <p className="text-xs text-slate-500 md:hidden">
                            {numeroTexto(i.quantidade)}
                            {un} × {reais4(i.preco_unitario)}
                          </p>
                          {i.produto_codigo && (
                            <p className="text-xs text-slate-400">Cód. {i.produto_codigo}</p>
                          )}
                          {i.quantidade_recebida > 0 && (
                            <p className={`text-xs font-semibold md:hidden ${corRecebido}`}>
                              Recebido {textoRecebido}
                            </p>
                          )}
                          {i.observacao?.trim() && (
                            <p className="mt-0.5 text-xs italic text-slate-500">
                              obs: {i.observacao.trim()}
                            </p>
                          )}
                        </div>

                        <span className="hidden text-right text-sm text-slate-600 md:block">
                          {reais4(i.preco_unitario)}
                        </span>

                        <span
                          className={`hidden text-right text-xs font-semibold md:block ${
                            i.quantidade_recebida > 0 ? corRecebido : 'text-slate-300'
                          }`}
                        >
                          {i.quantidade_recebida > 0 ? textoRecebido : '—'}
                        </span>

                        <span className="self-start text-right text-sm font-semibold text-slate-900 md:self-auto">
                          {reais(i.subtotal)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>

          <Cartao>
            <NotasDoPedido
              key={versao}
              pedido={pedido}
              itens={itens}
              onMudou={(a) => {
                mudou(a)
              }}
            />
          </Cartao>
        </div>

        {/* ---------- coluna lateral ---------- */}
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-28">
          <Cartao titulo="Valores">
            <div className="space-y-1">
              {itens && <Linha rotulo="Subtotal" valor={reais(soma)} />}
              {pedido.frete > 0 && <Linha rotulo="Frete" valor={reais(pedido.frete)} />}
              {pedido.desconto > 0 && <Linha rotulo="Desconto" valor={`- ${reais(pedido.desconto)}`} />}
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-2xl font-bold text-[#079C9C]">{reais(pedido.total)}</span>
              </div>
            </div>

            {valorRecebido > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">Recebido (em itens)</span>
                  <span className="font-semibold text-slate-800">
                    {reais(valorRecebido)} · {pctRecebido}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#079C9C]"
                    style={{ width: `${Math.min(pctRecebido, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </Cartao>

          <Cartao titulo="Detalhes">
            <div className="space-y-1.5">
              <Linha rotulo="Fornecedor" valor={pedido.fornecedor_nome} />
              {pedido.fornecedor_contato && <Linha rotulo="Contato" valor={pedido.fornecedor_contato} />}
              {pedido.previsao_entrega && (
                <Linha rotulo="Entrega prevista" valor={dataCurta(pedido.previsao_entrega)} />
              )}
              {pedido.prazo_dias != null && (
                <Linha
                  rotulo="Prazo do fornecedor"
                  valor={`${pedido.prazo_dias} ${pedido.prazo_dias === 1 ? 'dia' : 'dias'}`}
                />
              )}
              {pedido.condicao_pagamento && <Linha rotulo="Pagamento" valor={pedido.condicao_pagamento} />}
            </div>

            {pedido.observacao?.trim() && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Observações
                </p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{pedido.observacao.trim()}</p>
              </div>
            )}
          </Cartao>

          {recebimentos && recebimentos.length > 0 && (
            <Cartao titulo={`Recebimentos (${recebimentos.length})`}>
              <ul className="space-y-2">
                {recebimentos.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-slate-800">{dataHora(r.recebido_em)}</span>
                      <span className="truncate text-xs text-slate-500">{r.recebido_por_nome ?? '—'}</span>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-slate-600">
                      {r.itens.map((x) => {
                        const it = itemPorId.get(x.item_id)
                        return (
                          <li key={x.item_id} className="text-xs">
                            {numeroTexto(x.quantidade)}
                            {it?.unidade ? ` ${it.unidade}` : ''} · {it?.produto_nome ?? 'Item removido'}
                          </li>
                        )
                      })}
                    </ul>
                    <p className="mt-1 text-xs text-slate-400">
                      {r.deu_entrada ? 'Entrou no estoque' : 'Sem entrada no estoque'}
                      {r.encerrou ? ' · encerrou o pedido' : ''}
                    </p>
                    {r.observacao?.trim() && (
                      <p className="mt-1 text-xs italic text-slate-500">{r.observacao.trim()}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </aside>
      </div>

      <ReceberPedidoDialog
        pedido={
          recebendo
            ? { id: pedido.id, numero: pedido.numero, fornecedor_nome: pedido.fornecedor_nome }
            : null
        }
        ehDono
        onClose={() => setRecebendo(false)}
        onRecebido={(a) => {
          setRecebendo(false)
          mudou(a)
        }}
      />

      <PedidoCompraDialog
        key={formulario?.chave ?? 0}
        open={formulario !== null}
        inicial={formulario?.inicial ?? PEDIDO_VAZIO}
        onClose={() => setFormulario(null)}
        onSalvo={(novoId, numero) => {
          setFormulario(null)
          if (novoId === pedido.id) {
            mudou(`Pedido ${numeroPedido(numero)} salvo.`)
          } else {
            router.push(`/pedidos-compra/${novoId}`)
          }
        }}
      />
    </div>
  )
}