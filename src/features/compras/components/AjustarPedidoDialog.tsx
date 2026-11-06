'use client'

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { AlertCircle, Check, Loader2, Pencil, Search, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { numeroTexto, reais } from '@/features/loja/lib/formatar'
import { buscarProdutos, type ProdutoLoja } from '@/features/loja/services/lojaCatalogoService'
import type { ItemPedidoCompra, PedidoCompra } from '../services/comprasService'
import { ajustarPedidoPelaNota, vincularItem, type AjusteEnviado } from '../services/notasService'
import { adicionarItensAoPedido, definirPrecosVenda } from '../services/ajusteNotaService'
import {
  calcularAjustes,
  type Ajuste,
  type LinhaConferencia,
  type ValoresAjuste,
} from '../lib/conferenciaNota'
import { chaveNota } from '../lib/casamento'
import { chaveItem, numeroPedido } from '../lib/compras'
import type { ItemNota } from '../lib/nfe'
import {
  arred2,
  lerDecimal,
  percentualPorVenda,
  textoMoeda,
  textoNum,
  textoPct,
  vendaPorPercentual,
  type BaseMargem,
} from '../lib/precoVenda'

// mantido para o ConferenciaItens: indica onde o foco começa
export type AbaAjuste = 'ajustes' | 'novos' | 'preco'

const reais4 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

const qp = (v: ValoresAjuste) =>
  `${numeroTexto(v.quantidade)}${v.unidade ? ` ${v.unidade}` : ''} × ${reais4(v.preco)}`

const GRID =
  'grid grid-cols-[2rem_minmax(13rem,1fr)_8.5rem_8.5rem_11.5rem_7rem_5.5rem] items-center gap-x-3'

const campo =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-base outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/30 disabled:bg-slate-100 disabled:text-slate-400 md:text-sm'

const chipClass = 'rounded-full px-2 py-0.5 text-[11px] font-semibold'

type Escolha = 'nota' | 'pedido'

interface NovoItem {
  marcado: boolean
  nome: string
  codigo: string
  unidade: string | null
  qtd: string
  preco: string
  catalogo: boolean
}

interface PrecoEntrada {
  modo: 'venda' | 'margem'
  texto: string
}

interface LinhaPreco {
  chave: string
  nome: string
  custo: number
  novo: boolean
  itemId?: string
  notaKey?: string
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-slate-300 bg-white px-1 font-sans text-[10px] font-semibold text-slate-500">
      {children}
    </kbd>
  )
}

// ---------- busca no catálogo (teclado: ↑ ↓ Enter Esc) ----------

function BuscaCatalogo({
  inicial,
  onEscolher,
  onFechar,
}: {
  inicial: string
  onEscolher: (p: ProdutoLoja) => void
  onFechar: () => void
}) {
  const [termo, setTermo] = useState(inicial)
  const [res, setRes] = useState<ProdutoLoja[]>([])
  const [ativo, setAtivo] = useState(0)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const t = termo.trim()
    if (t.length < 2) {
      setRes([])
      return
    }
    let cancelado = false
    setBuscando(true)
    const timer = setTimeout(async () => {
      try {
        const r = await buscarProdutos({ termo: t, pagina: 0, soComEstoque: false })
        if (!cancelado) {
          setRes(r.itens.slice(0, 8))
          setAtivo(0)
        }
      } catch {
        if (!cancelado) setRes([])
      } finally {
        if (!cancelado) setBuscando(false)
      }
    }, 250)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [termo])

  return (
    <div className="space-y-2 rounded-lg border border-[#079C9C]/40 bg-white p-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setAtivo((i) => Math.min(i + 1, Math.max(res.length - 1, 0)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setAtivo((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
              e.preventDefault()
              if (res[ativo]) onEscolher(res[ativo])
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onFechar()
            }
          }}
          placeholder="Buscar no catálogo (código, barras ou descrição) · ↑↓ Enter · Esc fecha"
          aria-label="Buscar produto no catálogo"
          className={`${campo} pl-9 pr-9`}
        />
        {buscando ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : (
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar busca"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {res.length > 0 && (
        <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {res.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => onEscolher(p)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition ${
                  i === ativo ? 'bg-[#079C9C]/10' : 'hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                  <span className="block text-xs text-slate-500">
                    Cód. {p.code}
                    {p.unit ? ` · ${p.unit}` : ''}
                  </span>
                </span>
                {i === ativo && <span className="shrink-0 text-[11px] font-semibold text-[#047a7a]">Enter</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- conteúdo ----------

function Conteudo({
  pedido,
  itens,
  pares,
  soNota,
  podeFecharTotal,
  totalNotas,
  abaInicial,
  notasPreMarcadas,
  onFechar,
  onAplicado,
  sujoRef,
  escRef,
}: {
  pedido: PedidoCompra
  itens: ItemPedidoCompra[]
  pares: LinhaConferencia[]
  soNota: ItemNota[]
  podeFecharTotal: boolean
  totalNotas: number
  abaInicial: AbaAjuste
  notasPreMarcadas: string[]
  onFechar: () => void
  onAplicado: (aviso: string) => void
  sujoRef: MutableRefObject<boolean>
  escRef: MutableRefObject<boolean>
}) {
  const ajustes = useMemo(() => calcularAjustes(pares), [pares])
  const ajustePorItem = useMemo(() => new Map(ajustes.map((a) => [a.itemId, a] as const)), [ajustes])

  const gridRef = useRef<HTMLDivElement>(null)
  const pctRef = useRef<HTMLInputElement>(null)

  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(ajustes.map((a) => a.itemId)))
  const [escolha, setEscolha] = useState<Record<string, Escolha>>(() =>
    Object.fromEntries(
      ajustes
        .filter((a) => a.alternativa)
        .map((a) => [a.itemId, (a.usarNotaPorPadrao ? 'nota' : 'pedido') as Escolha])
    )
  )

  const [novos, setNovos] = useState<Record<string, NovoItem>>(() =>
    Object.fromEntries(
      soNota.map((n) => {
        const k = chaveNota(n)
        const preco = n.quantidade > 0 ? Math.round((n.subtotal / n.quantidade) * 1e6) / 1e6 : n.preco
        const v: NovoItem = {
          marcado: notasPreMarcadas.includes(k),
          nome: n.nome,
          codigo: '',
          unidade: n.unidade || null,
          qtd: textoNum(n.quantidade),
          preco: textoNum(preco),
          catalogo: false,
        }
        return [k, v]
      })
    )
  )
  const [buscandoKey, setBuscandoKey] = useState<string | null>(null)

  const [base, setBase] = useState<BaseMargem>('markup')
  const [precos, setPrecos] = useState<Record<string, PrecoEntrada>>({})
  const [pctGlobal, setPctGlobal] = useState('')
  const [soDif, setSoDif] = useState(false)

  const [fechar, setFechar] = useState(
    podeFecharTotal && soNota.every((n) => notasPreMarcadas.includes(chaveNota(n)))
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // não duplica itens se a segunda etapa falhar e a pessoa tentar de novo
  const adicionados = useRef(new Map<string, string>())
  const totalAdicao = useRef<number | null>(null)

  const tocar = () => {
    sujoRef.current = true
  }

  useEffect(() => {
    sujoRef.current = false
  }, [sujoRef])

  // enquanto a busca do catálogo está aberta, o Esc fecha só a busca
  useEffect(() => {
    escRef.current = buscandoKey !== null
    return () => {
      escRef.current = false
    }
  }, [buscandoKey, escRef])

  // ---------- foco inicial ----------
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const root = gridRef.current
      if (abaInicial === 'novos') {
        const el = root?.querySelector<HTMLElement>('[data-novo-nome]:not(:disabled)')
        if (el) {
          el.focus()
          return
        }
      }
      pctRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
    // só na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- navegação estilo planilha ----------
  const mover = (el: HTMLElement, dr: number, dc: number): boolean => {
    const root = gridRef.current
    if (!root) return false
    const r = Number(el.dataset.r)
    const c = Number(el.dataset.c)
    const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-cell]')).filter(
      (x) => !(x as HTMLInputElement).disabled
    )
    let alvo: HTMLElement | undefined

    if (dc !== 0) {
      const mesma = cells
        .filter((x) => Number(x.dataset.r) === r)
        .sort((a, b) => Number(a.dataset.c) - Number(b.dataset.c))
      alvo =
        dc > 0
          ? mesma.find((x) => Number(x.dataset.c) > c)
          : [...mesma].reverse().find((x) => Number(x.dataset.c) < c)
    } else {
      const linhas = Array.from(new Set(cells.map((x) => Number(x.dataset.r)))).sort((a, b) => a - b)
      const alvoLinha = dr > 0 ? linhas.find((x) => x > r) : [...linhas].reverse().find((x) => x < r)
      if (alvoLinha !== undefined) {
        const naLinha = cells.filter((x) => Number(x.dataset.r) === alvoLinha)
        alvo = naLinha.reduce((m, x) =>
          Math.abs(Number(x.dataset.c) - c) < Math.abs(Number(m.dataset.c) - c) ? x : m
        )
      }
    }

    if (!alvo) return false
    alvo.focus()
    if (alvo instanceof HTMLInputElement && alvo.type !== 'checkbox') alvo.select()
    return true
  }

  const tecla = (e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget
    const input = el instanceof HTMLInputElement ? el : null
    const texto = !!input && input.type !== 'checkbox'

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mover(el, 1, 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      mover(el, -1, 0)
    } else if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey || el instanceof HTMLButtonElement) return
      e.preventDefault()
      const moveu = mover(el, e.shiftKey ? -1 : 1, 0)
      if (!moveu && !e.shiftKey) document.getElementById('aj-aplicar')?.focus()
    } else if (e.key === 'ArrowRight') {
      if (!texto || (input!.selectionEnd === input!.value.length && (input!.selectionStart === input!.value.length || input!.selectionStart === 0))) {
        e.preventDefault()
        mover(el, 0, 1)
      }
    } else if (e.key === 'ArrowLeft') {
      if (!texto || (input!.selectionStart === 0 && (input!.selectionEnd === 0 || input!.selectionEnd === input!.value.length))) {
        e.preventDefault()
        mover(el, 0, -1)
      }
    }
  }

  const cel = (r: number, c: number) => ({
    'data-cell': '',
    'data-r': r,
    'data-c': c,
    onKeyDown: tecla,
  })

  const selecionar = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

  // ---------- itens do pedido ----------
  const valoresDe = (a: Ajuste): ValoresAjuste =>
    a.alternativa && escolha[a.itemId] === 'pedido' ? a.alternativa : a.para

  const escolhidos = ajustes.filter((a) => marcados.has(a.itemId))
  const porItem = new Map(escolhidos.map((a) => [a.itemId, valoresDe(a)]))

  const alternar = (id: string) => {
    tocar()
    setMarcados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  // ---------- itens novos ----------
  const setNovo = (k: string, patch: Partial<NovoItem>) => {
    tocar()
    setNovos((p) => ({ ...p, [k]: { ...p[k], ...patch } }))
  }

  const novosLista = soNota.map((n) => ({ n, k: chaveNota(n), v: novos[chaveNota(n)] }))
  const novosParse = novosLista
    .filter((x) => x.v.marcado)
    .map((x) => ({ ...x, q: lerDecimal(x.v.qtd), p: lerDecimal(x.v.preco) }))
  const novoInvalido = novosParse.some(
    (x) => x.q === null || x.q <= 0 || x.p === null || x.p < 0 || x.v.nome.trim().length < 2
  )
  const todosNovos = soNota.length === 0 || novosParse.length === soNota.length

  const fecharBusca = (k: string) => {
    setBuscandoKey(null)
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-k="${k}"]`)?.focus())
  }

  // ---------- total ----------
  const podeFechar = podeFecharTotal && todosNovos
  const fecharEf = fechar && podeFechar

  const somaExistentes = arred2(
    itens.reduce((s, i) => s + (porItem.get(i.id)?.subtotal ?? i.subtotal), 0)
  )
  const somaNovos = arred2(
    novosParse.reduce((s, x) => s + (x.q !== null && x.p !== null ? arred2(x.q * x.p) : 0), 0)
  )
  const somaItens = arred2(somaExistentes + somaNovos)
  const residuo = arred2(totalNotas - somaItens)
  const frete = fecharEf ? Math.max(residuo, 0) : pedido.frete
  const desconto = fecharEf ? Math.max(-residuo, 0) : pedido.desconto
  const totalDepois = arred2(somaItens + frete - desconto)
  const mudaExtra = fecharEf && (frete !== pedido.frete || desconto !== pedido.desconto)

  // ---------- preço de venda ----------
  const linhasPreco: LinhaPreco[] = [
    ...pares.map((l) => {
      const a = ajustePorItem.get(l.pedido.id)
      const v = a && marcados.has(a.itemId) ? valoresDe(a) : null
      return {
        chave: `i:${l.pedido.id}`,
        nome: l.pedido.produto_nome,
        custo: v ? v.preco : l.pedido.preco_unitario,
        novo: false,
        itemId: l.pedido.id,
      }
    }),
    ...novosParse.map((x) => ({
      chave: `n:${x.k}`,
      nome: x.v.nome,
      custo: x.p ?? 0,
      novo: true,
      notaKey: x.k,
    })),
  ]

  const resolver = (custo: number, e?: PrecoEntrada, b: BaseMargem = base) => {
    if (!e || e.texto.trim() === '') return { venda: null as number | null, pct: null as number | null }
    if (e.modo === 'venda') {
      const v = lerDecimal(e.texto)
      const ok = v !== null && v > 0
      return { venda: ok ? v : null, pct: ok ? percentualPorVenda(custo, v, b) : null }
    }
    const p = lerDecimal(e.texto)
    return { venda: p !== null ? vendaPorPercentual(custo, p, b) : null, pct: p }
  }

  const precosSalvar = linhasPreco.flatMap((l) => {
    const r = resolver(l.custo, precos[l.chave])
    return r.venda !== null ? [{ l, venda: r.venda, pct: r.pct }] : []
  })

  const setPreco = (chave: string, modo: 'venda' | 'margem', texto: string) => {
    tocar()
    setPrecos((p) => ({ ...p, [chave]: { modo, texto } }))
  }

  const trocarBase = (nova: BaseMargem) => {
    if (nova === base) return
    tocar()
    // quem estava por %, passa a valer pelo preço já calculado
    setPrecos((prev) => {
      const novo = { ...prev }
      for (const l of linhasPreco) {
        const e = prev[l.chave]
        if (e && e.modo === 'margem') {
          const r = resolver(l.custo, e, base)
          if (r.venda !== null) novo[l.chave] = { modo: 'venda', texto: textoMoeda(r.venda) }
        }
      }
      return novo
    })
    setBase(nova)
  }

  const aplicarGlobal = () => {
    if (lerDecimal(pctGlobal) === null) return
    tocar()
    setPrecos((prev) => {
      const novo = { ...prev }
      for (const l of linhasPreco) novo[l.chave] = { modo: 'margem', texto: pctGlobal }
      return novo
    })
  }

  const primeiraCelula = () => {
    const el = gridRef.current?.querySelector<HTMLElement>('[data-cell]:not(:disabled)')
    el?.focus()
  }

  const marcarTudo = () => {
    tocar()
    const tudo = marcados.size === ajustes.length && novosParse.length === soNota.length
    setMarcados(tudo ? new Set() : new Set(ajustes.map((a) => a.itemId)))
    setNovos((p) =>
      Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, marcado: !tudo }]))
    )
  }

  // ---------- resumo ----------
  const nada = escolhidos.length === 0 && novosParse.length === 0 && !mudaExtra && precosSalvar.length === 0

  const resumo = [
    escolhidos.length > 0 && `${escolhidos.length} ${escolhidos.length === 1 ? 'ajuste' : 'ajustes'}`,
    novosParse.length > 0 &&
      `${novosParse.length} ${novosParse.length === 1 ? 'item novo' : 'itens novos'}`,
    precosSalvar.length > 0 &&
      `${precosSalvar.length} ${precosSalvar.length === 1 ? 'preço de venda' : 'preços de venda'}`,
    mudaExtra && 'frete/desconto',
  ]
    .filter(Boolean)
    .join(' · ')

  const aplicar = async () => {
    if (salvando || nada) return
    if (novoInvalido) {
      setErro('Confira nome, quantidade e custo dos itens novos (campos em vermelho).')
      requestAnimationFrame(() =>
        gridRef.current?.querySelector<HTMLElement>('[data-invalido="1"]')?.focus()
      )
      return
    }

    setSalvando(true)
    setErro('')
    try {
      // 1) itens novos (já ligados ao item da nota)
      const pendentes = novosParse.filter((x) => !adicionados.current.has(x.k))
      if (pendentes.length > 0) {
        const r = await adicionarItensAoPedido(
          pedido.id,
          pendentes.map((x) => ({
            codigo: x.v.codigo,
            nome: x.v.nome.trim(),
            unidade: x.v.unidade,
            quantidade: x.q as number,
            preco: x.p as number,
          }))
        )
        totalAdicao.current = r.total
        pendentes.forEach((x, i) => adicionados.current.set(x.k, r.ids[i]))

        await Promise.all(
          pendentes.map((x, i) =>
            vincularItem({
              pedidoId: pedido.id,
              itemId: r.ids[i],
              alvoChave: chaveItem(x.v.codigo || null, x.v.nome.trim()),
              notaChave: x.k,
              notaNome: x.n.nome,
              notaCodigo: x.n.codigo,
            }).catch(() => {})
          )
        )
      }

      // 2) ajuste dos itens que já estavam no pedido
      const envio: AjusteEnviado[] = escolhidos.map((a) => {
        const v = valoresDe(a)
        return {
          item_id: a.itemId,
          quantidade: v.quantidade,
          preco: v.preco,
          ...(v.unidade && v.unidade !== a.de.unidade ? { unidade: v.unidade } : {}),
        }
      })

      let total = totalAdicao.current
      let alterados = 0
      if (envio.length > 0 || fecharEf) {
        const r = await ajustarPedidoPelaNota(pedido.id, envio, fecharEf)
        total = r.total
        alterados = r.alterados
      }

      // 3) preço de venda
      let avisoPreco = ''
      if (precosSalvar.length > 0) {
        try {
          await definirPrecosVenda(
            pedido.id,
            precosSalvar.flatMap(({ l, venda, pct }) => {
              const id = l.itemId ?? (l.notaKey ? adicionados.current.get(l.notaKey) : undefined)
              return id ? [{ item_id: id, preco_venda: venda, margem_pct: pct }] : []
            })
          )
          avisoPreco = ` Preço de venda definido em ${precosSalvar.length} ${
            precosSalvar.length === 1 ? 'item' : 'itens'
          }.`
        } catch (e) {
          avisoPreco = ` Atenção: os preços de venda não foram salvos (${
            e instanceof Error ? e.message : 'erro desconhecido'
          }).`
        }
      }

      const partes: string[] = []
      if (adicionados.current.size > 0)
        partes.push(
          `${adicionados.current.size} ${adicionados.current.size === 1 ? 'item adicionado' : 'itens adicionados'}`
        )
      if (alterados > 0) partes.push(`${alterados} ${alterados === 1 ? 'alteração' : 'alterações'}`)

      onAplicado(
        `Pedido ${numeroPedido(pedido.numero)} ajustado pela nota${
          partes.length ? ` (${partes.join(', ')})` : ''
        }.${total !== null ? ` Novo total: ${reais(total)}.` : ''}${avisoPreco}`
      )
    } catch (e) {
      setErro(
        (adicionados.current.size > 0 ? 'Os itens novos já foram adicionados. ' : '') +
          (e instanceof Error ? e.message : 'Não foi possível ajustar o pedido')
      )
      setSalvando(false)
    }
  }

  // ---------- atalhos globais ----------
  const global = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      aplicar()
      return
    }
    if (!e.altKey) return
    switch (e.code) {
      case 'KeyT':
        e.preventDefault()
        marcarTudo()
        break
      case 'KeyF':
        e.preventDefault()
        if (podeFechar) setFechar((v) => !v)
        break
      case 'KeyM':
        e.preventDefault()
        trocarBase(base === 'markup' ? 'margem' : 'markup')
        break
      case 'KeyD':
        e.preventDefault()
        setSoDif((v) => !v)
        break
      case 'KeyG':
        e.preventDefault()
        pctRef.current?.focus()
        pctRef.current?.select()
        break
    }
  }

  // ---------- render ----------
  const paresVisiveis = pares.filter((l) => !soDif || ajustePorItem.has(l.pedido.id))
  let linha = 0

  const camposPreco = (r: number, chave: string, custo: number, habilitado: boolean, nome: string) => {
    const e = precos[chave]
    const res = resolver(custo, e)
    const vendaTexto = e?.modo === 'venda' ? e.texto : res.venda !== null ? textoMoeda(res.venda) : ''
    const pctTexto = e?.modo === 'margem' ? e.texto : res.pct !== null ? textoPct(res.pct) : ''
    const abaixo = res.venda !== null && res.venda < custo

    return (
      <>
        <input
          {...cel(r, 4)}
          value={vendaTexto}
          disabled={!habilitado}
          onFocus={selecionar}
          onChange={(ev) => setPreco(chave, 'venda', ev.target.value)}
          inputMode="decimal"
          placeholder="Venda R$"
          aria-label={`Preço de venda de ${nome}`}
          className={`${campo} ${abaixo ? 'border-red-400 bg-red-50' : ''}`}
        />
        <input
          {...cel(r, 5)}
          value={pctTexto}
          disabled={!habilitado}
          onFocus={selecionar}
          onChange={(ev) => setPreco(chave, 'margem', ev.target.value)}
          inputMode="decimal"
          placeholder="%"
          aria-label={`Percentual de ${nome}`}
          className={campo}
        />
      </>
    )
  }

  return (
    <div onKeyDown={global} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-3 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Pencil className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg font-bold text-white">Ajustar pelo que veio na nota</DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              Pedido {numeroPedido(pedido.numero)} · {pedido.fornecedor_nome}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* barra de ferramentas */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="aj-pct" className="text-xs font-semibold text-slate-600">
              % para todos
            </label>
            <input
              id="aj-pct"
              ref={pctRef}
              value={pctGlobal}
              onChange={(e) => setPctGlobal(e.target.value)}
              onFocus={selecionar}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey) || e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (e.key === 'Enter' && lerDecimal(pctGlobal) !== null) aplicarGlobal()
                  primeiraCelula()
                }
              }}
              inputMode="decimal"
              placeholder="Ex: 40"
              className={`${campo} w-24`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={aplicarGlobal}
              disabled={lerDecimal(pctGlobal) === null}
              className="rounded-md border border-[#079C9C] px-2.5 py-1.5 text-xs font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 disabled:opacity-50"
            >
              Aplicar <span className="text-[#079C9C]/60">(Enter)</span>
            </button>
          </div>

          <div
            role="radiogroup"
            aria-label="Tipo de percentual"
            className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
          >
            {(
              [
                ['markup', 'Markup (sobre o custo)'],
                ['margem', 'Margem (sobre a venda)'],
              ] as [BaseMargem, string][]
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                tabIndex={-1}
                role="radio"
                aria-checked={base === v}
                onClick={() => trocarBase(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  base === v ? 'bg-[#079C9C] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setSoDif((v) => !v)}
              aria-pressed={soDif}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                soDif
                  ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#047a7a]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Só diferenças <Kbd>Alt+D</Kbd>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={marcarTudo}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Marcar/desmarcar tudo <Kbd>Alt+T</Kbd>
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {base === 'markup'
            ? 'Markup: custo R$ 10,00 com 40% = venda R$ 14,00.'
            : 'Margem: custo R$ 10,00 com 40% = venda R$ 16,67.'}{' '}
          Digite o preço final <strong>ou</strong> o %: o outro campo se calcula. Vazio = não define.
        </p>
      </div>

      {/* planilha */}
      <div ref={gridRef} className="min-h-0 flex-1 overflow-auto bg-slate-50/60 px-6 pb-4">
        <div className="min-w-[60rem]">
          <div
            className={`${GRID} sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400`}
          >
            <span />
            <span>Item</span>
            <span>No pedido</span>
            <span>Na nota</span>
            <span>Vai ficar</span>
            <span>Venda (R$)</span>
            <span>{base === 'markup' ? 'Markup %' : 'Margem %'}</span>
          </div>

          {pares.length === 0 && soNota.length === 0 && (
            <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">
              Nenhum item reconhecido na nota.
            </p>
          )}

          {/* itens que já estão no pedido */}
          {pares.length > 0 && (
            <section className="mt-3">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                No pedido ({paresVisiveis.length}
                {soDif && paresVisiveis.length !== pares.length ? ` de ${pares.length}` : ''})
              </h4>

              {paresVisiveis.length === 0 ? (
                <p className="rounded-lg bg-white px-3 py-4 text-center text-sm text-slate-500">
                  Nenhuma diferença nos itens reconhecidos.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {paresVisiveis.map((l) => {
                    const r = linha++
                    const a = ajustePorItem.get(l.pedido.id)
                    const marcado = a ? marcados.has(a.itemId) : false
                    const v = a && marcado ? valoresDe(a) : null
                    const de: ValoresAjuste = a
                      ? a.de
                      : {
                          quantidade: l.pedido.quantidade,
                          preco: l.pedido.preco_unitario,
                          subtotal: l.pedido.subtotal,
                          unidade: l.pedido.unidade,
                        }
                    const ficar = v ?? de
                    const chave = `i:${l.pedido.id}`

                    return (
                      <li
                        key={l.pedido.id}
                        className={`rounded-lg border bg-white px-3 py-2 transition focus-within:border-[#079C9C] focus-within:shadow-sm ${
                          a && !marcado ? 'border-slate-200 opacity-70' : 'border-slate-200'
                        }`}
                      >
                        <div className={GRID}>
                          {a ? (
                            <input
                              {...cel(r, 0)}
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternar(a.itemId)}
                              aria-label={`Ajustar ${l.pedido.produto_nome} pela nota`}
                              className="size-5 accent-[#079C9C]"
                            />
                          ) : (
                            <Check className="size-4 text-emerald-500" aria-label="Igual à nota" />
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {l.pedido.produto_nome}
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {l.difPreco !== null && (
                                <span
                                  className={`${chipClass} ${
                                    l.difPreco > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  preço {l.difPreco > 0 ? '+' : ''}
                                  {String(l.difPreco).replace('.', ',')}%
                                </span>
                              )}
                              {l.difQtd !== null && (
                                <span className={`${chipClass} bg-amber-50 text-amber-700`}>
                                  qtd {l.difQtd > 0 ? '+' : ''}
                                  {numeroTexto(l.difQtd)}
                                </span>
                              )}
                              {l.unidadeDiferente && (
                                <span className={`${chipClass} bg-slate-100 text-slate-600`}>
                                  unidade {l.pedido.unidade} × {l.nota.unidade}
                                </span>
                              )}
                              {!a && <span className={`${chipClass} bg-emerald-50 text-emerald-700`}>igual</span>}
                            </div>
                          </div>

                          <span className="text-xs text-slate-600">{qp(de)}</span>
                          <span className="text-xs text-slate-600">
                            {numeroTexto(l.nota.quantidade)}
                            {l.nota.unidade ? ` ${l.nota.unidade}` : ''} × {reais4(l.nota.preco)}
                          </span>
                          <span
                            className={`text-sm font-semibold ${
                              v ? 'text-[#047a7a]' : 'text-slate-800'
                            }`}
                          >
                            {qp(ficar)}
                            <span className="block text-[11px] font-normal text-slate-500">
                              total {reais(ficar.subtotal)}
                            </span>
                          </span>

                          {camposPreco(r, chave, ficar.preco, true, l.pedido.produto_nome)}
                        </div>

                        {a && marcado && (a.alternativa || a.aviso) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-11">
                            {a.alternativa && (
                              <button
                                {...cel(r, 1)}
                                type="button"
                                onClick={() => {
                                  tocar()
                                  setEscolha((p) => ({
                                    ...p,
                                    [a.itemId]: p[a.itemId] === 'nota' ? 'pedido' : 'nota',
                                  }))
                                }}
                                className="rounded-full border border-[#079C9C] bg-[#079C9C]/10 px-3 py-1 text-xs font-semibold text-[#047a7a] outline-none transition focus:ring-2 focus:ring-[#079C9C]/40"
                              >
                                {escolha[a.itemId] === 'nota'
                                  ? `Usando a nota: ${qp(a.para)}`
                                  : `Mantendo ${numeroTexto(a.de.quantidade)}${a.de.unidade ? ` ${a.de.unidade}` : ''}, só acerta o preço`}
                                {' · '}
                                <span className="underline">trocar (Enter)</span>
                              </button>
                            )}
                            {a.aviso && <span className="text-xs text-amber-700">{a.aviso}</span>}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {/* itens que só vieram na nota */}
          {soNota.length > 0 && (
            <section className="mt-5">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Só na nota ({soNota.length}) <span className="font-normal normal-case text-slate-400">· marque com Espaço para adicionar ao pedido</span>
              </h4>

              {pedido.status === 'recebido' && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Este pedido já foi recebido: os itens novos entram como recebidos, sem dar entrada no
                  estoque.
                </p>
              )}

              <ul className="space-y-1.5">
                {novosLista.map(({ n, k, v }) => {
                  const r = linha++
                  const q = lerDecimal(v.qtd)
                  const p = lerDecimal(v.preco)
                  const sub = q !== null && p !== null ? arred2(q * p) : 0
                  const qRuim = v.marcado && (q === null || q <= 0)
                  const pRuim = v.marcado && (p === null || p < 0)
                  const nomeRuim = v.marcado && v.nome.trim().length < 2
                  const chave = `n:${k}`

                  return (
                    <li
                      key={k}
                      className={`rounded-lg border bg-white px-3 py-2 transition focus-within:border-[#079C9C] focus-within:shadow-sm ${
                        v.marcado ? 'border-[#079C9C]/50' : 'border-slate-200'
                      }`}
                    >
                      <div className={GRID}>
                        <input
                          {...cel(r, 0)}
                          type="checkbox"
                          checked={v.marcado}
                          onChange={() => setNovo(k, { marcado: !v.marcado })}
                          aria-label={`Adicionar ${n.nome} ao pedido`}
                          className="size-5 accent-[#079C9C]"
                        />

                        <div className="min-w-0">
                          {!v.marcado ? (
                            <p className="truncate text-sm font-semibold text-slate-700">{n.nome}</p>
                          ) : v.catalogo ? (
                            <button
                              {...cel(r, 1)}
                              type="button"
                              data-k={k}
                              data-novo-nome=""
                              onClick={() => setBuscandoKey(k)}
                              onKeyDown={(e) => {
                                if (e.key === 'F2') {
                                  e.preventDefault()
                                  setBuscandoKey(k)
                                } else tecla(e)
                              }}
                              title="Trocar produto do catálogo (F2)"
                              className="flex max-w-full items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-left text-sm font-semibold text-emerald-800 outline-none focus:ring-2 focus:ring-[#079C9C]/40"
                            >
                              <Check className="size-4 shrink-0" />
                              <span className="truncate">
                                {v.nome} · Cód. {v.codigo}
                              </span>
                            </button>
                          ) : (
                            <input
                              {...cel(r, 1)}
                              data-k={k}
                              data-novo-nome=""
                              data-invalido={nomeRuim ? '1' : undefined}
                              value={v.nome}
                              onFocus={selecionar}
                              onChange={(e) => setNovo(k, { nome: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'F2') {
                                  e.preventDefault()
                                  setBuscandoKey(k)
                                } else tecla(e)
                              }}
                              maxLength={200}
                              aria-label="Nome do item no pedido"
                              className={`${campo} ${nomeRuim ? 'border-red-400' : ''}`}
                            />
                          )}
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className={`${chipClass} bg-[#079C9C]/15 text-[#047a7a]`}>item novo</span>
                            {v.marcado && (
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setBuscandoKey(k)}
                                className="text-[11px] font-semibold text-[#079C9C] hover:underline"
                              >
                                {v.catalogo ? 'Trocar produto' : 'Ligar ao catálogo'} <Kbd>F2</Kbd>
                              </button>
                            )}
                          </div>
                        </div>

                        <span className="text-xs text-slate-400">— não está</span>
                        <span className="text-xs text-slate-600">
                          {numeroTexto(n.quantidade)}
                          {n.unidade ? ` ${n.unidade}` : ''} × {reais4(n.preco)}
                        </span>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <input
                              {...cel(r, 2)}
                              data-invalido={qRuim ? '1' : undefined}
                              value={v.qtd}
                              disabled={!v.marcado}
                              onFocus={selecionar}
                              onChange={(e) => setNovo(k, { qtd: e.target.value })}
                              inputMode="decimal"
                              aria-label={`Quantidade de ${n.nome}`}
                              className={`${campo} w-[4.5rem] ${qRuim ? 'border-red-400' : ''}`}
                            />
                            <span className="text-xs text-slate-400">×</span>
                            <input
                              {...cel(r, 3)}
                              data-invalido={pRuim ? '1' : undefined}
                              value={v.preco}
                              disabled={!v.marcado}
                              onFocus={selecionar}
                              onChange={(e) => setNovo(k, { preco: e.target.value })}
                              inputMode="decimal"
                              aria-label={`Custo unitário de ${n.nome}`}
                              className={`${campo} w-[6rem] ${pRuim ? 'border-red-400' : ''}`}
                            />
                          </div>
                          <span className="block text-[11px] text-slate-500">
                            {v.unidade ? `${v.unidade} · ` : ''}total {reais(sub)}
                          </span>
                        </div>

                        {camposPreco(r, chave, p ?? 0, v.marcado, n.nome)}
                      </div>

                      {buscandoKey === k && (
                        <div className="mt-2 pl-11">
                          <BuscaCatalogo
                            inicial={n.nome}
                            onFechar={() => fecharBusca(k)}
                            onEscolher={(prod) => {
                              setNovo(k, {
                                codigo: prod.code,
                                nome: prod.name,
                                unidade: prod.unit ?? v.unidade,
                                catalogo: true,
                              })
                              fecharBusca(k)
                            }}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* rodapé */}
      <div className="shrink-0 border-t border-slate-200 bg-white">
        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Total do pedido</p>
            <p className="text-lg font-bold text-slate-900">
              {reais(pedido.total)} <span className="text-slate-400">→</span>{' '}
              <span className="text-[#079C9C]">{reais(totalDepois)}</span>
            </p>
            {mudaExtra && (
              <p className="text-xs text-slate-500">
                {frete > 0 ? `Frete e outras despesas ${reais(frete)}` : `Desconto ${reais(desconto)}`}
              </p>
            )}
          </div>

          <button
            type="button"
            tabIndex={-1}
            role="switch"
            aria-checked={fecharEf}
            disabled={!podeFechar}
            onClick={() => setFechar((v) => !v)}
            title={
              podeFechar
                ? `A nota fecha em ${reais(totalNotas)}. A diferença para a soma dos itens entra como frete e outras despesas (ou desconto).`
                : 'Indisponível: ainda há itens do pedido sem par, itens da nota que não vão para o pedido ou notas sem XML.'
            }
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                fecharEf ? 'bg-[#079C9C]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`size-4 rounded-full bg-white shadow transition ${fecharEf ? 'translate-x-4' : ''}`}
              />
            </span>
            <span>
              <span className="block text-xs font-semibold text-slate-700">
                Fechar o total com a nota <Kbd>Alt+F</Kbd>
              </span>
              <span className="block text-[11px] text-slate-500">
                {podeFechar ? `Nota: ${reais(totalNotas)}` : 'Indisponível'}
              </span>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-3">
            <p className="hidden max-w-[14rem] truncate text-xs text-slate-500 xl:block">
              {resumo || 'Nada para aplicar ainda.'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={onFechar}
              disabled={salvando}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Cancelar <span className="ml-1.5 text-[10px] text-slate-400">Esc</span>
            </Button>
            <Button
              id="aj-aplicar"
              type="button"
              onClick={aplicar}
              disabled={salvando || nada}
              className="min-w-40 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
            >
              {salvando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  Aplicar <span className="text-[10px] text-white/70">Ctrl+Enter</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="hidden border-t border-slate-100 bg-slate-50 px-6 py-1.5 text-[11px] text-slate-500 md:block">
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> linhas · <Kbd>←</Kbd> <Kbd>→</Kbd> colunas · <Kbd>Enter</Kbd> desce ·{' '}
          <Kbd>Espaço</Kbd> marca · <Kbd>F2</Kbd> catálogo · <Kbd>Alt+G</Kbd> % para todos ·{' '}
          <Kbd>Alt+M</Kbd> markup/margem · <Kbd>Ctrl+Enter</Kbd> aplica
        </p>
      </div>
    </div>
  )
}

export default function AjustarPedidoDialog({
  aberto,
  onClose,
  ...resto
}: {
  aberto: boolean
  pedido: PedidoCompra
  itens: ItemPedidoCompra[]
  pares: LinhaConferencia[]
  soNota: ItemNota[]
  podeFecharTotal: boolean
  totalNotas: number
  abaInicial: AbaAjuste
  notasPreMarcadas: string[]
  onClose: () => void
  onAplicado: (aviso: string) => void
}) {
  const sujo = useRef(false)
  const esc = useRef(false)

  const fechar = () => {
    if (sujo.current && !window.confirm('Descartar o ajuste? O que você marcou será perdido.')) return
    onClose()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // com a busca do catálogo aberta, o Esc fecha só a busca
          if (esc.current) e.preventDefault()
        }}
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[1080px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {aberto && <Conteudo {...resto} onFechar={fechar} sujoRef={sujo} escRef={esc} />}
      </DialogContent>
    </Dialog>
  )
}