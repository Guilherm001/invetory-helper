'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  ChevronDown,
  Link2,
  Loader2,
  Pencil,
  Sparkles,
  Unlink,
} from 'lucide-react'
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
import { calcularAjustes, conferirItens } from '../lib/conferenciaNota'
import { chaveNota } from '../lib/casamento'
import { chaveItem } from '../lib/compras'
import type { ItemNota } from '../lib/nfe'
import AjustarPedidoDialog from './AjustarPedidoDialog'

const arred2 = (n: number) => Math.round(n * 100) / 100

// preço da nota pode ter até 4 casas
const reais4 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

const qp = (q: number, un: string | null, preco: number) =>
  `${numeroTexto(q)}${un ? ` ${un}` : ''} × ${reais4(preco)}`

// cores fixas: pedido = cinza, nota fiscal = verde, recebido = branco
type Tipo = 'pedido' | 'nota' | 'recebido'

const ESTILO: Record<Tipo, string> = {
  pedido: 'border-slate-300 bg-slate-50',
  nota: 'border-[#079C9C]/40 bg-[#079C9C]/5',
  recebido: 'border-slate-200 bg-white',
}

const ROTULO: Record<Tipo, { texto: string; classe: string }> = {
  pedido: { texto: 'Pedido', classe: 'bg-slate-200 text-slate-700' },
  nota: { texto: 'Nota fiscal', classe: 'bg-[#079C9C]/15 text-[#047a7a]' },
  recebido: { texto: 'Recebido', classe: 'bg-slate-100 text-slate-500' },
}

function Rotulo({ tipo }: { tipo: Tipo }) {
  const r = ROTULO[tipo]
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${r.classe}`}
    >
      {r.texto}
    </span>
  )
}

function Lado({ tipo, children }: { tipo: Tipo; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-2 ${ESTILO[tipo]}`}>
      <Rotulo tipo={tipo} />
      <div className="mt-1">{children}</div>
    </div>
  )
}

const chip = 'rounded-full px-2 py-0.5 text-[11px] font-semibold'
const acaoClass =
  'flex items-center gap-1 text-xs font-semibold text-[#079C9C] transition hover:underline disabled:opacity-50'

export default function ConferenciaItens({
  pedido,
  itens,
  notas,
  onAjustado,
}: {
  pedido: PedidoCompra
  itens: ItemPedidoCompra[]
  notas: NotaCompra[]
  onAjustado: (aviso: string) => void
}) {
  const [aberta, setAberta] = useState(false)
  const [barcodes, setBarcodes] = useState<Map<string, string>>(new Map())
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [selP, setSelP] = useState<string | null>(null) // id do item do pedido
  const [selN, setSelN] = useState<string | null>(null) // chave do item da nota
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [ajustando, setAjustando] = useState(false)

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

  const c = useMemo(
    () => conferirItens(itens, notas, barcodes, mapaAlvo),
    [itens, notas, barcodes, mapaAlvo]
  )

  const ajustes = useMemo(() => calcularAjustes(c.pares), [c.pares])
  const totalNotas = arred2(notas.reduce((s, n) => s + n.valor, 0))
  const semPar = c.soPedido.length + c.soNota.length
  const problemas = c.precoDifere + c.qtdDifere + semPar

  // só dá para fechar o total com a nota se tudo tem par dos dois lados
  const podeFecharTotal = semPar === 0 && c.notasSemXml === 0 && c.pares.length > 0
  const podeAjustar = ['enviado', 'confirmado', 'recebido'].includes(pedido.status)

  const pedidoSel = c.soPedido.find((p) => p.id === selP) ?? null
  const notaSel = c.soNota.find((n) => chaveNota(n) === selN) ?? null

  const ligar = async (p: ItemPedidoCompra, n: ItemNota, marca: string) => {
    setOcupado(marca)
    setErro('')
    try {
      await vincularItem({
        pedidoId: pedido.id,
        itemId: p.id,
        alvoChave: chaveItem(p.produto_codigo, p.produto_nome),
        notaChave: chaveNota(n),
        notaNome: n.nome,
        notaCodigo: n.codigo,
      })
      setSelP(null)
      setSelN(null)
      await carregarVinculos()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ligar os itens')
    } finally {
      setOcupado(null)
    }
  }

  const desfazer = async (vinculo: Vinculo, marca: string) => {
    setOcupado(marca)
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
              <span className={`${chip} bg-emerald-50 text-emerald-700`}>Tudo confere</span>
            ) : (
              <>
                {c.precoDifere > 0 && (
                  <span className={`${chip} bg-red-50 text-red-700`}>
                    {c.precoDifere} com preço diferente
                  </span>
                )}
                {c.qtdDifere > 0 && (
                  <span className={`${chip} bg-amber-50 text-amber-700`}>
                    {c.qtdDifere} com quantidade diferente
                  </span>
                )}
                {semPar > 0 && (
                  <span className={`${chip} bg-amber-50 text-amber-700`}>{semPar} sem par</span>
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
        <div className="space-y-4 border-t border-slate-100 p-3">
          {c.notasSemXml > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {c.notasSemXml}{' '}
              {c.notasSemXml === 1 ? 'nota sem XML não entra' : 'notas sem XML não entram'} nesta
              conferência.
            </p>
          )}

          {erro && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {erro}
            </p>
          )}

          {/* ajustar o pedido pela nota */}
          {ajustes.length > 0 && podeAjustar && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#079C9C]/40 bg-[#079C9C]/5 px-3 py-2.5">
              <p className="text-sm text-slate-700">
                A nota tem preço ou quantidade diferente do pedido em{' '}
                <strong>{ajustes.length}</strong> {ajustes.length === 1 ? 'item' : 'itens'}.
              </p>
              <button
                type="button"
                onClick={() => setAjustando(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#079C9C] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95"
              >
                <Pencil className="size-4" />
                Ajustar o pedido pela nota
              </button>
            </div>
          )}

          {/* itens reconhecidos */}
          {c.pares.length > 0 && (
            <section className="space-y-2">
              <h5 className="text-sm font-semibold text-slate-800">
                Itens reconhecidos ({c.pares.length})
              </h5>

              <ul className="space-y-2">
                {c.pares.map((l) => {
                  const vinculo = l.como === 'manual' ? vinculoPorNota.get(l.notaChave) : undefined
                  return (
                    <li key={l.id} className="rounded-xl border border-slate-200 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {l.pedido.produto_nome}
                        </p>
                        {l.como === 'manual' && (
                          <span
                            title="Você ligou este item à mão"
                            className={`${chip} bg-emerald-50 text-emerald-700`}
                          >
                            Ligado por você
                          </span>
                        )}
                        {l.difPreco !== null && (
                          <span
                            className={`${chip} ${
                              l.difPreco > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            preço {l.difPreco > 0 ? '+' : ''}
                            {String(l.difPreco).replace('.', ',')}%
                          </span>
                        )}
                        {l.difQtd !== null && (
                          <span className={`${chip} bg-amber-50 text-amber-700`}>
                            quantidade {l.difQtd > 0 ? '+' : ''}
                            {numeroTexto(l.difQtd)}
                          </span>
                        )}
                        {l.unidadeDiferente && (
                          <span className={`${chip} bg-slate-100 text-slate-600`}>
                            unidade {l.pedido.unidade} × {l.nota.unidade}
                          </span>
                        )}
                      </div>

                      {l.nota.nome !== l.pedido.produto_nome && (
                        <p className="mt-0.5 text-[11px] text-slate-400">Na nota: {l.nota.nome}</p>
                      )}

                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <Lado tipo="pedido">
                          <p className="text-sm font-semibold text-slate-800">
                            {qp(l.pedido.quantidade, l.pedido.unidade, l.pedido.preco_unitario)}
                          </p>
                          <p className="text-xs text-slate-500">Total {reais(l.pedido.subtotal)}</p>
                        </Lado>

                        <Lado tipo="nota">
                          <p className="text-sm font-semibold text-slate-800">
                            {qp(l.nota.quantidade, l.nota.unidade, l.nota.preco)}
                          </p>
                          <p className="text-xs text-slate-500">Total {reais(l.nota.subtotal)}</p>
                        </Lado>

                        <Lado tipo="recebido">
                          <p className="text-sm font-semibold text-slate-800">
                            {numeroTexto(l.pedido.quantidade_recebida)}
                            {l.pedido.unidade ? ` ${l.pedido.unidade}` : ''}
                          </p>
                          {l.recebidoDiferente && (
                            <p className="text-xs font-semibold text-amber-600">
                              diferente da nota
                            </p>
                          )}
                        </Lado>
                      </div>

                      {vinculo && (
                        <button
                          type="button"
                          disabled={ocupado === l.id}
                          onClick={() => desfazer(vinculo, l.id)}
                          className={`${acaoClass} mt-2 !text-slate-500`}
                        >
                          {ocupado === l.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Unlink className="size-3.5" />
                          )}
                          Desfazer ligação
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* itens sem par */}
          {semPar > 0 && (
            <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
              <div>
                <h5 className="text-sm font-semibold text-slate-800">Itens sem par ({semPar})</h5>
                <p className="text-xs text-slate-500">
                  O sistema não reconheceu estes itens. Ligue o item do pedido ao item da nota que
                  é o mesmo produto: da próxima vez, com este fornecedor, ele já será reconhecido.
                </p>
              </div>

              {/* prováveis pares */}
              {c.sugestoes.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-[#079C9C]">
                    <Sparkles className="size-3.5" />
                    Prováveis pares ({c.sugestoes.length})
                  </p>
                  <ul className="space-y-2">
                    {c.sugestoes.map((s) => {
                      const marca = `s:${s.pedido.id}`
                      return (
                        <li
                          key={marca}
                          className="rounded-xl border border-[#079C9C]/30 bg-white p-2.5"
                        >
                          <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                            <Lado tipo="pedido">
                              <p className="text-sm font-semibold text-slate-900">
                                {s.pedido.produto_nome}
                              </p>
                              <p className="text-xs text-slate-600">
                                {qp(s.pedido.quantidade, s.pedido.unidade, s.pedido.preco_unitario)}{' '}
                                · total {reais(s.pedido.subtotal)}
                              </p>
                            </Lado>

                            <ArrowLeftRight className="mx-auto size-4 rotate-90 text-slate-400 md:rotate-0" />

                            <Lado tipo="nota">
                              <p className="text-sm font-semibold text-slate-900">{s.nota.nome}</p>
                              <p className="text-xs text-slate-600">
                                {qp(s.nota.quantidade, s.nota.unidade, s.nota.preco)} · total{' '}
                                {reais(s.nota.subtotal)}
                              </p>
                            </Lado>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] text-slate-500">
                              Motivo: {s.motivos.join(' · ')}
                            </p>
                            <button
                              type="button"
                              disabled={ocupado !== null}
                              onClick={() => ligar(s.pedido, s.nota, marca)}
                              className="flex items-center gap-1.5 rounded-lg border border-[#079C9C] px-3 py-1.5 text-xs font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 active:scale-95 disabled:opacity-50"
                            >
                              {ocupado === marca ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Link2 className="size-3.5" />
                              )}
                              Ligar
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* duas colunas: escolha um de cada lado */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Rotulo tipo="pedido" />
                    <span className="text-xs text-slate-500">
                      só no pedido ({c.soPedido.length})
                    </span>
                  </div>
                  {c.soPedido.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {c.soPedido.map((p) => {
                        const ativo = selP === p.id
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              aria-pressed={ativo}
                              onClick={() => setSelP(ativo ? null : p.id)}
                              className={`w-full rounded-lg border p-2 text-left transition ${ESTILO.pedido} ${
                                ativo ? 'ring-2 ring-[#079C9C]' : 'hover:border-slate-400'
                              }`}
                            >
                              <span className="block text-sm font-semibold text-slate-900">
                                {p.produto_nome}
                              </span>
                              <span className="block text-xs text-slate-600">
                                {qp(p.quantidade, p.unidade, p.preco_unitario)} · total{' '}
                                {reais(p.subtotal)}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Rotulo tipo="nota" />
                    <span className="text-xs text-slate-500">só na nota ({c.soNota.length})</span>
                  </div>
                  {c.soNota.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {c.soNota.map((n) => {
                        const chave = chaveNota(n)
                        const ativo = selN === chave
                        return (
                          <li key={chave}>
                            <button
                              type="button"
                              aria-pressed={ativo}
                              onClick={() => setSelN(ativo ? null : chave)}
                              className={`w-full rounded-lg border p-2 text-left transition ${ESTILO.nota} ${
                                ativo ? 'ring-2 ring-[#079C9C]' : 'hover:border-[#079C9C]'
                              }`}
                            >
                              <span className="block text-sm font-semibold text-slate-900">
                                {n.nome}
                              </span>
                              <span className="block text-xs text-slate-600">
                                {n.codigo ? `Cód. ${n.codigo} · ` : ''}
                                {qp(n.quantidade, n.unidade, n.preco)} · total {reais(n.subtotal)}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {pedidoSel && notaSel && (
                <div className="space-y-2 rounded-lg border border-[#079C9C] bg-white p-3">
                  <p className="text-xs font-semibold text-slate-600">Ligar estes dois itens?</p>
                  <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <Lado tipo="pedido">
                      <p className="text-sm font-semibold text-slate-900">
                        {pedidoSel.produto_nome}
                      </p>
                    </Lado>
                    <ArrowLeftRight className="mx-auto size-4 rotate-90 text-slate-400 md:rotate-0" />
                    <Lado tipo="nota">
                      <p className="text-sm font-semibold text-slate-900">{notaSel.nome}</p>
                    </Lado>
                  </div>
                  <button
                    type="button"
                    disabled={ocupado !== null}
                    onClick={() => ligar(pedidoSel, notaSel, 'manual')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#079C9C] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95 disabled:opacity-60"
                  >
                    {ocupado === 'manual' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Link2 className="size-4" />
                    )}
                    Ligar estes dois
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <AjustarPedidoDialog
        aberto={ajustando}
        pedido={pedido}
        itens={itens}
        ajustes={ajustes}
        podeFecharTotal={podeFecharTotal}
        totalNotas={totalNotas}
        onClose={() => setAjustando(false)}
        onAplicado={(aviso) => {
          setAjustando(false)
          onAjustado(aviso)
        }}
      />
    </div>
  )
}