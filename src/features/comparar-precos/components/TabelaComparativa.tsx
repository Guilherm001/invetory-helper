'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2, Trophy, X, Clock } from 'lucide-react'
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
import type { Fornecedor, ItemComparacao, Preco } from '../types'
import { chave, formatarReais, montarMapa, type Analise } from '../utils/melhorPreco'
import CelulaPreco from './CelulaPreco'

interface Props {
  itens: ItemComparacao[]
  fornecedores: Fornecedor[]
  precos: Preco[]
  analise: Analise
  onDefinirPreco: (itemId: string, fornecedorId: string, valor: number | null) => Promise<void>
  onAlterarQuantidade: (itemId: string, quantidade: number) => Promise<void>
  onRemoverItem: (itemId: string) => Promise<void>
  onEditarFornecedor: (fornecedor: Fornecedor) => void
  onRemoverFornecedor: (fornecedorId: string) => Promise<void>
  onAdicionarFornecedor: () => void
}

const numero = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','))

// pergunta antes de apagar
function Confirmar({
  titulo,
  descricao,
  rotuloBotao,
  onConfirmar,
  children,
}: {
  titulo: string
  descricao: React.ReactNode
  rotuloBotao: string
  onConfirmar: () => void
  children: React.ReactNode
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

// quantidade editável; salva ao sair do campo
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
        className="h-7 w-14 rounded-md border border-slate-200 bg-white text-center text-xs font-semibold text-[#079C9C] outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
      />
      {unidade && <span className="text-xs text-slate-500">{unidade}</span>}
    </div>
  )
}

export default function TabelaComparativa({
  itens,
  fornecedores,
  precos,
  analise,
  onDefinirPreco,
  onAlterarQuantidade,
  onRemoverItem,
  onEditarFornecedor,
  onRemoverFornecedor,
  onAdicionarFornecedor,
}: Props) {
  const [erro, setErro] = useState('')
  const mapa = montarMapa(precos)

  // erros de ações que não têm campo próprio aparecem no topo da tabela
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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
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
        </Button>
      </div>
    )
  }

  const totalDe = (id: string) => analise.ranking.find((t) => t.fornecedor.id === id)

  return (
    <div className="space-y-3">
      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 align-bottom">
              <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Item
              </th>

              {fornecedores.map((f) => (
                <th key={f.id} className="min-w-[160px] px-3 py-3 text-left font-normal">
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
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
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
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <X className="size-3.5" />
                        </button>
                      </Confirmar>
                    </div>
                  </div>
                </th>
              ))}

              <th className="w-32 px-3 py-3">
                <button
                  type="button"
                  onClick={onAdicionarFornecedor}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-[#079C9C] px-2.5 py-1.5 text-xs font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10"
                >
                  <Plus className="size-3.5" />
                  Fornecedor
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {itens.map((item) => {
              const linha = analise.linhas.get(item.id)

              return (
                <tr key={item.id} className="group">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 group-hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <div className="mt-1">
                          <QuantidadeInput
                            valor={item.quantity}
                            unidade={item.unit}
                            onSalvar={(n) => tentar(() => onAlterarQuantidade(item.id, n))}
                          />
                        </div>
                      </div>

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
                          className="rounded-md p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </Confirmar>
                    </div>
                  </td>

                  {fornecedores.map((f) => {
                    const preco = mapa.get(chave(item.id, f.id))
                    const destaque =
                      !!linha?.comparavel && preco !== undefined && linha.vencedores.includes(f.id)

                    return (
                      <td key={f.id} className="px-3 py-2.5 align-top">
                        <CelulaPreco
                          valor={preco}
                          destaque={destaque}
                          coluna={f.id}
                          rotulo={`Preço de ${item.name} em ${f.name}`}
                          onSalvar={(v) => onDefinirPreco(item.id, f.id, v)}
                        />
                      </td>
                    )
                  })}

                  <td />
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total
              </td>

              {fornecedores.map((f) => {
                const t = totalDe(f.id)
                const melhor = analise.melhorUnico?.fornecedor.id === f.id

                return (
                  <td key={f.id} className="px-3 py-3 align-top">
                    <p
                      className={`text-base font-bold ${
                        melhor ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {t && t.cotados > 0 ? formatarReais(t.total) : '—'}
                    </p>

                    {melhor && analise.ranking.filter((x) => x.completo).length > 1 && (
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

              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Dica: digite o preço e aperte Enter para ir ao próximo item. Esc cancela e campo vazio
        apaga o preço.
      </p>
    </div>
  )
}