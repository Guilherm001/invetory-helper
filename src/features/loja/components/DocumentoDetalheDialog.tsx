'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  ClipboardList,
  FileText,
  Loader2,
  Pencil,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import {
  alterarStatus,
  converterOrcamento,
  listarItensDocumento,
  type DocumentoResumo,
  type ItemDocumento,
  type StatusDocumento,
} from '../services/documentosService'
import {
  dataCurta,
  dataHora,
  hoje,
  numeroTexto,
  reais,
  resumoDocumento,
  statusInfo,
} from '../lib/formatar'
import BotoesImpressao from './BotoesImpressao'
import SenhaVendedor from './senhaVendedor'

export interface Aviso {
  texto: string
  link?: { href: string; label: string }
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </p>
      <div className="space-y-0.5 text-sm text-slate-700">{children}</div>
    </div>
  )
}

function Conteudo({
  doc,
  ehDono,
  onMudou,
  onEditar,
}: {
  doc: DocumentoResumo
  ehDono: boolean
  onMudou: (aviso?: Aviso) => void
  onEditar: (doc: DocumentoResumo, itens: ItemDocumento[]) => void
}) {
  const [itens, setItens] = useState<ItemDocumento[] | null>(null)
  const [erro, setErro] = useState('')
  const [agindo, setAgindo] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [pedindoSenha, setPedindoSenha] = useState(false)

  const orc = doc.documento === 'orcamento'
  const aberto = doc.status === 'aberta'
  const info = statusInfo(doc)
  const vencido = orc && aberto && !!doc.validade && doc.validade < hoje()

  // total dos itens, desconto e valor final
  const desconto = Number(doc.desconto ?? 0)
  const totalFinal = doc.total - desconto

  useEffect(() => {
    let cancelado = false
    listarItensDocumento(doc.id)
      .then((i) => {
        if (!cancelado) setItens(i)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar os itens')
      })
    return () => {
      cancelado = true
    }
  }, [doc.id])

  const executar = async (fn: () => Promise<Aviso | undefined>) => {
    setAgindo(true)
    setErro('')
    try {
      onMudou(await fn())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a ação')
      setAgindo(false)
    }
  }

  const mudarStatus = (status: StatusDocumento, aviso?: string) =>
    executar(async () => {
      await alterarStatus(doc.id, status)
      return aviso ? { texto: aviso } : undefined
    })

  const converter = () => {
    if (
      vencido &&
      !window.confirm(
        `Este orçamento venceu em ${dataCurta(doc.validade as string)}. Os preços podem ter mudado. Converter em pedido mesmo assim?`
      )
    )
      return
    setPedindoSenha(true)
  }

  const confirmarConversao = async (pin: string) => {
    const r = await converterOrcamento(doc.id, pin)
    onMudou({
      texto: `Orçamento nº ${doc.numero} virou o pedido nº ${r.numero}.`,
      link: { href: '/pedidos', label: 'Ver pedidos' },
    })
  }

  const recusarOuCancelar = () => {
    const msg = orc
      ? `Recusar o orçamento nº ${doc.numero}?`
      : `Cancelar o pedido nº ${doc.numero}?`
    if (!window.confirm(msg)) return
    mudarStatus(
      'cancelada',
      orc ? `Orçamento nº ${doc.numero} recusado.` : `Pedido nº ${doc.numero} cancelado.`
    )
  }

  const copiar = async () => {
    if (!itens) return
    try {
      await navigator.clipboard.writeText(resumoDocumento(doc, itens))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro('Não foi possível copiar o resumo.')
    }
  }

  const endereco = [doc.endereco, doc.bairro, doc.cidade, doc.complemento]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            {orc ? (
              <FileText className="size-6 text-white" />
            ) : (
              <ClipboardList className="size-6 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              {orc ? 'Orçamento' : 'Pedido'} nº {doc.numero}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              {dataHora(doc.criado_em)}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${info.classe}`}>
            {info.texto}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {doc.tipo === 'entrega' ? 'Entrega' : 'Retirada na loja'}
          </span>
          {orc && doc.validade && (
            <span className="text-xs text-slate-500">Válido até {dataCurta(doc.validade)}</span>
          )}
        </div>

        {doc.orcamento_numero !== null && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Veio do orçamento nº {doc.orcamento_numero}
            {doc.orcamento_em ? ` de ${dataCurta(doc.orcamento_em)}` : ''}.
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
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Produtos
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
            {desconto > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>{reais(doc.total)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Desconto</span>
                  <span>−{reais(desconto)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Total</span>
              <span className="text-2xl font-bold text-[#079C9C]">{reais(totalFinal)}</span>
            </div>
          </div>
        </div>

        {doc.pagamento && (
          <Bloco titulo="Pagamento">
            <p>{doc.pagamento}</p>
          </Bloco>
        )}

        {doc.observacao?.trim() && (
          <Bloco titulo="Observação do pedido">
            <p className="whitespace-pre-wrap">{doc.observacao.trim()}</p>
          </Bloco>
        )}

        {doc.vendedor_nome && (
          <Bloco titulo="Vendedor">
            <p className="font-semibold text-slate-900">{doc.vendedor_nome}</p>
            {doc.orcamento_vendedor && doc.orcamento_vendedor !== doc.vendedor_nome && (
              <p className="text-xs text-slate-500">Orçamento feito por {doc.orcamento_vendedor}</p>
            )}
            {doc.editado_por && (
              <p className="text-xs text-slate-500">
                Editado por {doc.editado_por}
                {doc.editado_em ? ` em ${dataHora(doc.editado_em)}` : ''}
              </p>
            )}
          </Bloco>
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
          {/* pedido fechado: explica por que não dá para editar */}
          {!aberto && !orc && (
            <p className="basis-full text-xs text-slate-500 sm:mr-auto sm:basis-auto">
              {doc.status === 'cancelada'
                ? 'Pedido cancelado.'
                : 'Pedido fechado: não pode mais ser alterado.'}{' '}
              {ehDono ? 'Reabra para poder editar.' : 'Só o dono pode reabrir.'}
            </p>
          )}

          <BotoesImpressao
            carregar={async () => ({ doc, itens: itens ?? [] })}
            desabilitado={!itens || agindo}
          />

          <Button
            type="button"
            variant="outline"
            onClick={copiar}
            disabled={!itens || agindo}
            className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            {copiado ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            {copiado ? 'Copiado!' : 'Copiar resumo'}
          </Button>

          {aberto && (
            <Button
              type="button"
              variant="outline"
              onClick={recusarOuCancelar}
              disabled={agindo}
              className="border-red-200 bg-white text-red-600 hover:bg-red-50"
            >
              {orc ? 'Recusar' : 'Cancelar pedido'}
            </Button>
          )}

          {/* editar: pedido ou orçamento, só enquanto estiver em aberto */}
          {aberto && itens && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onEditar(doc, itens)}
              disabled={agindo}
              className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              <Pencil className="size-4" />
              Editar {orc ? 'orçamento' : 'pedido'}
            </Button>
          )}

          {aberto && orc && (
            <Button
              type="button"
              onClick={converter}
              disabled={agindo}
              className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
            >
              {agindo && <Loader2 className="size-4 animate-spin" />}
              Converter em pedido
            </Button>
          )}

          {!aberto && (ehDono || orc) && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                mudarStatus('aberta', `${orc ? 'Orçamento' : 'Pedido'} nº ${doc.numero} reaberto.`)
              }
              disabled={agindo}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Reabrir
            </Button>
          )}
        </div>
      </div>

      {pedindoSenha && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <SenhaVendedor
            titulo="Digite a sua senha"
            descricao={`O orçamento nº ${doc.numero} vai virar pedido no seu nome.`}
            textoBotao="Converter em pedido"
            onConfirmar={confirmarConversao}
            onCancelar={() => setPedindoSenha(false)}
          />
        </div>
      )}
    </>
  )
}

export default function DocumentoDetalheDialog({
  doc,
  ehDono,
  onClose,
  onMudou,
  onEditar,
}: {
  doc: DocumentoResumo | null
  ehDono: boolean
  onClose: () => void
  onMudou: (aviso?: Aviso) => void
  onEditar: (doc: DocumentoResumo, itens: ItemDocumento[]) => void
}) {
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[4%] flex max-h-[92dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[600px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {doc && (
          <Conteudo key={doc.id} doc={doc} ehDono={ehDono} onMudou={onMudou} onEditar={onEditar} />
        )}
      </DialogContent>
    </Dialog>
  )
}