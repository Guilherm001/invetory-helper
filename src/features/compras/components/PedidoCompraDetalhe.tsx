'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Check,
  ClipboardCheck,
  ClipboardCopy,
  Copy,
  FileDown,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { dataCurta, dataHora, numeroTexto, reais } from '@/features/loja/lib/formatar'
import {
  alterarStatus,
  excluirPedido,
  nomeDaEmpresa,
  obterPedido,
  type ItemPedidoCompra,
  type PedidoCompra,
  type StatusCompra,
} from '../services/comprasService'
import {
  STATUS_INFO,
  atrasado,
  dadosDoPedido,
  diasDeAtraso,
  itemParaEntrada,
  numeroPedido,
  somarDias,
  textoWhatsApp,
} from '../lib/compras'
import { gerarPdfCompra, precarregarPdfCompra } from '../utils/gerarPdfCompra'
import type { PedidoInicial } from './PedidoCompraDialog'

interface Acao {
  status: StatusCompra
  rotulo: string
  tipo: 'principal' | 'normal' | 'perigo'
  confirmar?: string
  aviso: string
}

const ACOES: Record<StatusCompra, Acao[]> = {
  rascunho: [
    { status: 'enviado', rotulo: 'Marcar como enviado', tipo: 'principal', aviso: 'marcado como enviado' },
    { status: 'cancelado', rotulo: 'Cancelar pedido', tipo: 'perigo', confirmar: 'Cancelar este pedido?', aviso: 'cancelado' },
  ],
  enviado: [
    { status: 'confirmado', rotulo: 'Fornecedor confirmou', tipo: 'principal', aviso: 'confirmado pelo fornecedor' },
    { status: 'recebido', rotulo: 'Marcar como recebido', tipo: 'normal', aviso: 'marcado como recebido' },
    { status: 'rascunho', rotulo: 'Voltar para rascunho', tipo: 'normal', aviso: 'voltou para rascunho' },
    { status: 'cancelado', rotulo: 'Cancelar pedido', tipo: 'perigo', confirmar: 'Cancelar este pedido?', aviso: 'cancelado' },
  ],
  confirmado: [
    { status: 'recebido', rotulo: 'Marcar como recebido', tipo: 'principal', aviso: 'marcado como recebido' },
    { status: 'enviado', rotulo: 'Voltar para enviado', tipo: 'normal', aviso: 'voltou para enviado' },
    { status: 'cancelado', rotulo: 'Cancelar pedido', tipo: 'perigo', confirmar: 'Cancelar este pedido?', aviso: 'cancelado' },
  ],
  recebido: [
    { status: 'confirmado', rotulo: 'Reabrir pedido', tipo: 'normal', confirmar: 'Reabrir este pedido recebido?', aviso: 'reaberto' },
  ],
  cancelado: [
    { status: 'rascunho', rotulo: 'Reabrir como rascunho', tipo: 'normal', aviso: 'reaberto como rascunho' },
  ],
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-500">{rotulo}</span>
      <span className="font-medium text-slate-800">{valor}</span>
    </div>
  )
}

function Conteudo({
  pedido,
  onMudou,
  onEditar,
  onDuplicar,
}: {
  pedido: PedidoCompra
  onMudou: (aviso?: string) => void
  onEditar: (inicial: PedidoInicial) => void
  onDuplicar: (inicial: PedidoInicial) => void
}) {
  const [itens, setItens] = useState<ItemPedidoCompra[] | null>(null)
  const [empresa, setEmpresa] = useState('')
  const [erro, setErro] = useState('')
  const [agindo, setAgindo] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const info = STATUS_INFO[pedido.status]
  const atrasoEntrega = atrasado(pedido)
  const podeEditar = ['rascunho', 'enviado', 'confirmado'].includes(pedido.status)
  const podeExcluir = pedido.status === 'rascunho' || pedido.status === 'cancelado'

  useEffect(() => {
    precarregarPdfCompra()
    let cancelado = false
    obterPedido(pedido.id)
      .then((r) => {
        if (!cancelado && r) setItens(r.itens)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar os itens')
      })
    nomeDaEmpresa()
      .then((n) => {
        if (!cancelado) setEmpresa(n)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [pedido.id])

  const executar = async (fn: () => Promise<void>, aviso: string) => {
    setAgindo(true)
    setErro('')
    try {
      await fn()
      onMudou(aviso)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a ação')
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

  const excluir = () => {
    if (!window.confirm(`Excluir o pedido ${numeroPedido(pedido.numero)}? Não dá para desfazer.`))
      return
    executar(() => excluirPedido(pedido.id), `Pedido ${numeroPedido(pedido.numero)} excluído.`)
  }

  const copiar = async () => {
    if (!itens) return
    try {
      await navigator.clipboard.writeText(textoWhatsApp(pedido, itens, empresa))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
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

  const inicialDe = (): PedidoInicial => ({
    id: pedido.id,
    dados: dadosDoPedido(pedido),
    itens: (itens ?? []).map(itemParaEntrada),
  })

  const duplicar = () => {
    const dados = dadosDoPedido(pedido)
    onDuplicar({
      dados: {
        ...dados,
        comparacao_ref: null, // é um pedido novo, sem ligação com a comparação
        comparacao_nome: null,
        previsao_entrega:
          pedido.prazo_dias != null
            ? somarDias(new Date().toISOString().slice(0, 10), pedido.prazo_dias)
            : null,
      },
      itens: (itens ?? []).map(itemParaEntrada),
    })
  }

  const soma = (itens ?? []).reduce((s, i) => s + i.subtotal, 0)

  const eventos: [string, string | null][] = [
    [`Criado${pedido.criado_por_nome ? ` por ${pedido.criado_por_nome}` : ''}`, pedido.criado_em],
    ['Enviado ao fornecedor', pedido.enviado_em],
    ['Confirmado pelo fornecedor', pedido.confirmado_em],
    ['Recebido', pedido.recebido_em],
    ['Cancelado', pedido.cancelado_em],
  ]

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <ClipboardCheck className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              Pedido {numeroPedido(pedido.numero)}
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {pedido.fornecedor_nome}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
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

        {pedido.comparacao_nome && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
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

        <div className="space-y-1.5 rounded-xl border border-slate-200 p-4">
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
          {pedido.condicao_pagamento && (
            <Linha rotulo="Pagamento" valor={pedido.condicao_pagamento} />
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Itens
          </p>

          {itens === null && !erro ? (
            <p className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              Carregando itens...
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {(itens ?? []).map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {numeroTexto(i.quantidade)}
                      {i.unidade ? ` ${i.unidade}` : ''} · {i.produto_nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      {reais(i.preco_unitario)} cada
                      {i.produto_codigo ? ` · Cód. ${i.produto_codigo}` : ''}
                    </p>
                    {i.observacao?.trim() && (
                      <p className="mt-0.5 text-xs italic text-slate-500">
                        obs: {i.observacao.trim()}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">
                    {reais(i.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-1 rounded-xl border border-[#079C9C]/20 bg-[#079C9C]/5 px-4 py-3">
            {itens && <Linha rotulo="Subtotal" valor={reais(soma)} />}
            {pedido.frete > 0 && <Linha rotulo="Frete" valor={reais(pedido.frete)} />}
            {pedido.desconto > 0 && (
              <Linha rotulo="Desconto" valor={`- ${reais(pedido.desconto)}`} />
            )}
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-sm font-semibold text-slate-700">Total</span>
              <span className="text-2xl font-bold text-[#079C9C]">{reais(pedido.total)}</span>
            </div>
          </div>
        </div>

        {pedido.observacao?.trim() && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Observações
            </p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{pedido.observacao.trim()}</p>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Histórico
          </p>
          <ul className="space-y-1 text-sm text-slate-600">
            {eventos
              .filter(([, quando]) => quando)
              .map(([rotulo, quando]) => (
                <li key={rotulo} className="flex justify-between gap-3">
                  <span>{rotulo}</span>
                  <span className="text-slate-400">{dataHora(quando as string)}</span>
                </li>
              ))}
          </ul>
        </div>

        {(pedido.status === 'enviado' || pedido.status === 'confirmado') && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Ao receber, a entrada no estoque ainda é feita à mão, pelo botão de entrada no
            Catálogo. A conferência automática vem na próxima etapa.
          </p>
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

        <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={copiar}
            disabled={!itens || agindo}
            className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            {copiado ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            {copiado ? 'Copiado!' : 'WhatsApp'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={pdf}
            disabled={!itens || agindo || gerandoPdf}
            className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            {gerandoPdf ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            PDF
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={duplicar}
            disabled={!itens || agindo}
            className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            <Copy className="size-4" />
            Duplicar
          </Button>

          {podeEditar && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onEditar(inicialDe())}
              disabled={!itens || agindo}
              className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              <Pencil className="size-4" />
              Editar
            </Button>
          )}

          {podeExcluir && (
            <Button
              type="button"
              variant="outline"
              onClick={excluir}
              disabled={agindo}
              className="gap-2 border-red-200 bg-white text-red-600 hover:bg-red-50"
            >
              <Trash2 className="size-4" />
              Excluir
            </Button>
          )}

          {ACOES[pedido.status].map((a) => (
            <Button
              key={a.status}
              type="button"
              variant={a.tipo === 'principal' ? 'default' : 'outline'}
              onClick={() => mudarStatus(a)}
              disabled={agindo}
              className={
                a.tipo === 'principal'
                  ? 'gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90'
                  : a.tipo === 'perigo'
                    ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }
            >
              {agindo && a.tipo === 'principal' && <Loader2 className="size-4 animate-spin" />}
              {a.rotulo}
            </Button>
          ))}
        </div>
      </div>
    </>
  )
}

export default function PedidoCompraDetalhe({
  pedido,
  onClose,
  onMudou,
  onEditar,
  onDuplicar,
}: {
  pedido: PedidoCompra | null
  onClose: () => void
  onMudou: (aviso?: string) => void
  onEditar: (inicial: PedidoInicial) => void
  onDuplicar: (inicial: PedidoInicial) => void
}) {
  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[640px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {pedido && (
          <Conteudo
            key={pedido.id}
            pedido={pedido}
            onMudou={onMudou}
            onEditar={onEditar}
            onDuplicar={onDuplicar}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}