'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Banknote,
  Check,
  Clock,
  CreditCard,
  Divide,
  Loader2,
  QrCode,
  UserPlus,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { DocumentoResumo, ItemDocumento } from '@/features/loja/services/documentosService'
import SeletorCliente from '@/features/clientes/components/SeletorCliente'
import { fecharPedido, pedidoDoCaixa } from '../../services/caixaService'
import type { ResultadoFechamento } from '../../types'
import { useClienteCaixa } from '../../hooks/useClienteCaixa'
import {
  arredonda,
  calcularDesconto,
  paraNumero,
  valorParcela,
  type Forma,
  type TipoDesconto,
} from '../../lib/calculos'
import {
  MAX_FORMAS,
  opcoesDinheiro,
  totalLancado,
  validarLancamento,
  type Lancado,
} from '../../lib/pdvLogica'
import {
  colunaValida,
  linhasVisiveis,
  moverColuna,
  moverLinha,
  type LinhaId,
} from '../../lib/pdvNavegacao'
import { numeroTexto, reais, virgula } from '../../lib/formatar'

type Detalhe = 'dinheiro' | 'credito' | 'divisao'
type Digitando = { para: 'recebido' | 'divisao' | 'desc-pct' | 'desc-val'; texto: string }

interface Item {
  chave: string
  rotulo: string
  sub?: string
  ok: boolean
  icone?: LucideIcon
}

interface OpcaoDesconto {
  chave: string
  rotulo: string
  tipo?: TipoDesconto
  valor?: string
  digitar?: 'desc-pct' | 'desc-val'
}

const DESCONTOS: OpcaoDesconto[] = [
  { chave: 'zero', rotulo: 'Sem desconto', tipo: 'percentual', valor: '' },
  { chave: 'p2', rotulo: '2%', tipo: 'percentual', valor: '2' },
  { chave: 'p5', rotulo: '5%', tipo: 'percentual', valor: '5' },
  { chave: 'p10', rotulo: '10%', tipo: 'percentual', valor: '10' },
  { chave: 'p15', rotulo: '15%', tipo: 'percentual', valor: '15' },
  { chave: 'outro-pct', rotulo: 'Outro %', digitar: 'desc-pct' },
  { chave: 'outro-val', rotulo: 'Outro R$', digitar: 'desc-val' },
]

const NOME_FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  credito_cliente: 'Créd. cliente',
  pendencia: 'A prazo',
}

const rotuloForma = (l: Lancado) =>
  l.forma === 'credito' && (l.parcelas ?? 1) > 1
    ? `${NOME_FORMA.credito} ${l.parcelas}x`
    : (NOME_FORMA[l.forma] ?? l.forma)

// posição da forma na linha de formas
const idxForma = (f: Forma) => (f === 'pix' ? 1 : f === 'debito' ? 2 : f === 'credito' ? 3 : 0)

const campoClass =
  'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-right font-mono text-xl tabular-nums text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500'

const rotuloClass = 'text-[11px] uppercase tracking-wider text-slate-500'

function dataDaqui(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

// ---------- uma linha de opções (o cursor anda dentro dela com ← →) ----------

function LinhaOpcoes({
  titulo,
  dica,
  itens,
  ativa,
  col,
  onClique,
  children,
}: {
  titulo: string
  dica?: string
  itens: Item[]
  ativa: boolean
  col: number
  onClique: (i: number) => void
  children?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-md border p-2.5 transition ${
        ativa ? 'border-emerald-500/70 bg-slate-900' : 'border-slate-800 bg-slate-900/50'
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className={rotuloClass}>{titulo}</span>
        {dica && <span className="text-sm font-semibold text-emerald-300">{dica}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {itens.map((it, i) => {
          const marcado = ativa && i === col
          const Icone = it.icone
          return (
            <button
              key={it.chave}
              id={marcado ? 'pdv-item-ativo' : undefined}
              type="button"
              tabIndex={-1}
              aria-disabled={!it.ok}
              onClick={() => onClique(i)}
              className={`flex min-w-[5.5rem] flex-col items-center gap-0.5 rounded-md border px-3 py-2 text-sm font-semibold outline-none transition ${
                marcado && it.ok
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100 ring-2 ring-emerald-400/60'
                  : marcado
                    ? 'border-amber-500 bg-amber-500/10 text-amber-200 ring-2 ring-amber-500/40'
                    : it.ok
                      ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                      : 'border-dashed border-slate-800 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {Icone && <Icone className="size-4" />}
                {it.rotulo}
              </span>
              {it.sub && <span className="text-[10px] font-normal leading-tight">{it.sub}</span>}
            </button>
          )
        })}
      </div>

      {children}
    </div>
  )
}

function CampoDigitado({
  prefixo,
  valor,
  onChange,
  onKeyDown,
  rotulo,
}: {
  prefixo: string
  valor: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  rotulo: string
}) {
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <span className="font-mono text-slate-400">{prefixo}</span>
      <input
        autoFocus
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        aria-label={rotulo}
        className={campoClass}
      />
      <span className="shrink-0 text-[11px] text-slate-500">Enter confirma · ↑ cancela</span>
    </div>
  )
}

// ---------- painel ----------

export default function PainelPDV({
  pedidoId,
  onVoltar,
  onFechado,
  formaInicial,
  onForma,
}: {
  pedidoId: string
  onVoltar: () => void
  onFechado: (r: ResultadoFechamento) => void
  formaInicial: Forma
  onForma: (f: Forma) => void
}) {
  const [dados, setDados] = useState<{ doc: DocumentoResumo; itens: ItemDocumento[] } | null>(null)
  const [erroCarga, setErroCarga] = useState('')

  const [tipoDesc, setTipoDesc] = useState<TipoDesconto>('percentual')
  const [descTxt, setDescTxt] = useState('')
  const [descontoAberto, setDescontoAberto] = useState(false)

  const [lancados, setLancados] = useState<Lancado[]>([])
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [valorAlvo, setValorAlvo] = useState<number | null>(null)
  const [digitando, setDigitando] = useState<Digitando | null>(null)

  // a forma que já começa marcada neste pedido (a última usada no caixa)
  const formaPadrao = useRef(formaInicial)
  const [foco, setFoco] = useState<{ linha: LinhaId; col: number }>({
    linha: 'formas',
    col: idxForma(formaInicial),
  })

  const [aviso, setAviso] = useState('')
  const [vinculando, setVinculando] = useState(false)
  const [fechando, setFechando] = useState(false)

  // ignora o Enter que abriu o pedido, se ele ainda estiver chegando
  const montadoEm = useRef(0)
  useEffect(() => {
    montadoEm.current = Date.now()
  }, [])

  useEffect(() => {
    let cancelado = false
    pedidoDoCaixa(pedidoId)
      .then((d) => {
        if (!cancelado) setDados(d)
      })
      .catch((e) => {
        if (!cancelado) setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar o pedido')
      })
    return () => {
      cancelado = true
    }
  }, [pedidoId])

  const docCliente =
    (dados?.doc as unknown as { cliente_id?: string | null } | undefined)?.cliente_id ?? null
  const cli = useClienteCaixa(docCliente)

  // ---------- contas ----------
  const total = dados?.doc.total ?? 0
  const desc = calcularDesconto(total, tipoDesc, descTxt)
  const liquido = arredonda(total - desc.desconto)
  const pago = totalLancado(lancados)
  const falta = arredonda(liquido - pago)
  const alvo = valorAlvo !== null ? Math.min(valorAlvo, falta) : falta // quanto a próxima forma vai pagar
  const trocoTotal = arredonda(
    lancados.reduce((s, l) => s + (l.recebido !== null ? arredonda(l.recebido - l.valor) : 0), 0)
  )
  const limites = { credito_cliente: cli.credito, pendencia: cli.pendDisp }

  const podeFechar =
    !!dados && !desc.erro && !fechando && (liquido === 0 || (falta === 0 && lancados.length > 0))
  const formasAtivas = !!dados && falta > 0 && lancados.length < MAX_FORMAS

  // ---------- as linhas e o que há em cada uma ----------
  const itensFormas: Item[] = [
    { chave: 'dinheiro', rotulo: 'Dinheiro', icone: Banknote, ok: formasAtivas },
    { chave: 'pix', rotulo: 'PIX', icone: QrCode, ok: formasAtivas },
    { chave: 'debito', rotulo: 'Débito', icone: CreditCard, ok: formasAtivas },
    { chave: 'credito', rotulo: 'Crédito', icone: CreditCard, ok: formasAtivas },
    {
      chave: 'credito_cliente',
      rotulo: 'Créd. cliente',
      icone: Wallet,
      ok: formasAtivas && !cli.motivoCredito,
      sub: cli.motivoCredito ?? (cli.credito > 0 ? reais(cli.credito) : undefined),
    },
    {
      chave: 'pendencia',
      rotulo: 'A prazo',
      icone: Clock,
      ok: formasAtivas && !cli.motivoPendencia,
      sub: cli.motivoPendencia ?? undefined,
    },
    {
      chave: 'dividir',
      rotulo: 'Dividir',
      icone: Divide,
      ok: formasAtivas && lancados.length === 0 && liquido > 0,
    },
  ]

  const notas = opcoesDinheiro(alvo)
  const itensDetalhe: Item[] =
    detalhe === 'dinheiro'
      ? [
          { chave: 'exato', rotulo: 'Valor exato', ok: true },
          ...notas.map((n) => ({ chave: `n${n}`, rotulo: `R$ ${n}`, ok: true })),
          { chave: 'outro', rotulo: 'Outro valor', ok: true },
        ]
      : detalhe === 'credito'
        ? Array.from({ length: 12 }, (_, i) => ({
            chave: `p${i + 1}`,
            rotulo: i === 0 ? 'À vista' : `${i + 1}x`,
            ok: true,
          }))
        : detalhe === 'divisao'
          ? [
              ...(valorAlvo !== null ? [{ chave: 'sem', rotulo: 'Sem dividir', ok: true }] : []),
              { chave: 'metade', rotulo: `Metade · ${reais(arredonda(falta / 2))}`, ok: true },
              { chave: 'outro', rotulo: 'Outro valor', ok: true },
            ]
          : []

  const itensDesconto: Item[] = DESCONTOS.map((d) => ({ chave: d.chave, rotulo: d.rotulo, ok: true }))
  const itensLancados: Item[] = lancados.map((l, i) => ({
    chave: `l${i}`,
    rotulo: `✕ ${rotuloForma(l)} ${reais(l.valor)}`,
    ok: true,
  }))

  const linhas = linhasVisiveis({
    desconto: descontoAberto,
    detalhe: detalhe !== null,
    lancados: lancados.length > 0,
    fechar: podeFechar,
  })
  const linhaAtiva: LinhaId = linhas.includes(foco.linha)
    ? foco.linha
    : podeFechar
      ? 'fechar'
      : 'formas'

  const itensDe = (l: LinhaId): Item[] =>
    l === 'formas'
      ? itensFormas
      : l === 'detalhe'
        ? itensDetalhe
        : l === 'desconto'
          ? itensDesconto
          : l === 'lancados'
            ? itensLancados
            : l === 'voltar'
              ? [{ chave: 'voltar', rotulo: '← Voltar para a lista', ok: true }]
              : [{ chave: 'fechar', rotulo: 'Fechar pedido', ok: podeFechar }]

  const colAtiva = colunaValida(
    itensDe(linhaAtiva).map((i) => i.ok),
    foco.col
  )

  // o que aparece como dica na linha de detalhe: troco ou valor da parcela
  const itemDetalheAtivo = linhaAtiva === 'detalhe' ? itensDetalhe[colAtiva] : undefined
  let dicaDetalhe = ''
  if (itemDetalheAtivo && detalhe === 'dinheiro') {
    const recebido =
      itemDetalheAtivo.chave === 'exato'
        ? alvo
        : itemDetalheAtivo.chave.startsWith('n')
          ? Number(itemDetalheAtivo.chave.slice(1))
          : NaN
    if (Number.isFinite(recebido) && recebido > alvo) {
      dicaDetalhe = `Troco ${reais(arredonda(recebido - alvo))}`
    }
  } else if (itemDetalheAtivo && detalhe === 'credito') {
    const n = colAtiva + 1
    if (n > 1) {
      const p = valorParcela(alvo, n)
      dicaDetalhe = `${n}x de ${reais(p.base)}${p.ultima !== p.base ? ` (última ${reais(p.ultima)})` : ''}`
    }
  }

  // ---------- ações ----------
  const irPara = (linha: LinhaId, col = 0) => setFoco({ linha, col })

  const motivoBloqueio = (chave: string): string => {
    if (falta <= 0) return 'O pedido já está pago: feche o pedido.'
    if (lancados.length >= MAX_FORMAS) return `No máximo ${MAX_FORMAS} formas de pagamento.`
    if (chave === 'credito_cliente' && cli.motivoCredito)
      return `Crédito do cliente: ${cli.motivoCredito.toLowerCase()}.`
    if (chave === 'pendencia' && cli.motivoPendencia)
      return `A prazo: ${cli.motivoPendencia.toLowerCase()}.`
    if (chave === 'dividir') return 'Só dá para dividir antes do primeiro pagamento.'
    return ''
  }

  const limparPagamentos = () => {
    setLancados([])
    setDetalhe(null)
    setValorAlvo(null)
    setDigitando(null)
  }

  const aplicarDesconto = (tipo: TipoDesconto, texto: string) => {
    const d = calcularDesconto(total, tipo, texto)
    if (d.erro) {
      setAviso(d.erro)
      return
    }
    setTipoDesc(tipo)
    setDescTxt(texto)
    limparPagamentos() // o total mudou: os pagamentos lançados deixam de valer
    setDescontoAberto(false)
    setAviso('')
    if (arredonda(total - d.desconto) === 0) irPara('fechar')
    else irPara('formas', idxForma(formaPadrao.current))
  }

  const alternarDesconto = () => {
    setDigitando(null)
    setAviso('')
    if (descontoAberto) {
      setDescontoAberto(false)
      irPara('formas', idxForma(formaPadrao.current))
      return
    }
    setDetalhe(null)
    setDescontoAberto(true)
    irPara('desconto', 0)
  }

  const lancar = (forma: Forma, valor: number, recebido: number | null, parcelas: number | null) => {
    const r = validarLancamento({ liquido, lancados, forma, valor, recebido, parcelas, limites })
    if (!r.ok) {
      setAviso(r.erro)
      return
    }
    const novos = [...lancados, r.lancado]
    setLancados(novos)
    setDetalhe(null)
    setValorAlvo(null)
    setDigitando(null)
    setDescontoAberto(false)
    setAviso('')
    if (forma === 'dinheiro' || forma === 'pix' || forma === 'debito' || forma === 'credito') {
      onForma(forma)
    }
    if (arredonda(liquido - totalLancado(novos)) <= 0) irPara('fechar')
    else irPara('formas', idxForma(formaPadrao.current))
  }

  const escolherForma = (item: Item) => {
    if (!item.ok) {
      setAviso(motivoBloqueio(item.chave))
      return
    }
    setAviso('')
    switch (item.chave) {
      case 'dinheiro':
        setDetalhe('dinheiro')
        irPara('detalhe', 0)
        break
      case 'credito':
        setDetalhe('credito')
        irPara('detalhe', 0)
        break
      case 'dividir':
        setDetalhe('divisao')
        irPara('detalhe', 0)
        break
      case 'pix':
      case 'debito':
        lancar(item.chave, alvo, null, null)
        break
      case 'credito_cliente':
        lancar('credito_cliente', arredonda(Math.min(cli.credito, alvo)), null, null)
        break
      case 'pendencia':
        lancar('pendencia', alvo, null, null)
        break
    }
  }

  const escolherDetalhe = (col: number) => {
    const item = itensDetalhe[col]
    if (!item) return
    setAviso('')

    if (detalhe === 'dinheiro') {
      if (item.chave === 'outro') {
        setDigitando({ para: 'recebido', texto: '' })
        return
      }
      lancar('dinheiro', alvo, item.chave === 'exato' ? null : Number(item.chave.slice(1)), null)
    } else if (detalhe === 'credito') {
      lancar('credito', alvo, null, col + 1)
    } else if (detalhe === 'divisao') {
      if (item.chave === 'outro') {
        setDigitando({ para: 'divisao', texto: '' })
        return
      }
      setValorAlvo(item.chave === 'metade' ? arredonda(falta / 2) : null)
      setDetalhe(null)
      irPara('formas', idxForma(formaPadrao.current))
    }
  }

  const removerLancado = (col: number) => {
    setLancados((prev) => prev.filter((_, i) => i !== col))
    setDetalhe(null)
    setValorAlvo(null)
    setAviso('')
    irPara('formas', idxForma(formaPadrao.current))
  }

  const confirmarDigitado = () => {
    if (!digitando) return
    if (digitando.para === 'desc-pct') {
      aplicarDesconto('percentual', digitando.texto)
      return
    }
    if (digitando.para === 'desc-val') {
      aplicarDesconto('valor', digitando.texto)
      return
    }

    const v = paraNumero(digitando.texto)
    if (!Number.isFinite(v) || v <= 0) {
      setAviso('Informe um valor maior que zero.')
      return
    }
    if (digitando.para === 'recebido') {
      lancar('dinheiro', alvo, arredonda(v), null)
      return
    }
    // divisão: quanto vai na 1ª forma
    if (arredonda(v) >= falta) {
      setAviso(`Informe um valor menor que ${reais(falta)}: o resto vai na outra forma.`)
      return
    }
    setValorAlvo(arredonda(v))
    setDetalhe(null)
    setDigitando(null)
    setAviso('')
    irPara('formas', idxForma(formaPadrao.current))
  }

  const aoTeclarCampo = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!e.repeat) confirmarDigitado()
    } else if (e.key === 'ArrowUp' || e.key === 'Escape') {
      e.preventDefault()
      setDigitando(null)
      setAviso('')
    }
  }

  const fechar = async () => {
    if (!dados || !podeFechar) return
    setFechando(true)
    setAviso('')
    try {
      const r = await fecharPedido(
        dados.doc.id,
        dados.doc.total,
        { tipo: tipoDesc, valor: descTxt.trim() === '' ? 0 : paraNumero(descTxt) || 0 },
        liquido === 0
          ? []
          : lancados.map((l) => ({
              forma: l.forma,
              valor: l.valor,
              recebido: l.recebido,
              parcelas: l.parcelas,
            })),
        cli.clienteId
      )
      onFechado(r)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível fechar o pedido')
      setFechando(false)
    }
  }

  const ativar = (linha: LinhaId, col: number) => {
    if (linha === 'voltar') {
      onVoltar()
    } else if (linha === 'desconto') {
      const d = DESCONTOS[col]
      if (!d) return
      if (d.digitar) {
        setDigitando({ para: d.digitar, texto: '' })
        return
      }
      aplicarDesconto(d.tipo ?? 'percentual', d.valor ?? '')
    } else if (linha === 'formas') {
      const it = itensFormas[col]
      if (it) escolherForma(it)
    } else if (linha === 'detalhe') {
      escolherDetalhe(col)
    } else if (linha === 'lancados') {
      removerLancado(col)
    } else {
      void fechar()
    }
  }

  // ---------- teclado ----------
  const aoTeclar = (e: KeyboardEvent) => {
    if (e.defaultPrevented || !dados || vinculando || fechando) return
    if (document.querySelector('[role="dialog"]')) return // janela aberta por cima

    // F2 vale até digitando um valor
    if (e.key === 'F2') {
      e.preventDefault()
      alternarDesconto()
      return
    }

    const el = e.target as HTMLElement
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return // o campo trata as próprias teclas
    if (Date.now() - montadoEm.current < 250) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const nova = moverLinha(linhas, linhaAtiva, e.key === 'ArrowDown' ? 1 : -1)
      if (nova !== linhaAtiva) {
        setAviso('')
        irPara(nova, nova === 'formas' ? idxForma(formaPadrao.current) : 0)
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const hab = itensDe(linhaAtiva).map((i) => i.ok)
      irPara(linhaAtiva, moverColuna(hab, colAtiva, e.key === 'ArrowRight' ? 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!e.repeat) ativar(linhaAtiva, colAtiva)
    }
  }

  // o ouvinte é registrado uma vez e sempre chama a versão mais nova da função
  const teclaRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    teclaRef.current = aoTeclar
  })
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclaRef.current(e)
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  // o item escolhido pelas setas sempre fica à vista
  useEffect(() => {
    document.getElementById('pdv-item-ativo')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [linhaAtiva, colAtiva, detalhe, descontoAberto])

  // ---------- telas ----------
  if (erroCarga) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={onVoltar}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Voltar para a lista
        </button>
        <p className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">{erroCarga}</p>
      </div>
    )
  }

  if (!dados) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Carregando pedido...
      </p>
    )
  }

  const { doc, itens } = dados

  return (
    <div className="flex min-h-0 flex-col">
      <div className="space-y-3 pb-4">
        <LinhaOpcoes
          titulo={`Pedido nº ${doc.numero} · ${doc.cliente_nome || 'cliente não informado'}`}
          itens={itensDe('voltar')}
          ativa={linhaAtiva === 'voltar'}
          col={colAtiva}
          onClique={() => ativar('voltar', 0)}
        />

        <p className="text-sm text-slate-400">
          {doc.tipo === 'entrega' ? 'Entrega' : 'Retirada na loja'}
          {doc.cliente_telefone ? ` · ${doc.cliente_telefone}` : ''}
          {doc.vendedor_nome ? ` · vendedor ${doc.vendedor_nome}` : ''}
        </p>

        <details className="rounded-md border border-slate-800 bg-slate-900">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm text-slate-300">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'} · ver produtos
          </summary>
          <ul className="divide-y divide-slate-800 border-t border-slate-800">
            {itens.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 text-slate-300">
                  <strong className="font-mono tabular-nums text-slate-100">
                    {numeroTexto(i.quantidade)}
                    {i.unidade ? ` ${i.unidade}` : ''}
                  </strong>{' '}
                  {i.produto_nome}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-slate-200">{reais(i.subtotal)}</span>
              </li>
            ))}
          </ul>
        </details>

        {/* cliente: a única parte que usa o mouse */}
        <div className="space-y-2 rounded-md bg-slate-100 p-3 text-slate-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Cliente cadastrado</p>
            {!cli.clienteId && !vinculando && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setVinculando(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline"
              >
                <UserPlus className="size-4" />
                Vincular
              </button>
            )}
          </div>

          {cli.clienteId ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {cli.info?.nome ?? cli.escolhido?.nome ?? doc.cliente_nome ?? 'Cliente'}
                </p>
                {docCliente === null && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Tirar o cliente"
                    onClick={() => {
                      cli.setEscolhido(null)
                      setLancados((prev) =>
                        prev.filter((l) => l.forma !== 'credito_cliente' && l.forma !== 'pendencia')
                      )
                    }}
                    className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {cli.carregando ? (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="size-3 animate-spin" />
                  Carregando saldos...
                </p>
              ) : cli.erro ? (
                <p className="text-xs text-red-600">{cli.erro}</p>
              ) : cli.info ? (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                    Crédito {reais(cli.info.credito)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-semibold ${
                      cli.info.devendo > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    Deve {reais(cli.info.devendo)}
                  </span>
                  {cli.info.vencido > 0 && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-semibold text-red-700">
                      Vencido {reais(cli.info.vencido)}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ) : vinculando ? (
            <div className="space-y-2">
              <SeletorCliente
                vinculo={null}
                carregando={false}
                onEscolher={(c) => {
                  cli.setEscolhido(c)
                  setVinculando(false)
                }}
                onLimpar={() => cli.setEscolhido(null)}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setVinculando(false)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {doc.cliente_nome ? `${doc.cliente_nome} não tem cadastro.` : 'Sem cliente cadastrado.'} Para
              usar crédito ou vender a prazo, vincule um cliente.
            </p>
          )}
        </div>

        {/* totais */}
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{reais(total)}</span>
          </div>

          {desc.desconto > 0 ? (
            <div className="flex items-center justify-between text-sm text-emerald-400">
              <span>
                Desconto{desc.percentual !== null ? ` (${virgula(desc.percentual)}%)` : ''}
              </span>
              <span className="font-mono tabular-nums">- {reais(desc.desconto)}</span>
            </div>
          ) : null}

          <button
            type="button"
            tabIndex={-1}
            onClick={alternarDesconto}
            className="flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:underline"
          >
            <span className="rounded border border-slate-600 px-1.5 py-px font-mono text-[10px] text-slate-400">
              F2
            </span>
            {desc.desconto > 0 ? 'Mudar o desconto' : 'Dar desconto'}
          </button>

          <div className="flex items-end justify-between border-t border-slate-800 pt-3">
            <span className={rotuloClass}>Total a pagar</span>
            <span className="font-mono text-4xl font-bold tabular-nums text-emerald-400 md:text-5xl">
              {reais(liquido)}
            </span>
          </div>
        </div>

        {/* desconto (F2) */}
        {descontoAberto && (
          <LinhaOpcoes
            titulo="Desconto"
            itens={itensDesconto}
            ativa={linhaAtiva === 'desconto'}
            col={colAtiva}
            onClique={(i) => {
              irPara('desconto', i)
              ativar('desconto', i)
            }}
          >
            {digitando && (digitando.para === 'desc-pct' || digitando.para === 'desc-val') && (
              <CampoDigitado
                prefixo={digitando.para === 'desc-pct' ? '%' : 'R$'}
                valor={digitando.texto}
                onChange={(t) => setDigitando({ ...digitando, texto: t })}
                onKeyDown={aoTeclarCampo}
                rotulo="Valor do desconto"
              />
            )}
          </LinhaOpcoes>
        )}

        {/* pagamento */}
        {liquido > 0 && (
          <>
            <LinhaOpcoes
              titulo={
                valorAlvo !== null && lancados.length === 0
                  ? `Forma de pagamento · 1ª forma ${reais(valorAlvo)}`
                  : lancados.length > 0
                    ? `Forma de pagamento · falta ${reais(falta)}`
                    : 'Forma de pagamento'
              }
              itens={itensFormas}
              ativa={linhaAtiva === 'formas'}
              col={colAtiva}
              onClique={(i) => {
                irPara('formas', i)
                ativar('formas', i)
              }}
            />

            {detalhe !== null && (
              <LinhaOpcoes
                titulo={
                  detalhe === 'dinheiro'
                    ? `Quanto o cliente deu (para ${reais(alvo)})`
                    : detalhe === 'credito'
                      ? `Parcelas (${reais(alvo)})`
                      : 'Quanto vai na 1ª forma'
                }
                dica={dicaDetalhe}
                itens={itensDetalhe}
                ativa={linhaAtiva === 'detalhe'}
                col={colAtiva}
                onClique={(i) => {
                  irPara('detalhe', i)
                  ativar('detalhe', i)
                }}
              >
                {digitando && (digitando.para === 'recebido' || digitando.para === 'divisao') && (
                  <CampoDigitado
                    prefixo="R$"
                    valor={digitando.texto}
                    onChange={(t) => setDigitando({ ...digitando, texto: t })}
                    onKeyDown={aoTeclarCampo}
                    rotulo={
                      digitando.para === 'recebido' ? 'Dinheiro recebido do cliente' : 'Valor da 1ª forma'
                    }
                  />
                )}
              </LinhaOpcoes>
            )}

            {lancados.length > 0 && (
              <LinhaOpcoes
                titulo="Lançados (Enter remove)"
                itens={itensLancados}
                ativa={linhaAtiva === 'lancados'}
                col={colAtiva}
                onClique={(i) => {
                  irPara('lancados', i)
                  ativar('lancados', i)
                }}
              />
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-slate-800 bg-slate-900 p-2">
                <p className={rotuloClass}>Pago</p>
                <p className="font-mono text-lg font-bold tabular-nums text-slate-100">{reais(pago)}</p>
              </div>
              <div
                className={`rounded-md border p-2 ${
                  falta > 0 ? 'border-amber-600/60 bg-amber-500/10' : 'border-slate-800 bg-slate-900'
                }`}
              >
                <p className={rotuloClass}>Falta</p>
                <p
                  className={`font-mono text-lg font-bold tabular-nums ${
                    falta > 0 ? 'text-amber-300' : 'text-slate-100'
                  }`}
                >
                  {reais(Math.max(0, falta))}
                </p>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-900 p-2">
                <p className={rotuloClass}>Troco</p>
                <p
                  className={`font-mono text-lg font-bold tabular-nums ${
                    trocoTotal > 0 ? 'text-emerald-400' : 'text-slate-100'
                  }`}
                >
                  {reais(trocoTotal)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* fechar: sempre visível */}
      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-800 bg-slate-950 px-4 py-3 lg:mx-0 lg:px-0">
        {aviso && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-amber-700/60 bg-amber-950/60 px-3 py-2 text-sm text-amber-200"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {aviso}
          </p>
        )}

        <button
          id={linhaAtiva === 'fechar' ? 'pdv-item-ativo' : undefined}
          type="button"
          tabIndex={-1}
          onClick={() => void fechar()}
          disabled={!podeFechar}
          className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-4 text-lg font-bold outline-none transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${
            linhaAtiva === 'fechar'
              ? 'bg-emerald-400 text-slate-950 ring-4 ring-emerald-300/60'
              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
          }`}
        >
          {fechando ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Fechando...
            </>
          ) : (
            <>
              <Check className="size-5" />
              FECHAR PEDIDO · {reais(liquido)}
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500">
          ↑ ↓ trocam de linha · ← → escolhem · Enter confirma · F2 desconto
        </p>
      </div>
    </div>
  )
}