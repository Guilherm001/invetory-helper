'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Link2, Loader2, Unlink, X } from 'lucide-react'
import { numeroTexto, reais } from '@/features/loja/lib/formatar'
import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import {
  barcodesDosCodigos,
  desvincularItem,
  listarVinculos,
  vincularItem,
  type NotaCompra,
  type Vinculo,
} from '../services/notasService'
import { conferirItens, type LinhaConferencia } from '../lib/conferenciaNota'
import { chaveNota } from '../lib/casamento'
import { chaveItem } from '../lib/compras'
import type { ItemNota } from '../lib/nfe'

const chipClass = 'rounded-full px-2 py-0.5 text-[11px] font-semibold'

// preço da nota pode ter até 4 casas
const reais4 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

const acaoClass =
  'flex items-center gap-1 font-semibold text-[#079C9C] transition hover:underline disabled:opacity-50'

export default function ConferenciaItens({
  pedido,
  itens,
  notas,
}: {
  pedido: PedidoCompra
  itens: ItemPedidoCompra[]
  notas: NotaCompra[]
}) {
  const [aberta, setAberta] = useState(false)
  const [barcodes, setBarcodes] = useState<Map<string, string>>(new Map())
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [ligando, setLigando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  // código de barras dos produtos do pedido, para ligar com os itens do XML
  const codigosTexto = itens.map((i) => i.produto_codigo ?? '').filter(Boolean).join('\u0000')
  useEffect(() => {
    if (!codigosTexto) return
    let cancelado = false
    barcodesDosCodigos(codigosTexto.split('\u0000')).then((m) => {
      if (!cancelado) setBarcodes(m)
    })
    return () => {
      cancelado = true
    }
  }, [codigosTexto])

  const carregarVinculos = useCallback(async () => {
    try {
      setVinculos(await listarVinculos(pedido.id))
    } catch {
      // sem o SQL de vínculos a conferência funciona igual, só sem as ligações manuais
    }
  }, [pedido.id])

  useEffect(() => {
    carregarVinculos()
  }, [carregarVinculos])

  const mapaAlvo = useMemo(
    () => new Map(vinculos.map((v) => [v.nota_chave, v.alvo_chave] as const)),
    [vinculos]
  )
  const vinculoPorNota = useMemo(
    () => new Map(vinculos.map((v) => [v.nota_chave, v] as const)),
    [vinculos]
  )

  const conferencia = useMemo(
    () => conferirItens(itens, notas, barcodes, mapaAlvo),
    [itens, notas, barcodes, mapaAlvo]
  )

  // itens que ainda não foram reconhecidos com segurança: podem ser ligados à mão
  const livresPedido = conferencia.linhas
    .filter((x) => x.pedido && (!x.nota || x.como === 'parecido'))
    .map((x) => x.pedido as ItemPedidoCompra)
  const livresNota = conferencia.linhas
    .filter((x) => x.nota && (!x.pedido || x.como === 'parecido'))
    .map((x) => x.nota as ItemNota)

  const ligar = async (linha: LinhaConferencia, pedidoItem: ItemPedidoCompra, notaItem: ItemNota) => {
    setOcupado(linha.id)
    setErro('')
    try {
      await vincularItem({
        pedidoId: pedido.id,
        itemId: pedidoItem.id,
        alvoChave: chaveItem(pedidoItem.produto_codigo, pedidoItem.produto_nome),
        notaChave: chaveNota(notaItem),
        notaNome: notaItem.nome,
        notaCodigo: notaItem.codigo,
      })
      setLigando(null)
      await carregarVinculos()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ligar os itens')
    } finally {
      setOcupado(null)
    }
  }

  const desfazer = async (linha: LinhaConferencia, vinculo: Vinculo) => {
    setOcupado(linha.id)
    setErro('')
    try {
      await desvincularItem(vinculo.id)
      await carregarVinculos()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível desfazer a ligação')
    } finally {
      setOcupado(null)
    }
  }

  const problemas =
    conferencia.precoDifere + conferencia.qtdDifere + conferencia.soNota + conferencia.soPedido

  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-slate-700">Conferência dos itens</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {problemas === 0 ? (
              <span className={`${chipClass} bg-emerald-50 text-emerald-700`}>Tudo confere</span>
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
          className={`size-5 shrink-0 text-slate-400 transition ${aberta ? 'rotate-180' : ''}`}
        />
      </button>

      {aberta && (
        <div className="space-y-2 border-t border-slate-100 p-3">
          {conferencia.notasSemXml > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {conferencia.notasSemXml}{' '}
              {conferencia.notasSemXml === 1 ? 'nota sem XML não entra' : 'notas sem XML não entram'}{' '}
              nesta conferência.
            </p>
          )}

          {(conferencia.soNota > 0 || conferencia.soPedido > 0) && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              O sistema não reconheceu algum item? Ligue-o ao item certo: da próxima vez, com este
              fornecedor, ele já será reconhecido.
            </p>
          )}

          {erro && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {erro}
            </p>
          )}

          <ul className="space-y-2">
            {conferencia.linhas.map((l) => {
              const vinculo = l.como === 'manual' && l.notaChave ? vinculoPorNota.get(l.notaChave) : undefined
              const podeLigar = !l.nota || !l.pedido || l.como === 'parecido'
              const aberto = ligando === l.id
              const trabalhando = ocupado === l.id

              return (
                <li key={l.id} className="rounded-lg border border-slate-200 p-2.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                    {l.pedido?.produto_nome ?? l.nota?.nome}
                    {!l.pedido && (
                      <span className={`${chipClass} bg-amber-50 text-amber-700`}>Só na nota</span>
                    )}
                    {!l.nota && (
                      <span className={`${chipClass} bg-amber-50 text-amber-700`}>
                        Não veio na nota
                      </span>
                    )}
                    {l.como === 'manual' && (
                      <span
                        title="Você ligou este item à mão"
                        className={`${chipClass} bg-emerald-50 text-emerald-700`}
                      >
                        Ligado por você
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

                  {l.pedido && l.nota && l.pedido.produto_nome !== l.nota.nome && (
                    <p className="text-[11px] text-slate-400">Na nota: {l.nota.nome}</p>
                  )}

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
                        <span className="ml-1.5 font-semibold text-amber-600">≠ nota</span>
                      )}
                    </p>
                  </div>

                  {(vinculo || podeLigar) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {vinculo && (
                        <button
                          type="button"
                          disabled={trabalhando}
                          onClick={() => desfazer(l, vinculo)}
                          className={`${acaoClass} !text-slate-500`}
                        >
                          {trabalhando ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Unlink className="size-3.5" />
                          )}
                          Desfazer ligação
                        </button>
                      )}

                      {podeLigar && (
                        <button
                          type="button"
                          disabled={trabalhando}
                          onClick={() => setLigando(aberto ? null : l.id)}
                          className={acaoClass}
                        >
                          <Link2 className="size-3.5" />
                          {!l.pedido
                            ? 'Ligar a um item do pedido'
                            : !l.nota
                              ? 'Ligar a um item da nota'
                              : 'Trocar ligação'}
                        </button>
                      )}
                    </div>
                  )}

                  {aberto && (
                    <div className="mt-2 rounded-lg border border-[#079C9C]/30 bg-[#079C9C]/5 p-2">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-600">
                          {l.nota
                            ? `"${l.nota.nome}" (da nota) é qual item do pedido?`
                            : `"${l.pedido?.produto_nome}" (do pedido) é qual item da nota?`}
                        </p>
                        <button
                          type="button"
                          aria-label="Fechar"
                          onClick={() => setLigando(null)}
                          className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      {(l.nota ? livresPedido : livresNota).length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Não há outros itens para ligar neste pedido.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {l.nota
                            ? livresPedido.map((p) => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    disabled={trabalhando}
                                    onClick={() => ligar(l, p, l.nota as ItemNota)}
                                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-xs transition hover:border-[#079C9C] disabled:opacity-60"
                                  >
                                    <span className="block font-semibold text-slate-800">
                                      {p.produto_nome}
                                    </span>
                                    <span className="text-slate-500">
                                      {numeroTexto(p.quantidade)}
                                      {p.unidade ? ` ${p.unidade}` : ''} × {reais(p.preco_unitario)}
                                    </span>
                                  </button>
                                </li>
                              ))
                            : livresNota.map((n) => (
                                <li key={chaveNota(n)}>
                                  <button
                                    type="button"
                                    disabled={trabalhando}
                                    onClick={() => ligar(l, l.pedido as ItemPedidoCompra, n)}
                                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-xs transition hover:border-[#079C9C] disabled:opacity-60"
                                  >
                                    <span className="block font-semibold text-slate-800">
                                      {n.nome}
                                    </span>
                                    <span className="text-slate-500">
                                      {n.codigo ? `Cód. ${n.codigo} · ` : ''}
                                      {numeroTexto(n.quantidade)}
                                      {n.unidade ? ` ${n.unidade}` : ''} × {reais4(n.preco)}
                                    </span>
                                  </button>
                                </li>
                              ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}