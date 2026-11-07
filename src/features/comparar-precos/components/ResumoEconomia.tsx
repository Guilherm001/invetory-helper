'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  FileDown,
  FilePlus2,
  Loader2,
  PiggyBank,
  Scale,
  Share2,
  Trophy,
} from 'lucide-react'
import type { Fornecedor, ItemComparacao } from '../types'
import { formatarReais, type Analise, type PedidoSugerido } from '../utils/melhorPreco'
import { gerarPedidoPdf, precarregarPdf } from '../utils/gerarPedidoPdf'
import { usePedidosDaComparacao } from '@/features/compras/hooks/usePedidosDaComparacao'
import { STATUS_INFO, numeroPedido } from '@/features/compras/lib/compras'

interface Props {
  itens: ItemComparacao[]
  fornecedores: Fornecedor[]
  analise: Analise
  nomeComparacao?: string
  comparacaoId?: string
}

const numero = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','))

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079C9C] focus-visible:ring-offset-1 disabled:opacity-60 md:py-2'
const BTN_SECUNDARIO = `${BASE} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`
const BTN_PRIMARIO = `${BASE} bg-[#079C9C] text-white hover:bg-[#079C9C]/90`

// texto pronto para colar no WhatsApp ou e-mail
function textoDoPedido(p: PedidoSugerido) {
  const linhas = p.itens.map(({ item, preco, subtotal }) => {
    const qtd = `${numero(item.quantity)}${item.unit ? ` ${item.unit}` : ''}`
    return `- ${qtd} ${item.name} (${formatarReais(preco)} cada) = ${formatarReais(subtotal)}`
  })
  return [
    `Pedido para ${p.fornecedor.name}`,
    '',
    ...linhas,
    '',
    `Total: ${formatarReais(p.subtotal)}`,
  ].join('\n')
}

function Indicador({
  icone,
  titulo,
  destaque = false,
  children,
}: {
  icone: ReactNode
  titulo: string
  destaque?: boolean
  children: ReactNode
}) {
  return (
    <div className={`p-4 ${destaque ? 'bg-emerald-50' : ''}`}>
      <p className="flex items-center gap-2 text-sm text-slate-500">
        {icone}
        {titulo}
      </p>
      {children}
    </div>
  )
}

export default function ResumoEconomia({
  itens,
  fornecedores,
  analise,
  nomeComparacao,
  comparacaoId,
}: Props) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')

  const compras = usePedidosDaComparacao(comparacaoId, nomeComparacao)

  // carrega a biblioteca do PDF antes do clique (necessário para compartilhar no iPhone)
  useEffect(() => {
    precarregarPdf()
  }, [])

  if (itens.length === 0 || fornecedores.length === 0) return null

  const {
    ranking,
    melhorUnico,
    melhorUnicoParcial,
    totalMisto,
    mistoCompleto,
    itensComPreco,
    itensSemPreco,
    economia,
    economiaPercentual,
    pedidos,
  } = analise

  const comPrecos = ranking.filter((t) => t.cotados > 0)
  const maiorTotal = Math.max(...comPrecos.map((t) => t.total), 1)

  // fornecedores desta compra que ainda não viraram pedido
  const semPedido = pedidos.filter((p) => !compras.criados.has(p.fornecedor.id))

  const copiar = async (p: PedidoSugerido) => {
    setErroAcao('')
    try {
      await navigator.clipboard.writeText(textoDoPedido(p))
      setCopiado(p.fornecedor.id)
      setTimeout(() => setCopiado((atual) => (atual === p.fornecedor.id ? null : atual)), 2000)
    } catch {
      setErroAcao('Não foi possível copiar. Seu navegador bloqueou o acesso à área de transferência.')
    }
  }

  const baixarPdf = async (p: PedidoSugerido) => {
    setErroAcao('')
    setGerandoPdf(p.fornecedor.id)
    try {
      await gerarPedidoPdf(p, nomeComparacao)
    } catch (err) {
      setErroAcao(
        `Não foi possível gerar o PDF: ${err instanceof Error ? err.message : 'erro desconhecido'}`
      )
    } finally {
      setGerandoPdf(null)
    }
  }

  const temEconomia = economia !== null && economia > 0
  const semDiferenca = economia !== null && economia <= 0
  const umSoFornecedor = pedidos.length === 1

  return (
    <section className="space-y-6" aria-label="Resumo da comparação">
      {/* Indicadores: uma faixa só, divididos por linhas */}
      <div className="grid divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-3 md:divide-x md:divide-y-0">
        <Indicador
          icone={<Trophy className="size-4 text-[#079C9C]" />}
          titulo="Melhor fornecedor único"
        >
          {melhorUnico ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatarReais(melhorUnico.total)}
              </p>
              <p className="truncate text-sm text-slate-500" title={melhorUnico.fornecedor.name}>
                {melhorUnico.fornecedor.name}
              </p>
              {melhorUnicoParcial && (
                <p className="text-xs text-amber-600">
                  Estimativa: cobre {melhorUnico.cotados} de {itensComPreco} itens com preço
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Preencha alguns preços para ver.</p>
          )}
        </Indicador>

        <Indicador
          icone={<Scale className="size-4 text-[#079C9C]" />}
          titulo="Menor preço de cada item"
        >
          {totalMisto !== null ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatarReais(totalMisto)}
              </p>
              <p className="text-sm text-slate-500">
                {umSoFornecedor
                  ? '1 fornecedor'
                  : `Dividido em ${pedidos.length} fornecedores`}
                {itensSemPreco > 0 &&
                  ` · sem preço: ${itensSemPreco} ${itensSemPreco === 1 ? 'item' : 'itens'}`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Preencha alguns preços para ver.</p>
          )}
        </Indicador>

        <Indicador
          icone={
            <PiggyBank className={`size-4 ${temEconomia ? 'text-emerald-600' : 'text-[#079C9C]'}`} />
          }
          titulo="Economia"
          destaque={temEconomia}
        >
          {temEconomia && economia !== null ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
                {formatarReais(economia)}
              </p>
              <p className="text-sm text-emerald-700/80">
                {economiaPercentual !== null &&
                  `${String(economiaPercentual).replace('.', ',')}% a menos `}
                que comprar tudo de um só
                {melhorUnicoParcial && melhorUnico
                  ? ` · estimativa com os ${melhorUnico.cotados} itens que ${melhorUnico.fornecedor.name} cotou`
                  : itensSemPreco > 0 &&
                    ` · sem contar ${itensSemPreco} ${itensSemPreco === 1 ? 'item sem preço' : 'itens sem preço'}`}
              </p>
            </>
          ) : semDiferenca ? (
            <p className="mt-2 text-sm text-slate-500">
              Sem diferença: o melhor fornecedor já tem o menor preço em tudo.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Preencha alguns preços para ver.</p>
          )}
        </Indicador>
      </div>

      {/* Ranking */}
      {comPrecos.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Total por fornecedor</h4>
          <ul className="space-y-3">
            {comPrecos.map((t, i) => {
              const melhor = melhorUnico?.fornecedor.id === t.fornecedor.id
              return (
                <li key={t.fornecedor.id} className={t.completo ? '' : 'opacity-60'}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-xs text-slate-400">{i + 1}º</span>
                      <span className="truncate font-medium text-slate-800">
                        {t.fornecedor.name}
                      </span>
                      {!t.completo && (
                        <span className="shrink-0 text-[11px] font-medium text-amber-600">
                          faltam {t.faltando} {t.faltando === 1 ? 'item' : 'itens'}
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        melhor ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {formatarReais(t.total)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        melhor ? 'bg-emerald-500' : 'bg-[#079C9C]/50'
                      }`}
                      style={{ width: `${Math.max(4, (t.total / maiorTotal) * 100)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          {comPrecos.some((t) => !t.completo) && (
            <p className="mt-3 text-xs text-slate-400">
              Fornecedores que não cotaram todos os itens têm total menor só por faltar
              preço, por isso ficam esmaecidos e atrás dos completos.
            </p>
          )}
        </div>
      )}

      {/* Pedidos sugeridos */}
      {pedidos.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Como comprar</h4>
              <p className="text-xs text-slate-400">
                Cada item vai para o fornecedor com o menor preço. Em caso de empate, vale o
                primeiro da lista.
                {!mistoCompleto && ' Itens sem preço ficam de fora.'}
              </p>
            </div>

            {compras.podeCriar && semPedido.length >= 2 && (
              <button
                type="button"
                onClick={() => compras.criar(semPedido, 'todos')}
                disabled={compras.criando !== null}
                className={`${BTN_PRIMARIO} shrink-0`}
              >
                {compras.criando === 'todos' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FilePlus2 className="size-4" />
                )}
                Criar todos os pedidos ({semPedido.length})
              </button>
            )}
          </div>

          {(erroAcao || compras.erro) && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              {erroAcao || compras.erro}
            </p>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {pedidos.map((p) => {
              const criado = compras.criados.get(p.fornecedor.id)
              const foiCopiado = copiado === p.fornecedor.id

              return (
                <div
                  key={p.fornecedor.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p
                        className="truncate font-semibold text-slate-900"
                        title={p.fornecedor.name}
                      >
                        {p.fornecedor.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}
                        {p.fornecedor.lead_time_days != null &&
                          ` · prazo ${p.fornecedor.lead_time_days} ${p.fornecedor.lead_time_days === 1 ? 'dia' : 'dias'}`}
                      </p>
                    </div>

                    <div className="flex gap-2 sm:shrink-0">
                      <button
                        type="button"
                        onClick={() => copiar(p)}
                        className={`${BTN_SECUNDARIO} flex-1 sm:flex-none sm:px-2.5 sm:py-1.5 sm:text-xs ${
                          foiCopiado ? '!border-emerald-300 !bg-emerald-50 !text-emerald-700' : ''
                        }`}
                      >
                        {foiCopiado ? (
                          <>
                            <Check className="size-4 sm:size-3.5" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <ClipboardCopy className="size-4 sm:size-3.5" />
                            Copiar pedido
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => baixarPdf(p)}
                        disabled={gerandoPdf !== null}
                        className={`${BTN_SECUNDARIO} flex-1 sm:flex-none sm:px-2.5 sm:py-1.5 sm:text-xs`}
                      >
                        {gerandoPdf === p.fornecedor.id ? (
                          <>
                            <Loader2 className="size-4 animate-spin sm:size-3.5" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Share2 className="size-4 sm:hidden" />
                            <FileDown className="hidden size-3.5 sm:block" />
                            <span className="sm:hidden">Compartilhar</span>
                            <span className="hidden sm:inline">PDF</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <ul className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
                    {p.itens.map(({ item, preco, subtotal }) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-1.5"
                      >
                        <span
                          className="min-w-0 break-words text-slate-700 sm:truncate"
                          title={item.name}
                        >
                          <span className="font-medium tabular-nums text-slate-900">
                            {numero(item.quantity)}
                            {item.unit ? ` ${item.unit}` : ''}
                          </span>{' '}
                          {item.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500 sm:text-right sm:text-sm">
                          {formatarReais(preco)}
                          <span className="ml-2 text-sm font-medium text-slate-800">
                            {formatarReais(subtotal)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                    <span className="font-medium text-slate-600">Subtotal</span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatarReais(p.subtotal)}
                    </span>
                  </div>

                  {compras.podeCriar && (
                    <div className="mt-3">
                      {criado ? (
                        <Link
                          href={`/pedidos-compra?abrir=${criado.id}`}
                          className={`${BASE} w-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                        >
                          <CheckCircle2 className="size-4" />
                          Pedido {numeroPedido(criado.numero)} · {STATUS_INFO[criado.status].texto}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => compras.criar([p], p.fornecedor.id)}
                          disabled={compras.criando !== null}
                          className={`${BTN_PRIMARIO} w-full`}
                        >
                          {compras.criando === p.fornecedor.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <FilePlus2 className="size-4" />
                          )}
                          Criar pedido de compra
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}