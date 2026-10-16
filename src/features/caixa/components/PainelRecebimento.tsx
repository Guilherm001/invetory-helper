'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  Clock,
  CreditCard,
  Loader2,
  Plus,
  QrCode,
  Tag,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { DocumentoResumo, ItemDocumento } from '@/features/loja/services/documentosService'
import { fecharPedido, pedidoDoCaixa } from '../services/caixaService'
import type { ResultadoFechamento } from '../types'
import {
  arredonda,
  calcularDesconto,
  paraNumero,
  resolverPagamentos,
  restanteDaSegunda,
  valorParcela,
  type Forma,
  type LinhaPagamento,
  type TipoDesconto,
} from '../lib/calculos'
import { numeroTexto, reais, virgula } from '../lib/formatar'

interface LinhaUI {
  forma: Forma | null
  valor: string
  recebido: string
  parcelas: number
}

const linhaVazia = (): LinhaUI => ({ forma: null, valor: '', recebido: '', parcelas: 1 })

const FORMAS: { id: Forma; rotulo: string; icone: LucideIcon }[] = [
  { id: 'dinheiro', rotulo: 'Dinheiro', icone: Banknote },
  { id: 'pix', rotulo: 'PIX', icone: QrCode },
  { id: 'debito', rotulo: 'Débito', icone: CreditCard },
  { id: 'credito', rotulo: 'Crédito', icone: CreditCard },
]

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

function sugestoesDinheiro(valor: number) {
  const s = new Set<number>()
  for (const nota of [10, 20, 50, 100, 200]) {
    const m = Math.ceil(valor / nota) * nota
    if (m > valor) s.add(m)
  }
  return [...s].sort((a, b) => a - b).slice(0, 4)
}

// ---------- um bloco de pagamento (uma forma) ----------

function BlocoPagamento({
  rotulo,
  linha,
  valorNumero,
  valorEditavel,
  onMudar,
}: {
  rotulo: string
  linha: LinhaUI
  valorNumero: number // quanto esta forma vai pagar
  valorEditavel: boolean
  onMudar: (p: Partial<LinhaUI>) => void
}) {
  const recebido = linha.recebido.trim() === '' ? valorNumero : paraNumero(linha.recebido)
  const troco = Number.isFinite(recebido) ? Math.max(0, arredonda(recebido - valorNumero)) : 0
  const parcela = valorParcela(valorNumero, linha.parcelas)

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{rotulo}</span>
        {valorEditavel ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-500">R$</span>
            <input
              value={linha.valor}
              onChange={(e) => onMudar({ valor: e.target.value })}
              inputMode="decimal"
              placeholder="0,00"
              aria-label={`Valor de ${rotulo}`}
              className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-base font-semibold outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
            />
          </div>
        ) : (
          <span className="text-lg font-bold text-slate-900">{reais(valorNumero)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FORMAS.map(({ id, rotulo: nome, icone: Icone }) => {
          const ativo = linha.forma === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={ativo}
              onClick={() => onMudar({ forma: id, recebido: '', parcelas: 1 })}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition active:scale-95 ${
                ativo
                  ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Icone className="size-6" />
              {nome}
            </button>
          )
        })}
      </div>

      {/* prontos no banco, ligam quando existir o cadastro de clientes */}
      <div className="flex flex-wrap gap-2">
        {[
          { rotulo: 'Crédito de cliente', icone: Wallet },
          { rotulo: 'A prazo (pendência)', icone: Clock },
        ].map(({ rotulo: nome, icone: Icone }) => (
          <span
            key={nome}
            title="Disponível quando existir o cadastro de clientes"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-slate-200 px-3 py-1 text-xs text-slate-400"
          >
            <Icone className="size-3.5" />
            {nome} · em breve
          </span>
        ))}
      </div>

      {linha.forma === 'dinheiro' && valorNumero > 0 && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Cliente deu R$</span>
            <input
              value={linha.recebido}
              onChange={(e) => onMudar({ recebido: e.target.value })}
              inputMode="decimal"
              placeholder={virgula(valorNumero)}
              aria-label="Dinheiro recebido do cliente"
              className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-base font-semibold outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onMudar({ recebido: '' })}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:border-[#079C9C] hover:text-[#079C9C]"
            >
              Valor exato
            </button>
            {sugestoesDinheiro(valorNumero).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onMudar({ recebido: String(n) })}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:border-[#079C9C] hover:text-[#079C9C]"
              >
                R$ {n}
              </button>
            ))}
          </div>
          {troco > 0 && (
            <p className="text-lg font-bold text-emerald-700">Troco: {reais(troco)}</p>
          )}
        </div>
      )}

      {linha.forma === 'credito' && valorNumero > 0 && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-slate-600">Parcelas</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={linha.parcelas === n}
                onClick={() => onMudar({ parcelas: n })}
                className={`min-w-11 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition ${
                  linha.parcelas === n
                    ? 'border-[#079C9C] bg-[#079C9C] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[#079C9C]'
                }`}
              >
                {n === 1 ? 'À vista' : `${n}x`}
              </button>
            ))}
          </div>
          {linha.parcelas > 1 && (
            <p className="text-sm text-slate-600">
              {linha.parcelas}x de <strong>{reais(parcela.base)}</strong>
              {parcela.ultima !== parcela.base && ` (a última de ${reais(parcela.ultima)})`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- painel ----------

export default function PainelRecebimento({
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

  const [descontoAberto, setDescontoAberto] = useState(false)
  const [tipoDesc, setTipoDesc] = useState<TipoDesconto>('percentual')
  const [descTxt, setDescTxt] = useState('')

  const [dividir, setDividir] = useState(false)
  const [linhas, setLinhas] = useState<LinhaUI[]>([linhaVazia(), linhaVazia()])

  const [fechando, setFechando] = useState(false)
  const [erro, setErro] = useState('')

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

  const total = dados?.doc.total ?? 0
  const desc = calcularDesconto(total, tipoDesc, descTxt)
  const liquido = arredonda(total - desc.desconto)

  const [l0, l1] = linhas
  const valorL0 = dividir ? l0.valor : virgula(liquido)
  const valorL1 = dividir ? virgula(restanteDaSegunda(liquido, l0.valor)) : ''

  const efetivas: LinhaPagamento[] = []
  if (l0.forma) efetivas.push({ forma: l0.forma, valor: valorL0, recebido: l0.recebido, parcelas: l0.parcelas })
  if (dividir && l1.forma)
    efetivas.push({ forma: l1.forma, valor: valorL1, recebido: l1.recebido, parcelas: l1.parcelas })

  const res = resolverPagamentos(liquido, efetivas)
  const faltaForma = liquido > 0 && (!l0.forma || (dividir && !l1.forma))
  const podeFechar =
    !!dados && !desc.erro && !fechando && (liquido === 0 || (!faltaForma && !res.erro))

  const mudar = (i: number, p: Partial<LinhaUI>) =>
    setLinhas((prev) => prev.map((l, n) => (n === i ? { ...l, ...p } : l)))

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
          : res.pagamentos.map((p) => ({
              forma: p.forma,
              valor: p.valor,
              recebido: p.recebido,
              parcelas: p.parcelas,
            }))
      )
      onFechado(r)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível fechar o pedido')
      setFechando(false)
    }
  }

  if (erroCarga) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-slate-500 lg:hidden">
          <ArrowLeft className="size-4" /> Voltar
        </button>
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erroCarga}</p>
      </div>
    )
  }

  if (!dados) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Carregando pedido...
      </p>
    )
  }

  const { doc, itens } = dados

  return (
    <div className="flex min-h-0 flex-col">
      <div className="space-y-4 pb-4">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 lg:hidden"
        >
          <ArrowLeft className="size-4" /> Voltar para a lista
        </button>

        <div>
          <p className="text-sm font-bold text-[#079C9C]">Pedido nº {doc.numero}</p>
          <p className="text-xl font-bold text-slate-900">{doc.cliente_nome || 'Cliente não informado'}</p>
          <p className="text-sm text-slate-500">
            {doc.tipo === 'entrega' ? 'Entrega' : 'Retirada na loja'}
            {doc.cliente_telefone ? ` · ${doc.cliente_telefone}` : ''}
            {doc.vendedor_nome ? ` · vendedor ${doc.vendedor_nome}` : ''}
          </p>
        </div>

        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-slate-700">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'} · ver produtos
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {itens.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 text-slate-700">
                  <strong>
                    {numeroTexto(i.quantidade)}
                    {i.unidade ? ` ${i.unidade}` : ''}
                  </strong>{' '}
                  {i.produto_nome}
                </span>
                <span className="shrink-0 font-medium text-slate-900">{reais(i.subtotal)}</span>
              </li>
            ))}
          </ul>
        </details>

        {/* totais e desconto */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>{reais(total)}</span>
          </div>

          {!descontoAberto && desc.desconto === 0 ? (
            <button
              type="button"
              onClick={() => setDescontoAberto(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#079C9C] hover:underline"
            >
              <Tag className="size-4" />
              Dar desconto
            </button>
          ) : (
            <div className="space-y-2 rounded-lg bg-white p-2.5">
              <div className="flex items-center gap-2">
                <div role="radiogroup" aria-label="Tipo de desconto" className="flex overflow-hidden rounded-lg border border-slate-200">
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
                      onClick={() => setTipoDesc(id)}
                      className={`px-3.5 py-2 text-sm font-semibold ${
                        tipoDesc === id ? 'bg-[#079C9C] text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
                <input
                  value={descTxt}
                  onChange={(e) => setDescTxt(e.target.value)}
                  inputMode="decimal"
                  placeholder={tipoDesc === 'percentual' ? 'Ex: 5' : 'Ex: 20,00'}
                  aria-label="Valor do desconto"
                  autoFocus={descontoAberto && descTxt === ''}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-base outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
                />
                <button
                  type="button"
                  aria-label="Remover desconto"
                  onClick={() => {
                    setDescTxt('')
                    setDescontoAberto(false)
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
                      onClick={() => setDescTxt(n)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-[#079C9C] hover:text-[#079C9C]"
                    >
                      {n}%
                    </button>
                  ))}
                </div>
              )}

              {desc.erro && <p className="text-sm text-red-600">{desc.erro}</p>}
            </div>
          )}

          {desc.desconto > 0 && (
            <div className="flex items-center justify-between text-sm text-emerald-700">
              <span>Desconto{desc.percentual !== null ? ` (${virgula(desc.percentual)}%)` : ''}</span>
              <span>- {reais(desc.desconto)}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-sm font-semibold text-slate-700">Total a pagar</span>
            <span className="text-3xl font-bold text-[#079C9C]">{reais(liquido)}</span>
          </div>
        </div>

        {/* pagamento */}
        {liquido > 0 && (
          <div className="space-y-3">
            <BlocoPagamento
              rotulo={dividir ? '1ª forma de pagamento' : 'Forma de pagamento'}
              linha={l0}
              valorNumero={dividir ? Math.max(0, paraNumero(l0.valor) || 0) : liquido}
              valorEditavel={dividir}
              onMudar={(p) => mudar(0, p)}
            />

            {dividir ? (
              <>
                <BlocoPagamento
                  rotulo="2ª forma de pagamento (o que falta)"
                  linha={l1}
                  valorNumero={restanteDaSegunda(liquido, l0.valor)}
                  valorEditavel={false}
                  onMudar={(p) => mudar(1, p)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setDividir(false)
                    setLinhas([linhaVazia(), linhaVazia()])
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-red-600"
                >
                  <X className="size-4" />
                  Pagar de uma forma só
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDividir(true)
                  setLinhas((prev) => [{ ...prev[0], valor: '' }, linhaVazia()])
                }}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#079C9C] hover:underline"
              >
                <Plus className="size-4" />
                Dividir em 2 formas de pagamento
              </button>
            )}
          </div>
        )}
      </div>

      {/* barra de ação sempre visível */}
      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-200 bg-white px-4 py-3 lg:mx-0 lg:px-0">
        {(erro || (!podeFechar && !fechando && liquido > 0 && (faltaForma || res.erro))) && (
          <p
            role="alert"
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
              erro ? 'border border-red-200 bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro || (faltaForma ? 'Escolha a forma de pagamento.' : res.erro)}
          </p>
        )}

        <button
          type="button"
          onClick={fechar}
          disabled={!podeFechar}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#079C9C] px-4 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {fechando ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Fechando...
            </>
          ) : (
            <>
              <Check className="size-5" />
              Fechar pedido · {reais(liquido)}
            </>
          )}
        </button>
      </div>
    </div>
  )
}