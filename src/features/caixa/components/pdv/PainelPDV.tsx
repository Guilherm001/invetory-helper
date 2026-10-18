'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  Clock,
  CreditCard,
  Loader2,
  QrCode,
  Tag,
  UserPlus,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { DocumentoResumo, ItemDocumento } from '@/features/loja/services/documentosService'
import SeletorCliente from '@/features/clientes/components/SeletorCliente'
import { fecharPedido, pedidoDoCaixa } from '../../services/caixaService'
import type { ResultadoFechamento } from '../../types'
import { useClienteCaixa } from '../../hooks/useClienteCaixa'
import {
  arredonda,
  calcularDesconto,
  paraNumero,
  resolverPagamentos,
  valorParcela,
  type Forma,
  type LinhaPagamento,
  type TipoDesconto,
} from '../../lib/calculos'
import { numeroTexto, reais, virgula } from '../../lib/formatar'

const MAX_FORMAS = 2

interface Lancado {
  forma: Forma
  valor: number
  recebido: number | null
  parcelas: number | null
}

interface Rascunho {
  forma: Forma
  valor: string
  recebido: string
  parcelas: string
}

const FORMAS: { id: Forma; rotulo: string; tecla: string; icone: LucideIcon }[] = [
  { id: 'dinheiro', rotulo: 'Dinheiro', tecla: '1', icone: Banknote },
  { id: 'pix', rotulo: 'PIX', tecla: '2', icone: QrCode },
  { id: 'debito', rotulo: 'Débito', tecla: '3', icone: CreditCard },
  { id: 'credito', rotulo: 'Crédito', tecla: '4', icone: CreditCard },
  { id: 'credito_cliente', rotulo: 'Créd. cliente', tecla: '5', icone: Wallet },
  { id: 'pendencia', rotulo: 'A prazo', tecla: '6', icone: Clock },
]

const rotuloForma = (l: { forma: Forma; parcelas: number | null }) => {
  const nome = FORMAS.find((f) => f.id === l.forma)?.rotulo ?? l.forma
  return l.forma === 'credito' && (l.parcelas ?? 1) > 1 ? `${nome} ${l.parcelas}x` : nome
}

const paraLinha = (l: Lancado): LinhaPagamento => ({
  forma: l.forma,
  valor: virgula(l.valor),
  recebido: l.recebido === null ? '' : virgula(l.recebido),
  parcelas: l.parcelas ?? 1,
})

function dataDaqui(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

const campoClass =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-right font-mono text-xl tabular-nums text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500'

const rotuloClass = 'text-[11px] uppercase tracking-wider text-slate-500'

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-slate-600 px-1.5 py-px font-mono text-[10px] text-slate-400">
      {children}
    </span>
  )
}

export default function PainelPDV({
  pedidoId,
  onVoltar,
  onFechado,
}: {
  pedidoId: string
  onVoltar: () => void
  onFechado: (r: ResultadoFechamento) => void
}) {
  const [dados, setDados] = useState<{ doc: DocumentoResumo; itens: ItemDocumento[] } | null>(null)
  const [erroCarga, setErroCarga] = useState('')

  const [descAberto, setDescAberto] = useState(false)
  const [tipoDesc, setTipoDesc] = useState<TipoDesconto>('percentual')
  const [descTxt, setDescTxt] = useState('')

  const [lancados, setLancados] = useState<Lancado[]>([])
  const [rasc, setRasc] = useState<Rascunho | null>(null)

  const [vinculando, setVinculando] = useState(false)
  const [fechando, setFechando] = useState(false)
  const [erro, setErro] = useState('')

  const raiz = useRef<HTMLDivElement>(null)
  const valorRef = useRef<HTMLInputElement>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelado = false
    pedidoDoCaixa(pedidoId)
      .then((d) => {
        if (!cancelado) setDados(d)
      })
      .catch((e) => {
        if (!cancelado) setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar o pedido')
      })
    return () => {
      cancelado = true
    }
  }, [pedidoId])

  // o teclado funciona assim que o pedido abre, sem precisar clicar
  useEffect(() => {
    raiz.current?.focus()
  }, [])

  const docCliente =
    (dados?.doc as unknown as { cliente_id?: string | null } | undefined)?.cliente_id ?? null
  const cli = useClienteCaixa(docCliente)

  const total = dados?.doc.total ?? 0
  const desc = calcularDesconto(total, tipoDesc, descTxt)
  const liquido = arredonda(total - desc.desconto)
  const pago = arredonda(lancados.reduce((s, l) => s + l.valor, 0))
  const falta = arredonda(liquido - pago)
  const trocoTotal = arredonda(
    lancados.reduce((s, l) => s + (l.recebido !== null ? arredonda(l.recebido - l.valor) : 0), 0)
  )
  const limites = { credito_cliente: cli.credito, pendencia: cli.pendDisp }

  const formaRasc = rasc?.forma ?? null
  const prontoParaFechar =
    !!dados && !formaRasc && (liquido === 0 || (falta === 0 && lancados.length > 0))
  const podeFechar = prontoParaFechar && !desc.erro && !fechando

  // abriu um lançamento: o cursor vai para o valor | cobriu o total: vai para o botão de fechar
  useEffect(() => {
    if (formaRasc) {
      valorRef.current?.focus()
      valorRef.current?.select()
    }
  }, [formaRasc])

  useEffect(() => {
    if (prontoParaFechar) fecharRef.current?.focus()
  }, [prontoParaFechar])

  // mudou o desconto: os pagamentos já lançados deixam de valer
  const mudarDesconto = (novo: string) => {
    setDescTxt(novo)
    setLancados([])
    setRasc(null)
    setErro('')
  }

  const mudarTipoDesconto = (novo: TipoDesconto) => {
    setTipoDesc(novo)
    setLancados([])
    setRasc(null)
    setErro('')
  }

  const escolherForma = (forma: Forma) => {
    if (!dados || liquido <= 0 || falta <= 0) return
    if (lancados.length >= MAX_FORMAS) {
      setErro(`No máximo ${MAX_FORMAS} formas de pagamento.`)
      return
    }
    const bloqueio =
      forma === 'credito_cliente' ? cli.motivoCredito : forma === 'pendencia' ? cli.motivoPendencia : null
    if (bloqueio) {
      setErro(`${FORMAS.find((f) => f.id === forma)?.rotulo}: ${bloqueio.toLowerCase()}.`)
      return
    }
    setErro('')
    setRasc({ forma, valor: virgula(falta), recebido: '', parcelas: '1' })
  }

  const lancar = () => {
    if (!rasc) return
    setErro('')

    const v = paraNumero(rasc.valor)
    if (!Number.isFinite(v) || v <= 0) return setErro('Informe o valor.')
    const valor = arredonda(v)
    if (valor > falta + 0.0001) return setErro(`O valor passa do que falta (${reais(falta)}).`)
    if (lancados.length + 1 >= MAX_FORMAS && valor < falta - 0.0001)
      return setErro(`A última forma precisa cobrir o que falta (${reais(falta)}).`)

    const linha: LinhaPagamento = {
      forma: rasc.forma,
      valor: rasc.valor,
      recebido: rasc.recebido,
      parcelas: Number(rasc.parcelas) || 1,
    }
    // confere só esta linha (o total é o que já foi lançado mais este valor)
    const r = resolverPagamentos(arredonda(pago + valor), [...lancados.map(paraLinha), linha], limites)
    if (r.erro) return setErro(r.erro)

    const novo = r.pagamentos[r.pagamentos.length - 1]
    setLancados((prev) => [
      ...prev,
      { forma: novo.forma, valor: novo.valor, recebido: novo.recebido, parcelas: novo.parcelas },
    ])
    setRasc(null)
    raiz.current?.focus()
  }

  const usarCredito = () => {
    if (cli.credito <= 0 || falta <= 0) return
    if (lancados.length >= MAX_FORMAS) return setErro(`No máximo ${MAX_FORMAS} formas de pagamento.`)
    const usar = arredonda(Math.min(cli.credito, falta))
    setErro('')
    setLancados((prev) => [...prev, { forma: 'credito_cliente', valor: usar, recebido: null, parcelas: null }])
  }

  const fechar = async () => {
    if (!dados || !podeFechar) return
    setFechando(true)
    setErro('')
    try {
      const r = await fecharPedido(
        dados.doc.id,
        dados.doc.total,
        { tipo: tipoDesc, valor: descTxt.trim() === '' ? 0 : paraNumero(descTxt) || 0 },
        liquido === 0
          ? []
          : lancados.map((l) => ({
              forma: l.forma,
              valor: l.valor,
              recebido: l.recebido,
              parcelas: l.parcelas,
            })),
        cli.clienteId
      )
      onFechado(r)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível fechar o pedido')
      setFechando(false)
    }
  }

  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // teclas de janelas abertas por cima (portais) não são deste painel
    if (!raiz.current?.contains(e.target as Node)) return
    const alvo = e.target as HTMLElement
    const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)

    if (e.key === 'Escape') {
      e.preventDefault()
      if (rasc) {
        setRasc(null)
        raiz.current?.focus()
      } else if (alvo.id === 'pdv-desconto') {
        raiz.current?.focus()
      } else {
        onVoltar()
      }
      return
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      fechar()
      return
    }

    if (digitando || e.ctrlKey || e.metaKey || e.altKey) return

    const forma = FORMAS.find((f) => f.tecla === e.key)
    if (forma) {
      e.preventDefault()
      escolherForma(forma.id)
      return
    }
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault()
      setDescAberto(true)
    }
  }

  const dica = rasc
    ? 'Enter lança · Esc cancela'
    : podeFechar
      ? 'Enter fecha o pedido'
      : falta > 0
        ? 'Tecle 1 a 6 para escolher a forma de pagamento'
        : ''

  return (
    <div ref={raiz} tabIndex={-1} onKeyDown={aoTeclar} className="flex min-h-0 flex-col outline-none">
      {erroCarga ? (
        <div className="space-y-3">
          <button type="button" onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-slate-400 lg:hidden">
            <ArrowLeft className="size-4" /> Voltar
          </button>
          <p className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">{erroCarga}</p>
        </div>
      ) : !dados ? (
        <p className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando pedido...
        </p>
      ) : (
        <>
          <div className="space-y-4 pb-4">
            <button
              type="button"
              onClick={onVoltar}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-400 lg:hidden"
            >
              <ArrowLeft className="size-4" /> Voltar para a lista
            </button>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={rotuloClass}>Pedido</p>
                <p className="truncate text-2xl font-bold text-slate-100">
                  <span className="font-mono tabular-nums text-emerald-400">Nº {dados.doc.numero}</span>
                  <span className="ml-3">{dados.doc.cliente_nome || 'Cliente não informado'}</span>
                </p>
                <p className="text-sm text-slate-400">
                  {dados.doc.tipo === 'entrega' ? 'Entrega' : 'Retirada na loja'}
                  {dados.doc.cliente_telefone ? ` · ${dados.doc.cliente_telefone}` : ''}
                  {dados.doc.vendedor_nome ? ` · vendedor ${dados.doc.vendedor_nome}` : ''}
                </p>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 lg:flex">
                <Kbd>Esc</Kbd> voltar
              </span>
            </div>

            <details className="rounded-md border border-slate-800 bg-slate-900">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm text-slate-300">
                {dados.itens.length} {dados.itens.length === 1 ? 'item' : 'itens'} · ver produtos
              </summary>
              <ul className="divide-y divide-slate-800 border-t border-slate-800">
                {dados.itens.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-1.5 text-sm">
                    <span className="min-w-0 text-slate-300">
                      <strong className="font-mono tabular-nums text-slate-100">
                        {numeroTexto(i.quantidade)}
                        {i.unidade ? ` ${i.unidade}` : ''}
                      </strong>{' '}
                      {i.produto_nome}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-slate-200">{reais(i.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </details>

            {/* cliente (cartão claro, porque o seletor é claro) */}
            <div className="space-y-2 rounded-md bg-slate-100 p-3 text-slate-900">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Cliente cadastrado</p>
                {!cli.clienteId && !vinculando && (
                  <button
                    type="button"
                    onClick={() => setVinculando(true)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    <UserPlus className="size-4" />
                    Vincular
                  </button>
                )}
              </div>

              {cli.clienteId ? (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">
                      {cli.info?.nome ?? cli.escolhido?.nome ?? dados.doc.cliente_nome ?? 'Cliente'}
                    </p>
                    {docCliente === null && (
                      <button
                        type="button"
                        aria-label="Tirar o cliente"
                        onClick={() => {
                          cli.setEscolhido(null)
                          setLancados((prev) =>
                            prev.filter((l) => l.forma !== 'credito_cliente' && l.forma !== 'pendencia')
                          )
                        }}
                        className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  {cli.carregando ? (
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="size-3 animate-spin" />
                      Carregando saldos...
                    </p>
                  ) : cli.erro ? (
                    <p className="text-xs text-red-600">{cli.erro}</p>
                  ) : cli.info ? (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                        Crédito {reais(cli.info.credito)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-semibold ${
                          cli.info.devendo > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        Deve {reais(cli.info.devendo)}
                      </span>
                      {cli.info.vencido > 0 && (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-semibold text-red-700">
                          Vencido {reais(cli.info.vencido)}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {cli.credito > 0 && falta > 0 && !lancados.some((l) => l.forma === 'credito_cliente') && (
                    <button
                      type="button"
                      onClick={usarCredito}
                      className="flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <Wallet className="size-4" />
                      Usar crédito de {reais(Math.min(cli.credito, falta))}
                    </button>
                  )}
                </div>
              ) : vinculando ? (
                <div className="space-y-2">
                  <SeletorCliente
                    vinculo={null}
                    carregando={false}
                    onEscolher={(c) => {
                      cli.setEscolhido(c)
                      setVinculando(false)
                    }}
                    onLimpar={() => cli.setEscolhido(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setVinculando(false)}
                    className="text-sm text-slate-500 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {dados.doc.cliente_nome ? `${dados.doc.cliente_nome} não tem cadastro.` : 'Sem cliente cadastrado.'}{' '}
                  Para usar crédito ou vender a prazo, vincule um cliente.
                </p>
              )}
            </div>

            {/* totais */}
            <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{reais(total)}</span>
              </div>

              {!descAberto && desc.desconto === 0 ? (
                <button
                  type="button"
                  onClick={() => setDescAberto(true)}
                  className="flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:underline"
                >
                  <Tag className="size-4" />
                  Desconto <Kbd>D</Kbd>
                </button>
              ) : (
                <div className="space-y-2 rounded-md bg-slate-950 p-2.5">
                  <div className="flex items-center gap-2">
                    <div role="radiogroup" aria-label="Tipo de desconto" className="flex overflow-hidden rounded-md border border-slate-700">
                      {(
                        [
                          ['percentual', '%'],
                          ['valor', 'R$'],
                        ] as [TipoDesconto, string][]
                      ).map(([id, nome]) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={tipoDesc === id}
                          onClick={() => mudarTipoDesconto(id)}
                          className={`px-3 py-2 text-sm font-semibold ${
                            tipoDesc === id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {nome}
                        </button>
                      ))}
                    </div>
                    <input
                      id="pdv-desconto"
                      value={descTxt}
                      onChange={(e) => mudarDesconto(e.target.value)}
                      inputMode="decimal"
                      autoFocus={descAberto && descTxt === ''}
                      placeholder={tipoDesc === 'percentual' ? 'Ex: 5' : 'Ex: 20,00'}
                      aria-label="Valor do desconto"
                      className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-right font-mono text-lg tabular-nums text-slate-100 outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      aria-label="Remover desconto"
                      onClick={() => {
                        mudarDesconto('')
                        setDescAberto(false)
                      }}
                      className="rounded p-2 text-slate-500 hover:text-red-400"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {tipoDesc === 'percentual' && (
                    <div className="flex gap-2">
                      {['5', '10'].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => mudarDesconto(n)}
                          className="rounded-full border border-slate-700 px-3 py-0.5 text-sm text-slate-300 hover:border-emerald-500 hover:text-emerald-400"
                        >
                          {n}%
                        </button>
                      ))}
                    </div>
                  )}

                  {desc.erro && <p className="text-sm text-red-400">{desc.erro}</p>}
                </div>
              )}

              {desc.desconto > 0 && (
                <div className="flex items-center justify-between text-sm text-emerald-400">
                  <span>Desconto{desc.percentual !== null ? ` (${virgula(desc.percentual)}%)` : ''}</span>
                  <span className="font-mono tabular-nums">- {reais(desc.desconto)}</span>
                </div>
              )}

              <div className="flex items-end justify-between border-t border-slate-800 pt-3">
                <span className={rotuloClass}>Total a pagar</span>
                <span className="font-mono text-4xl font-bold tabular-nums text-emerald-400 md:text-5xl">
                  {reais(liquido)}
                </span>
              </div>
            </div>

            {/* pagamento */}
            {liquido > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
                  {FORMAS.map(({ id, rotulo, tecla, icone: Icone }) => {
                    const bloqueio =
                      id === 'credito_cliente' ? cli.motivoCredito : id === 'pendencia' ? cli.motivoPendencia : null
                    const ativoBtn = formaRasc === id
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={ativoBtn}
                        disabled={!!bloqueio || falta <= 0}
                        onClick={() => escolherForma(id)}
                        className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:border-dashed disabled:border-slate-800 disabled:text-slate-600 ${
                          ativoBtn
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                            : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 focus-visible:border-emerald-500'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Kbd>{tecla}</Kbd>
                          <Icone className="size-4" />
                        </span>
                        {rotulo}
                        {bloqueio && <span className="text-[10px] font-normal leading-tight">{bloqueio}</span>}
                      </button>
                    )
                  })}
                </div>

                {/* lançamento em andamento */}
                {rasc && (
                  <div className="space-y-3 rounded-md border border-emerald-600/60 bg-slate-950 p-3">
                    <p className={rotuloClass}>
                      Lançando · <span className="text-emerald-400">{rotuloForma({ forma: rasc.forma, parcelas: null })}</span>
                    </p>

                    <div className="flex flex-wrap items-end gap-3">
                      <label className="min-w-36 flex-1 space-y-1">
                        <span className={rotuloClass}>Valor (R$)</span>
                        <input
                          ref={valorRef}
                          value={rasc.valor}
                          onChange={(e) => setRasc({ ...rasc, valor: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              lancar()
                            }
                          }}
                          inputMode="decimal"
                          className={campoClass}
                        />
                      </label>

                      {rasc.forma === 'dinheiro' && (
                        <label className="min-w-36 flex-1 space-y-1">
                          <span className={rotuloClass}>Cliente deu (R$)</span>
                          <input
                            value={rasc.recebido}
                            onChange={(e) => setRasc({ ...rasc, recebido: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                lancar()
                              }
                            }}
                            inputMode="decimal"
                            placeholder="exato"
                            className={campoClass}
                          />
                        </label>
                      )}

                      {rasc.forma === 'credito' && (
                        <label className="w-28 space-y-1">
                          <span className={rotuloClass}>Parcelas</span>
                          <input
                            value={rasc.parcelas}
                            onChange={(e) =>
                              setRasc({ ...rasc, parcelas: e.target.value.replace(/\D/g, '').slice(0, 2) })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                lancar()
                              }
                            }}
                            inputMode="numeric"
                            className={campoClass}
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        onClick={lancar}
                        className="rounded-md bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                      >
                        Lançar ⏎
                      </button>
                    </div>

                    {rasc.forma === 'dinheiro' &&
                      (() => {
                        const v = paraNumero(rasc.valor)
                        const r = rasc.recebido.trim() === '' ? v : paraNumero(rasc.recebido)
                        const t = Number.isFinite(v) && Number.isFinite(r) ? arredonda(r - v) : 0
                        return t > 0 ? (
                          <p className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
                            Troco {reais(t)}
                          </p>
                        ) : null
                      })()}

                    {rasc.forma === 'credito' &&
                      (() => {
                        const v = paraNumero(rasc.valor)
                        const n = Math.min(12, Math.max(1, Number(rasc.parcelas) || 1))
                        if (!Number.isFinite(v) || v <= 0 || n < 2) return null
                        const p = valorParcela(arredonda(v), n)
                        return (
                          <p className="text-sm text-slate-300">
                            {n}x de <strong className="font-mono">{reais(p.base)}</strong>
                            {p.ultima !== p.base && ` (a última de ${reais(p.ultima)})`}
                          </p>
                        )
                      })()}

                    {rasc.forma === 'credito_cliente' && (
                      <p className="text-sm text-slate-300">
                        Crédito do cliente: <strong className="font-mono">{reais(cli.credito)}</strong>
                      </p>
                    )}

                    {rasc.forma === 'pendencia' && (
                      <p className="text-sm text-amber-300">
                        Fica a prazo: vence em <strong>{dataDaqui(cli.info?.pendencia.dias ?? 25)}</strong>. Disponível:{' '}
                        <strong className="font-mono">{reais(cli.pendDisp)}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* pagamentos já lançados */}
                {lancados.length > 0 && (
                  <ul className="divide-y divide-slate-800 rounded-md border border-slate-800 bg-slate-900">
                    {lancados.map((l, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="text-sm text-slate-200">
                          {rotuloForma(l)}
                          {l.recebido !== null && l.recebido > l.valor && (
                            <span className="ml-2 text-xs text-slate-500">
                              recebido {reais(l.recebido)}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="font-mono font-semibold tabular-nums text-slate-100">{reais(l.valor)}</span>
                          <button
                            type="button"
                            aria-label={`Remover ${rotuloForma(l)}`}
                            onClick={() => setLancados((prev) => prev.filter((_, n) => n !== i))}
                            className="rounded p-1 text-slate-500 hover:text-red-400"
                          >
                            <X className="size-4" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* conta */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border border-slate-800 bg-slate-900 p-2">
                    <p className={rotuloClass}>Pago</p>
                    <p className="font-mono text-lg font-bold tabular-nums text-slate-100">{reais(pago)}</p>
                  </div>
                  <div
                    className={`rounded-md border p-2 ${
                      falta > 0 ? 'border-amber-600/60 bg-amber-500/10' : 'border-slate-800 bg-slate-900'
                    }`}
                  >
                    <p className={rotuloClass}>Falta</p>
                    <p
                      className={`font-mono text-lg font-bold tabular-nums ${
                        falta > 0 ? 'text-amber-300' : 'text-slate-100'
                      }`}
                    >
                      {reais(Math.max(0, falta))}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900 p-2">
                    <p className={rotuloClass}>Troco</p>
                    <p
                      className={`font-mono text-lg font-bold tabular-nums ${
                        trocoTotal > 0 ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {reais(trocoTotal)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* fechar: sempre visível */}
          <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-800 bg-slate-950 px-4 py-3 lg:mx-0 lg:px-0">
            {erro && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {erro}
              </p>
            )}

            <button
              ref={fecharRef}
              type="button"
              onClick={fechar}
              disabled={!podeFechar}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-4 text-lg font-bold text-slate-950 outline-none transition hover:bg-emerald-400 focus-visible:ring-4 focus-visible:ring-emerald-300/60 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {fechando ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Fechando...
                </>
              ) : (
                <>
                  <Check className="size-5" />
                  FECHAR PEDIDO · {reais(liquido)}
                </>
              )}
            </button>

            {dica && <p className="text-center text-xs text-slate-500">{dica} · Ctrl+Enter fecha</p>}
          </div>
        </>
      )}
    </div>
  )
}