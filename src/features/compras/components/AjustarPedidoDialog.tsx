'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, Pencil } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { numeroTexto, reais } from '@/features/loja/lib/formatar'
import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import { ajustarPedidoPelaNota, type AjusteEnviado } from '../services/notasService'
import type { Ajuste, ValoresAjuste } from '../lib/conferenciaNota'
import { numeroPedido } from '../lib/compras'

const arred2 = (n: number) => Math.round(n * 100) / 100

const reais4 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

const qp = (v: ValoresAjuste) =>
  `${numeroTexto(v.quantidade)}${v.unidade ? ` ${v.unidade}` : ''} × ${reais4(v.preco)}`

type Escolha = 'nota' | 'pedido'

function Conteudo({
  pedido,
  itens,
  ajustes,
  podeFecharTotal,
  totalNotas,
  onClose,
  onAplicado,
}: {
  pedido: PedidoCompra
  itens: ItemPedidoCompra[]
  ajustes: Ajuste[]
  podeFecharTotal: boolean
  totalNotas: number
  onClose: () => void
  onAplicado: (aviso: string) => void
}) {
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(ajustes.map((a) => a.itemId)))
  const [escolha, setEscolha] = useState<Record<string, Escolha>>(() =>
    Object.fromEntries(
      ajustes
        .filter((a) => a.alternativa)
        .map((a) => [a.itemId, (a.usarNotaPorPadrao ? 'nota' : 'pedido') as Escolha])
    )
  )
  const [fechar, setFechar] = useState(podeFecharTotal)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // os valores que cada item vai ter, conforme a escolha
  const valoresDe = (a: Ajuste): ValoresAjuste =>
    a.alternativa && escolha[a.itemId] === 'pedido' ? a.alternativa : a.para

  const escolhidos = ajustes.filter((a) => marcados.has(a.itemId))
  const porItem = new Map(escolhidos.map((a) => [a.itemId, valoresDe(a)]))

  // como o pedido ficaria
  const somaItens = arred2(
    itens.reduce((s, i) => s + (porItem.get(i.id)?.subtotal ?? i.subtotal), 0)
  )
  const residuo = arred2(totalNotas - somaItens)
  const frete = fechar ? Math.max(residuo, 0) : pedido.frete
  const desconto = fechar ? Math.max(-residuo, 0) : pedido.desconto
  const totalDepois = arred2(somaItens + frete - desconto)
  const mudaExtra = fechar && (frete !== pedido.frete || desconto !== pedido.desconto)
  const nada = escolhidos.length === 0 && !mudaExtra

  const alternar = (id: string) =>
    setMarcados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  const aplicar = async () => {
    if (salvando || nada) return
    setSalvando(true)
    setErro('')
    try {
      const envio: AjusteEnviado[] = escolhidos.map((a) => {
        const v = valoresDe(a)
        return {
          item_id: a.itemId,
          quantidade: v.quantidade,
          preco: v.preco,
          // só manda a unidade quando o pedido passa a usar a da nota
          ...(v.unidade && v.unidade !== a.de.unidade ? { unidade: v.unidade } : {}),
        }
      })

      const r = await ajustarPedidoPelaNota(pedido.id, envio, fechar)
      onAplicado(
        r.alterados === 0
          ? `Pedido ${numeroPedido(pedido.numero)}: nada precisou mudar.`
          : `Pedido ${numeroPedido(pedido.numero)} ajustado pela nota (${r.alterados} ${
              r.alterados === 1 ? 'alteração' : 'alterações'
            }). Novo total: ${reais(r.total)}.`
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ajustar o pedido')
      setSalvando(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Pencil className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              Ajustar o pedido pela nota
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              Pedido {numeroPedido(pedido.numero)} · {pedido.fornecedor_nome}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <p className="text-sm text-slate-500">
          A nota vale mais que o pedido. Confira o que vai mudar e desmarque o que não quiser
          alterar. O estoque não é alterado.
        </p>

        <ul className="space-y-2">
          {ajustes.map((a) => {
            const marcado = marcados.has(a.itemId)
            const v = valoresDe(a)
            const usandoNota = !a.alternativa || escolha[a.itemId] === 'nota'

            return (
              <li
                key={a.itemId}
                className={`rounded-xl border p-3 transition ${
                  marcado ? 'border-[#079C9C]/50 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(a.itemId)}
                    className="mt-0.5 size-5 shrink-0 accent-[#079C9C]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{a.nome}</span>

                    <span className="mt-2 grid gap-2 sm:grid-cols-2">
                      <span className="rounded-lg border border-slate-300 bg-slate-50 p-2">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          No pedido agora
                        </span>
                        <span className="block text-sm font-semibold text-slate-800">{qp(a.de)}</span>
                        <span className="block text-xs text-slate-500">
                          Total {reais(a.de.subtotal)}
                        </span>
                      </span>

                      <span className="rounded-lg border border-[#079C9C]/40 bg-[#079C9C]/5 p-2">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-[#047a7a]">
                          {usandoNota ? 'Vai ficar (como na nota)' : 'Vai ficar (quantidade do pedido)'}
                        </span>
                        <span className="block text-sm font-semibold text-slate-800">{qp(v)}</span>
                        <span className="block text-xs text-slate-500">
                          Total {reais(v.subtotal)}
                        </span>
                      </span>
                    </span>
                  </span>
                </label>

                {/* unidade realmente diferente: como ajustar */}
                {a.alternativa && marcado && (
                  <div
                    role="radiogroup"
                    aria-label={`Como ajustar ${a.nome}`}
                    className="mt-2 flex flex-wrap gap-2 pl-8"
                  >
                    {(
                      [
                        ['nota', `Usar a nota: ${qp(a.para)}`],
                        [
                          'pedido',
                          `Manter ${numeroTexto(a.de.quantidade)}${a.de.unidade ? ` ${a.de.unidade}` : ''} e acertar só o preço`,
                        ],
                      ] as [Escolha, string][]
                    ).map(([valor, rotulo]) => {
                      const ativo = escolha[a.itemId] === valor
                      return (
                        <button
                          key={valor}
                          type="button"
                          role="radio"
                          aria-checked={ativo}
                          onClick={() => setEscolha((p) => ({ ...p, [a.itemId]: valor }))}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            ativo
                              ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#047a7a]'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {rotulo}
                        </button>
                      )
                    })}
                  </div>
                )}

                {a.aviso && (
                  <p className="mt-1.5 pl-8 text-xs text-amber-700">{a.aviso}</p>
                )}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          role="switch"
          aria-checked={fechar}
          disabled={!podeFecharTotal}
          onClick={() => setFechar((v) => !v)}
          className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
            fechar ? 'border-[#079C9C] bg-[#079C9C]/10' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <span>
            <span className="block text-sm font-semibold text-slate-700">
              Fechar o total com o da nota
            </span>
            <span className="block text-xs text-slate-500">
              {podeFecharTotal
                ? `A nota fecha em ${reais(totalNotas)}. A diferença para a soma dos itens entra como frete e outras despesas (ou desconto, se for negativa).`
                : 'Indisponível: ainda há itens sem par ou notas sem XML, e a diferença não seria só frete.'}
            </span>
          </span>
          <span
            className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
              fechar ? 'bg-[#079C9C]' : 'bg-slate-300'
            }`}
          >
            <span
              className={`size-5 rounded-full bg-white shadow transition ${fechar ? 'translate-x-5' : ''}`}
            />
          </span>
        </button>

        <div className="space-y-1 rounded-xl border border-[#079C9C]/20 bg-[#079C9C]/5 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-600">Total do pedido</span>
            <span className="font-semibold text-slate-900">
              {reais(pedido.total)} → {reais(totalDepois)}
            </span>
          </div>
          {mudaExtra && (
            <div className="flex justify-between gap-3 text-xs text-slate-500">
              <span>{frete > 0 ? 'Frete e outras despesas' : 'Desconto'}</span>
              <span>
                {reais(frete > 0 ? frete : desconto)}
                {pedido.frete > 0 || pedido.desconto > 0
                  ? ` (antes: ${reais(pedido.frete > 0 ? pedido.frete : pedido.desconto)})`
                  : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50">
        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-3 px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={salvando}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={aplicar}
            disabled={salvando || nada}
            className="min-w-44 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {salvando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Ajustando...
              </>
            ) : (
              `Ajustar o pedido (${escolhidos.length + (mudaExtra ? 1 : 0)})`
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

export default function AjustarPedidoDialog({
  aberto,
  ...resto
}: {
  aberto: boolean
  pedido: PedidoCompra
  itens: ItemPedidoCompra[]
  ajustes: Ajuste[]
  podeFecharTotal: boolean
  totalNotas: number
  onClose: () => void
  onAplicado: (aviso: string) => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[640px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {aberto && <Conteudo {...resto} />}
      </DialogContent>
    </Dialog>
  )
}