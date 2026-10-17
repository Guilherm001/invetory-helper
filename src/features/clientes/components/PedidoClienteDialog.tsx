'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, ClipboardList, FileText, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { detalhePedidoCliente, type DetalhePedido } from '../services/fichaService'
import {
  FORMA_ROTULO,
  dataCurta,
  dataHora,
  numeroTexto,
  reais,
  statusPedido,
} from '../lib/formatar'

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <div className="space-y-0.5 text-sm text-slate-700">{children}</div>
    </div>
  )
}

function Conteudo({ id }: { id: string }) {
  const [d, setD] = useState<DetalhePedido | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    detalhePedidoCliente(id)
      .then((r) => {
        if (!cancelado) setD(r)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar o pedido')
      })
    return () => {
      cancelado = true
    }
  }, [id])

  if (erro) {
    return (
      <p className="m-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {erro}
      </p>
    )
  }

  if (!d) {
    return (
      <p className="flex items-center gap-2 px-6 py-10 text-sm text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Carregando...
      </p>
    )
  }

  const { doc, itens, pagamentos } = d
  const orc = doc.documento === 'orcamento'
  const st = statusPedido(doc)
  const endereco = [doc.endereco, doc.bairro, doc.cidade, doc.complemento]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')
  const pago = doc.total_liquido ?? doc.total - doc.desconto
  const validos = pagamentos.filter((p) => !p.estornado)

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            {orc ? <FileText className="size-6 text-white" /> : <ClipboardList className="size-6 text-white" />}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              {orc ? 'Orçamento' : 'Pedido'} nº {doc.numero}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/80">{dataHora(doc.criado_em)}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.classe}`}>{st.texto}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {doc.tipo === 'entrega' ? 'Entrega' : 'Retirada na loja'}
          </span>
          {orc && doc.validade && <span className="text-xs text-slate-500">Válido até {dataCurta(doc.validade)}</span>}
        </div>

        {doc.orcamento_numero !== null && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Veio do orçamento nº {doc.orcamento_numero}
            {doc.orcamento_vendedor ? `, feito por ${doc.orcamento_vendedor}` : ''}.
          </p>
        )}

        <Bloco titulo="Cliente">
          <p className="font-semibold text-slate-900">{doc.cliente_nome || 'Não informado'}</p>
          {doc.cliente_telefone && <p>{doc.cliente_telefone}</p>}
        </Bloco>

        {doc.tipo === 'entrega' && (
          <Bloco titulo="Endereço de entrega">
            <p>{endereco || 'Não informado'}</p>
          </Bloco>
        )}

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Produtos</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {itens.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {numeroTexto(i.quantidade)}
                    {i.unidade ? ` ${i.unidade}` : ''} · {i.produto_nome}
                  </p>
                  <p className="text-xs text-slate-500">
                    {reais(i.preco_unitario)} cada{i.produto_codigo ? ` · Cód. ${i.produto_codigo}` : ''}
                  </p>
                  {i.observacao?.trim() && (
                    <p className="mt-0.5 text-xs italic text-slate-500">obs: {i.observacao.trim()}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900">{reais(i.subtotal)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1 rounded-xl border border-[#079C9C]/20 bg-[#079C9C]/5 px-4 py-3">
            {doc.desconto > 0 && (
              <>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>{reais(doc.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-700">
                  <span>
                    Desconto
                    {doc.desconto_percentual !== null ? ` (${String(doc.desconto_percentual).replace('.', ',')}%)` : ''}
                  </span>
                  <span>- {reais(doc.desconto)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Total</span>
              <span className="text-2xl font-bold text-[#079C9C]">{reais(pago)}</span>
            </div>
          </div>
        </div>

        <Bloco titulo="Pagamento">
          {validos.length > 0 ? (
            <ul className="space-y-1">
              {validos.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <span>
                    {FORMA_ROTULO[p.forma] ?? p.forma}
                    {p.forma === 'credito' && (p.parcelas ?? 1) > 1 ? ` em ${p.parcelas}x` : ''}
                    {p.forma === 'dinheiro' && p.troco > 0 && (
                      <span className="block text-xs text-slate-500">
                        recebido {reais(p.recebido ?? p.valor)} · troco {reais(p.troco)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-slate-900">{reais(p.valor)}</span>
                </li>
              ))}
            </ul>
          ) : doc.status === 'aberta' ? (
            <p className="text-slate-500">Ainda sem pagamento: o pedido está em aberto.</p>
          ) : (
            <p>{doc.pagamento || 'Não informado'}</p>
          )}
        </Bloco>

        {doc.observacao?.trim() && (
          <Bloco titulo="Observação">
            <p className="whitespace-pre-wrap">{doc.observacao.trim()}</p>
          </Bloco>
        )}

        <Bloco titulo="Quem atendeu">
          {doc.vendedor_nome && <p>Vendedor: {doc.vendedor_nome}</p>}
          {doc.editado_por && (
            <p className="text-xs text-slate-500">
              Editado por {doc.editado_por}
              {doc.editado_em ? ` em ${dataHora(doc.editado_em)}` : ''}
            </p>
          )}
          {doc.fechado_em && (
            <p className="text-xs text-slate-500">
              Fechado no caixa por {doc.fechado_por} em {dataHora(doc.fechado_em)}
            </p>
          )}
          {doc.documento === 'pedido' && doc.status === 'entregue' && (
            <p className="text-xs text-slate-500">
              Cupom fiscal: {doc.fiscal_status === 'emitido' ? 'emitido' : 'não emitido'}
            </p>
          )}
        </Bloco>
      </div>
    </>
  )
}

export default function PedidoClienteDialog({
  vendaId,
  onClose,
}: {
  vendaId: string | null
  onClose: () => void
}) {
  return (
    <Dialog open={vendaId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[4%] flex max-h-[92dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[600px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {vendaId && <Conteudo key={vendaId} id={vendaId} />}
      </DialogContent>
    </Dialog>
  )
}