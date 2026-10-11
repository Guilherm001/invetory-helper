'use client'

import { useState } from 'react'
import {
  Check,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react'
import { useLojaCatalogo } from '../hooks/useLojaCatalogo'
import { useListaCompras } from '../hooks/useListaCompras'
import { pedirCompra, type ProdutoLoja } from '../services/lojaCatalogoService'

const reais = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const numero = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','))

const GRID =
  'md:grid md:grid-cols-[6rem_minmax(0,1fr)_3.5rem_8rem_9rem_11rem] md:items-center md:gap-4'

const thClass = 'text-xs font-semibold uppercase tracking-wide text-slate-400'

const stepperClass =
  'flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition active:scale-90 hover:border-[#079C9C] hover:text-[#079C9C]'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

function Estoque({ valor, unidade }: { valor: number | null; unidade: string | null }) {
  if (valor === null) {
    return (
      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-500">
        —
      </span>
    )
  }
  if (valor <= 0) {
    return (
      <span className="inline-flex rounded-lg bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700">
        Sem estoque
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">
      {numero(valor)}
      {unidade ? ` ${unidade}` : ''} em estoque
    </span>
  )
}

// ---------- uma linha do catálogo, com o botão de comprar ----------

function LinhaProduto({
  p,
  naLista,
  onPedido,
}: {
  p: ProdutoLoja
  naLista: number
  onPedido: (codigo: string, quantidade: number) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [quantidade, setQuantidade] = useState('1')
  const [urgente, setUrgente] = useState(false)
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState(false)

  const qtd = Number(quantidade.replace(',', '.'))
  const valida = Number.isFinite(qtd) && qtd > 0

  const ajustar = (delta: number) => {
    const base = valida ? qtd : 0
    setQuantidade(String(Math.max(1, base + delta)).replace('.', ','))
  }

  const fechar = () => {
    setAberto(false)
    setErro('')
  }

  const enviar = async () => {
    if (!valida) {
      setErro('Informe uma quantidade maior que zero.')
      return
    }
    setEnviando(true)
    setErro('')
    try {
      await pedirCompra(p, { quantidade: qtd, urgente, observacao: obs })
      onPedido(p.code, qtd)
      setAberto(false)
      setQuantidade('1')
      setUrgente(false)
      setObs('')
      setFeito(true)
      setTimeout(() => setFeito(false), 3000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao colocar na lista de compras')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className={GRID}>
        <span className="hidden truncate text-sm text-slate-500 md:block">{p.code}</span>

        <div className="min-w-0">
          <p className="font-semibold text-slate-900 md:truncate" title={p.name}>
            {p.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 md:hidden">
            Cód. {p.code}
            {p.unit ? ` · ${p.unit}` : ''}
          </p>
          {p.barcode && (
            <p className="hidden truncate text-xs text-slate-400 md:block">{p.barcode}</p>
          )}
          {naLista > 0 && (
            <p className="mt-1 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
              Já na lista: {numero(naLista)}
              {p.unit ? ` ${p.unit}` : ''}
            </p>
          )}
        </div>

        <span className="hidden text-sm text-slate-600 md:block">{p.unit ?? '—'}</span>

        <div className="mt-2 flex items-center justify-between gap-2 md:contents">
          <span className="text-lg font-bold text-[#079C9C] md:text-base md:text-slate-800">
            {reais(p.price)}
          </span>
          <Estoque valor={p.stock} unidade={p.unit} />
        </div>

        <div className="mt-3 md:mt-0">
          {feito ? (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">
              <Check className="size-4" />
              Na lista de compras
            </span>
          ) : (
            <button
              type="button"
              onClick={() => (aberto ? fechar() : setAberto(true))}
              aria-expanded={aberto}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${
                aberto
                  ? 'border-slate-300 bg-slate-50 text-slate-600'
                  : 'border-[#079C9C] text-[#079C9C] hover:bg-[#079C9C]/10'
              }`}
            >
              {aberto ? (
                <>
                  <X className="size-4" />
                  Cancelar
                </>
              ) : (
                <>
                  <PackagePlus className="size-4" />
                  {naLista > 0 ? 'Pedir de novo' : 'Colocar para comprar'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {aberto && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => ajustar(-1)}
                className={stepperClass}
              >
                <Minus className="size-4" />
              </button>
              <input
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                inputMode="decimal"
                aria-label="Quantidade"
                className="h-10 w-20 rounded-lg border border-slate-200 bg-white text-center text-base font-semibold outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => ajustar(1)}
                className={stepperClass}
              >
                <Plus className="size-4" />
              </button>
              {p.unit && (
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                  {p.unit}
                </span>
              )}
            </div>

            <div role="radiogroup" aria-label="Prioridade" className="flex gap-2">
              {(
                [
                  [false, 'Normal'],
                  [true, 'Urgente'],
                ] as [boolean, string][]
              ).map(([valor, rotulo]) => {
                const ativo = urgente === valor
                return (
                  <button
                    key={rotulo}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setUrgente(valor)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      ativo
                        ? valor
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {rotulo}
                  </button>
                )
              })}
            </div>
          </div>

          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                enviar()
              }
            }}
            placeholder="Observação (opcional): para quando, para quem..."
            aria-label="Observação"
            className={inputClass}
          />

          {erro && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {erro}
            </p>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#079C9C] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-[0.99] disabled:opacity-60 md:ml-auto md:w-auto md:min-w-52"
          >
            {enviando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Colocar na lista de compras'
            )}
          </button>
        </div>
      )}
    </li>
  )
}

// ---------- página ----------

export default function CatalogoLoja() {
  const c = useLojaCatalogo()
  const lista = useListaCompras()

  return (
    <div className="w-full pb-16">
      <div className="mt-7 flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-2xl font-bold md:text-3xl">Catálogo</h3>
          <p className="text-sm text-gray-400">
            Consulte preços e estoque. Faltou algo? Coloque para comprar.
          </p>
        </article>

        {/* o sistema de vendas entra aqui */}
        <button
          type="button"
          disabled
          title="Em breve"
          className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-[#079C9C] px-5 py-3 text-sm font-semibold text-white opacity-50"
        >
          <ShoppingCart className="size-5" />
          Nova venda
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px]">em breve</span>
        </button>
      </div>

      {/* Busca (fica no topo ao rolar) */}
      <div className="sticky top-0 z-10 -mx-4 space-y-3 bg-white/95 px-4 pb-3 pt-3 backdrop-blur md:-mx-10 md:px-10 lg:-mx-14 lg:px-14">
        <div className="relative md:max-w-2xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            value={c.termo}
            onChange={(e) => c.setTermo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                c.buscarAgora()
              }
            }}
            autoFocus
            inputMode="search"
            enterKeyHint="search"
            placeholder="Buscar por descrição, código ou código de barras"
            aria-label="Buscar produto"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
          />
          {c.termo && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => c.setTermo('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={c.soComEstoque}
            onClick={c.alternarEstoque}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              c.soComEstoque
                ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Só com estoque
          </button>

          <p className="flex items-center gap-2 text-sm text-slate-500">
            {c.atualizando && <Loader2 className="size-4 animate-spin" />}
            {!c.carregando && `${c.total} ${c.total === 1 ? 'produto' : 'produtos'}`}
          </p>
        </div>
      </div>

      {c.erro && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {c.erro}
        </p>
      )}

      {/* Cabeçalho (desktop) */}
      {c.itens.length > 0 && (
        <div className={`hidden px-4 pb-2 pt-3 ${GRID}`}>
          <span className={thClass}>Código</span>
          <span className={thClass}>Descrição</span>
          <span className={thClass}>Un</span>
          <span className={thClass}>Preço à vista</span>
          <span className={thClass}>Estoque</span>
          <span />
        </div>
      )}

      {c.carregando ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando catálogo...</p>
      ) : c.itens.length === 0 && !c.erro ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <Search className="size-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nenhum produto encontrado</p>
          <p className="text-xs text-slate-400">Tente outra palavra ou confira o código.</p>
        </div>
      ) : (
        <ul className={`mt-3 space-y-2 md:mt-0 ${c.atualizando ? 'opacity-60' : ''}`}>
          {c.itens.map((p) => (
            <LinhaProduto
              key={p.id}
              p={p}
              naLista={lista.mapa.get(p.code) ?? 0}
              onPedido={lista.somar}
            />
          ))}
        </ul>
      )}

      {c.temMais && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={c.carregarMais}
            disabled={c.carregandoMais}
            className="flex items-center gap-2 rounded-lg border border-[#079C9C] px-5 py-2.5 text-sm font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 disabled:opacity-60"
          >
            {c.carregandoMais && <Loader2 className="size-4 animate-spin" />}
            Ver mais
          </button>
        </div>
      )}
    </div>
  )
}