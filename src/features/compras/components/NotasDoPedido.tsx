'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { formatarCnpj, formatarCpf } from '@/features/clientes/lib/documentos'
import { dataCurta, dataHora, reais } from '@/features/loja/lib/formatar'
import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import { dispensarNotas } from '../services/painelService'
import {
  documentoDoFornecedor,
  excluirNota,
  linkDoArquivo,
  listarNotas,
  notaDispensada,
  type ArquivoNota,
  type NotaCompra,
} from '../services/notasService'
import { alertasDasNotas } from '../lib/conferenciaNota'
import { formatarChave } from '../lib/nfe'
import ConferenciaItens from './ConferenciaItens'
import NotaCompraDialog from './NotaCompraDialog'

const ORIGEM = { manual: 'Digitada', chave: 'Pela chave', xml: 'XML' } as const

const fmtDoc = (d: string) => (d.length <= 11 ? formatarCpf(d) : formatarCnpj(d))

const chipClass = 'rounded-full px-2 py-0.5 text-[11px] font-semibold'

function IconeArquivo({ tipo }: { tipo: string }) {
  if (tipo.startsWith('image/')) return <ImageIcon className="size-4" />
  if (tipo.includes('xml')) return <FileCode className="size-4" />
  return <FileText className="size-4" />
}

export default function NotasDoPedido({
  pedido,
  itens,
}: {
  pedido: PedidoCompra
  itens: ItemPedidoCompra[] | null
}) {
  const [notas, setNotas] = useState<NotaCompra[] | null>(null)
  const [erro, setErro] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [copiada, setCopiada] = useState<string | null>(null)
  const [docFornecedor, setDocFornecedor] = useState<string | null>(null)
  const [dispensada, setDispensada] = useState(false)
  const [dispensando, setDispensando] = useState(false)

  const podeAdicionar = ['enviado', 'confirmado', 'recebido'].includes(pedido.status)

  const carregar = useCallback(async () => {
    try {
      setNotas(await listarNotas(pedido.id))
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar as notas')
      setNotas((atual) => atual ?? [])
    }
  }, [pedido.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  // CNPJ do fornecedor, para conferir com o emitente da nota
  useEffect(() => {
    if (!pedido.fornecedor_ref) return
    let cancelado = false
    documentoDoFornecedor(pedido.fornecedor_ref).then((d) => {
      if (!cancelado) setDocFornecedor(d)
    })
    return () => {
      cancelado = true
    }
  }, [pedido.fornecedor_ref])

  useEffect(() => {
    let cancelado = false
    notaDispensada(pedido.id).then((v) => {
      if (!cancelado) setDispensada(v)
    })
    return () => {
      cancelado = true
    }
  }, [pedido.id])

  const temXml = !!notas?.some((n) => n.itens.length > 0)

  const alertas = useMemo(
    () => (itens && notas ? alertasDasNotas(pedido, itens, notas, docFornecedor) : []),
    [pedido, itens, notas, docFornecedor]
  )

  const alternarDispensa = async () => {
    setDispensando(true)
    setErro('')
    try {
      await dispensarNotas([pedido.id], !dispensada)
      setDispensada(!dispensada)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar')
    } finally {
      setDispensando(false)
    }
  }

  const abrirArquivo = async (a: ArquivoNota) => {
    setErro('')
    // abre a aba já no clique, senão o navegador bloqueia o pop-up
    const aba = window.open('', '_blank')
    if (!aba) {
      setErro('O navegador bloqueou a nova aba. Libere os pop-ups e tente de novo.')
      return
    }
    setAbrindo(a.path)
    try {
      const url = await linkDoArquivo(a.path)
      aba.opener = null
      aba.location.href = url
    } catch (e) {
      aba.close()
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o arquivo')
    } finally {
      setAbrindo(null)
    }
  }

  const excluir = async (n: NotaCompra) => {
    if (!window.confirm(`Excluir a nota ${n.numero}? Os arquivos anexados também serão apagados.`))
      return
    setExcluindo(n.id)
    setErro('')
    try {
      await excluirNota(n.id)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir a nota')
    } finally {
      setExcluindo(null)
    }
  }

  const copiarChave = async (n: NotaCompra) => {
    if (!n.chave) return
    try {
      await navigator.clipboard.writeText(n.chave)
      setCopiada(n.id)
      setTimeout(() => setCopiada((atual) => (atual === n.id ? null : atual)), 2000)
    } catch {
      setErro('Não foi possível copiar a chave.')
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Notas fiscais
        </p>
        {podeAdicionar && (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="flex items-center gap-1 text-xs font-semibold text-[#079C9C] hover:underline"
          >
            <Plus className="size-3.5" />
            Adicionar nota
          </button>
        )}
      </div>

      {erro && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"
        >
          {erro}
        </p>
      )}

      {notas === null ? (
        <p className="flex items-center gap-2 py-3 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Carregando notas...
        </p>
      ) : notas.length === 0 ? (
        pedido.status === 'recebido' ? (
          dispensada ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              <span>Marcado como compra sem nota fiscal.</span>
              <button
                type="button"
                onClick={alternarDispensa}
                disabled={dispensando}
                className="text-xs font-semibold text-[#079C9C] hover:underline disabled:opacity-50"
              >
                Desfazer
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Pedido recebido sem nota fiscal registrada.
              </span>
              <button
                type="button"
                onClick={alternarDispensa}
                disabled={dispensando}
                className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
              >
                {dispensando && <Loader2 className="size-3 animate-spin" />}
                Este pedido não tem nota
              </button>
            </div>
          )
        ) : (
          <p className="text-sm text-slate-500">Nenhuma nota registrada.</p>
        )
      ) : (
        <div className="space-y-3">
          {/* avisos */}
          {alertas.length > 0 && (
            <ul className="space-y-1.5">
              {alertas.map((a, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                    a.nivel === 'aviso'
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {a.nivel === 'aviso' ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  )}
                  {a.texto}
                </li>
              ))}
            </ul>
          )}

          {/* notas */}
          <ul className="space-y-2">
            {notas.map((n) => (
              <li key={n.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      NF {n.numero}
                      {n.serie != null ? ` · série ${n.serie}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {n.emissao ? `Emitida em ${dataCurta(n.emissao)}` : 'Sem data de emissão'}
                      {n.emitente_nome
                        ? ` · ${n.emitente_nome}`
                        : n.emitente_doc
                          ? ` · ${fmtDoc(n.emitente_doc)}`
                          : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-slate-900">{reais(n.valor)}</p>
                    <span className={`${chipClass} bg-slate-100 text-slate-600`}>
                      {ORIGEM[n.origem]}
                    </span>
                  </div>
                </div>

                {n.chave && (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-slate-500">
                      {formatarChave(n.chave)}
                    </p>
                    <button
                      type="button"
                      onClick={() => copiarChave(n)}
                      aria-label="Copiar chave de acesso"
                      title="Copiar chave"
                      className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      {copiada === n.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </button>
                  </div>
                )}

                {n.arquivos.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {n.arquivos.map((a) => (
                      <li key={a.path}>
                        <button
                          type="button"
                          onClick={() => abrirArquivo(a)}
                          disabled={abrindo === a.path}
                          className="flex max-w-[14rem] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-[#079C9C]/50 hover:text-[#079C9C] disabled:opacity-60"
                        >
                          {abrindo === a.path ? (
                            <Loader2 className="size-4 shrink-0 animate-spin" />
                          ) : (
                            <IconeArquivo tipo={a.tipo} />
                          )}
                          <span className="truncate">{a.nome}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-50" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {n.duplicatas.length > 0 && (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Vencimentos
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {n.duplicatas.map((d, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span>
                            {d.vencimento ? dataCurta(d.vencimento) : 'Sem data'}
                            {d.numero ? ` · parcela ${d.numero}` : ''}
                          </span>
                          <span className="font-medium">{reais(d.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {n.observacao?.trim() && (
                  <p className="mt-2 text-xs italic text-slate-500">{n.observacao.trim()}</p>
                )}

                <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <p className="text-[11px] text-slate-400">
                    Registrada{n.registrada_por ? ` por ${n.registrada_por}` : ''} em{' '}
                    {dataHora(n.criado_em)}
                  </p>
                  <button
                    type="button"
                    onClick={() => excluir(n)}
                    disabled={excluindo === n.id}
                    aria-label={`Excluir a nota ${n.numero}`}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {excluindo === n.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* conferência dos itens: só quando há XML */}
          {temXml && itens && <ConferenciaItens pedido={pedido} itens={itens} notas={notas} />}
        </div>
      )}

      <NotaCompraDialog
        pedido={{ id: pedido.id, numero: pedido.numero, fornecedor_nome: pedido.fornecedor_nome }}
        aberto={adicionando}
        onClose={() => setAdicionando(false)}
        onSalvo={() => {
          setAdicionando(false)
          carregar()
        }}
      />
    </div>
  )
}