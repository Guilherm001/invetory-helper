'use client'

import { useRef, useState } from 'react'
import { AlertCircle, Check, Loader2, Minus, Plus, Search, Trash2, Undo2, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import SeletorCliente from '@/features/clientes/components/SeletorCliente'
import type { Cliente } from '@/features/clientes/services/clientesService'
import { useLojaCatalogo } from '@/features/loja/hooks/useLojaCatalogo'
import type { ProdutoLoja } from '@/features/loja/services/lojaCatalogoService'
import { lancarDevolucao } from '../services/caixaService'
import { arredonda, paraNumero } from '../lib/calculos'
import { numeroTexto, reais, virgula } from '../lib/formatar'
import CampoSenha from './CampoSenha'

interface Item {
  chave: string
  codigo: string
  nome: string
  unidade: string | null
  qtd: string
  preco: string
}

const MOTIVOS = ['Produto errado', 'Defeito', 'Sobrou da obra', 'Desistência']

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

const stepperClass =
  'flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#079C9C] hover:text-[#079C9C] active:scale-90'

function subtotal(i: Item) {
  const q = paraNumero(i.qtd)
  const p = paraNumero(i.preco)
  return Number.isFinite(q) && Number.isFinite(p) && q > 0 && p >= 0 ? arredonda(q * p) : 0
}

function Conteudo({ onClose, onFeito }: { onClose: () => void; onFeito: () => void }) {
  const c = useLojaCatalogo()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [origem, setOrigem] = useState('')
  const [motivo, setMotivo] = useState('')
  const [pin, setPin] = useState('')
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<{ numero: number; total: number; saldo: number; nome: string } | null>(null)
  const enterOcupado = useRef(false)

  const total = arredonda(itens.reduce((s, i) => s + subtotal(i), 0))

  const adicionar = (p: ProdutoLoja) => {
    setErro('')
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.codigo === p.code)
      if (idx >= 0) {
        const novo = [...prev]
        const q = paraNumero(novo[idx].qtd)
        novo[idx] = { ...novo[idx], qtd: numeroTexto((Number.isFinite(q) ? q : 0) + 1) }
        return novo
      }
      return [
        {
          chave: p.id,
          codigo: p.code,
          nome: p.name,
          unidade: p.unit,
          qtd: '1',
          preco: p.price === null ? '' : virgula(p.price),
        },
        ...prev,
      ]
    })
  }

  const adicionarPrimeiro = async () => {
    const t = c.termo.trim()
    if (!t || enterOcupado.current) return
    enterOcupado.current = true
    try {
      const p = await c.primeiroResultado()
      if (p) {
        adicionar(p)
        setAviso(`Adicionado: ${p.name}`)
        c.setTermo('')
      } else {
        setAviso(`Nenhum produto encontrado para "${t}".`)
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Erro ao buscar o produto')
    } finally {
      enterOcupado.current = false
    }
  }

  const alterar = (chave: string, dados: Partial<Item>) =>
    setItens((prev) => prev.map((i) => (i.chave === chave ? { ...i, ...dados } : i)))

  const ajustar = (i: Item, delta: number) => {
    const q = paraNumero(i.qtd)
    alterar(i.chave, { qtd: numeroTexto(Math.max(1, (Number.isFinite(q) ? q : 0) + delta)) })
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente) return setErro('Escolha o cliente que vai receber o crédito.')
    if (itens.length === 0) return setErro('Adicione os produtos devolvidos.')
    for (const i of itens) {
      const q = paraNumero(i.qtd)
      const p = paraNumero(i.preco)
      if (!Number.isFinite(q) || q <= 0) return setErro(`Informe a quantidade de ${i.nome}.`)
      if (!Number.isFinite(p) || p < 0) return setErro(`Informe o valor de ${i.nome}.`)
    }
    if (total <= 0) return setErro('O total da devolução precisa ser maior que zero.')
    if (motivo.trim().length < 3) return setErro('Informe o motivo da devolução.')
    if (pin.length < 4) return setErro('Digite a senha do caixa.')

    const numeroOrigem = origem.trim() === '' ? null : Number(origem)
    if (numeroOrigem !== null && (!Number.isInteger(numeroOrigem) || numeroOrigem <= 0))
      return setErro('O número do pedido original deve ser só números.')

    setEnviando(true)
    setErro('')
    try {
      const r = await lancarDevolucao(
        pin,
        cliente.id,
        itens.map((i) => ({
          codigo: i.codigo || null,
          nome: i.nome,
          unidade: i.unidade,
          quantidade: paraNumero(i.qtd),
          preco: paraNumero(i.preco),
        })),
        motivo.trim(),
        numeroOrigem
      )
      setFeito({ ...r, nome: cliente.nome })
      onFeito()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível registrar a devolução')
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  const header = (
    <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-white/20">
          <Undo2 className="size-6 text-white" />
        </div>
        <div>
          <DialogTitle className="text-xl font-bold text-white">Devolução</DialogTitle>
          <DialogDescription className="text-sm text-white/80">
            O valor devolvido vira crédito do cliente
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>
  )

  if (feito) {
    return (
      <>
        {header}
        <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-8" strokeWidth={3} />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">Devolução nº {feito.numero} registrada</p>
            <p className="mt-1 text-3xl font-bold text-emerald-700">{reais(feito.total)}</p>
            <p className="text-sm text-slate-500">de crédito lançado para {feito.nome}</p>
          </div>
          <p className="text-sm text-slate-600">
            Crédito total do cliente agora: <strong>{reais(feito.saldo)}</strong>
          </p>
          <Button onClick={onClose} className="bg-[#079C9C] text-white hover:bg-[#079C9C]/90">
            Concluir
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <form onSubmit={enviar} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Cliente</span>
          <SeletorCliente
            vinculo={cliente}
            carregando={false}
            onEscolher={setCliente}
            onLimpar={() => setCliente(null)}
          />
        </div>

        {/* produtos devolvidos */}
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-slate-700">Produtos devolvidos</span>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={c.termo}
              onChange={(e) => {
                c.setTermo(e.target.value)
                setAviso('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  adicionarPrimeiro()
                }
              }}
              placeholder="Código, código de barras ou descrição (Enter adiciona)"
              aria-label="Buscar produto devolvido"
              className={`${inputClass} pl-9`}
            />
          </div>

          {aviso && <p className="text-xs text-slate-500">{aviso}</p>}

          {c.termo.trim() !== '' && c.itens.length > 0 && (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {c.itens.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      adicionar(p)
                      c.setTermo('')
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                      <span className="block text-xs text-slate-500">
                        Cód. {p.code} · {p.price === null ? 'sem preço' : reais(p.price)}
                      </span>
                    </span>
                    <Plus className="size-4 shrink-0 text-[#079C9C]" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {itens.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
              Nenhum produto ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {itens.map((i) => (
                <li key={i.chave} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{i.nome}</p>
                      <p className="text-xs text-slate-500">
                        Cód. {i.codigo}
                        {i.unidade ? ` · ${i.unidade}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${i.nome}`}
                      onClick={() => setItens((prev) => prev.filter((x) => x.chave !== i.chave))}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-[18px]" />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button type="button" aria-label="Diminuir" onClick={() => ajustar(i, -1)} className={stepperClass}>
                        <Minus className="size-4" />
                      </button>
                      <input
                        value={i.qtd}
                        onChange={(e) => alterar(i.chave, { qtd: e.target.value })}
                        inputMode="decimal"
                        aria-label={`Quantidade de ${i.nome}`}
                        className="h-9 w-16 rounded-lg border border-slate-200 text-center text-base font-semibold outline-none focus:border-[#079C9C]"
                      />
                      <button type="button" aria-label="Aumentar" onClick={() => ajustar(i, 1)} className={stepperClass}>
                        <Plus className="size-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-500">× R$</span>
                      <input
                        value={i.preco}
                        onChange={(e) => alterar(i.chave, { preco: e.target.value })}
                        inputMode="decimal"
                        placeholder="Valor"
                        aria-label={`Valor de ${i.nome}`}
                        className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-center text-base outline-none focus:border-[#079C9C] md:text-sm"
                      />
                    </div>

                    <span className="ml-auto text-base font-bold text-slate-900">{reais(subtotal(i))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-sm font-semibold text-emerald-800">Crédito a lançar</span>
            <span className="text-2xl font-bold text-emerald-700">{reais(total)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Nº do pedido original (opcional)</span>
          <input
            value={origem}
            onChange={(e) => setOrigem(e.target.value.replace(/\D/g, '').slice(0, 9))}
            inputMode="numeric"
            placeholder="Só para referência"
            aria-label="Número do pedido original"
            className={`${inputClass} sm:w-56`}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Motivo</span>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  motivo === m
                    ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            placeholder="Ou escreva o motivo"
            aria-label="Motivo"
            className={inputClass}
          />
        </div>

        <CampoSenha valor={pin} onChange={setPin} />

        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={enviando}
            className="min-w-44 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Lançar crédito
          </Button>
        </div>
      </form>
    </>
  )
}

export default function DevolucaoDialog({
  aberto,
  onClose,
  onFeito,
}: {
  aberto: boolean
  onClose: () => void
  onFeito: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[680px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {aberto && <Conteudo onClose={onClose} onFeito={onFeito} />}
      </DialogContent>
    </Dialog>
  )
}