'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck,
  Download,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { dataCurta, reais } from '@/features/loja/lib/formatar'
import {
  listarFornecedoresDosPedidos,
  listarPedidos,
  resumoPedidos,
  totalDosPedidos,
  type CampoData,
  type FiltroCompra,
  type FiltroNota,
  type FiltrosPedidos,
  type OrdemCompra,
  type PedidoCompra,
  type ResumoCompras,
} from '../services/comprasService'
import { PEDIDO_VAZIO, infoStatus, atrasado, diasDeAtraso, numeroPedido } from '../lib/compras'
import PedidoCompraDialog, { type PedidoInicial } from './PedidoCompraDialog'
import ImportarComparacaoDialog from './ImportarComparacaoDialog'

interface Resultado {
  chave: string
  itens: PedidoCompra[]
  total: number
  paginas: number
  soma: number | null
}

const FILTROS: [FiltroCompra, string][] = [
  ['todos', 'Todos'],
  ['rascunho', 'Rascunhos'],
  ['andamento', 'Em andamento'],
  ['atrasado', 'Atrasados'],
  ['recebido', 'Recebidos'],
  ['cancelado', 'Cancelados'],
]

const CAMPOS_DATA: [CampoData, string][] = [
  ['criado', 'Criação'],
  ['previsao', 'Previsão de entrega'],
  ['recebido', 'Recebimento'],
]

const ORDENS: [OrdemCompra, string][] = [
  ['recentes', 'Mais recentes'],
  ['antigos', 'Mais antigos'],
  ['maior', 'Maior valor'],
  ['menor', 'Menor valor'],
  ['entrega', 'Entrega mais próxima'],
]

const NOTAS: [FiltroNota, string][] = [
  ['todas', 'Todas'],
  ['com', 'Com nota fiscal'],
  ['sem', 'Sem nota fiscal'],
]

const COLUNAS = 'lg:grid-cols-[5.5rem_6rem_9rem_minmax(0,1fr)_7.5rem]'

const campoClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

// ---------- estado dos filtros (o que está na tela) ----------

interface Estado {
  termo: string
  filtro: FiltroCompra
  campoData: CampoData
  de: string
  ate: string
  fornecedor: string
  vmin: string // texto digitado
  vmax: string // texto digitado
  nota: FiltroNota
  parcial: boolean
  ordem: OrdemCompra
}

const VAZIO: Estado = {
  termo: '',
  filtro: 'todos',
  campoData: 'criado',
  de: '',
  ate: '',
  fornecedor: '',
  vmin: '',
  vmax: '',
  nota: 'todas',
  parcial: false,
  ordem: 'recentes',
}

const ehData = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

// "1.500,50" -> 1500.5 ; vazio ou inválido -> null
function lerValor(texto: string): number | null {
  const s = texto.trim()
  if (!s) return null
  const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(limpo)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function paraFiltros(e: Estado): FiltrosPedidos {
  return {
    filtro: e.filtro,
    termo: e.termo,
    campoData: e.campoData,
    de: e.de,
    ate: e.ate,
    fornecedor: e.fornecedor,
    valorMin: lerValor(e.vmin),
    valorMax: lerValor(e.vmax),
    nota: e.nota,
    parcial: e.parcial,
    ordem: e.ordem,
  }
}

// lê a URL (link compartilhado, voltar da página do pedido, atalhos do painel)
function lerDaUrl(base: Estado): Estado {
  const p = new URLSearchParams(window.location.search)
  const e = { ...base }

  const filtro = p.get('filtro') as FiltroCompra | null
  if (filtro && FILTROS.some(([v]) => v === filtro)) e.filtro = filtro

  e.termo = p.get('q') ?? e.termo

  const campo = p.get('campo') as CampoData | null
  if (campo && CAMPOS_DATA.some(([v]) => v === campo)) e.campoData = campo

  const de = p.get('de')
  const ate = p.get('ate')
  if (ehData(de)) e.de = de
  if (ehData(ate)) e.ate = ate

  e.fornecedor = p.get('forn') ?? e.fornecedor
  e.vmin = p.get('min') ?? e.vmin
  e.vmax = p.get('max') ?? e.vmax

  const nota = p.get('nota') as FiltroNota | null
  if (nota && NOTAS.some(([v]) => v === nota)) e.nota = nota

  if (p.get('parcial') === '1') e.parcial = true

  const ordem = p.get('ordem') as OrdemCompra | null
  if (ordem && ORDENS.some(([v]) => v === ordem)) e.ordem = ordem

  return e
}

// só o que foge do padrão vai para a URL
function paraQuery(e: Estado): string {
  const p = new URLSearchParams()
  if (e.filtro !== 'todos') p.set('filtro', e.filtro)
  if (e.termo.trim()) p.set('q', e.termo.trim())
  if (e.de || e.ate) {
    p.set('campo', e.campoData)
    if (e.de) p.set('de', e.de)
    if (e.ate) p.set('ate', e.ate)
  }
  if (e.fornecedor) p.set('forn', e.fornecedor)
  if (e.vmin.trim()) p.set('min', e.vmin.trim())
  if (e.vmax.trim()) p.set('max', e.vmax.trim())
  if (e.nota !== 'todas') p.set('nota', e.nota)
  if (e.parcial) p.set('parcial', '1')
  if (e.ordem !== 'recentes') p.set('ordem', e.ordem)
  return p.toString()
}

// ---------- datas ----------

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const somarDiasData = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// [rótulo, de, ate]
function atalhosDePeriodo(): [string, string, string][] {
  const h = new Date()
  const a = h.getFullYear()
  const m = h.getMonth()
  return [
    ['Hoje', iso(h), iso(h)],
    ['Últimos 7 dias', iso(somarDiasData(h, -6)), iso(h)],
    ['Últimos 30 dias', iso(somarDiasData(h, -29)), iso(h)],
    ['Próximos 7 dias', iso(h), iso(somarDiasData(h, 6))],
    ['Este mês', iso(new Date(a, m, 1)), iso(new Date(a, m + 1, 0))],
    ['Mês passado', iso(new Date(a, m - 1, 1)), iso(new Date(a, m, 0))],
    ['Este ano', `${a}-01-01`, `${a}-12-31`],
  ]
}

// cor de fundo suave + faixa lateral por situação do pedido (classes completas para o Tailwind)
const TOM_LINHA = {
  rascunho: 'border-slate-200 border-l-slate-300 bg-slate-50',
  enviado: 'border-sky-200 border-l-sky-400 bg-sky-50/70',
  confirmado: 'border-indigo-200 border-l-indigo-400 bg-indigo-50/60',
  parcial: 'border-orange-200 border-l-orange-400 bg-orange-50/70',
  recebido: 'border-emerald-200 border-l-emerald-500 bg-emerald-50/60',
  cancelado: 'border-rose-200 border-l-rose-300 bg-rose-50/50',
  atrasado: 'border-amber-300 border-l-amber-500 bg-amber-50/80',
} as const

function tomDaLinha(p: PedidoCompra, atraso: boolean): string {
  if (atraso) return TOM_LINHA.atrasado
  if (p.recebido_parcial && p.status !== 'recebido' && p.status !== 'cancelado') return TOM_LINHA.parcial
  return TOM_LINHA[p.status]
}

function dataDoPedido(p: PedidoCompra, campo: CampoData) {
  if (campo === 'previsao') return p.previsao_entrega ? dataCurta(p.previsao_entrega) : '—'
  const v = campo === 'recebido' ? p.recebido_em : p.criado_em
  return v ? new Date(v).toLocaleDateString('pt-BR') : '—'
}

function Rotulo({ id, texto, children }: { id?: string; texto: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {texto}
      </label>
      {children}
    </div>
  )
}

export default function PedidosCompraLista({
  abrirId,
  filtroInicial,
}: {
  abrirId: string | null
  filtroInicial?: FiltroCompra
}) {
  const router = useRouter()

  // f = o que a pessoa está mexendo; fa = o que já foi aplicado na busca (com um respiro
  // de 300 ms quando está digitando, para não consultar a cada tecla)
  const [f, setF] = useState<Estado>({ ...VAZIO, filtro: filtroInicial ?? 'todos' })
  const [fa, setFa] = useState<Estado>({ ...VAZIO, filtro: filtroInicial ?? 'todos' })
  const [pronto, setPronto] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const textoRef = useRef('')

  const [versao, setVersao] = useState(0)
  const [res, setRes] = useState<Resultado | null>(null)
  const [resumo, setResumo] = useState<ResumoCompras | null>(null)
  const [fornecedores, setFornecedores] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)

  const [formulario, setFormulario] = useState<{ chave: number; inicial: PedidoInicial } | null>(null)
  const [importando, setImportando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const set = (p: Partial<Estado>) => setF((a) => ({ ...a, ...p }))

  const chave = `${JSON.stringify(fa)}|${versao}`

  // link antigo (?abrir=id): vai para a página do pedido
  useEffect(() => {
    if (abrirId) router.replace(`/pedidos-compra/${abrirId}`)
  }, [abrirId, router])

  // lê os filtros da URL uma vez, antes de qualquer busca
  useEffect(() => {
    const e = lerDaUrl({ ...VAZIO, filtro: filtroInicial ?? 'todos' })
    setF(e)
    setFa(e)
    textoRef.current = `${e.termo}|${e.vmin}|${e.vmax}`
    if (e.de || e.ate || e.fornecedor || e.vmin || e.vmax || e.nota !== 'todas' || e.parcial) {
      setPainelAberto(true)
    }
    setPronto(true)
    // só na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // aplica os filtros: texto espera um pouco, o resto (chips, datas, selects) é na hora
  useEffect(() => {
    if (!pronto) return
    const textoKey = `${f.termo}|${f.vmin}|${f.vmax}`
    const mudouTexto = textoKey !== textoRef.current
    textoRef.current = textoKey
    const t = setTimeout(() => setFa(f), mudouTexto ? 300 : 0)
    return () => clearTimeout(t)
  }, [f, pronto])

  // guarda os filtros aplicados na URL, sem criar entrada nova no histórico
  useEffect(() => {
    if (!pronto || abrirId) return
    const qs = paraQuery(fa)
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [fa, pronto, abrirId])

  useEffect(() => {
    if (!pronto) return
    let cancelado = false
    const filtros = paraFiltros(fa)

    Promise.all([
      listarPedidos({ ...filtros, pagina: 0 }),
      totalDosPedidos(filtros).catch(() => null),
    ])
      .then(([r, soma]) => {
        if (cancelado) return
        setRes({ chave, itens: r.itens, total: r.total, paginas: 1, soma })
        setErro(null)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar os pedidos')
      })

    return () => {
      cancelado = true
    }
    // fa já está dentro de "chave"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, pronto])

  useEffect(() => {
    let cancelado = false
    resumoPedidos()
      .then((r) => {
        if (!cancelado) setResumo(r)
      })
      .catch(() => {})
    listarFornecedoresDosPedidos()
      .then((l) => {
        if (!cancelado) setFornecedores(l)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [versao])

  const carregarMais = async () => {
    if (!res || res.chave !== chave || carregandoMais) return
    setCarregandoMais(true)
    try {
      const r = await listarPedidos({ ...paraFiltros(fa), pagina: res.paginas })
      setRes((atual) =>
        atual && atual.chave === chave
          ? {
              ...atual,
              itens: [...atual.itens, ...r.itens],
              total: r.itens.length > 0 ? r.total : atual.itens.length,
              paginas: atual.paginas + 1,
            }
          : atual
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar mais pedidos')
    } finally {
      setCarregandoMais(false)
    }
  }

  const abrirFormulario = (inicial: PedidoInicial) =>
    setFormulario({ chave: Date.now(), inicial })

  const abrirPedido = (id: string) => router.push(`/pedidos-compra/${id}`)

  const carregando = res === null && erro === null
  const atualizando = res !== null && res.chave !== chave
  const itens = res?.itens ?? []
  const temMais = res !== null && res.itens.length < res.total

  // ---------- filtros ativos (chips) ----------

  const rotuloCampo = CAMPOS_DATA.find(([v]) => v === f.campoData)?.[1] ?? 'Data'
  const periodoTexto =
    f.de && f.ate
      ? f.de === f.ate
        ? dataCurta(f.de)
        : `${dataCurta(f.de)} a ${dataCurta(f.ate)}`
      : f.de
        ? `a partir de ${dataCurta(f.de)}`
        : f.ate
          ? `até ${dataCurta(f.ate)}`
          : ''

  const chips: { chave: string; texto: string; limpar: () => void }[] = []
  if (f.de || f.ate)
    chips.push({
      chave: 'periodo',
      texto: `${rotuloCampo}: ${periodoTexto}`,
      limpar: () => set({ de: '', ate: '' }),
    })
  if (f.fornecedor)
    chips.push({ chave: 'forn', texto: f.fornecedor, limpar: () => set({ fornecedor: '' }) })
  if (f.vmin.trim() || f.vmax.trim())
    chips.push({
      chave: 'valor',
      texto: `Valor ${f.vmin.trim() ? `de R$ ${f.vmin.trim()}` : ''}${
        f.vmin.trim() && f.vmax.trim() ? ' ' : ''
      }${f.vmax.trim() ? `até R$ ${f.vmax.trim()}` : ''}`,
      limpar: () => set({ vmin: '', vmax: '' }),
    })
  if (f.nota !== 'todas')
    chips.push({
      chave: 'nota',
      texto: f.nota === 'com' ? 'Com nota fiscal' : 'Sem nota fiscal',
      limpar: () => set({ nota: 'todas' }),
    })
  if (f.parcial)
    chips.push({ chave: 'parcial', texto: 'Recebimento parcial', limpar: () => set({ parcial: false }) })

  const temFiltro = f.filtro !== 'todos' || f.termo.trim() !== '' || chips.length > 0
  const limparTudo = () => setF({ ...VAZIO, ordem: f.ordem })

  const atalhos = atalhosDePeriodo()

  const cartoes: { filtro: FiltroCompra; titulo: string; n: number; total: number; cor: string }[] = [
    {
      filtro: 'rascunho',
      titulo: 'Rascunhos',
      n: resumo?.rascunhos.n ?? 0,
      total: resumo?.rascunhos.total ?? 0,
      cor: 'text-slate-700',
    },
    {
      filtro: 'andamento',
      titulo: 'Em andamento',
      n: resumo?.andamento.n ?? 0,
      total: resumo?.andamento.total ?? 0,
      cor: 'text-sky-700',
    },
    {
      filtro: 'atrasado',
      titulo: 'Atrasados',
      n: resumo?.atrasados.n ?? 0,
      total: resumo?.atrasados.total ?? 0,
      cor: 'text-amber-700',
    },
  ]

  // a coluna de data acompanha o filtro de período; sem período, mostra a criação
  const campoVisivel: CampoData = fa.de || fa.ate ? fa.campoData : 'criado'
  const tituloData = campoVisivel === 'previsao' ? 'Entrega' : campoVisivel === 'recebido' ? 'Recebido' : 'Data'

  // fornecedor vindo da URL pode não estar na lista carregada
  const opcoesFornecedor =
    f.fornecedor && !fornecedores.includes(f.fornecedor) ? [f.fornecedor, ...fornecedores] : fornecedores

  return (
    <div className="w-full pb-16">
      <div className="mt-7 flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-2xl font-bold md:text-3xl">Pedidos de compra</h3>
          <p className="text-sm text-gray-400">
            Compras feitas aos fornecedores, do rascunho até a entrega.
          </p>
        </article>

        <div className="grid grid-cols-2 gap-2 md:flex">
          <button
            type="button"
            onClick={() => setImportando(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#079C9C] bg-white px-4 py-3 text-sm font-semibold text-[#079C9C] shadow-sm transition hover:bg-[#079C9C]/10 active:scale-95"
          >
            <Download className="size-5" />
            Importar
          </button>
          <button
            type="button"
            onClick={() => abrirFormulario(PEDIDO_VAZIO)}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#079C9C] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95"
          >
            <Plus className="size-5" />
            Novo pedido
          </button>
        </div>
      </div>

      {aviso && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
        >
          <p>{aviso}</p>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setAviso(null)}
            className="shrink-0 text-emerald-600 hover:text-emerald-800"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {cartoes.map((c) => (
          <button
            key={c.filtro}
            type="button"
            onClick={() => set({ filtro: f.filtro === c.filtro ? 'todos' : c.filtro })}
            aria-pressed={f.filtro === c.filtro}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              f.filtro === c.filtro
                ? 'border-[#079C9C] bg-[#079C9C]/5 ring-1 ring-[#079C9C]/30'
                : 'border-slate-200 bg-white hover:border-[#079C9C]/40'
            }`}
          >
            <p className="text-sm text-slate-500">{c.titulo}</p>
            <p className={`mt-1 text-3xl font-bold ${c.cor}`}>{c.n}</p>
            <p className="text-xs text-slate-400">{reais(c.total)}</p>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {/* busca + botão de filtros */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 md:max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={f.termo}
              onChange={(e) => set({ termo: e.target.value })}
              placeholder="Buscar por fornecedor ou número (PC-12)"
              aria-label="Buscar pedido de compra"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
            />
            {f.termo && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => set({ termo: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPainelAberto((v) => !v)}
            aria-expanded={painelAberto}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm transition ${
              painelAberto || chips.length > 0
                ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="size-4" />
            Filtros
            {chips.length > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-[#079C9C] text-[11px] font-bold text-white">
                {chips.length}
              </span>
            )}
          </button>
        </div>

        {/* painel de filtros avançados */}
        {painelAberto && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {/* período */}
            <div className="space-y-2">
              <div className="grid gap-3 md:grid-cols-[14rem_1fr_1fr]">
                <Rotulo id="fl-campo" texto="Período por">
                  <select
                    id="fl-campo"
                    value={f.campoData}
                    onChange={(e) => set({ campoData: e.target.value as CampoData })}
                    className={campoClass}
                  >
                    {CAMPOS_DATA.map(([v, r]) => (
                      <option key={v} value={v}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Rotulo>
                <Rotulo id="fl-de" texto="De">
                  <input
                    id="fl-de"
                    type="date"
                    value={f.de}
                    max={f.ate || undefined}
                    onChange={(e) => set({ de: e.target.value })}
                    className={campoClass}
                  />
                </Rotulo>
                <Rotulo id="fl-ate" texto="Até">
                  <input
                    id="fl-ate"
                    type="date"
                    value={f.ate}
                    min={f.de || undefined}
                    onChange={(e) => set({ ate: e.target.value })}
                    className={campoClass}
                  />
                </Rotulo>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {atalhos.map(([rotulo, de, ate]) => {
                  const ativo = f.de === de && f.ate === ate
                  return (
                    <button
                      key={rotulo}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => (ativo ? set({ de: '', ate: '' }) : set({ de, ate }))}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        ativo
                          ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {rotulo}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Rotulo id="fl-forn" texto="Fornecedor">
                <select
                  id="fl-forn"
                  value={f.fornecedor}
                  onChange={(e) => set({ fornecedor: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {opcoesFornecedor.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Rotulo>

              <Rotulo id="fl-min" texto="Valor mínimo (R$)">
                <input
                  id="fl-min"
                  value={f.vmin}
                  onChange={(e) => set({ vmin: e.target.value })}
                  inputMode="decimal"
                  placeholder="0,00"
                  autoComplete="off"
                  className={campoClass}
                />
              </Rotulo>

              <Rotulo id="fl-max" texto="Valor máximo (R$)">
                <input
                  id="fl-max"
                  value={f.vmax}
                  onChange={(e) => set({ vmax: e.target.value })}
                  inputMode="decimal"
                  placeholder="Sem limite"
                  autoComplete="off"
                  className={campoClass}
                />
              </Rotulo>

              <Rotulo id="fl-nota" texto="Nota fiscal">
                <select
                  id="fl-nota"
                  value={f.nota}
                  onChange={(e) => set({ nota: e.target.value as FiltroNota })}
                  className={campoClass}
                >
                  {NOTAS.map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </Rotulo>
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={f.parcial}
                onChange={(e) => set({ parcial: e.target.checked })}
                className="size-4 accent-[#079C9C]"
              />
              Só pedidos com recebimento parcial
            </label>
          </div>
        )}

        {/* status + ordenação + contagem */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Filtrar" className="flex flex-wrap gap-2">
            {FILTROS.map(([valor, rotulo]) => {
              const ativo = f.filtro === valor
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => set({ filtro: valor })}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    ativo
                      ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {rotulo}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="fl-ordem" className="sr-only">
              Ordenar por
            </label>
            <select
              id="fl-ordem"
              value={f.ordem}
              onChange={(e) => set({ ordem: e.target.value as OrdemCompra })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
            >
              {ORDENS.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* filtros ativos + total do que está na tela */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <span
                key={c.chave}
                className="flex items-center gap-1 rounded-full bg-[#079C9C]/10 py-1 pl-3 pr-1.5 text-xs font-semibold text-[#047a7a]"
              >
                {c.texto}
                <button
                  type="button"
                  onClick={c.limpar}
                  aria-label={`Remover filtro: ${c.texto}`}
                  className="rounded-full p-0.5 hover:bg-[#079C9C]/20"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {temFiltro && (
              <button
                type="button"
                onClick={limparTudo}
                className="px-1.5 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-600 hover:underline"
              >
                Limpar tudo
              </button>
            )}
          </div>

          <p className="flex items-center gap-2 text-sm text-slate-500">
            {atualizando && <Loader2 className="size-4 animate-spin" />}
            {res && (
              <span>
                {res.total} {res.total === 1 ? 'pedido' : 'pedidos'}
                {res.soma !== null && res.total > 0 && (
                  <>
                    {' · '}
                    <strong className="font-semibold text-slate-700">{reais(res.soma)}</strong>
                  </>
                )}
              </span>
            )}
          </p>
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 && !erro ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <ClipboardCheck className="size-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nenhum pedido encontrado</p>
          {temFiltro ? (
            <>
              <p className="max-w-xs text-xs text-slate-400">
                Nenhum pedido bate com os filtros escolhidos.
              </p>
              <button
                type="button"
                onClick={limparTudo}
                className="mt-1 rounded-lg border border-[#079C9C] px-4 py-2 text-sm font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10"
              >
                Limpar filtros
              </button>
            </>
          ) : (
            <p className="max-w-xs text-xs text-slate-400">
              Crie um pedido novo ou importe os pedidos de uma comparação de preços.
            </p>
          )}
        </div>
      ) : (
        <div className={`mt-4 ${atualizando ? 'opacity-60' : ''}`}>
          {/* cabeçalho das colunas (só no PC) */}
          <div
            className={`mb-1 hidden gap-x-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:grid ${COLUNAS}`}
          >
            <span>Pedido</span>
            <span>{tituloData}</span>
            <span>Status</span>
            <span>Fornecedor</span>
            <span className="text-right">Valor</span>
          </div>

          <ul className="space-y-2">
            {itens.map((p) => {
              const info = infoStatus(p)
              const atraso = atrasado(p)
              const detalhes = [
                p.previsao_entrega ? `Entrega ${dataCurta(p.previsao_entrega)}` : '',
                p.condicao_pagamento ?? '',
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => abrirPedido(p.id)}
                    title={detalhes || undefined}
                    className={`grid w-full grid-cols-2 items-center gap-x-3 gap-y-1.5 rounded-xl border border-l-4 px-4 py-3 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md hover:brightness-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C] ${tomDaLinha(p, atraso)} ${COLUNAS}`}
                  >
                    {/* pedido */}
                    <span className="order-1 text-sm font-bold text-[#079C9C] lg:order-none">
                      {numeroPedido(p.numero)}
                    </span>

                    {/* data */}
                    <span className="order-4 text-xs text-slate-500 lg:order-none lg:text-sm">
                      {dataDoPedido(p, campoVisivel)}
                    </span>

                    {/* status */}
                    <span className="order-5 flex flex-wrap items-center justify-end gap-1 lg:order-none lg:justify-start">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${info.classe}`}
                      >
                        {info.texto}
                      </span>
                      {atraso && p.previsao_entrega && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          Atrasado {diasDeAtraso(p.previsao_entrega)}d
                        </span>
                      )}
                    </span>

                    {/* fornecedor */}
                    <span className="order-3 col-span-2 min-w-0 lg:order-none lg:col-span-1">
                      <span className="block truncate font-semibold text-slate-900">
                        {p.fornecedor_nome}
                      </span>
                      {detalhes && (
                        <span className="block truncate text-xs text-slate-400">{detalhes}</span>
                      )}
                    </span>

                    {/* valor */}
                    <span className="order-2 justify-self-end text-base font-bold tabular-nums text-slate-900 lg:order-none lg:justify-self-auto lg:text-right">
                      {reais(p.total)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {temMais && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={carregarMais}
            disabled={carregandoMais}
            className="flex items-center gap-2 rounded-lg border border-[#079C9C] px-5 py-2.5 text-sm font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 disabled:opacity-60"
          >
            {carregandoMais && <Loader2 className="size-4 animate-spin" />}
            Ver mais
          </button>
        </div>
      )}

      <PedidoCompraDialog
        key={formulario?.chave ?? 0}
        open={formulario !== null}
        inicial={formulario?.inicial ?? PEDIDO_VAZIO}
        onClose={() => setFormulario(null)}
        onSalvo={(id) => {
          setFormulario(null)
          setVersao((v) => v + 1)
          abrirPedido(id)
        }}
      />

      <ImportarComparacaoDialog
        open={importando}
        onClose={() => setImportando(false)}
        onCriados={(criados) => {
          setImportando(false)
          setVersao((v) => v + 1)
          setAviso(
            `${criados.length} ${criados.length === 1 ? 'pedido criado' : 'pedidos criados'} como rascunho: ${criados
              .map((c) => numeroPedido(c.numero))
              .join(', ')}.`
          )
        }}
      />
    </div>
  )
}