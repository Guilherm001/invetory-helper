'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronDown, Loader2, Trash2 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import SenhaVendedor from '@/features/loja/components/senhaVendedor'
import { numeroTexto, reais } from '@/features/loja/lib/formatar'
import { lerPreco } from '@/features/comparar-precos/utils/melhorPreco'
import {
  atualizarPrecosVenda,
  excluirItemDoPedido,
  itensAReceber,
  obterPedido,
  precosDeVenda,
  receberPedido,
  ultimosPrecos,
  type ItemAReceber,
  type ResultadoRecebimento,
  type UltimoPreco,
} from '../services/comprasService'
import {
  barcodesDosCodigos,
  empresaIdAtual,
  listarVinculos,
  registrarNota,
  type DadosNota,
} from '../services/notasService'
import { agruparItensNota, casar } from '../lib/casamento'
import { chaveItem, numeroPedido } from '../lib/compras'
import { mesmaUnidade } from '../lib/unidades'
import { NOTA_VAZIA, notaPreenchida, validarNota, type NotaRascunho } from '../lib/notaRascunho'
import NotaFiscalCampos from './NotaFiscalCampos'

export interface PedidoParaReceber {
  id: string
  numero: number
  fornecedor_nome: string
}

/* ---------- helpers ---------- */

const arredondar = (n: number) => Math.round(n * 1000) / 1000
const arredondar2 = (n: number) => Math.round(n * 100) / 100

// vazio vale 0; inválido vale NaN
function lerQtd(texto: string | undefined) {
  const s = (texto ?? '').trim()
  if (s === '') return 0
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

// vazio vale null; inválido vale NaN
function lerNum(texto: string | undefined) {
  const s = (texto ?? '').trim()
  if (s === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

const faltaDe = (i: ItemAReceber) => Math.max(0, arredondar(i.quantidade - i.quantidade_recebida))

const listaCurta = (nomes: string[]) =>
  nomes.length <= 4 ? nomes.join(', ') : `${nomes.slice(0, 4).join(', ')} e mais ${nomes.length - 4}`

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const reais4 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

const precoTexto = (n: number) => n.toFixed(2).replace('.', ',')
const pct = (n: number) => n.toFixed(1).replace('.', ',')

// margem sobre o preço de venda: (venda - custo) / venda
const margemDePreco = (custo: number, preco: number) => ((preco - custo) / preco) * 100
const precoDeMargem = (custo: number, margem: number) =>
  margem < 100 ? arredondar2(custo / (1 - margem / 100)) : null

function montarAviso(r: ResultadoRecebimento) {
  const situacao = r.completo
    ? 'recebido por completo'
    : r.encerrou
      ? 'encerrado com o que chegou'
      : 'recebimento parcial registrado'

  const partes = [`Pedido ${numeroPedido(r.numero)}: ${situacao} (por ${r.recebido_por}).`]
  if (r.sem_estoque.length > 0)
    partes.push(`Sem entrada no estoque, por não achar no catálogo: ${r.sem_estoque.join(', ')}.`)
  return partes.join(' ')
}

// custo do pedido, preço de venda atual no catálogo e última compra de cada item
interface InfoPrecos {
  custo: Map<string, number> // por id do item
  venda: Map<string, number> // por código do produto
  ultimo: Map<string, UltimoPreco> // por chaveItem
}

// preço e margem digitados são guardados juntos: mexer em um recalcula o outro
interface EntradaVenda {
  preco: string
  margem: string
}
const VAZIA: EntradaVenda = { preco: '', margem: '' }

/* ---------- componentes pequenos ---------- */

type Tom = 'erro' | 'atencao' | 'info'

const TONS: Record<Tom, string> = {
  erro: 'border-red-200 bg-red-50 text-red-700',
  atencao: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-slate-200 bg-slate-50 text-slate-600',
}

function Aviso({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <p
      role={tom === 'erro' ? 'alert' : undefined}
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${TONS[tom]}`}
    >
      {tom !== 'info' && <AlertCircle className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </p>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-slate-300 bg-white px-1 font-sans text-[10px] font-semibold text-slate-500">
      {children}
    </kbd>
  )
}

function Opcao({
  marcado,
  onChange,
  titulo,
  descricao,
  atalho,
}: {
  marcado: boolean
  onChange: (v: boolean) => void
  titulo: string
  descricao: string
  atalho?: string
}) {
  return (
    <label title={descricao} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-[#079C9C]"
      />
      <span>{titulo}</span>
      {atalho && <Kbd>{atalho}</Kbd>}
    </label>
  )
}

const CAMPO =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-right text-sm outline-none transition focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 disabled:bg-slate-50 disabled:text-slate-400'

const GRADE = 'grid-cols-[minmax(0,1fr)_7rem_2rem]'
const GRADE_PRECO = 'grid-cols-[minmax(0,1fr)_6.5rem_7rem_7rem_6.5rem_7.5rem_2rem]'

interface DadosPreco {
  carregando: boolean
  custo: number | null
  vendaAtual: number | null
  variacao: number | null // custo contra a última compra, em %
  entrada: EntradaVenda
  onPreco: (texto: string) => void
  onMargem: (texto: string) => void
}

function LinhaItem({
  item,
  r,
  q,
  valor,
  estoque,
  modoPreco,
  preco,
  podeExcluir,
  onChange,
  onTecla,
  onExcluir,
}: {
  item: ItemAReceber
  r: number
  q: number
  valor: string
  estoque: boolean
  modoPreco: boolean
  preco: DadosPreco | null
  podeExcluir: boolean
  onChange: (valor: string) => void
  onTecla: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onExcluir: () => void
}) {
  const falta = faltaDe(item)
  const concluido = falta === 0
  const aMais = q > falta ? arredondar(q - falta) : 0
  const vaiFaltar = !concluido && q > 0 && q < falta ? arredondar(falta - q) : 0
  const un = item.unidade ? ` ${item.unidade}` : ''

  const selecionar = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

  let celulasPreco: ReactNode = null
  if (modoPreco) {
    if (!preco) {
      celulasPreco = (
        <>
          <span />
          <span />
          <span />
          <span />
        </>
      )
    } else if (preco.carregando) {
      celulasPreco = (
        <>
          <span className="text-right text-xs text-slate-400">...</span>
          <span />
          <span />
          <span />
        </>
      )
    } else {
      const { custo, vendaAtual, variacao, entrada } = preco
      const subiu = variacao !== null && variacao >= 0.5
      const desceu = variacao !== null && variacao <= -0.5
      const margemAtual = custo && vendaAtual ? margemDePreco(custo, vendaAtual) : null
      const margemDigitada = lerNum(entrada.margem)
      const abaixo = margemDigitada !== null && Number.isFinite(margemDigitada) && margemDigitada < 0

      celulasPreco = (
        <>
          <div className="text-right">
            <p className="text-sm text-slate-800">{custo != null ? reais4(custo) : '—'}</p>
            {(subiu || desceu) && variacao !== null && (
              <p
                title="Variação do custo desde a última compra"
                className={`text-[11px] font-medium ${subiu ? 'text-amber-700' : 'text-emerald-700'}`}
              >
                {subiu ? '+' : ''}
                {pct(variacao)}% vs última
              </p>
            )}
          </div>

          <p className="text-right text-sm text-slate-600">
            {vendaAtual != null ? reais(vendaAtual) : '—'}
          </p>

          <div className="relative">
            <input
              data-cell=""
              data-r={r}
              data-c={1}
              value={entrada.margem}
              onChange={(e) => preco.onMargem(e.target.value)}
              onKeyDown={onTecla}
              onFocus={selecionar}
              disabled={!custo}
              inputMode="decimal"
              placeholder={margemAtual !== null ? pct(margemAtual) : ''}
              aria-label={`Margem de ${item.produto_nome} em porcentagem`}
              className={`${CAMPO} pr-6 ${abaixo ? 'text-red-700' : ''}`}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              %
            </span>
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              R$
            </span>
            <input
              data-cell=""
              data-r={r}
              data-c={2}
              value={entrada.preco}
              onChange={(e) => preco.onPreco(e.target.value)}
              onKeyDown={onTecla}
              onFocus={selecionar}
              inputMode="decimal"
              placeholder={vendaAtual != null ? precoTexto(vendaAtual) : '0,00'}
              aria-label={`Novo preço de venda de ${item.produto_nome}`}
              className={`${CAMPO} pl-7 ${entrada.preco.trim() !== '' ? 'border-[#079C9C]/60 font-semibold' : ''}`}
            />
          </div>
        </>
      )
    }
  }

  return (
    <li
      className={`grid ${modoPreco ? GRADE_PRECO : GRADE} items-center gap-x-3 border-b border-slate-100 px-3 py-2 focus-within:bg-slate-50 ${
        concluido ? 'opacity-60' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900" title={item.produto_nome}>
          {item.produto_nome}
        </p>
        <p className="text-xs text-slate-500">
          Pedido {numeroTexto(item.quantidade)}
          {un}
          {item.quantidade_recebida > 0 && `, recebido ${numeroTexto(item.quantidade_recebida)}`}
          {!concluido && `, falta ${numeroTexto(falta)}`}
          {aMais > 0 && (
            <span className="text-amber-700">{`, ${numeroTexto(aMais)} a mais que o pedido`}</span>
          )}
          {vaiFaltar > 0 && `, ainda faltam ${numeroTexto(vaiFaltar)}`}
          {item.observacao?.trim() && ` · obs: ${item.observacao.trim()}`}
        </p>
        {!item.produto_codigo && estoque && !concluido && (
          <p className="text-xs text-amber-700">Sem código do catálogo: não dá entrada no estoque.</p>
        )}
      </div>

      {concluido ? (
        <span className="text-right text-xs text-slate-500">Recebido</span>
      ) : (
        <input
          data-cell=""
          data-r={r}
          data-c={0}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onFocus={selecionar}
          onKeyDown={(e) => {
            // T = chegou tudo neste item
            if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 't') {
              e.preventDefault()
              onChange(numeroTexto(falta))
              return
            }
            onTecla(e)
          }}
          inputMode="decimal"
          placeholder="0"
          aria-label={`Quantidade que chegou de ${item.produto_nome}`}
          className={`${CAMPO} font-semibold`}
        />
      )}

      {celulasPreco}

      {podeExcluir ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={onExcluir}
          title="Excluir item do pedido (Alt+Del)"
          aria-label={`Excluir ${item.produto_nome} do pedido`}
          className="flex size-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      ) : (
        <span />
      )}
    </li>
  )
}

/* ---------- conteúdo ---------- */

type AvisoXml = { tom: Tom; texto: string }

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
  const tabelaRef = useRef<HTMLDivElement>(null)
  const focouInicial = useRef(false)

  const [itens, setItens] = useState<ItemAReceber[] | null>(null)
  const [erroCarga, setErroCarga] = useState('')
  const [chegou, setChegou] = useState<Record<string, string>>({})
  const [estoque, setEstoque] = useState(true)
  const [encerrar, setEncerrar] = useState(false)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [pedindoSenha, setPedindoSenha] = useState(false)

  // nota fiscal (opcional)
  const [nota, setNota] = useState<NotaRascunho>(NOTA_VAZIA)
  const [notaAberta, setNotaAberta] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [erroEmpresa, setErroEmpresa] = useState('')
  const dadosNotaRef = useRef<DadosNota | null>(null)
  const [notaPendente, setNotaPendente] = useState<{
    dados: DadosNota
    erro: string
    aviso: string
  } | null>(null)
  const [tentando, setTentando] = useState(false)

  // preço de venda (opcional, só o dono): vazio = não muda
  const [revisarPreco, setRevisarPreco] = useState(false)
  const [venda, setVenda] = useState<Record<string, EntradaVenda>>({})
  const [precos, setPrecos] = useState<InfoPrecos | null>(null)
  const [margemGeral, setMargemGeral] = useState('')

  // preenchimento do "Chegou" pelas quantidades do XML
  const [preenchendo, setPreenchendo] = useState(false)
  const [avisosXml, setAvisosXml] = useState<AvisoXml[]>([])

  useEffect(() => {
    let cancelado = false
    itensAReceber(pedido.id)
      .then((l) => !cancelado && setItens(l))
      .catch(
        (e) =>
          !cancelado && setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar os itens')
      )
    return () => {
      cancelado = true
    }
  }, [pedido.id])

  useEffect(() => {
    let cancelado = false
    empresaIdAtual()
      .then((id) => !cancelado && setEmpresaId(id))
      .catch(
        (e) =>
          !cancelado &&
          setErroEmpresa(
            e instanceof Error ? e.message : 'Não foi possível preparar o envio de arquivos'
          )
      )
    return () => {
      cancelado = true
    }
  }, [])

  // foco no primeiro campo quando a lista aparece (só na primeira vez)
  useEffect(() => {
    if (!itens || itens.length === 0 || focouInicial.current) return
    const id = requestAnimationFrame(() => {
      focouInicial.current = true
      tabelaRef.current?.querySelector<HTMLInputElement>('[data-cell]')?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [itens])

  // custo, preço atual e última compra: só carrega quando a revisão de preço é ligada
  useEffect(() => {
    if (!revisarPreco || precos || !itens) return
    let cancelado = false
    const doCatalogo = itens.filter((i) => i.produto_codigo)

    Promise.all([
      obterPedido(pedido.id),
      precosDeVenda(doCatalogo.map((i) => i.produto_codigo ?? '')),
      ultimosPrecos(
        doCatalogo.map((i) => chaveItem(i.produto_codigo ?? '', i.produto_nome)),
        pedido.id
      ),
    ])
      .then(([r, vendaAtual, ultimo]) => {
        if (cancelado) return
        setPrecos({
          custo: new Map((r?.itens ?? []).map((i) => [i.id, i.preco_unitario] as const)),
          venda: vendaAtual,
          ultimo,
        })
      })
      .catch(() => {
        if (cancelado) return
        setErro('Não foi possível carregar os preços de venda.')
        setRevisarPreco(false)
      })

    return () => {
      cancelado = true
    }
  }, [revisarPreco, precos, itens, pedido.id])

  const linhas = (itens ?? []).map((item) => ({
    item,
    falta: faltaDe(item),
    q: lerQtd(chegou[item.id]),
  }))

  const invalido = linhas.find((l) => Number.isNaN(l.q) || l.q < 0)
  const pendentes = linhas.filter((l) => l.falta > 0).length
  const conferidos = linhas.filter((l) => l.q > 0).length
  // itens que ainda ficam faltando depois desta conferência
  const aindaFalta = linhas.filter((l) => l.falta - (l.q > 0 ? l.q : 0) > 0).length

  const temNota = notaPreenchida(nota)
  const mexeuNoPreco =
    revisarPreco && Object.values(venda).some((v) => v.preco.trim() !== '' || v.margem.trim() !== '')
  const sujo = !notaPendente && (conferidos > 0 || obs.trim() !== '' || temNota || mexeuNoPreco)
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

  /* ----- preço e margem ligados ----- */

  // mexeu no preço: a margem é recalculada
  const mudarPreco = (item: ItemAReceber, texto: string) => {
    const custo = precos?.custo.get(item.id) ?? null
    const p = lerPreco(texto)
    const m = custo && p !== null && Number.isFinite(p) && p > 0 ? margemDePreco(custo, p) : null
    setVenda((v) => ({ ...v, [item.id]: { preco: texto, margem: m !== null ? pct(m) : '' } }))
    setErro('')
  }

  // mexeu na margem: o preço é recalculado
  const mudarMargem = (item: ItemAReceber, texto: string) => {
    const custo = precos?.custo.get(item.id) ?? null
    const m = lerNum(texto)
    const p = custo && m !== null && Number.isFinite(m) ? precoDeMargem(custo, m) : null
    setVenda((v) => ({ ...v, [item.id]: { margem: texto, preco: p !== null ? precoTexto(p) : '' } }))
    setErro('')
  }

  // mesma margem para todos os itens que chegaram
  const aplicarMargemATodos = () => {
    const m = lerNum(margemGeral)
    if (!precos || m === null || !Number.isFinite(m) || m >= 100) {
      setErro('Informe uma margem menor que 100%.')
      return
    }
    setErro('')
    setVenda((v) => {
      const novo = { ...v }
      for (const l of linhas) {
        const custo = precos.custo.get(l.item.id)
        if (l.q > 0 && l.item.produto_codigo && custo) {
          const p = precoDeMargem(custo, m)
          if (p !== null) novo[l.item.id] = { margem: margemGeral.trim(), preco: precoTexto(p) }
        }
      }
      return novo
    })
  }

  // repassa ao preço de venda o mesmo percentual que o custo subiu desde a última compra
  const repassarAumentos = () => {
    if (!precos) return
    setErro('')
    setVenda((v) => {
      const novo = { ...v }
      for (const l of linhas) {
        const codigo = l.item.produto_codigo
        if (l.q <= 0 || !codigo) continue
        const custo = precos.custo.get(l.item.id)
        const ultimo = precos.ultimo.get(chaveItem(codigo, l.item.produto_nome))
        const atual = precos.venda.get(codigo)
        if (custo && ultimo && ultimo.preco > 0 && atual && custo / ultimo.preco >= 1.005) {
          const p = arredondar2((atual * custo) / ultimo.preco)
          novo[l.item.id] = { preco: precoTexto(p), margem: pct(margemDePreco(custo, p)) }
        }
      }
      return novo
    })
  }

  /* ----- excluir item do pedido (só o dono, e só item sem recebimento) ----- */

  const excluirItem = async (item: ItemAReceber) => {
    if (!ehDono || excluindo || salvando || item.quantidade_recebida > 0) return
    if (!window.confirm(`Excluir "${item.produto_nome}" do pedido? Não dá para desfazer.`)) return

    const posicao = linhas.findIndex((l) => l.item.id === item.id)
    setExcluindo(true)
    setErro('')
    try {
      const r = await excluirItemDoPedido(item.id)

      // o que sobrou já foi todo recebido: o pedido fecha como recebido
      if (r.status === 'recebido') {
        onRecebido(
          `Pedido ${numeroPedido(pedido.numero)}: "${item.produto_nome}" excluído. Os itens restantes já estavam recebidos, então o pedido ficou como recebido.`
        )
        return
      }

      setItens((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev))
      setChegou(({ [item.id]: _c, ...resto }) => resto)
      setVenda(({ [item.id]: _v, ...resto }) => resto)

      // o foco vai para o item que ocupou o lugar
      requestAnimationFrame(() => {
        const campos = Array.from(
          tabelaRef.current?.querySelectorAll<HTMLInputElement>('[data-cell]') ?? []
        ).filter((x) => !x.disabled)
        const alvo = campos.find((x) => Number(x.dataset.r) >= posicao) ?? campos[campos.length - 1]
        alvo?.focus()
        alvo?.select()
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir o item')
    } finally {
      setExcluindo(false)
    }
  }

  /* ----- teclado na tabela ----- */

  // devolve false quando não há para onde ir
  const mover = (el: HTMLInputElement, dr: number, dc: number) => {
    const root = tabelaRef.current
    if (!root) return false
    const cells = Array.from(root.querySelectorAll<HTMLInputElement>('[data-cell]')).filter(
      (x) => !x.disabled
    )
    const r = Number(el.dataset.r)
    const c = Number(el.dataset.c)
    let alvo: HTMLInputElement | undefined

    if (dc !== 0) {
      const mesma = cells
        .filter((x) => Number(x.dataset.r) === r)
        .sort((a, b) => Number(a.dataset.c) - Number(b.dataset.c))
      alvo =
        dc > 0
          ? mesma.find((x) => Number(x.dataset.c) > c)
          : [...mesma].reverse().find((x) => Number(x.dataset.c) < c)
    } else {
      const coluna = cells
        .filter((x) => Number(x.dataset.c) === c)
        .filter((x) => (dr > 0 ? Number(x.dataset.r) > r : Number(x.dataset.r) < r))
        .sort((a, b) => Number(a.dataset.r) - Number(b.dataset.r))
      alvo = dr > 0 ? coluna[0] : coluna[coluna.length - 1]
    }

    if (!alvo) return false
    alvo.focus()
    alvo.select()
    return true
  }

  const tecla = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Alt+Del: exclui o item da linha
    if (e.altKey && e.key === 'Delete') {
      e.preventDefault()
      const l = linhas[Number(e.currentTarget.dataset.r)]
      if (l) excluirItem(l.item)
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const el = e.currentTarget

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mover(el, 1, 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      mover(el, -1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // desce na mesma coluna; no último campo, vai para o botão de confirmar
      if (!mover(el, 1, 0)) document.getElementById('rc-confirmar')?.focus()
    } else if (e.key === 'ArrowRight') {
      if (
        el.selectionEnd === el.value.length &&
        (el.selectionStart === el.value.length || el.selectionStart === 0)
      ) {
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

  /* ----- confirmar ----- */

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
    if (revisarPreco) {
      const ruim = linhas.find((l) => {
        const t = venda[l.item.id]?.preco.trim()
        if (!t || l.q <= 0 || !l.item.produto_codigo) return false
        const p = lerPreco(t)
        return p === null || !Number.isFinite(p) || p <= 0
      })
      if (ruim) {
        setErro(`Preço de venda inválido em ${ruim.item.produto_nome}.`)
        return false
      }
    }
    return true
  }

  // só entram os itens que chegaram, do catálogo, com o novo preço preenchido
  const precosParaAtualizar = () =>
    linhas.flatMap((l) => {
      const codigo = l.item.produto_codigo
      const p = lerPreco(venda[l.item.id]?.preco ?? '')
      return l.q > 0 && codigo && p !== null && Number.isFinite(p) && p > 0
        ? [{ codigo, preco: p }]
        : []
    })

  // pin null = o dono (já identificado); com pin = o balcão, e a senha identifica quem recebeu
  const enviar = async (pin: string | null) => {
    const r = await receberPedido({
      pedidoId: pedido.id,
      itens: linhas.filter((l) => l.q > 0).map((l) => ({ item_id: l.item.id, quantidade: l.q })),
      estoque,
      encerrar: encerrar && aindaFalta > 0,
      observacao: obs.trim(),
      vendedorId: null,
      pin,
    })

    let aviso = montarAviso(r)

    // o recebimento já foi registrado: se o preço falhar, só avisa
    const alteracoes = revisarPreco ? precosParaAtualizar() : []
    if (alteracoes.length > 0) {
      try {
        await atualizarPrecosVenda(alteracoes)
        aviso += ` Preço de venda atualizado em ${plural(alteracoes.length, 'item', 'itens')}.`
      } catch {
        aviso += ' Atenção: o preço de venda não foi atualizado.'
      }
    }

    const dadosNota = dadosNotaRef.current

    // o recebimento já foi registrado: uma falha na nota não pode desfazê-lo nem ser repetida
    if (dadosNota) {
      try {
        await registrarNota(pedido.id, dadosNota)
      } catch (e) {
        setPedindoSenha(false)
        setSalvando(false)
        setNotaPendente({
          dados: dadosNota,
          erro: e instanceof Error ? e.message : 'Erro ao registrar a nota',
          aviso,
        })
        return
      }
    }

    onRecebido(dadosNota ? `${aviso} Nota fiscal registrada.` : aviso)
  }

  const usarQuantidadesDaNota = async () => {
    if (!nota.xml || !itens || preenchendo) return
    setPreenchendo(true)
    setAvisosXml([])
    setErro('')

    try {
      const [barcodes, vinculos] = await Promise.all([
        barcodesDosCodigos(itens.map((i) => i.produto_codigo ?? '').filter(Boolean)),
        listarVinculos(pedido.id).catch(() => []),
      ])

      const daNota = agruparItensNota(nota.xml.itens)
      const pares = casar(
        itens,
        daNota,
        barcodes,
        new Map(vinculos.map((v) => [v.nota_chave, v.alvo_chave] as const))
      )

      const novos: Record<string, string> = {}
      const unidades: string[] = []
      let jaRecebidos = 0

      pares.forEach(({ ni }, pi) => {
        const item = itens[pi]
        const n = daNota[ni]

        // o que já chegou por completo não recebe mais nada
        if (faltaDe(item) === 0) {
          jaRecebidos++
          return
        }

        novos[item.id] = numeroTexto(n.quantidade)

        if (n.unidade && item.unidade && !mesmaUnidade(n.unidade, item.unidade)) {
          unidades.push(`${item.produto_nome} (pedido em ${item.unidade}, nota em ${n.unidade})`)
        }
      })

      const usadas = new Set([...pares.values()].map((p) => p.ni))
      const naoReconhecidos = daNota.filter((_, ni) => !usadas.has(ni)).map((n) => n.nome)
      const naoVieram = itens
        .filter((it, pi) => faltaDe(it) > 0 && !pares.has(pi))
        .map((it) => it.produto_nome)
      const preenchidos = Object.keys(novos).length

      setChegou((p) => ({ ...p, ...novos }))

      const avisos: AvisoXml[] = [
        preenchidos === 0
          ? { tom: 'atencao', texto: 'Nenhum item da nota foi reconhecido.' }
          : {
              tom: 'info',
              texto: `${plural(preenchidos, 'item preenchido', 'itens preenchidos')} com as quantidades da nota. Confira o que chegou de verdade antes de confirmar.`,
            },
      ]
      if (unidades.length > 0)
        avisos.push({
          tom: 'atencao',
          texto: `Unidade diferente entre o pedido e a nota. Confira a quantidade: ${listaCurta(unidades)}.`,
        })
      if (naoReconhecidos.length > 0)
        avisos.push({
          tom: 'atencao',
          texto: `${plural(naoReconhecidos.length, 'item da nota não foi reconhecido', 'itens da nota não foram reconhecidos')}: ${listaCurta(naoReconhecidos)}. Preencha à mão. Para o sistema reconhecer da próxima vez, o dono liga os itens em Notas fiscais do pedido.`,
        })
      if (naoVieram.length > 0)
        avisos.push({ tom: 'info', texto: `Não vieram na nota: ${listaCurta(naoVieram)}.` })
      if (jaRecebidos > 0)
        avisos.push({
          tom: 'info',
          texto: `${plural(jaRecebidos, 'item já tinha sido recebido por completo', 'itens já tinham sido recebidos por completo')}: não mudaram.`,
        })
      setAvisosXml(avisos)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível usar as quantidades da nota')
    } finally {
      setPreenchendo(false)
    }
  }

  const confirmar = async () => {
    if (!validar()) return

    // confere a nota antes de mexer no estoque
    dadosNotaRef.current = null
    if (temNota) {
      const v = validarNota(nota)
      if (!v.ok) {
        setNotaAberta(true)
        setErro(v.erro)
        return
      }
      // Com XML importado, manda os itens exatamente como o XML trouxe (com IPI, ST e
      // acréscimos por linha) e os impostos do cabeçalho. Sem isso o custo sai sem imposto
      // e a diferença da nota cai toda no frete do pedido.
      dadosNotaRef.current = nota.xml
        ? { ...v.dados, itens: nota.xml.itens, impostos: nota.xml.impostos ?? null }
        : v.dados
    }

    // o balcão se identifica com a senha; o dono já está identificado
    if (!ehDono) {
      setPedindoSenha(true)
      return
    }

    setSalvando(true)
    try {
      await enviar(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar o recebimento')
      setSalvando(false)
    }
  }

  const tentarNotaDeNovo = async () => {
    if (!notaPendente || tentando) return
    setTentando(true)
    try {
      await registrarNota(pedido.id, notaPendente.dados)
      onRecebido(`${notaPendente.aviso} Nota fiscal registrada.`)
    } catch (e) {
      setNotaPendente({
        ...notaPendente,
        erro: e instanceof Error ? e.message : 'Erro ao registrar a nota',
      })
      setTentando(false)
    }
  }

  // Ctrl+Enter confirma; Alt+T = chegou tudo; Alt+P = revisar preço
  const atalhos = (e: React.KeyboardEvent) => {
    if (pedindoSenha) return
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!salvando && itens && itens.length > 0) confirmar()
    } else if (e.altKey && e.code === 'KeyT') {
      e.preventDefault()
      chegouTudo()
    } else if (e.altKey && e.code === 'KeyP' && ehDono) {
      e.preventDefault()
      setRevisarPreco((v) => !v)
    }
  }

  const temItens = !!itens && itens.length > 0

  return (
    <>
      <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 text-left">
        <DialogTitle className="text-lg font-semibold text-slate-900">
          Receber pedido {numeroPedido(pedido.numero)}
        </DialogTitle>
        <DialogDescription className="truncate text-sm text-slate-500">
          {pedido.fornecedor_nome}
        </DialogDescription>
      </DialogHeader>

      {notaPendente ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
            <Aviso tom="info">O recebimento foi registrado.</Aviso>
            <Aviso tom="atencao">A nota fiscal não foi salva: {notaPendente.erro}</Aviso>
            <p className="text-sm text-slate-500">
              Os arquivos da nota já foram enviados. Tente salvar a nota de novo.
            </p>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-6 py-3">
            <Button
              type="button"
              variant="outline"
              disabled={tentando}
              onClick={() =>
                onRecebido(`${notaPendente.aviso} Atenção: a nota fiscal não foi registrada.`)
              }
            >
              Fechar sem a nota
            </Button>
            <Button
              type="button"
              onClick={tentarNotaDeNovo}
              disabled={tentando}
              className="min-w-36 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
            >
              {tentando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Tentar de novo'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div onKeyDown={atalhos} className="relative flex min-h-0 flex-1 flex-col">
          {/* barra de opções */}
          {temItens && (
            <div className="shrink-0 space-y-2 border-b border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Button type="button" variant="outline" size="sm" onClick={chegouTudo} className="gap-2">
                  Chegou tudo
                  <Kbd>Alt+T</Kbd>
                </Button>

                <Opcao
                  marcado={estoque}
                  onChange={setEstoque}
                  titulo="Dar entrada no estoque"
                  descricao="Soma o que chegou no estoque do catálogo e guarda no histórico do item."
                />

                {/* mostra custo de compra: só o dono */}
                {ehDono && (
                  <Opcao
                    marcado={revisarPreco}
                    onChange={setRevisarPreco}
                    titulo="Revisar preço de venda"
                    descricao="Mostra o custo e o preço atual dos itens que chegaram, para atualizar o preço no catálogo."
                    atalho="Alt+P"
                  />
                )}

                {conferidos > 0 && aindaFalta > 0 && (
                  <Opcao
                    marcado={encerrar}
                    onChange={setEncerrar}
                    titulo="Encerrar o pedido"
                    descricao="O que faltou não vem mais. O pedido fica como recebido."
                  />
                )}
              </div>

              {revisarPreco && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
                  <span className="flex items-center gap-2">
                    Margem para todos
                    <span className="relative">
                      <input
                        value={margemGeral}
                        onChange={(e) => setMargemGeral(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault()
                            aplicarMargemATodos()
                          }
                        }}
                        inputMode="decimal"
                        placeholder="40"
                        aria-label="Margem para todos os itens, em porcentagem"
                        className="h-8 w-20 rounded-md border border-slate-300 bg-white pl-2 pr-6 text-right text-sm outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        %
                      </span>
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={aplicarMargemATodos}>
                      Aplicar
                    </Button>
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={repassarAumentos}>
                    Repassar aumentos
                  </Button>
                  <span className="text-xs text-slate-500">
                    Margem sobre o preço de venda. Campo vazio mantém o preço atual.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            <div className={`space-y-4 px-6 py-4 ${revisarPreco ? 'min-w-[900px]' : ''}`}>
              {erroCarga ? (
                <Aviso tom="erro">{erroCarga}</Aviso>
              ) : itens === null ? (
                <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Carregando itens...
                </p>
              ) : itens.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Este pedido não está mais aguardando recebimento.
                </p>
              ) : (
                <>
                  {/* nota fiscal: antes da lista, porque o XML pode preencher as quantidades */}
                  <div className="rounded-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setNotaAberta((v) => !v)}
                      aria-expanded={notaAberta}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                    >
                      <span>
                        <span className="block text-sm font-medium text-slate-800">Nota fiscal</span>
                        <span className="block text-xs text-slate-500">
                          {temNota ? 'Dados preenchidos' : 'Foto, chave ou XML da nota (opcional)'}
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 text-slate-400 transition ${
                          notaAberta ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* fica montado mesmo fechado, para não perder as miniaturas */}
                    <div className={notaAberta ? 'border-t border-slate-200 p-3' : 'hidden'}>
                      <NotaFiscalCampos
                        nota={nota}
                        setNota={setNota}
                        pedidoId={pedido.id}
                        empresaId={empresaId}
                        erroEmpresa={erroEmpresa}
                        acaoXml={
                          <div className="space-y-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={usarQuantidadesDaNota}
                              disabled={preenchendo || !itens}
                              className="w-full gap-2"
                            >
                              {preenchendo && <Loader2 className="size-4 animate-spin" />}
                              Usar as quantidades da nota
                            </Button>

                            {avisosXml.map((a, i) => (
                              <Aviso key={i} tom={a.tom}>
                                {a.texto}
                              </Aviso>
                            ))}
                          </div>
                        }
                      />
                    </div>
                  </div>

                  <div ref={tabelaRef}>
                    <div
                      className={`sticky top-0 z-10 grid ${
                        revisarPreco ? GRADE_PRECO : GRADE
                      } gap-x-3 border-b border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-500`}
                    >
                      <span>Item</span>
                      <span className="text-right">Chegou</span>
                      {revisarPreco && (
                        <>
                          <span className="text-right">Custo</span>
                          <span className="text-right">Venda atual</span>
                          <span className="text-right">Margem</span>
                          <span className="text-right">Novo preço</span>
                        </>
                      )}
                      <span />
                    </div>

                    <ul>
                      {linhas.map(({ item, q }, r) => {
                        const codigo = item.produto_codigo
                        const comPreco = revisarPreco && q > 0 && !!codigo
                        const custo = precos?.custo.get(item.id) ?? null
                        const ultimo = codigo
                          ? precos?.ultimo.get(chaveItem(codigo, item.produto_nome))
                          : undefined
                        const variacao =
                          custo != null && ultimo && ultimo.preco > 0
                            ? ((custo - ultimo.preco) / ultimo.preco) * 100
                            : null

                        return (
                          <LinhaItem
                            key={item.id}
                            item={item}
                            r={r}
                            q={q}
                            valor={chegou[item.id] ?? ''}
                            estoque={estoque}
                            modoPreco={revisarPreco}
                            onChange={(v) => definir(item.id, v)}
                            onTecla={tecla}
                            podeExcluir={ehDono && item.quantidade_recebida === 0}
                            onExcluir={() => excluirItem(item)}
                            preco={
                              comPreco
                                ? {
                                    carregando: !precos,
                                    custo,
                                    vendaAtual: codigo ? (precos?.venda.get(codigo) ?? null) : null,
                                    variacao,
                                    entrada: venda[item.id] ?? VAZIA,
                                    onPreco: (t) => mudarPreco(item, t),
                                    onMargem: (t) => mudarMargem(item, t),
                                  }
                                : null
                            }
                          />
                        )
                      })}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200">
            {erro && (
              <div className="px-6 pt-3">
                <Aviso tom="erro">{erro}</Aviso>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 px-6 py-3">
              <input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                maxLength={500}
                placeholder="Observação (ex: quem entregou, avaria)"
                aria-label="Observação do recebimento"
                className="min-w-48 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
              />
              <p className="shrink-0 text-sm text-slate-500">
                {conferidos} de {plural(pendentes, 'item', 'itens')} conferidos
              </p>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
                  Cancelar
                </Button>
                <Button
                  id="rc-confirmar"
                  type="button"
                  onClick={confirmar}
                  disabled={salvando || !temItens}
                  className="min-w-48 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      Confirmar recebimento
                      <span className="text-[10px] text-white/70">Ctrl+Enter</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {temItens && (
              <p className="hidden border-t border-slate-100 bg-slate-50 px-6 py-1.5 text-[11px] text-slate-500 md:block">
                <Kbd>Enter</Kbd> <Kbd>↓</Kbd> próxima linha · <Kbd>↑</Kbd> linha anterior ·{' '}
                <Kbd>←</Kbd> <Kbd>→</Kbd> colunas · <Kbd>T</Kbd> no campo Chegou = chegou tudo do item ·{' '}
                {ehDono && (
                  <>
                    <Kbd>Alt+Del</Kbd> exclui o item do pedido ·{' '}
                  </>
                )}
                <Kbd>Esc</Kbd> fecha
              </p>
            )}
          </div>

          {pedindoSenha && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
              <SenhaVendedor
                titulo="Digite a sua senha"
                descricao="Para registrar o recebimento no seu nome."
                textoBotao="Confirmar"
                onConfirmar={(pin) => enviar(pin)}
                onCancelar={() => setPedindoSenha(false)}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ---------- dialog ---------- */

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
        className="top-[3%] flex h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[1180px]"
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