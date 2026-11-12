'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  Package,
  Search,
  StickyNote,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { listFornecedores } from '@/features/comparar-precos/services/comparacaoService'
import type { Fornecedor } from '@/features/comparar-precos/types'
import { lerPreco } from '@/features/comparar-precos/utils/melhorPreco'
import { buscarProdutos, type ProdutoLoja } from '@/features/loja/services/lojaCatalogoService'
import { dataCurta, hoje, reais } from '@/features/loja/lib/formatar'
import {
  criarPedidos,
  editarPedido,
  ultimosPrecos,
  type DadosPedidoCompra,
  type ItemEntrada,
  type UltimoPreco,
} from '../services/comprasService'
import { chaveItem, somarDias } from '../lib/compras'

export interface PedidoInicial {
  id?: string // preenchido = editando um pedido existente
  dados: DadosPedidoCompra
  itens: ItemEntrada[]
}

// ---------- utilidades ----------

const arredonda = (n: number) => Math.round(n * 100) / 100
const arredonda6 = (n: number) => Math.round(n * 1e6) / 1e6
const paraNumero = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')))
const qtdTexto = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')
const precoTexto = (n: number) => n.toFixed(2).replace('.', ',')

// custo unitário com frete pode ter até 4 casas
const reais4 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

const celula =
  'h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-base outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/30 md:text-sm'

// Colunas (desktop): item | qtd | preço un. | subtotal | ações
// No celular: nome em linha própria, qtd e preço lado a lado, subtotal + ações embaixo.
const COLUNAS = 'md:grid-cols-[minmax(0,1fr)_7rem_8rem_7rem_6.5rem]'
const LINHA = `grid grid-cols-2 items-center gap-x-2 gap-y-1.5 ${COLUNAS}`

const CONDICOES = ['À vista', '7 dias', '14 dias', '28 dias', '30/60 dias']

type ModoDesconto = 'valor' | 'pct'

// O que fazer com o frete:
//  - 'valor': soma no custo dos itens, proporcional ao valor de cada um
//  - 'igual': soma no custo dos itens, a mesma parte para cada item
//  - 'separado': fica como frete do pedido, fora do custo dos itens
type ModoFrete = 'valor' | 'igual' | 'separado'

const MODOS_FRETE: [ModoFrete, string][] = [
  ['valor', 'Por valor'],
  ['igual', 'Igual'],
  ['separado', 'Separado'],
]

const EXPLICACAO_FRETE: Record<ModoFrete, string> = {
  valor: 'Somado ao custo dos itens, proporcional ao valor de cada um.',
  igual: 'Somado ao custo dos itens, a mesma parte para cada item.',
  separado: 'Fica como frete do pedido, fora do custo dos itens.',
}

// "10 cimento" ou "10x cimento" -> quantidade 10
function interpretar(texto: string): { nome: string; quantidade: number; informou: boolean } {
  const t = texto.trim()
  const m = t.match(/^(\d+)\s*x\s*(.+)$/i) || t.match(/^(\d+)\s+(.+)$/)
  if (m) {
    const q = Number(m[1])
    if (q >= 1) return { nome: m[2].trim(), quantidade: q, informou: true }
  }
  return { nome: t, quantidade: 1, informou: false }
}

interface ItemForm {
  key: number
  codigo: string
  nome: string
  unidade: string | null
  qtd: string // em UNIDADES; se "emCaixas" estiver ligado, em CAIXAS
  preco: string // preço da unidade; se "porCaixa" estiver preenchido, é o preço da CAIXA
  porCaixa: string // unidades por caixa ('' = preço já é por unidade)
  caixaAberta: boolean
  emCaixas: boolean // true = a quantidade digitada está em CAIXAS
  obs: string
  obsAberta: boolean
}

function novoItemForm(base: Partial<ItemForm> & Pick<ItemForm, 'key' | 'nome'>): ItemForm {
  return {
    codigo: '',
    unidade: null,
    qtd: '1',
    preco: '',
    porCaixa: '',
    caixaAberta: false,
    emCaixas: false,
    obs: '',
    obsAberta: false,
    ...base,
  }
}

// preço de 1 unidade, sem arredondar e sem desconto (null = preço inválido/vazio)
function precoBase(i: ItemForm): number | null {
  const p = lerPreco(i.preco)
  if (p === null || !Number.isFinite(p) || p < 0) return null
  const n = paraNumero(i.porCaixa)
  return Number.isFinite(n) && n > 0 ? p / n : p
}

// preço final de 1 unidade, já com o fator de desconto (sem frete)
function precoFinal(i: ItemForm, fator: number): number | null {
  const b = precoBase(i)
  return b === null ? null : arredonda(b * fator)
}

// quantidade em UNIDADES (converte se estiver no modo "em caixas")
function qtdUnidades(i: ItemForm): number {
  const q = paraNumero(i.qtd)
  if (!Number.isFinite(q)) return q
  const n = paraNumero(i.porCaixa)
  return i.emCaixas && Number.isFinite(n) && n > 0 ? Math.round(q * n * 1000) / 1000 : q
}

function subtotalDe(i: ItemForm, fator: number) {
  const q = qtdUnidades(i)
  const p = precoFinal(i, fator)
  return Number.isFinite(q) && q > 0 && p !== null ? arredonda(q * p) : 0
}

// divide o frete entre os itens (em centavos); o último item leva o resto para fechar a soma
function dividirFrete(
  itens: ItemForm[],
  fator: number,
  frete: number,
  modo: Exclude<ModoFrete, 'separado'>
): Map<number, number> {
  const partes = new Map<number, number>()

  const alvos = itens.flatMap((i) => {
    const q = qtdUnidades(i)
    const b = precoBase(i)
    return Number.isFinite(q) && q > 0 && b !== null ? [{ key: i.key, total: q * b * fator }] : []
  })
  if (alvos.length === 0 || frete <= 0) return partes

  const somaTotais = alvos.reduce((s, a) => s + a.total, 0)
  const porValor = modo === 'valor' && somaTotais > 0

  let restante = frete
  alvos.forEach((a, idx) => {
    const parte =
      idx === alvos.length - 1
        ? restante
        : arredonda(frete * (porValor ? a.total / somaTotais : 1 / alvos.length))
    restante = arredonda(restante - parte)
    partes.set(a.key, parte)
  })

  return partes
}

function Campo({
  id,
  label,
  children,
  className = '',
}: {
  id?: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-slate-300 bg-white px-1 font-sans text-[10px] font-semibold text-slate-500">
      {children}
    </kbd>
  )
}

// ---------- conteúdo (só existe enquanto a janela está aberta) ----------

function Conteudo({
  inicial,
  onFechar,
  onSujo,
  onSalvo,
  escRef,
}: {
  inicial: PedidoInicial
  onFechar: () => void
  onSujo: (sujo: boolean) => void
  onSalvo: (id: string, numero: number) => void
  escRef: MutableRefObject<boolean>
}) {
  const editando = !!inicial.id
  const d = inicial.dados
  const contador = useRef(0)
  const buscaRef = useRef<HTMLInputElement>(null)
  const tabelaRef = useRef<HTMLDivElement>(null)

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [ref, setRef] = useState<string | null>(d.fornecedor_ref)
  const [nome, setNome] = useState(d.fornecedor_nome)
  const [contato, setContato] = useState(d.fornecedor_contato ?? '')
  const [prazo, setPrazo] = useState(d.prazo_dias != null ? String(d.prazo_dias) : '')
  const [condicao, setCondicao] = useState(d.condicao_pagamento ?? '')
  const [previsao, setPrevisao] = useState(d.previsao_entrega ?? '')
  const [frete, setFrete] = useState(d.frete > 0 ? precoTexto(d.frete) : '')
  // pedido novo: o frete já entra no custo dos itens. Pedido antigo com frete separado
  // continua como estava, até a pessoa escolher outra opção.
  const [modoFrete, setModoFrete] = useState<ModoFrete>(editando && d.frete > 0 ? 'separado' : 'valor')
  const [desconto, setDesconto] = useState(d.desconto > 0 ? precoTexto(d.desconto) : '')
  const [modoDesconto, setModoDesconto] = useState<ModoDesconto>('valor')
  const [obs, setObs] = useState(d.observacao ?? '')
  const [maisAberto, setMaisAberto] = useState(!!(d.fornecedor_contato || d.observacao))
  const [limiteBusca, setLimiteBusca] = useState(30)

  const [itens, setItens] = useState<ItemForm[]>(() =>
    inicial.itens.map((i) =>
      novoItemForm({
        key: ++contador.current,
        codigo: i.codigo,
        nome: i.nome,
        unidade: i.unidade,
        qtd: qtdTexto(i.quantidade),
        preco: i.preco > 0 ? precoTexto(i.preco) : '',
        obs: i.observacao,
      })
    )
  )

  // busca de produtos
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ProdutoLoja[]>([])
  const [destaque, setDestaque] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const enterOcupado = useRef(false)

  // depois de adicionar um item, o foco vai para a quantidade ou o preço dele
  const [foco, setFoco] = useState<{ key: number; c: number } | null>(null)

  const [ultimos, setUltimos] = useState<Map<string, UltimoPreco>>(new Map())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // fornecedores cadastrados no Comparar preços
  useEffect(() => {
    listFornecedores()
      .then(setFornecedores)
      .catch(() => {})
  }, [])

  // foco inicial: fornecedor vazio -> nome; senão -> busca de itens
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!nome.trim()) document.getElementById('pc-nome')?.focus()
      else buscaRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
    // só na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // com texto na busca, o Esc limpa a busca em vez de fechar a janela
  useEffect(() => {
    escRef.current = termo !== ''
    return () => {
      escRef.current = false
    }
  }, [termo, escRef])

  // resultados da busca enquanto digita
  const consulta = interpretar(termo).nome
  useEffect(() => {
    if (consulta.length < 2 && !/^\d+$/.test(consulta)) {
      setResultados([])
      setBuscando(false)
      return
    }
    let cancelado = false
    setBuscando(true)
    const timer = setTimeout(async () => {
      try {
        const r = await buscarProdutos({ termo: consulta, pagina: 0, soComEstoque: false })
        if (!cancelado) {
          setResultados(r.itens.slice(0, limiteBusca))
          setDestaque(0)
        }
      } catch {
        if (!cancelado) setResultados([])
      } finally {
        if (!cancelado) setBuscando(false)
      }
    }, 250)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [consulta, limiteBusca])

  useEffect(() => {
    document.getElementById(`pc-res-${destaque}`)?.scrollIntoView({ block: 'nearest' })
  }, [destaque])

  // última compra de cada produto (para o alerta de variação)
  const chavesTexto = itens.map((i) => chaveItem(i.codigo, i.nome)).filter(Boolean).join('\u0000')
  useEffect(() => {
    const lista = chavesTexto ? Array.from(new Set(chavesTexto.split('\u0000'))) : []
    if (lista.length === 0) {
      setUltimos(new Map())
      return
    }
    let cancelado = false
    const timer = setTimeout(() => {
      ultimosPrecos(lista, inicial.id)
        .then((m) => {
          if (!cancelado) setUltimos(m)
        })
        .catch(() => {})
    }, 400)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [chavesTexto, inicial.id])

  // foco pendente depois de adicionar item
  useEffect(() => {
    if (!foco) return
    const el = tabelaRef.current?.querySelector<HTMLInputElement>(
      `[data-key="${foco.key}"][data-c="${foco.c}"]`
    )
    if (el) {
      el.focus()
      el.select()
    }
    setFoco(null)
  }, [foco, itens])

  // ---------- totais, desconto e frete ----------

  // soma dos itens SEM desconto
  const bruto = arredonda(itens.reduce((s, i) => s + subtotalDe(i, 1), 0))

  const freteNum = frete.trim() === '' ? 0 : (lerPreco(frete) ?? 0)

  // desconto digitado: em % ou em R$ (nulo = inválido)
  const descontoDigitado: number | null = (() => {
    if (desconto.trim() === '') return 0
    const v = modoDesconto === 'pct' ? paraNumero(desconto) : lerPreco(desconto)
    return v === null || !Number.isFinite(v) || v < 0 ? null : v
  })()

  const descontoInvalido =
    descontoDigitado === null ||
    (modoDesconto === 'pct' && descontoDigitado > 100) ||
    (modoDesconto === 'valor' && descontoDigitado > bruto)

  // fator aplicado no preço de cada item: 1 = sem desconto
  const fator = (() => {
    if (descontoInvalido || !descontoDigitado) return 1
    if (modoDesconto === 'pct') return 1 - descontoDigitado / 100
    return bruto > 0 ? 1 - descontoDigitado / bruto : 1
  })()

  // soma dos itens já com o desconto, antes do frete
  const somaBase = arredonda(itens.reduce((s, i) => s + subtotalDe(i, fator), 0))
  const descontoEfetivo = arredonda(bruto - somaBase)

  const freteValor = Number.isFinite(freteNum) && freteNum > 0 ? freteNum : 0
  const ratearFrete = modoFrete !== 'separado' && freteValor > 0 && somaBase > 0

  // quanto do frete cai em cada item
  const partesFrete = ratearFrete
    ? dividirFrete(itens, fator, freteValor, modoFrete as Exclude<ModoFrete, 'separado'>)
    : new Map<number, number>()

  // preço final de 1 unidade: com desconto e com a parte do frete (é o que vai para o pedido)
  const custoUnit = (i: ItemForm): number | null => {
    const p = precoFinal(i, fator)
    const extra = partesFrete.get(i.key)
    const q = qtdUnidades(i)
    const b = precoBase(i)
    if (!extra || p === null || b === null || !(q > 0)) return p
    return arredonda6(b * fator + extra / q)
  }

  const subtotalFinal = (i: ItemForm) => {
    const q = qtdUnidades(i)
    const c = custoUnit(i)
    return Number.isFinite(q) && q > 0 && c !== null ? arredonda(q * c) : 0
  }

  // o dinheiro que sai é o mesmo nos dois casos: itens (com desconto) + frete
  const total = arredonda(somaBase + (Number.isFinite(freteNum) ? freteNum : 0))

  // só pergunta antes de fechar se algo mudou
  const snapshot = JSON.stringify([
    ref, nome, contato, prazo, condicao, previsao, frete, modoFrete, desconto, modoDesconto, obs,
    itens.map((i) => [i.codigo, i.nome, i.qtd, i.preco, i.porCaixa, i.emCaixas, i.obs]),
  ])
  const [snapshotInicial] = useState(snapshot)
  useEffect(() => {
    onSujo(snapshot !== snapshotInicial)
  }, [snapshot, snapshotInicial, onSujo])

  // ---------- fornecedor ----------

  const escolherFornecedor = (id: string) => {
    const f = fornecedores.find((x) => x.id === id)
    if (!f) return
    setRef(f.id)
    setNome(f.name)
    setContato(f.contact ?? '')
    if (f.lead_time_days != null) {
      setPrazo(String(f.lead_time_days))
      if (!previsao) setPrevisao(somarDias(hoje(), f.lead_time_days))
    }
  }

  // digitou o nome de um fornecedor cadastrado: liga e preenche (só em pedido novo)
  const mudarFornecedor = (texto: string) => {
    setNome(texto)
    const f = fornecedores.find((x) => x.name.trim().toLowerCase() === texto.trim().toLowerCase())
    if (!f) return
    if (editando) setRef(f.id)
    else escolherFornecedor(f.id)
  }

  const fornecedorLigado = ref ? fornecedores.find((f) => f.id === ref) : undefined

  // ---------- itens ----------

  const alterar = (key: number, dados: Partial<ItemForm>) =>
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, ...dados } : i)))

  const remover = (key: number) => {
    setItens((prev) => prev.filter((i) => i.key !== key))
    buscaRef.current?.focus()
  }

  const adicionarProduto = (p: ProdutoLoja, quantidade = 1, informou = false) => {
    setErro('')
    const existente = itens.find((x) => x.codigo !== '' && x.codigo === p.code)
    if (existente) {
      const atual = paraNumero(existente.qtd)
      alterar(existente.key, { qtd: qtdTexto((Number.isFinite(atual) ? atual : 0) + quantidade) })
      setFoco({ key: existente.key, c: 1 })
    } else {
      const key = ++contador.current
      setItens((prev) => [
        // o preço de compra é digitado: o do catálogo é o de venda
        novoItemForm({
          key,
          codigo: p.code,
          nome: p.name,
          unidade: p.unit,
          qtd: qtdTexto(quantidade),
        }),
        ...prev,
      ])
      setFoco({ key, c: informou ? 2 : 1 })
    }
    setTermo('')
    setResultados([])
    setLimiteBusca(30)
  }

  const adicionarAvulso = (nomeItem: string, quantidade: number, informou: boolean) => {
    setErro('')
    const key = ++contador.current
    setItens((prev) => [novoItemForm({ key, nome: nomeItem, qtd: qtdTexto(quantidade) }), ...prev])
    setFoco({ key, c: informou ? 2 : 1 })
    setTermo('')
    setResultados([])
    setLimiteBusca(30)
  }

  // Enter: adiciona o resultado destacado; sem resultado, entra como item avulso
  const adicionarPorEnter = async () => {
    const t = termo.trim()
    if (!t || enterOcupado.current) return
    enterOcupado.current = true
    try {
      const { nome: busca, quantidade, informou } = interpretar(t)

      if (resultados.length > 0 && !buscando) {
        adicionarProduto(resultados[Math.min(destaque, resultados.length - 1)], quantidade, informou)
        return
      }

      try {
        const r = await buscarProdutos({ termo: busca, pagina: 0, soComEstoque: false })
        if (r.itens[0]) {
          adicionarProduto(r.itens[0], quantidade, informou)
          return
        }
      } catch {
        // cai para item avulso
      }
      adicionarAvulso(busca, quantidade, informou)
    } finally {
      enterOcupado.current = false
    }
  }

  // ---------- teclado na tabela de itens ----------

  const focarCelula = (key: string | undefined, c: number) => {
    const el = tabelaRef.current?.querySelector<HTMLInputElement>(`[data-key="${key}"][data-c="${c}"]`)
    if (el) {
      el.focus()
      el.select()
    }
  }

  const mover = (el: HTMLElement, dr: number, dc: number) => {
    const root = tabelaRef.current
    if (!root) return
    const r = Number(el.dataset.r)
    const c = Number(el.dataset.c)
    const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-cell]'))
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
      alvo = cells.find((x) => Number(x.dataset.r) === r + dr && Number(x.dataset.c) === c)
    }

    if (alvo) {
      alvo.focus()
      if (alvo instanceof HTMLInputElement) alvo.select()
    } else if (dc === 0 && dr < 0) {
      buscaRef.current?.focus()
      buscaRef.current?.select()
    }
  }

  const tecla = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const c = Number(el.dataset.c)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mover(el, 1, 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      mover(el, -1, 0)
    } else if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) return
      e.preventDefault()
      // nome -> quantidade -> preço -> volta para a busca
      if (c < 2) focarCelula(el.dataset.key, c + 1)
      else {
        buscaRef.current?.focus()
        buscaRef.current?.select()
      }
    } else if (e.key === 'ArrowRight') {
      if (el.selectionEnd === el.value.length && (el.selectionStart === el.value.length || el.selectionStart === 0)) {
        e.preventDefault()
        mover(el, 0, 1)
      }
    } else if (e.key === 'ArrowLeft') {
      if (el.selectionStart === 0 && (el.selectionEnd === 0 || el.selectionEnd === el.value.length)) {
        e.preventDefault()
        mover(el, 0, -1)
      }
    }
  }

  const selecionar = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

  // ---------- salvar ----------

  const salvar = async () => {
    if (salvando) return
    setErro('')

    const nomeF = nome.trim()
    if (nomeF.length < 2) {
      setErro('Informe o fornecedor.')
      document.getElementById('pc-nome')?.focus()
      return
    }
    if (itens.length === 0) {
      setErro('Adicione pelo menos um item.')
      buscaRef.current?.focus()
      return
    }

    const lista: ItemEntrada[] = []
    for (const i of itens) {
      const q = qtdUnidades(i) // já convertida para unidades
      const p = custoUnit(i) // já com o desconto e a parte do frete
      if (i.nome.trim() === '') {
        setErro('Há um item sem nome.')
        focarCelula(String(i.key), 0)
        return
      }
      if (!Number.isFinite(q) || q <= 0) {
        setErro(`Informe a quantidade de ${i.nome}.`)
        focarCelula(String(i.key), 1)
        return
      }
      if (p === null) {
        setErro(`Informe o preço de ${i.nome}.`)
        focarCelula(String(i.key), 2)
        return
      }
      lista.push({
        codigo: i.codigo,
        nome: i.nome.trim(),
        unidade: i.unidade,
        quantidade: q,
        preco: p,
        observacao: i.obs.trim(),
      })
    }

    if (!Number.isFinite(freteNum) || freteNum < 0) {
      setErro('Frete inválido.')
      return
    }
    if (descontoInvalido) {
      setErro(
        modoDesconto === 'pct'
          ? 'Desconto inválido. Use um valor de 0 a 100%.'
          : 'Desconto inválido. Não pode ser maior que o valor dos itens.'
      )
      document.getElementById('pc-desconto')?.focus()
      return
    }

    let prazoNum: number | null = null
    if (prazo.trim() !== '') {
      prazoNum = Number(prazo)
      if (!Number.isInteger(prazoNum) || prazoNum < 0 || prazoNum > 365) {
        setErro('O prazo deve ser um número inteiro de dias.')
        return
      }
    }

    const dados: DadosPedidoCompra = {
      fornecedor_ref: ref,
      fornecedor_nome: nomeF,
      fornecedor_contato: contato.trim() || null,
      prazo_dias: prazoNum,
      comparacao_ref: d.comparacao_ref,
      comparacao_nome: d.comparacao_nome,
      condicao_pagamento: condicao.trim() || null,
      previsao_entrega: previsao || null,
      // frete rateado já está no preço de cada item: não pode contar de novo
      frete: ratearFrete ? 0 : freteNum,
      desconto: 0, // o desconto já foi aplicado no preço de cada item
      observacao: obs.trim() || null,
    }

    setSalvando(true)
    try {
      if (inicial.id) {
        const r = await editarPedido(inicial.id, dados, lista)
        onSalvo(r.id, r.numero)
      } else {
        const [novo] = await criarPedidos([{ dados, itens: lista }])
        onSalvo(novo.id, novo.numero)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o pedido')
      setSalvando(false)
    }
  }

  const global = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      salvar()
    }
  }

  const fornecedoresOrdenados = useMemo(
    () => [...fornecedores].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [fornecedores]
  )

  return (
    <div onKeyDown={global} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 bg-[#079C9C] py-3.5 pl-6 pr-12 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <ClipboardCheck className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg font-bold text-white">
              {editando ? 'Editar pedido de compra' : 'Novo pedido de compra'}
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {d.comparacao_nome ? `Da comparação ${d.comparacao_nome}` : 'Fornecedor, itens e prazo de entrega'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-6">
        {/* fornecedor e entrega */}
        <section className="grid gap-3 md:grid-cols-12">
          <Campo id="pc-nome" label="Fornecedor" className="md:col-span-6">
            <input
              id="pc-nome"
              list="pc-fornecedores"
              value={nome}
              onChange={(e) => mudarFornecedor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  document.getElementById('pc-previsao')?.focus()
                }
              }}
              maxLength={120}
              autoComplete="off"
              placeholder="Digite para buscar um fornecedor cadastrado"
              className={inputClass}
            />
            <datalist id="pc-fornecedores">
              {fornecedoresOrdenados.map((f) => (
                <option key={f.id} value={f.name} />
              ))}
            </datalist>
            {fornecedorLigado && (
              <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                <Check className="size-3.5" />
                Fornecedor cadastrado
              </p>
            )}
          </Campo>

          <Campo id="pc-previsao" label="Previsão de entrega" className="md:col-span-3">
            <input
              id="pc-previsao"
              type="date"
              value={previsao}
              onChange={(e) => setPrevisao(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  document.getElementById('pc-condicao')?.focus()
                }
              }}
              className={inputClass}
            />
          </Campo>

          <Campo id="pc-prazo" label="Prazo do fornecedor (dias)" className="md:col-span-3">
            <input
              id="pc-prazo"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
            />
          </Campo>

          <Campo id="pc-condicao" label="Condição de pagamento" className="md:col-span-12">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                id="pc-condicao"
                value={condicao}
                onChange={(e) => setCondicao(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault()
                    buscaRef.current?.focus()
                  }
                }}
                maxLength={60}
                autoComplete="off"
                placeholder="Ex: 28 dias"
                className={`${inputClass} md:max-w-xs`}
              />
              <div className="flex flex-wrap gap-1.5">
                {CONDICOES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    tabIndex={-1}
                    onClick={() => setCondicao(c)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      condicao === c
                        ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </Campo>
        </section>

        {/* itens */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-800">Itens ({itens.length})</h4>
            <p className="hidden text-xs text-slate-400 md:block">
              Ex: <strong>10 cimento</strong> + <Kbd>Enter</Kbd> já entra com quantidade 10
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={buscaRef}
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value)
                setLimiteBusca(30)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  adicionarPorEnter()
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (resultados.length > 0) setDestaque((i) => Math.min(i + 1, resultados.length - 1))
                  else tabelaRef.current?.querySelector<HTMLElement>('[data-cell]')?.focus()
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setDestaque((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Escape' && termo) {
                  e.preventDefault()
                  setTermo('')
                  setResultados([])
                }
              }}
              placeholder="Buscar no catálogo (código, barras ou descrição). Enter adiciona."
              aria-label="Buscar produto para o pedido"
              autoComplete="off"
              enterKeyHint="done"
              className={`${inputClass} pl-9 pr-9`}
            />
            {buscando ? (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
            ) : (
              termo && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setTermo('')
                    setLimiteBusca(30)
                    buscaRef.current?.focus()
                  }}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              )
            )}
          </div>

          {resultados.length > 0 && (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              {resultados.map((p, idx) => {
                const noPedido = itens.some((x) => x.codigo !== '' && x.codigo === p.code)
                return (
                  <li key={p.id}>
                    <button
                      id={`pc-res-${idx}`}
                      type="button"
                      tabIndex={-1}
                      onMouseEnter={() => setDestaque(idx)}
                      onClick={() => {
                        const { quantidade, informou } = interpretar(termo)
                        adicionarProduto(p, quantidade, informou)
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                        idx === destaque ? 'bg-[#079C9C]/10' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          Cód. {p.code}
                          {p.unit ? ` · ${p.unit}` : ''}
                        </span>
                      </span>
                      {noPedido && (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                          <Check className="size-3.5" />
                          No pedido
                        </span>
                      )}
                      {idx === destaque && (
                        <span className="shrink-0 text-[11px] font-semibold text-[#047a7a]">Enter</span>
                      )}
                    </button>
                  </li>
                )
              })}

              {resultados.length >= limiteBusca && (
                <li>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setLimiteBusca((l) => l + 30)}
                    className="w-full p-2 text-center text-sm font-semibold text-[#079C9C] hover:bg-slate-50"
                  >
                    Mostrar mais
                  </button>
                </li>
              )}
            </ul>
          )}

          {itens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
              <ClipboardCheck className="size-7 text-slate-300" />
              <p className="text-sm text-slate-500">
                Nenhum item ainda. Digite na busca acima e aperte <Kbd>Enter</Kbd>. Se não achar no
                catálogo, entra como item avulso.
              </p>
            </div>
          ) : (
            <div ref={tabelaRef} className="space-y-1.5">
              <div
                className={`hidden px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid md:items-center md:gap-x-2 ${COLUNAS}`}
              >
                <span>Item</span>
                <span className="text-right">Qtd</span>
                <span className="text-right">Preço un.</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>

              <ul className="space-y-1.5">
                {itens.map((i, r) => {
                  const ultimo = ultimos.get(chaveItem(i.codigo, i.nome))
                  const preco = custoUnit(i) // preço da unidade, com desconto e frete
                  const extraFrete = partesFrete.get(i.key) ?? 0
                  const variacao =
                    ultimo && ultimo.preco > 0 && preco !== null
                      ? ((preco - ultimo.preco) / ultimo.preco) * 100
                      : null

                  const nPorCaixa = paraNumero(i.porCaixa)
                  const emCaixa = Number.isFinite(nPorCaixa) && nPorCaixa > 0
                  const modoCaixas = emCaixa && i.emCaixas
                  const qtdNum = paraNumero(i.qtd)
                  const unidadesTotal = qtdUnidades(i)
                  const caixas =
                    emCaixa && Number.isFinite(qtdNum) && qtdNum > 0
                      ? modoCaixas
                        ? qtdNum
                        : qtdNum / nPorCaixa
                      : null

                  return (
                    <li
                      key={i.key}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 transition focus-within:border-[#079C9C] focus-within:shadow-sm"
                    >
                      <div className={LINHA}>
                        <input
                          data-cell=""
                          data-key={i.key}
                          data-r={r}
                          data-c={0}
                          onKeyDown={tecla}
                          onFocus={selecionar}
                          value={i.nome}
                          onChange={(e) => alterar(i.key, { nome: e.target.value })}
                          aria-label="Nome do item"
                          className={`${celula} col-span-2 font-semibold md:col-span-1`}
                        />

                        <div className="relative min-w-0">
                          <input
                            data-cell=""
                            data-key={i.key}
                            data-r={r}
                            data-c={1}
                            onKeyDown={tecla}
                            onFocus={selecionar}
                            value={i.qtd}
                            onChange={(e) => alterar(i.key, { qtd: e.target.value })}
                            inputMode="decimal"
                            aria-label={`${modoCaixas ? 'Quantidade em caixas de' : 'Quantidade de'} ${i.nome}`}
                            className={`${celula} text-right ${i.unidade || modoCaixas ? 'pr-9' : ''}`}
                          />
                          {(modoCaixas || i.unidade) && (
                            <span className="pointer-events-none absolute right-2 top-1/2 max-w-[2rem] -translate-y-1/2 truncate text-[11px] text-slate-400">
                              {modoCaixas ? 'cx' : i.unidade}
                            </span>
                          )}
                        </div>

                        <div className="relative min-w-0">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            R$
                          </span>
                          <input
                            data-cell=""
                            data-key={i.key}
                            data-r={r}
                            data-c={2}
                            onKeyDown={tecla}
                            onFocus={selecionar}
                            value={i.preco}
                            onChange={(e) => alterar(i.key, { preco: e.target.value })}
                            inputMode="decimal"
                            placeholder={emCaixa ? 'Preço cx' : 'Preço'}
                            aria-label={`${emCaixa ? 'Preço da caixa de' : 'Preço de'} ${i.nome}`}
                            className={`${celula} pl-7 text-right ${
                              i.preco.trim() === '' ? 'border-amber-300 bg-amber-50' : ''
                            }`}
                          />
                        </div>

                        <div className="col-span-2 flex items-center justify-between gap-2 md:contents">
                          <span className="min-w-0 truncate text-base font-bold text-slate-900 md:text-right md:text-sm">
                            {reais(subtotalFinal(i))}
                          </span>
                          <div className="flex shrink-0 justify-end gap-0.5">
                            <button
                              type="button"
                              tabIndex={-1}
                              aria-label={`Unidades por caixa de ${i.nome}`}
                              title="Preço por caixa (unidades por caixa)"
                              onClick={() => alterar(i.key, { caixaAberta: !i.caixaAberta })}
                              className={`rounded-md p-1.5 transition hover:bg-slate-100 ${
                                emCaixa ? 'text-[#079C9C]' : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              <Package className="size-4" />
                            </button>
                            <button
                              type="button"
                              tabIndex={-1}
                              aria-label={`Observação de ${i.nome}`}
                              title="Observação do item"
                              onClick={() => alterar(i.key, { obsAberta: !i.obsAberta })}
                              className={`rounded-md p-1.5 transition hover:bg-slate-100 ${
                                i.obs ? 'text-[#079C9C]' : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              <StickyNote className="size-4" />
                            </button>
                            <button
                              type="button"
                              tabIndex={-1}
                              aria-label={`Remover ${i.nome}`}
                              title="Remover item"
                              onClick={() => remover(i.key)}
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {extraFrete > 0 && preco !== null && (
                        <p className="mt-1.5 text-xs font-medium text-emerald-700">
                          + {reais(extraFrete)} de frete → custo de {reais4(preco)} por un.
                        </p>
                      )}

                      {(i.caixaAberta || emCaixa) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                          <Package className="size-3.5 shrink-0 text-slate-400" />
                          <label htmlFor={`pc-cx-${i.key}`}>Caixa com</label>
                          <input
                            id={`pc-cx-${i.key}`}
                            value={i.porCaixa}
                            onChange={(e) =>
                              alterar(i.key, { porCaixa: e.target.value.replace(/\D/g, '').slice(0, 5) })
                            }
                            onFocus={selecionar}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                                e.preventDefault()
                                buscaRef.current?.focus()
                              }
                            }}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="12"
                            className={`${celula} !w-16 text-right`}
                          />
                          <span>un.</span>
                          {[12, 24].map((n) => (
                            <button
                              key={n}
                              type="button"
                              tabIndex={-1}
                              onClick={() => alterar(i.key, { porCaixa: String(n) })}
                              className={`rounded-full border px-2 py-0.5 font-medium transition ${
                                nPorCaixa === n
                                  ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                                  : 'border-slate-200 bg-white hover:bg-slate-100'
                              }`}
                            >
                              {n}
                            </button>
                          ))}

                          {emCaixa && (
                            <label className="flex cursor-pointer items-center gap-1.5 font-medium text-slate-700">
                              <input
                                type="checkbox"
                                tabIndex={-1}
                                checked={i.emCaixas}
                                onChange={(e) => alterar(i.key, { emCaixas: e.target.checked })}
                                className="size-3.5 accent-[#079C9C]"
                              />
                              Quantidade em caixas
                            </label>
                          )}

                          {emCaixa && (
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() =>
                                alterar(i.key, { porCaixa: '', caixaAberta: false, emCaixas: false })
                              }
                              className="ml-auto font-semibold text-slate-500 hover:text-red-600"
                            >
                              Remover caixa
                            </button>
                          )}

                          <span className="basis-full text-slate-500">
                            {!emCaixa
                              ? 'Informe quantas unidades vêm na caixa'
                              : modoCaixas
                                ? `${qtdTexto(Number.isFinite(qtdNum) ? qtdNum : 0)} cx × ${nPorCaixa} = ${qtdTexto(
                                    Number.isFinite(unidadesTotal) ? unidadesTotal : 0
                                  )} un.${preco !== null ? ` · ${reais4(preco)} por un.` : ''} (preço acima é o da caixa)`
                                : `Preço acima é o da caixa; a quantidade é em unidades${
                                    preco !== null ? ` → ${reais4(preco)} por un.` : ''
                                  }${
                                    caixas !== null
                                      ? ` · ${qtdTexto(caixas)} ${caixas === 1 ? 'caixa' : 'caixas'}`
                                      : ''
                                  }`}
                          </span>
                        </div>
                      )}

                      {ultimo && (
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span>
                            Última compra: {reais(ultimo.preco)} em{' '}
                            {new Date(ultimo.criado_em).toLocaleDateString('pt-BR')} ({ultimo.fornecedor})
                          </span>
                          {variacao !== null && Math.abs(variacao) >= 0.5 && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                                variacao > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {variacao > 0 ? (
                                <TrendingUp className="size-3" />
                              ) : (
                                <TrendingDown className="size-3" />
                              )}
                              {variacao > 0 ? '+' : ''}
                              {variacao.toFixed(1).replace('.', ',')}%
                            </span>
                          )}
                        </p>
                      )}

                      {(i.obsAberta || i.obs) && (
                        <input
                          value={i.obs}
                          onChange={(e) => alterar(i.key, { obs: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault()
                              buscaRef.current?.focus()
                            }
                          }}
                          placeholder="Observação deste item"
                          aria-label={`Observação de ${i.nome}`}
                          maxLength={500}
                          className={`${celula} mt-1.5`}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* subtotal, frete e desconto */}
          <div className="ml-auto w-full space-y-2 rounded-xl border border-[#079C9C]/20 bg-[#079C9C]/5 px-4 py-3 md:max-w-sm">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold text-slate-900">{reais(bruto)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label htmlFor="pc-desconto" className="text-slate-600">
                Desconto
              </label>
              <div className="flex items-center gap-1.5">
                <div
                  role="group"
                  aria-label="Tipo de desconto"
                  className="flex overflow-hidden rounded-md border border-slate-200 bg-white"
                >
                  {(['valor', 'pct'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      tabIndex={-1}
                      aria-pressed={modoDesconto === m}
                      onClick={() => {
                        setModoDesconto(m)
                        document.getElementById('pc-desconto')?.focus()
                      }}
                      className={`h-9 px-2.5 text-xs font-bold transition ${
                        modoDesconto === m
                          ? 'bg-[#079C9C] text-white'
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {m === 'valor' ? 'R$' : '%'}
                    </button>
                  ))}
                </div>
                <input
                  id="pc-desconto"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  onFocus={selecionar}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault()
                      document.getElementById('pc-frete')?.focus()
                    }
                  }}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={modoDesconto === 'pct' ? '0 %' : '0,00'}
                  className={`${celula} !w-24 text-right ${descontoInvalido ? 'border-red-300 bg-red-50' : ''}`}
                />
              </div>
            </div>
            {descontoEfetivo > 0 && (
              <p className="text-right text-xs font-medium text-emerald-700">
                − {reais(descontoEfetivo)} aplicado no preço de cada item
              </p>
            )}

            <div className="flex items-center justify-between gap-3 text-sm">
              <label htmlFor="pc-frete" className="text-slate-600">
                Frete (R$)
              </label>
              <input
                id="pc-frete"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                onFocus={selecionar}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault()
                    document.getElementById('pc-salvar')?.focus()
                  }
                }}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                className={`${celula} !w-28 text-right`}
              />
            </div>

            {freteValor > 0 && (
              <div className="space-y-1.5">
                <div
                  role="radiogroup"
                  aria-label="O que fazer com o frete"
                  className="flex overflow-hidden rounded-md border border-slate-200 bg-white"
                >
                  {MODOS_FRETE.map(([v, rotulo]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      tabIndex={-1}
                      aria-checked={modoFrete === v}
                      onClick={() => setModoFrete(v)}
                      className={`h-8 flex-1 text-xs font-semibold transition ${
                        modoFrete === v
                          ? 'bg-[#079C9C] text-white'
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                <p
                  className={`text-right text-xs ${
                    modoFrete === 'separado' ? 'text-slate-500' : 'font-medium text-emerald-700'
                  }`}
                >
                  {EXPLICACAO_FRETE[modoFrete]}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* contato e observações */}
        <section className="rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMaisAberto((v) => !v)}
            aria-expanded={maisAberto}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
          >
            <span className="text-sm font-semibold text-slate-700">
              Contato e observações{' '}
              <span className="font-normal text-slate-400">
                {!maisAberto && (contato || obs) ? '· preenchido' : '(opcional)'}
              </span>
            </span>
            <ChevronDown
              className={`size-5 shrink-0 text-slate-400 transition ${maisAberto ? 'rotate-180' : ''}`}
            />
          </button>

          {maisAberto && (
            <div className="grid gap-3 border-t border-slate-100 p-3 md:grid-cols-2">
              <Campo id="pc-contato" label="Contato do fornecedor">
                <input
                  id="pc-contato"
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Telefone, WhatsApp ou e-mail"
                  className={inputClass}
                />
              </Campo>
              <Campo id="pc-obs" label="Observações para o fornecedor">
                <textarea
                  id="pc-obs"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Horário de entrega, local, etc."
                  className={`${inputClass} resize-none`}
                />
              </Campo>
            </div>
          )}
        </section>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50">
        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 md:px-6"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500">
              {previsao ? `Entrega prevista ${dataCurta(previsao)} · ` : ''}Total
            </p>
            <p className="text-2xl font-bold text-[#079C9C]">{reais(total)}</p>
          </div>

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
              id="pc-salvar"
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90 sm:min-w-44"
            >
              {salvando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  {editando ? 'Salvar alterações' : 'Salvar pedido'}
                  <span className="hidden text-[10px] text-white/70 md:inline">Ctrl+Enter</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="hidden border-t border-slate-100 bg-white px-6 py-1.5 text-[11px] text-slate-500 md:block">
          <Kbd>Enter</Kbd> avança (nome → qtd → preço → busca) · <Kbd>↑</Kbd> <Kbd>↓</Kbd> linhas ·{' '}
          <Kbd>←</Kbd> <Kbd>→</Kbd> colunas · <Kbd>Esc</Kbd> limpa a busca / fecha
        </p>
      </div>
    </div>
  )
}

// ---------- janela ----------

export default function PedidoCompraDialog({
  open,
  inicial,
  onClose,
  onSalvo,
}: {
  open: boolean
  inicial: PedidoInicial
  onClose: () => void
  onSalvo: (id: string, numero: number) => void
}) {
  const sujo = useRef(false)
  const esc = useRef(false)
  const marcarSujo = useCallback((v: boolean) => {
    sujo.current = v
  }, [])

  const fechar = () => {
    if (sujo.current && !window.confirm('Descartar as alterações deste pedido?')) return
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // com texto na busca de itens, o Esc só limpa a busca
          if (esc.current) e.preventDefault()
        }}
        className="top-[3%] flex max-h-[94dvh] w-[calc(100%-1rem)] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[1120px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {open && (
          <Conteudo
            inicial={inicial}
            onFechar={fechar}
            onSujo={marcarSujo}
            onSalvo={onSalvo}
            escRef={esc}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}