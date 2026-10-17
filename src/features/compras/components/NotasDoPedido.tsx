'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
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
import { dataCurta, dataHora, numeroTexto, reais } from '@/features/loja/lib/formatar'
import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import {
  barcodesDosCodigos,
  documentoDoFornecedor,
  excluirNota,
  linkDoArquivo,
  listarNotas,
  type ArquivoNota,
  type NotaCompra,
} from '../services/notasService'
import { alertasDasNotas, conferirItens } from '../lib/conferenciaNota'
import { formatarChave } from '../lib/nfe'
import NotaCompraDialog from './NotaCompraDialog'

const ORIGEM = { manual: 'Digitada', chave: 'Pela chave', xml: 'XML' } as const

const fmtDoc = (d: string) => (d.length <= 11 ? formatarCpf(d) : formatarCnpj(d))

// preço da nota pode ter até 4 casas
const reais4 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

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
  const [barcodes, setBarcodes] = useState<Map<string, string>>(new Map())
  const [conferenciaAberta, setConferenciaAberta] = useState(false)

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

  const temXml = !!notas?.some((n) => n.itens.length > 0)

  // código de barras dos produtos do pedido, para ligar com os itens do XML
  const codigosTexto = (itens ?? []).map((i) => i.produto_codigo ?? '').filter(Boolean).join('\u0000')
  useEffect(() => {
    if (!temXml || !codigosTexto) return
    let cancelado = false
    barcodesDosCodigos(codigosTexto.split('\u0000')).then((m) => {
      if (!cancelado) setBarcodes(m)
    })
    return () => {
      cancelado = true
    }
  }, [temXml, codigosTexto])

  const alertas = useMemo(
    () => (itens && notas ? alertasDasNotas(pedido, itens, notas, docFornecedor) : []),
    [pedido, itens, notas, docFornecedor]
  )

  const conferencia = useMemo(
    () => (itens && notas && temXml ? conferirItens(itens, notas, barcodes) : null),
    [itens, notas, temXml, barcodes]
  )

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
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Pedido recebido sem nota fiscal registrada.
          </p>
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
          {conferencia && (
            <div className="rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setConferenciaAberta((v) => !v)}
                aria-expanded={conferenciaAberta}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-700">
                    Conferência dos itens
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {conferencia.precoDifere +
                      conferencia.qtdDifere +
                      conferencia.soNota +
                      conferencia.soPedido ===
                    0 ? (
                      <span className={`${chipClass} bg-emerald-50 text-emerald-700`}>
                        Tudo confere
                      </span>
                    ) : (
                      <>
                        {conferencia.precoDifere > 0 && (
                          <span className={`${chipClass} bg-red-50 text-red-700`}>
                            {conferencia.precoDifere} com preço diferente
                          </span>
                        )}
                        {conferencia.qtdDifere > 0 && (
                          <span className={`${chipClass} bg-amber-50 text-amber-700`}>
                            {conferencia.qtdDifere} com quantidade diferente
                          </span>
                        )}
                        {conferencia.soNota > 0 && (
                          <span className={`${chipClass} bg-amber-50 text-amber-700`}>
                            {conferencia.soNota} só na nota
                          </span>
                        )}
                        {conferencia.soPedido > 0 && (
                          <span className={`${chipClass} bg-amber-50 text-amber-700`}>
                            {conferencia.soPedido} não vieram na nota
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </span>
                <ChevronDown
                  className={`size-5 shrink-0 text-slate-400 transition ${
                    conferenciaAberta ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {conferenciaAberta && (
                <div className="space-y-2 border-t border-slate-100 p-3">
                  {conferencia.notasSemXml > 0 && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      {conferencia.notasSemXml}{' '}
                      {conferencia.notasSemXml === 1 ? 'nota sem XML não entra' : 'notas sem XML não entram'}{' '}
                      nesta conferência.
                    </p>
                  )}

                  <ul className="space-y-2">
                    {conferencia.linhas.map((l) => (
                      <li key={l.id} className="rounded-lg border border-slate-200 p-2.5">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                          {l.pedido?.produto_nome ?? l.nota?.nome}
                          {!l.pedido && (
                            <span className={`${chipClass} bg-amber-50 text-amber-700`}>
                              Só na nota
                            </span>
                          )}
                          {!l.nota && (
                            <span className={`${chipClass} bg-amber-50 text-amber-700`}>
                              Não veio na nota
                            </span>
                          )}
                          {l.como === 'parecido' && (
                            <span
                              title="Ligado ao item da nota pelo nome parecido"
                              className={`${chipClass} bg-slate-100 text-slate-600`}
                            >
                              Nome parecido
                            </span>
                          )}
                        </p>

                        <div className="mt-1.5 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                          <p>
                            <span className="font-semibold text-slate-500">Pedido: </span>
                            {l.pedido
                              ? `${numeroTexto(l.pedido.quantidade)}${l.pedido.unidade ? ` ${l.pedido.unidade}` : ''} × ${reais(l.pedido.preco_unitario)}`
                              : '—'}
                          </p>

                          <p>
                            <span className="font-semibold text-slate-500">Nota: </span>
                            {l.nota
                              ? `${numeroTexto(l.nota.quantidade)}${l.nota.unidade ? ` ${l.nota.unidade}` : ''} × ${reais4(l.nota.preco)}`
                              : '—'}
                            {l.difPreco !== null && (
                              <span
                                className={`ml-1.5 font-semibold ${
                                  l.difPreco > 0 ? 'text-red-600' : 'text-emerald-600'
                                }`}
                              >
                                {l.difPreco > 0 ? '+' : ''}
                                {String(l.difPreco).replace('.', ',')}%
                              </span>
                            )}
                            {l.difQtd !== null && (
                              <span className="ml-1.5 font-semibold text-amber-600">
                                qtd {l.difQtd > 0 ? '+' : ''}
                                {numeroTexto(l.difQtd)}
                              </span>
                            )}
                            {l.unidadeDiferente && (
                              <span className="ml-1.5 text-slate-400">
                                (unidade: {l.pedido?.unidade} × {l.nota?.unidade})
                              </span>
                            )}
                          </p>

                          <p>
                            <span className="font-semibold text-slate-500">Recebido: </span>
                            {l.pedido ? numeroTexto(l.pedido.quantidade_recebida) : '—'}
                            {l.recebidoDiferente && (
                              <span className="ml-1.5 font-semibold text-amber-600">
                                ≠ nota
                              </span>
                            )}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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