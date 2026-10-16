'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, PackageCheck } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import SenhaVendedor from '@/features/loja/components/senhaVendedor'
import { numeroTexto } from '@/features/loja/lib/formatar'
import {
  itensAReceber,
  receberPedido,
  type ItemAReceber,
  type ResultadoRecebimento,
} from '../services/comprasService'
import { numeroPedido } from '../lib/compras'

export interface PedidoParaReceber {
  id: string
  numero: number
  fornecedor_nome: string
}

const arredondar = (n: number) => Math.round(n * 1000) / 1000

// vazio vale 0; inválido vale NaN
function lerQtd(texto: string | undefined) {
  const s = (texto ?? '').trim()
  if (s === '') return 0
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

const faltaDe = (i: ItemAReceber) => Math.max(0, arredondar(i.quantidade - i.quantidade_recebida))

function montarAviso(r: ResultadoRecebimento) {
  const situacao = r.completo
    ? 'recebido por completo'
    : r.encerrou
      ? 'encerrado com o que chegou'
      : 'recebimento parcial registrado'

  const partes = [`Pedido ${numeroPedido(r.numero)}: ${situacao} (por ${r.recebido_por}).`]
  if (r.sem_estoque.length > 0)
    partes.push(
      `Sem entrada no estoque, por não achar no catálogo: ${r.sem_estoque.join(', ')}.`
    )
  return partes.join(' ')
}

function Opcao({
  ativo,
  onChange,
  titulo,
  descricao,
}: {
  ativo: boolean
  onChange: () => void
  titulo: string
  descricao: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={onChange}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
        ativo ? 'border-[#079C9C] bg-[#079C9C]/10' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span>
        <span className="block text-sm font-semibold text-slate-700">{titulo}</span>
        <span className="block text-xs text-slate-500">{descricao}</span>
      </span>
      <span
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
          ativo ? 'bg-[#079C9C]' : 'bg-slate-300'
        }`}
      >
        <span
          className={`size-5 rounded-full bg-white shadow transition ${ativo ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  )
}

function Conteudo({
  pedido,
  ehDono,
  onFechar,
  onSujo,
  onRecebido,
}: {
  pedido: PedidoParaReceber
  ehDono: boolean
  onFechar: () => void
  onSujo: (sujo: boolean) => void
  onRecebido: (aviso: string) => void
}) {
  const [itens, setItens] = useState<ItemAReceber[] | null>(null)
  const [erroCarga, setErroCarga] = useState('')
  const [chegou, setChegou] = useState<Record<string, string>>({})
  const [estoque, setEstoque] = useState(true)
  const [encerrar, setEncerrar] = useState(false)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pedindoSenha, setPedindoSenha] = useState(false)

  useEffect(() => {
    let cancelado = false
    itensAReceber(pedido.id)
      .then((l) => {
        if (!cancelado) setItens(l)
      })
      .catch((e) => {
        if (!cancelado) setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar os itens')
      })
    return () => {
      cancelado = true
    }
  }, [pedido.id])

  const linhas = (itens ?? []).map((item) => ({
    item,
    falta: faltaDe(item),
    q: lerQtd(chegou[item.id]),
  }))

  const invalido = linhas.find((l) => Number.isNaN(l.q) || l.q < 0)
  const pendentes = linhas.filter((l) => l.falta > 0).length
  const conferidos = linhas.filter((l) => l.q > 0).length
  // itens que ainda ficam faltando depois desta conferência
  const aindaFalta = linhas.filter(
    (l) => l.falta - (Number.isFinite(l.q) && l.q > 0 ? l.q : 0) > 0
  ).length

  const sujo = conferidos > 0 || obs.trim() !== ''
  useEffect(() => {
    onSujo(sujo)
  }, [sujo, onSujo])

  const definir = (id: string, valor: string) => {
    setChegou((p) => ({ ...p, [id]: valor }))
    setErro('')
  }

  const chegouTudo = () =>
    setChegou(
      Object.fromEntries(linhas.filter((l) => l.falta > 0).map((l) => [l.item.id, numeroTexto(l.falta)]))
    )

  const irParaProximo = (atual: HTMLInputElement) => {
    const campos = Array.from(document.querySelectorAll<HTMLInputElement>('[data-chegou]')).filter(
      (el) => !el.disabled && el.offsetParent !== null
    )
    const proximo = campos[campos.indexOf(atual) + 1]
    if (proximo) proximo.focus()
    else atual.blur()
  }

  const validar = () => {
    setErro('')
    if (invalido) {
      setErro(`Quantidade inválida em ${invalido.item.produto_nome}.`)
      return false
    }
    if (conferidos === 0) {
      setErro('Informe quanto chegou de pelo menos um item.')
      return false
    }
    return true
  }

  const enviar = async (vendedorId: string | null, pin: string | null) => {
    const r = await receberPedido({
      pedidoId: pedido.id,
      itens: linhas
        .filter((l) => l.q > 0)
        .map((l) => ({ item_id: l.item.id, quantidade: l.q })),
      estoque,
      encerrar: encerrar && aindaFalta > 0,
      observacao: obs.trim(),
      vendedorId,
      pin,
    })
    onRecebido(montarAviso(r))
  }

  const confirmar = async () => {
    if (!validar()) return

    // o balcão se identifica com a senha; o dono já está identificado
    if (!ehDono) {
      setPedindoSenha(true)
      return
    }

    setSalvando(true)
    try {
      await enviar(null, null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar o recebimento')
      setSalvando(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <PackageCheck className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              Receber pedido {numeroPedido(pedido.numero)}
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {pedido.fornecedor_nome}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {erroCarga ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {erroCarga}
            </p>
          ) : itens === null ? (
            <p className="flex items-center gap-2 py-6 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              Carregando itens...
            </p>
          ) : itens.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Este pedido não está mais aguardando recebimento.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Informe quanto chegou de cada item. O que não chegou fica pendente.
                </p>
                <button
                  type="button"
                  onClick={chegouTudo}
                  className="shrink-0 rounded-lg border border-[#079C9C] px-3 py-2 text-sm font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 active:scale-95"
                >
                  Chegou tudo
                </button>
              </div>

              <ul className="space-y-2">
                {linhas.map(({ item, falta, q }) => {
                  const concluido = falta === 0
                  const aMais = q > falta ? arredondar(q - falta) : 0
                  const vaiFaltar = !concluido && q >= 0 && q < falta ? arredondar(falta - q) : 0
                  const un = item.unidade ? ` ${item.unidade}` : ''

                  return (
                    <li
                      key={item.id}
                      className={`rounded-xl border p-3 shadow-sm ${
                        concluido
                          ? 'border-slate-200 bg-slate-50 opacity-70'
                          : q > 0
                            ? 'border-[#079C9C]/50 bg-[#079C9C]/5'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{item.produto_nome}</p>
                      <p className="text-xs text-slate-500">
                        Pedido {numeroTexto(item.quantidade)}
                        {un}
                        {item.quantidade_recebida > 0 &&
                          ` · já recebido ${numeroTexto(item.quantidade_recebida)}`}
                        {!concluido && ` · falta ${numeroTexto(falta)}`}
                      </p>
                      {item.observacao?.trim() && (
                        <p className="mt-0.5 text-xs italic text-slate-500">
                          obs: {item.observacao.trim()}
                        </p>
                      )}
                      {!item.produto_codigo && estoque && !concluido && (
                        <p className="mt-0.5 text-[11px] text-amber-600">
                          Sem código do catálogo: não dá entrada no estoque.
                        </p>
                      )}

                      {concluido ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-600">
                          Recebido por completo
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={`chegou-${item.id}`}
                            className="text-sm font-medium text-slate-600"
                          >
                            Chegou
                          </label>
                          <input
                            id={`chegou-${item.id}`}
                            data-chegou=""
                            value={chegou[item.id] ?? ''}
                            onChange={(e) => definir(item.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                irParaProximo(e.currentTarget)
                              }
                            }}
                            inputMode="decimal"
                            enterKeyHint="next"
                            placeholder="0"
                            className="h-10 w-24 rounded-lg border border-slate-200 bg-white text-center text-base font-semibold outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
                          />
                          <button
                            type="button"
                            onClick={() => definir(item.id, numeroTexto(falta))}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Tudo ({numeroTexto(falta)})
                          </button>
                          {aMais > 0 && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              +{numeroTexto(aMais)} a mais que o pedido
                            </span>
                          )}
                          {q > 0 && vaiFaltar > 0 && (
                            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                              faltam {numeroTexto(vaiFaltar)}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              <div className="space-y-2">
                <Opcao
                  ativo={estoque}
                  onChange={() => setEstoque((v) => !v)}
                  titulo="Dar entrada no estoque"
                  descricao="Soma o que chegou no estoque do catálogo e guarda no histórico do item"
                />

                {conferidos > 0 && aindaFalta > 0 && (
                  <Opcao
                    ativo={encerrar}
                    onChange={() => setEncerrar((v) => !v)}
                    titulo="Encerrar o pedido"
                    descricao="O que faltou não vem mais. O pedido fica como recebido."
                  />
                )}
              </div>

              <input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                maxLength={500}
                placeholder="Observação (ex: nº da nota fiscal, quem entregou)"
                aria-label="Observação do recebimento"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
              />
            </>
          )}
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
          <div className="flex items-center justify-between gap-3 px-6 py-3.5">
            <p className="text-sm text-slate-500">
              {conferidos} de {pendentes} {pendentes === 1 ? 'item' : 'itens'} conferidos
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onFechar}
                disabled={salvando}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmar}
                disabled={salvando || !itens || itens.length === 0}
                className="min-w-44 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
              >
                {salvando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Confirmar recebimento'
                )}
              </Button>
            </div>
          </div>
        </div>

        {pedindoSenha && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
            <SenhaVendedor
              titulo="Quem está recebendo?"
              descricao="Escolha o vendedor e digite a senha para registrar o recebimento."
              textoBotao="Confirmar"
              onConfirmar={(vendedorId, pin) => enviar(vendedorId, pin)}
              onCancelar={() => setPedindoSenha(false)}
            />
          </div>
        )}
      </div>
    </>
  )
}

export default function ReceberPedidoDialog({
  pedido,
  ehDono,
  onClose,
  onRecebido,
}: {
  pedido: PedidoParaReceber | null
  ehDono: boolean
  onClose: () => void
  onRecebido: (aviso: string) => void
}) {
  const sujo = useRef(false)
  const marcarSujo = useCallback((v: boolean) => {
    sujo.current = v
  }, [])

  const fechar = () => {
    if (sujo.current && !window.confirm('Descartar a conferência? O que você marcou será perdido.'))
      return
    onClose()
  }

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && fechar()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[680px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {pedido && (
          <Conteudo
            key={pedido.id}
            pedido={pedido}
            ehDono={ehDono}
            onFechar={fechar}
            onSujo={marcarSujo}
            onRecebido={onRecebido}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}