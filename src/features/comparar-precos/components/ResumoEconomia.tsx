'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  ClipboardCopy,
  FileDown,
  Loader2,
  PiggyBank,
  Scale,
  Share2,
  Trophy,
} from 'lucide-react'
import type { Fornecedor, ItemComparacao } from '../types'
import { formatarReais, type Analise, type PedidoSugerido } from '../utils/melhorPreco'
import { gerarPedidoPdf, precarregarPdf } from '../utils/gerarPedidoPdf'

interface Props {
  itens: ItemComparacao[]
  fornecedores: Fornecedor[]
  analise: Analise
  nomeComparacao?: string
}

const numero = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','))

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

export default function ResumoEconomia({ itens, fornecedores, analise, nomeComparacao }: Props) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')

  // carrega a biblioteca do PDF antes do clique (necessário para compartilhar no iPhone)
  useEffect(() => {
    precarregarPdf()
  }, [])

  if (itens.length === 0 || fornecedores.length === 0) return null

  const {
    ranking,
    melhorUnico,
    totalMisto,
    mistoCompleto,
    itensSemPreco,
    economia,
    economiaPercentual,
    pedidos,
  } = analise

  const comPrecos = ranking.filter((t) => t.cotados > 0)
  const maiorTotal = Math.max(...comPrecos.map((t) => t.total), 1)

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

  const semDiferenca = economia !== null && economia <= 0
  const umSoFornecedor = pedidos.length === 1

  return (
    <section className="space-y-5" aria-label="Resumo da comparação">
      {/* Cartões */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Trophy className="size-4 text-[#079C9C]" />
            Melhor fornecedor único
          </div>
          {melhorUnico ? (
            <>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatarReais(melhorUnico.total)}
              </p>
              <p className="truncate text-sm text-slate-500" title={melhorUnico.fornecedor.name}>
                {melhorUnico.fornecedor.name}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              Nenhum fornecedor cotou todos os itens ainda.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Scale className="size-4 text-[#079C9C]" />
            Menor preço de cada item
          </div>
          {totalMisto !== null ? (
            <>
              <p className="mt-1 text-2xl font-bold text-slate-900">
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
        </div>

        <div
          className={`rounded-xl border p-4 shadow-sm ${
            economia !== null && economia > 0
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <PiggyBank
              className={`size-4 ${
                economia !== null && economia > 0 ? 'text-emerald-600' : 'text-[#079C9C]'
              }`}
            />
            Economia
          </div>

          {economia !== null && economia > 0 ? (
            <>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {formatarReais(economia)}
              </p>
              <p className="text-sm text-emerald-700/80">
                {economiaPercentual !== null &&
                  `${String(economiaPercentual).replace('.', ',')}% a menos `}
                que comprar tudo de um só
              </p>
            </>
          ) : semDiferenca ? (
            <p className="mt-2 text-sm text-slate-500">
              Sem diferença: o melhor fornecedor já tem o menor preço em tudo.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              {itensSemPreco > 0
                ? `Faltam preços em ${itensSemPreco} ${itensSemPreco === 1 ? 'item' : 'itens'} para calcular.`
                : 'Nenhum fornecedor cotou todos os itens ainda.'}
            </p>
          )}
        </div>
      </div>

      {/* Ranking */}
      {comPrecos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                      className={`shrink-0 font-semibold ${
                        melhor ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {formatarReais(t.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Como comprar</h4>
            <p className="text-xs text-slate-400">
              Cada item vai para o fornecedor com o menor preço. Em caso de empate, vale o
              primeiro da lista.
              {!mistoCompleto && ' Itens sem preço ficam de fora.'}
            </p>
          </div>

          {erroAcao && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {erroAcao}
            </p>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {pedidos.map((p) => (
              <div
                key={p.fornecedor.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900" title={p.fornecedor.name}>
                      {p.fornecedor.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}
                      {p.fornecedor.lead_time_days != null &&
                        ` · prazo ${p.fornecedor.lead_time_days} ${p.fornecedor.lead_time_days === 1 ? 'dia' : 'dias'}`}
                    </p>
                  </div>

                  <div className="flex gap-2 sm:shrink-0 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => copiar(p)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition active:scale-95 sm:flex-none sm:px-2.5 sm:py-1.5 sm:text-xs ${
                        copiado === p.fornecedor.id
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-[#079C9C] text-[#079C9C] hover:bg-[#079C9C]/10'
                      }`}
                    >
                      {copiado === p.fornecedor.id ? (
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
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#079C9C] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95 disabled:opacity-60 sm:flex-none sm:px-2.5 sm:py-1.5 sm:text-xs"
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

                <ul className="divide-y divide-slate-100 text-sm">
                  {p.itens.map(({ item, preco, subtotal }) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-1.5"
                    >
                      <span
                        className="min-w-0 break-words text-slate-700 sm:truncate"
                        title={item.name}
                      >
                        <span className="font-semibold text-[#079C9C]">
                          {numero(item.quantity)}
                          {item.unit ? ` ${item.unit}` : ''}
                        </span>{' '}
                        {item.name}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500 sm:text-right sm:text-sm">
                        {formatarReais(preco)}
                        <span className="ml-2 text-sm font-medium text-slate-800">
                          {formatarReais(subtotal)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm">
                  <span className="font-semibold text-slate-600">Subtotal</span>
                  <span className="font-bold text-slate-900">{formatarReais(p.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}