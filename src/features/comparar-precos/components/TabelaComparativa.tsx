'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Clock, Minus, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../../../components/ui/alert-dialog'
import { Button } from '../../../../components/ui/button'
import IndicadorHistorico from '@/features/historico-precos/components/IndicadorHistorico'
import { chaveDoProduto } from '@/features/historico-precos/utils/estatisticas'
import type { Referencia } from '@/features/historico-precos/utils/referencias'
import type { Fornecedor, ItemComparacao, Preco } from '../types'
import { chave, formatarReais, montarMapa, type Analise } from '../utils/melhorPreco'
import CelulaPreco from './CelulaPreco'

interface Props {
  itens: ItemComparacao[]
  fornecedores: Fornecedor[]
  precos: Preco[]
  analise: Analise
  referencias?: Map<string, Referencia>
  onDefinirPreco: (itemId: string, fornecedorId: string, valor: number | null) => Promise<void>
  onAlterarQuantidade: (itemId: string, quantidade: number) => Promise<void>
  onRemoverItem: (itemId: string) => Promise<void>
  onEditarFornecedor: (fornecedor: Fornecedor) => void
  onRemoverFornecedor: (fornecedorId: string) => Promise<void>
  onAdicionarFornecedor: () => void
}

const numero = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','))

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079C9C]'
const BTN_ICONE = `rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCO}`
const BTN_ICONE_PERIGO = `rounded-md p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400`

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mr-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500">
      {children}
    </kbd>
  )
}

// pergunta antes de apagar
function Confirmar({
  titulo,
  descricao,
  rotuloBotao,
  onConfirmar,
  children,
}: {
  titulo: string
  descricao: ReactNode
  rotuloBotao: string
  onConfirmar: () => void
  children: ReactNode
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {rotuloBotao}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// quantidade editável (desktop); salva ao sair do campo
function QuantidadeInput({
  valor,
  unidade,
  onSalvar,
}: {
  valor: number
  unidade: string | null
  onSalvar: (n: number) => void
}) {
  const [texto, setTexto] = useState<string | null>(null)

  const confirmar = () => {
    if (texto === null) return
    const n = Number(texto.replace(',', '.'))
    setTexto(null)
    if (Number.isFinite(n) && n > 0 && n !== valor) onSalvar(n)
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={texto ?? numero(valor)}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={(e) => {
          setTexto((t) => t ?? numero(valor))
          e.target.select()
        }}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setTexto(null)
            e.currentTarget.blur()
          }
        }}
        inputMode="decimal"
        aria-label="Quantidade"
        className="h-8 w-16 rounded-md border border-transparent bg-transparent text-center text-sm tabular-nums text-slate-700 outline-none transition hover:border-slate-200 focus:border-[#079C9C] focus:bg-white focus:ring-2 focus:ring-[#079C9C]/20"
      />
      {unidade && <span className="text-xs text-slate-500">{unidade}</span>}
    </div>
  )
}

// quantidade com − e + grandes (celular)
function QuantidadeStepper({
  valor,
  unidade,
  onSalvar,
}: {
  valor: number
  unidade: string | null
  onSalvar: (n: number) => void
}) {
  const botao = `flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition active:border-[#079C9C] active:text-[#079C9C] disabled:opacity-40 ${FOCO}`

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={valor <= 1}
        onClick={() => onSalvar(valor - 1)}
        className={botao}
      >
        <Minus className="size-4" />
      </button>
      <span className="min-w-[3.5rem] text-center text-sm font-medium text-slate-700">
        {numero(valor)}
        {unidade ? ` ${unidade}` : ''}
      </span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        onClick={() => onSalvar(valor + 1)}
        className={botao}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export default function TabelaComparativa({
  itens,
  fornecedores,
  precos,
  analise,
  referencias,
  onDefinirPreco,
  onAlterarQuantidade,
  onRemoverItem,
  onEditarFornecedor,
  onRemoverFornecedor,
  onAdicionarFornecedor,
}: Props) {
  const [erro, setErro] = useState('')
  const mapa = montarMapa(precos)

  // referência do histórico (última vez que o item foi cotado em outra comparação)
  const refDe = (item: ItemComparacao) =>
    referencias?.get(chaveDoProduto({ codigo: item.catalog_code, itemNome: item.name }))

  // erros de ações que não têm campo próprio aparecem no topo
  const tentar = async (acao: () => Promise<void>) => {
    setErro('')
    try {
      await acao()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Ocorreu um erro')
    }
  }

  if (fornecedores.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
        <p className="text-base font-semibold text-slate-700">
          Adicione os fornecedores que vão participar
        </p>
        <p className="max-w-sm text-sm text-slate-500">
          Cada fornecedor vira uma coluna. Depois é só preencher o preço de cada item.
        </p>
        <Button
          onClick={onAdicionarFornecedor}
          className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
        >
          <Plus className="size-4" />
          Adicionar fornecedor
          <span className="ml-1 hidden rounded bg-white/20 px-1.5 text-[11px] font-medium md:inline">
            F
          </span>
        </Button>
      </div>
    )
  }

  const totalDe = (id: string) => analise.ranking.find((t) => t.fornecedor.id === id)
  const completos = analise.ranking.filter((x) => x.completo).length

  return (
    <div className="space-y-3">
      {erro && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {erro}
        </p>
      )}

      {/* ===================== CELULAR ===================== */}
      <div className="space-y-4 md:hidden">
        {/* Fornecedores: faixa rolável */}
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-1">
            {fornecedores.map((f) => (
              <div
                key={f.id}
                className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-1"
              >
                <div className="max-w-[130px] min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{f.name}</p>
                  {f.lead_time_days != null && (
                    <p className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="size-3" />
                      {f.lead_time_days} {f.lead_time_days === 1 ? 'dia' : 'dias'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Editar ${f.name}`}
                  onClick={() => onEditarFornecedor(f)}
                  className="rounded-md p-2 text-slate-400 active:bg-slate-100"
                >
                  <Pencil className="size-4" />
                </button>
                <Confirmar
                  titulo="Tirar fornecedor desta comparação?"
                  descricao={
                    <>
                      <strong>{f.name}</strong> sai desta comparação e os preços dele aqui serão
                      apagados. O cadastro do fornecedor continua guardado.
                    </>
                  }
                  rotuloBotao="Tirar fornecedor"
                  onConfirmar={() => tentar(() => onRemoverFornecedor(f.id))}
                >
                  <button
                    type="button"
                    aria-label={`Tirar ${f.name} da comparação`}
                    className="rounded-md p-2 text-slate-400 active:bg-red-50 active:text-red-600"
                  >
                    <X className="size-4" />
                  </button>
                </Confirmar>
              </div>
            ))}

            <button
              type="button"
              onClick={onAdicionarFornecedor}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3.5 text-sm font-medium text-slate-600 active:bg-slate-50"
            >
              <Plus className="size-4" />
              Fornecedor
            </button>
          </div>
        </div>

        {/* Itens: um bloco por item */}
        <ul className="space-y-3">
          {itens.map((item) => {
            const linha = analise.linhas.get(item.id)
            const referencia = refDe(item)

            return (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-medium text-slate-900">{item.name}</p>

                  <Confirmar
                    titulo="Remover item?"
                    descricao={
                      <>
                        <strong>{item.name}</strong> sai da comparação junto com os preços que já
                        foram preenchidos.
                      </>
                    }
                    rotuloBotao="Remover item"
                    onConfirmar={() => tentar(() => onRemoverItem(item.id))}
                  >
                    <button
                      type="button"
                      aria-label={`Remover ${item.name}`}
                      className="-mr-1 -mt-1 shrink-0 rounded-md p-2 text-slate-300 active:bg-red-50 active:text-red-600"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </Confirmar>
                </div>

                <div className="mt-2">
                  <QuantidadeStepper
                    valor={item.quantity}
                    unidade={item.unit}
                    onSalvar={(n) => tentar(() => onAlterarQuantidade(item.id, n))}
                  />
                </div>

                <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
                  {fornecedores.map((f) => {
                    const preco = mapa.get(chave(item.id, f.id))
                    const destaque =
                      !!linha?.comparavel && preco !== undefined && linha.vencedores.includes(f.id)
                    // único preço do item: não há com quem comparar
                    const sozinho =
                      fornecedores.length > 1 && preco !== undefined && linha?.cotacoes === 1

                    return (
                      <div key={f.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pt-2.5">
                          <p className="truncate text-sm text-slate-700">{f.name}</p>
                          {destaque && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <Trophy className="size-3" />
                              Menor preço
                            </span>
                          )}
                        </div>
                        <div className="w-36 shrink-0">
                          <CelulaPreco
                            valor={preco}
                            destaque={destaque}
                            sozinho={sozinho}
                            coluna={f.id}
                            rotulo={`Preço de ${item.name} em ${f.name}`}
                            onSalvar={(v) => onDefinirPreco(item.id, f.id, v)}
                          />
                          <IndicadorHistorico preco={preco} referencia={referencia} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>

        {/* Totais */}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-slate-600">Total por fornecedor</p>
          <ul className="divide-y divide-slate-100">
            {fornecedores.map((f) => {
              const t = totalDe(f.id)
              const melhor = analise.melhorUnico?.fornecedor.id === f.id

              return (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">{f.name}</p>
                    {t && !t.completo && (
                      <p className="text-[11px] font-medium text-amber-600">
                        {t.cotados === 0
                          ? 'Sem preços'
                          : `Faltam ${t.faltando} ${t.faltando === 1 ? 'item' : 'itens'}`}
                      </p>
                    )}
                    {melhor && completos > 1 && (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <Trophy className="size-3" />
                        Melhor
                      </span>
                    )}
                  </div>
                  <p
                    className={`shrink-0 text-base font-semibold tabular-nums ${
                      melhor ? 'text-emerald-700' : 'text-slate-800'
                    }`}
                  >
                    {t && t.cotados > 0 ? formatarReais(t.total) : '—'}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* ===================== DESKTOP ===================== */}
      {/* Rolagem própria: cabeçalho e totais ficam fixos enquanto você desce pela lista */}
      <div className="hidden max-h-[calc(100dvh-17rem)] min-h-[16rem] overflow-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="align-bottom">
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-medium text-slate-500"
              >
                Item
              </th>
              <th
                scope="col"
                className="sticky top-0 z-20 w-24 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-medium text-slate-500"
              >
                Qtd.
              </th>

              {fornecedores.map((f) => (
                <th
                  key={f.id}
                  scope="col"
                  className="sticky top-0 z-20 min-w-[148px] border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-normal"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900" title={f.name}>
                        {f.name}
                      </p>
                      {f.lead_time_days != null && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="size-3" />
                          {f.lead_time_days} {f.lead_time_days === 1 ? 'dia' : 'dias'}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0">
                      <button
                        type="button"
                        aria-label={`Editar ${f.name}`}
                        onClick={() => onEditarFornecedor(f)}
                        className={BTN_ICONE}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <Confirmar
                        titulo="Tirar fornecedor desta comparação?"
                        descricao={
                          <>
                            <strong>{f.name}</strong> sai desta comparação e os preços dele aqui
                            serão apagados. O cadastro do fornecedor continua guardado.
                          </>
                        }
                        rotuloBotao="Tirar fornecedor"
                        onConfirmar={() => tentar(() => onRemoverFornecedor(f.id))}
                      >
                        <button
                          type="button"
                          aria-label={`Tirar ${f.name} da comparação`}
                          className={`${BTN_ICONE} hover:bg-red-50 hover:text-red-600`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </Confirmar>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {itens.map((item) => {
              const linha = analise.linhas.get(item.id)
              const referencia = refDe(item)

              return (
                <tr key={item.id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2 text-left align-top font-normal group-hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 pt-1.5 font-medium text-slate-900">{item.name}</p>

                      <Confirmar
                        titulo="Remover item?"
                        descricao={
                          <>
                            <strong>{item.name}</strong> sai da comparação junto com os preços
                            que já foram preenchidos.
                          </>
                        }
                        rotuloBotao="Remover item"
                        onConfirmar={() => tentar(() => onRemoverItem(item.id))}
                      >
                        <button
                          type="button"
                          aria-label={`Remover ${item.name}`}
                          className={BTN_ICONE_PERIGO}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </Confirmar>
                    </div>
                  </th>

                  <td className="border-b border-slate-100 px-3 py-2 align-top group-hover:bg-slate-50">
                    <QuantidadeInput
                      valor={item.quantity}
                      unidade={item.unit}
                      onSalvar={(n) => tentar(() => onAlterarQuantidade(item.id, n))}
                    />
                  </td>

                  {fornecedores.map((f) => {
                    const preco = mapa.get(chave(item.id, f.id))
                    const destaque =
                      !!linha?.comparavel && preco !== undefined && linha.vencedores.includes(f.id)
                    // único preço do item: não há com quem comparar
                    const sozinho =
                      fornecedores.length > 1 && preco !== undefined && linha?.cotacoes === 1

                    return (
                      <td
                        key={f.id}
                        className="border-b border-slate-100 px-3 py-2 align-top group-hover:bg-slate-50"
                      >
                        <CelulaPreco
                          valor={preco}
                          destaque={destaque}
                          sozinho={sozinho}
                          coluna={f.id}
                          rotulo={`Preço de ${item.name} em ${f.name}`}
                          onSalvar={(v) => onDefinirPreco(item.id, f.id, v)}
                        />
                        <IndicadorHistorico preco={preco} referencia={referencia} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            <tr>
              <th
                scope="row"
                className="sticky bottom-0 left-0 z-30 border-t border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-600"
              >
                Total
              </th>
              <td className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-50" />

              {fornecedores.map((f) => {
                const t = totalDe(f.id)
                const melhor = analise.melhorUnico?.fornecedor.id === f.id

                return (
                  <td
                    key={f.id}
                    className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-50 px-3 py-3 align-top"
                  >
                    <p
                      className={`text-base font-semibold tabular-nums ${
                        melhor ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {t && t.cotados > 0 ? formatarReais(t.total) : '—'}
                    </p>

                    {melhor && completos > 1 && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <Trophy className="size-3" />
                        Melhor
                      </span>
                    )}

                    {t && !t.completo && (
                      <p className="mt-1 text-[11px] font-medium text-amber-600">
                        {t.cotados === 0
                          ? 'Sem preços'
                          : `Faltam ${t.faltando} ${t.faltando === 1 ? 'item' : 'itens'}`}
                      </p>
                    )}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 md:flex">
        <span>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd> mover entre preços (fora de um campo, entram na tabela)
        </span>
        <span>
          <Kbd>Enter</Kbd> salvar e descer
        </span>
        <span>
          <Kbd>Shift</Kbd>
          <Kbd>Enter</Kbd> subir
        </span>
        <span>
          <Kbd>Esc</Kbd> cancelar
        </span>
        <span>Campo vazio apaga o preço</span>
        <span>
          <Kbd>1</Kbd>–<Kbd>9</Kbd> preencher um fornecedor
        </span>
        <span>
          <Kbd>M</Kbd> alternar modo
        </span>
      </p>
    </div>
  )
}