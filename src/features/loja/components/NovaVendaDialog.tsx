'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  FileText,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  StickyNote,
  Trash2,
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
import { useLojaCatalogo } from '../hooks/useLojaCatalogo'
import type { ProdutoLoja } from '../services/lojaCatalogoService'
import {
  criarVenda,
  ErroSenha,
  editarOrcamento,
  type DadosVenda,
  type TipoEntrega,
} from '../services/vendaService'
import { dataCurta, hoje } from '../lib/formatar'
import BotoesImpressao from './BotoesImpressao'
import SenhaVendedor from './senhaVendedor'
import {
  carregarDocumentoCompleto,
  type DocumentoResumo,
  type ItemDocumento,
} from '../services/documentosService'

export type ModoDocumento = 'venda' | 'orcamento'

export interface EdicaoOrcamento {
  doc: DocumentoResumo
  itens: ItemDocumento[]
}

// ---------- utilidades ----------

const reais = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const arredonda = (n: number) => Math.round(n * 100) / 100

const paraNumero = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')))

const emTexto = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700'

const stepperClass =
  'flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#079C9C] hover:text-[#079C9C] active:scale-90'

const PAGAMENTOS = ['Dinheiro', 'PIX', 'Cartão', 'A prazo']
const VALIDADES = [7, 15, 30]

interface ItemCarrinho {
  id: string
  codigo: string
  nome: string
  unidade: string | null
  estoque: number | null
  preco: string // texto: se o produto não tem preço, o vendedor digita
  precoFixo: boolean
  qtd: string
  obs: string
  obsAberta: boolean
}

function subtotalDe(i: ItemCarrinho) {
  const q = paraNumero(i.qtd)
  const p = paraNumero(i.preco)
  return Number.isFinite(q) && Number.isFinite(p) && q > 0 && p >= 0
    ? arredonda(q * p)
    : 0
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        ativo
          ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

// ---------- conteúdo (só existe enquanto a janela está aberta) ----------

function VendaConteudo({
  modo,
  edicao,
  onFechar,
  onSujo,
  onNova,
  onSalvo,
}: {
  modo: ModoDocumento
  edicao?: EdicaoOrcamento
  onFechar: () => void
  onSujo: (sujo: boolean) => void
  onNova: () => void
  onSalvo?: () => void
}) {
  const c = useLojaCatalogo()
  const ehOrc = modo === 'orcamento'
  const d = edicao?.doc

  const [aba, setAba] = useState<'produtos' | 'pedido'>('produtos')
  const [itens, setItens] = useState<ItemCarrinho[]>(() =>
    (edicao?.itens ?? []).map((i) => ({
      id: i.id,
      codigo: i.produto_codigo ?? '',
      nome: i.produto_nome,
      unidade: i.unidade,
      estoque: null,
      preco: emTexto(i.preco_unitario),
      precoFixo: false, // na edição o preço pode ser ajustado
      qtd: emTexto(i.quantidade),
      obs: i.observacao ?? '',
      obsAberta: false,
    }))
  )

  const [cliente, setCliente] = useState(d?.cliente_nome ?? '')
  const [telefone, setTelefone] = useState(d?.cliente_telefone ?? '')
  const [tipo, setTipo] = useState<TipoEntrega>(d?.tipo ?? 'retirada')
  const [endereco, setEndereco] = useState(d?.endereco ?? '')
  const [bairro, setBairro] = useState(d?.bairro ?? '')
  const [cidade, setCidade] = useState(d?.cidade ?? '')
  const [complemento, setComplemento] = useState(d?.complemento ?? '')
  const [pagamento, setPagamento] = useState(d?.pagamento ?? '')
  const [observacao, setObservacao] = useState(d?.observacao ?? '')
  // null (só na edição) = manter a validade que o orçamento já tinha
  const [validadeDias, setValidadeDias] = useState<number | null>(edicao ? null : 7)

  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState<{
    id: string
    numero: number
    total: number
    vendedor: string | null
    resumo: string
  } | null>(null)
  const [copiado, setCopiado] = useState(false)

  // busca rápida (Enter)
  const buscaRef = useRef<HTMLInputElement>(null)
  const enterOcupado = useRef(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const total = arredonda(itens.reduce((soma, i) => soma + subtotalDe(i), 0))

  // na edição só pergunta antes de fechar se algo mudou
  const snapshot = JSON.stringify([
    itens.map((i) => [i.codigo, i.nome, i.qtd, i.preco, i.obs]),
    cliente,
    telefone,
    tipo,
    endereco,
    bairro,
    cidade,
    complemento,
    pagamento,
    observacao,
    validadeDias,
  ])
  const [inicial] = useState(snapshot)
  const sujo = edicao ? snapshot !== inicial : itens.length > 0

  useEffect(() => {
    onSujo(sujo && !feito)
  }, [sujo, feito, onSujo])

  const alterar = (id: string, dados: Partial<ItemCarrinho>) =>
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...dados } : i)))

  const remover = (id: string) => setItens((prev) => prev.filter((i) => i.id !== id))

  const ajustarQtd = (i: ItemCarrinho, delta: number) => {
    const atual = paraNumero(i.qtd)
    const base = Number.isFinite(atual) ? atual : 0
    alterar(i.id, { qtd: emTexto(Math.max(1, base + delta)) })
  }

  const adicionar = (p: ProdutoLoja) => {
    setErro('')
    setItens((prev) => {
      // já está no pedido (mesmo código): soma a quantidade
      const idx = prev.findIndex((x) => x.codigo === p.code)
      if (idx >= 0) {
        const novo = [...prev]
        const atual = paraNumero(novo[idx].qtd)
        novo[idx] = {
          ...novo[idx],
          qtd: emTexto((Number.isFinite(atual) ? atual : 0) + 1),
        }
        return novo
      }
      return [
        {
          id: p.id,
          codigo: p.code,
          nome: p.name,
          unidade: p.unit,
          estoque: p.stock,
          preco: p.price === null ? '' : emTexto(p.price),
          precoFixo: p.price !== null,
          qtd: '1',
          obs: '',
          obsAberta: false,
        },
        ...prev,
      ]
    })
  }

  // Enter na busca: adiciona o primeiro resultado ao pedido e limpa para o próximo
  const adicionarPrimeiro = async () => {
    const t = c.termo.trim()
    if (!t || enterOcupado.current) return

    enterOcupado.current = true
    try {
      const p = await c.primeiroResultado()
      if (p) {
        adicionar(p)
        setAviso({ tipo: 'ok', texto: `Adicionado: ${p.name}` })
        c.setTermo('')
      } else {
        setAviso({ tipo: 'erro', texto: `Nenhum produto encontrado para "${t}".` })
      }
    } catch (e) {
      setAviso({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Erro ao buscar o produto',
      })
    } finally {
      enterOcupado.current = false
      buscaRef.current?.focus()
    }
  }

  const montarResumo = (numero: number, totalFinal: number, validade: string | null) => {
    const linhas: string[] = [`${ehOrc ? 'Orçamento' : 'Pedido'} nº ${numero}`]
    if (ehOrc && validade) linhas.push(`Válido até ${dataCurta(validade)}`)
    if (cliente.trim())
      linhas.push(`Cliente: ${cliente.trim()}${telefone.trim() ? ` (${telefone.trim()})` : ''}`)
    if (tipo === 'entrega') {
      const end = [endereco, bairro, cidade, complemento]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ')
      linhas.push(`Entrega: ${end}`)
    } else {
      linhas.push('Retirada na loja')
    }
    linhas.push('', 'Itens:')
    for (const i of itens) {
      linhas.push(
        `• ${i.qtd}${i.unidade ? ` ${i.unidade}` : ''} ${i.nome} — ${reais(subtotalDe(i))}`
      )
      if (i.obs.trim()) linhas.push(`   obs: ${i.obs.trim()}`)
    }
    linhas.push('', `Total: ${reais(totalFinal)}`)
    if (pagamento) linhas.push(`Pagamento: ${pagamento}`)
    if (observacao.trim()) linhas.push(`Obs: ${observacao.trim()}`)
    return linhas.join('\n')
  }

  // confere o pedido antes de pedir a senha
  const validar = (): boolean => {
    setErro('')

    if (itens.length === 0) {
      setErro('Adicione pelo menos um produto.')
      setAba('produtos')
      return false
    }
    for (const i of itens) {
      const q = paraNumero(i.qtd)
      const p = paraNumero(i.preco)
      if (!Number.isFinite(q) || q <= 0) {
        setErro(`Informe a quantidade de ${i.nome}.`)
        setAba('pedido')
        return false
      }
      if (!Number.isFinite(p) || p < 0) {
        setErro(`Informe o preço de ${i.nome}.`)
        setAba('pedido')
        return false
      }
    }
    if (tipo === 'entrega' && !endereco.trim()) {
      setErro('Informe o endereço de entrega.')
      setAba('pedido')
      return false
    }
    return true
  }

  // 1º passo: confere o pedido e pede a senha do vendedor
  const pedirSenha = () => {
    if (validar()) setConfirmando(true)
  }

  // 2º passo: com a senha, grava no banco (a senha identifica o vendedor)
  const confirmar = async (pin: string) => {
    const dados: DadosVenda = {
      documento: ehOrc ? 'orcamento' : 'pedido',
      validade_dias: ehOrc ? (validadeDias ?? undefined) : undefined,
      pin,
      cliente_nome: cliente,
      cliente_telefone: telefone,
      tipo,
      endereco: tipo === 'entrega' ? endereco : '',
      bairro: tipo === 'entrega' ? bairro : '',
      cidade: tipo === 'entrega' ? cidade : '',
      complemento: tipo === 'entrega' ? complemento : '',
      pagamento,
      observacao,
    }
    const lista = itens.map((i) => ({
      codigo: i.codigo,
      nome: i.nome,
      unidade: i.unidade,
      quantidade: paraNumero(i.qtd),
      preco: paraNumero(i.preco),
      observacao: i.obs.trim(),
    }))

    try {
      const r = edicao
        ? await editarOrcamento(edicao.doc.id, dados, lista)
        : await criarVenda(dados, lista)

      setFeito({
        id: r.id,
        numero: r.numero,
        total: r.total,
        vendedor: r.vendedor_nome,
        resumo: montarResumo(r.numero, r.total, r.validade),
      })
      setConfirmando(false)
      if (edicao) onSalvo?.()
    } catch (e) {
      // erro de senha: a própria janela da senha mostra e deixa tentar de novo
      if (e instanceof ErroSenha) throw e
      // qualquer outro erro: fecha a janela da senha e mostra na tela
      setConfirmando(false)
      setErro(e instanceof Error ? e.message : 'Erro ao registrar')
    }
  }

  const copiar = async () => {
    if (!feito) return
    try {
      await navigator.clipboard.writeText(feito.resumo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  // ---------- tela de sucesso ----------
  if (feito) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="size-9" strokeWidth={3} />
        </div>
        <div>
          <h4 className="text-2xl font-bold text-slate-900">
            {ehOrc
              ? edicao
                ? `Orçamento nº ${feito.numero} atualizado`
                : `Orçamento nº ${feito.numero} salvo`
              : `Pedido nº ${feito.numero} registrado`}
          </h4>
          <p className="mt-1 text-3xl font-bold text-[#079C9C]">{reais(feito.total)}</p>
          {feito.vendedor && (
            <p className="mt-1 text-sm text-slate-500">Vendedor: {feito.vendedor}</p>
          )}
        </div>

        <pre className="max-h-48 w-full max-w-md overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-left font-sans text-sm text-slate-700">
          {feito.resumo}
        </pre>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Imprimir
          </p>
          <BotoesImpressao centralizar carregar={() => carregarDocumentoCompleto(feito.id)} />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={copiar} className="gap-2">
            {copiado ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            {copiado ? 'Copiado!' : 'Copiar resumo'}
          </Button>
          {!edicao && (
            <Button
              type="button"
              onClick={onNova}
              className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
            >
              <Plus className="size-4" />
              {ehOrc ? 'Novo orçamento' : 'Nova venda'}
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={ehOrc ? '/orcamentos' : '/pedidos'}>
              {ehOrc ? 'Ver orçamentos' : 'Ver pedidos'}
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    )
  }

  // ---------- tela principal ----------
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* abas (só no celular) */}
      <div className="grid grid-cols-2 border-b border-slate-200 md:hidden">
        {(
          [
            ['produtos', 'Produtos'],
            ['pedido', `${ehOrc ? 'Orçamento' : 'Pedido'} (${itens.length})`],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`py-3 text-sm font-semibold transition ${
              aba === id
                ? 'border-b-2 border-[#079C9C] text-[#079C9C]'
                : 'border-b-2 border-transparent text-slate-500'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] md:grid-cols-2 md:divide-x md:divide-slate-200">
        {/* ===== Esquerda: buscar produtos ===== */}
        <section
          className={`${aba === 'produtos' ? 'flex' : 'hidden'} min-h-0 flex-col md:flex`}
        >
          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={buscaRef}
                value={c.termo}
                onChange={(e) => {
                  c.setTermo(e.target.value)
                  setAviso(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    adicionarPrimeiro()
                  }
                }}
                autoFocus
                inputMode="search"
                enterKeyHint="done"
                placeholder="Código, código de barras ou descrição"
                aria-label="Buscar produto"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
              />
              {c.termo && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => {
                    c.setTermo('')
                    setAviso(null)
                    buscaRef.current?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>

            {aviso ? (
              <p
                role={aviso.tipo === 'erro' ? 'alert' : 'status'}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  aviso.tipo === 'ok'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {aviso.tipo === 'ok' ? (
                  <Check className="size-4 shrink-0" />
                ) : (
                  <AlertCircle className="size-4 shrink-0" />
                )}
                <span className="min-w-0 truncate">{aviso.texto}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Digite o código e aperte Enter para adicionar o primeiro resultado.
              </p>
            )}

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

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {c.erro && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {c.erro}
              </p>
            )}

            {c.carregando ? (
              <p className="py-10 text-center text-sm text-slate-400">Carregando catálogo...</p>
            ) : c.itens.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Search className="size-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Nenhum produto encontrado</p>
              </div>
            ) : (
              <ul className={`space-y-2 ${c.atualizando ? 'opacity-60' : ''}`}>
                {c.itens.map((p, idx) => {
                  const noPedido = itens.find((i) => i.codigo === p.code)
                  // o primeiro resultado é o que o Enter vai adicionar
                  const destaque = idx === 0 && c.termo.trim() !== '' && c.emDia
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm ${
                        destaque
                          ? 'border-[#079C9C] ring-2 ring-[#079C9C]/25'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Cód. {p.code}
                          {p.unit ? ` · ${p.unit}` : ''}
                          {p.stock !== null &&
                            (p.stock <= 0 ? ' · Sem estoque' : ` · Estoque: ${emTexto(p.stock)}`)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#079C9C]">
                          {p.price === null ? 'Sem preço' : reais(p.price)}
                        </p>
                        {destaque && (
                          <p className="mt-1 text-[11px] font-semibold text-[#079C9C]">
                            ↵ Enter para adicionar
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => adicionar(p)}
                        aria-label={`Adicionar ${p.name}`}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${
                          noPedido
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-[#079C9C] text-white hover:bg-[#079C9C]/90'
                        }`}
                      >
                        {noPedido ? (
                          <>
                            <Check className="size-4" />
                            {noPedido.qtd}
                          </>
                        ) : (
                          <>
                            <Plus className="size-4" />
                            Adicionar
                          </>
                        )}
                      </button>
                    </li>
                  )
                })}
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
        </section>

        {/* ===== Direita: pedido / orçamento ===== */}
        <section
          className={`${aba === 'pedido' ? 'flex' : 'hidden'} min-h-0 flex-col bg-slate-50/60 md:flex`}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
            {/* itens */}
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Produtos do {ehOrc ? 'orçamento' : 'pedido'} ({itens.length})
              </p>

              {itens.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center">
                  <ShoppingCart className="size-7 text-slate-300" />
                  <p className="text-sm text-slate-500">Nenhum produto ainda.</p>
                  <button
                    type="button"
                    onClick={() => setAba('produtos')}
                    className="text-sm font-semibold text-[#079C9C] md:hidden"
                  >
                    Buscar produtos
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {itens.map((i) => {
                    const q = paraNumero(i.qtd)
                    const acimaDoEstoque =
                      i.estoque !== null && Number.isFinite(q) && q > i.estoque
                    return (
                      <li
                        key={i.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{i.nome}</p>
                            <p className="text-xs text-slate-500">
                              {i.codigo ? `Cód. ${i.codigo}` : 'Sem código'}
                              {i.unidade ? ` · ${i.unidade}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remover ${i.nome}`}
                            onClick={() => remover(i.id)}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-[18px]" />
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label="Diminuir quantidade"
                              onClick={() => ajustarQtd(i, -1)}
                              className={stepperClass}
                            >
                              <Minus className="size-4" />
                            </button>
                            <input
                              value={i.qtd}
                              onChange={(e) => alterar(i.id, { qtd: e.target.value })}
                              inputMode="decimal"
                              aria-label={`Quantidade de ${i.nome}`}
                              className="h-9 w-16 rounded-lg border border-slate-200 bg-white text-center text-base font-semibold outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
                            />
                            <button
                              type="button"
                              aria-label="Aumentar quantidade"
                              onClick={() => ajustarQtd(i, 1)}
                              className={stepperClass}
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>

                          {i.precoFixo ? (
                            <span className="text-sm text-slate-500">
                              × {reais(paraNumero(i.preco))}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-slate-500">× R$</span>
                              <input
                                value={i.preco}
                                onChange={(e) => alterar(i.id, { preco: e.target.value })}
                                inputMode="decimal"
                                placeholder="Preço"
                                aria-label={`Preço de ${i.nome}`}
                                className={`h-9 w-24 rounded-lg border px-2 text-center text-base outline-none focus:border-[#079C9C] md:text-sm ${
                                  i.preco.trim() === ''
                                    ? 'border-amber-300 bg-amber-50'
                                    : 'border-slate-200 bg-white'
                                }`}
                              />
                            </div>
                          )}

                          <span className="ml-auto text-base font-bold text-slate-900">
                            {reais(subtotalDe(i))}
                          </span>
                        </div>

                        {acimaDoEstoque && (
                          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                            <AlertCircle className="size-3.5 shrink-0" />
                            Acima do estoque ({emTexto(i.estoque as number)}). Confira antes de
                            prometer.
                          </p>
                        )}

                        {i.obsAberta || i.obs ? (
                          <input
                            value={i.obs}
                            onChange={(e) => alterar(i.id, { obs: e.target.value })}
                            placeholder="Observação deste produto (ex: cortar em 3m)"
                            aria-label={`Observação de ${i.nome}`}
                            maxLength={500}
                            className={`${inputClass} mt-2`}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => alterar(i.id, { obsAberta: true })}
                            className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-slate-600"
                          >
                            <StickyNote className="size-3.5" />
                            Adicionar observação
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* validade (só orçamento) */}
            {ehOrc && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">Validade do orçamento</p>
                <div className="flex flex-wrap gap-2">
                  {d?.validade && (
                    <Chip ativo={validadeDias === null} onClick={() => setValidadeDias(null)}>
                      Manter ({d.validade < hoje() ? 'venceu em' : 'até'}{' '}
                      {dataCurta(d.validade)})
                    </Chip>
                  )}
                  {VALIDADES.map((dias) => (
                    <Chip
                      key={dias}
                      ativo={validadeDias === dias}
                      onClick={() => setValidadeDias(dias)}
                    >
                      {dias} dias
                    </Chip>
                  ))}
                </div>
                {edicao && (
                  <p className="text-xs text-slate-400">
                    Escolhendo um prazo, a contagem recomeça a partir de hoje.
                  </p>
                )}
              </div>
            )}

            {/* cliente */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Cliente</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nome do cliente"
                  maxLength={120}
                  aria-label="Nome do cliente"
                  className={inputClass}
                />
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Telefone"
                  inputMode="tel"
                  maxLength={40}
                  aria-label="Telefone do cliente"
                  className={inputClass}
                />
              </div>
            </div>

            {/* retirada / entrega */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Como o cliente recebe</p>
              <div className="flex gap-2">
                <Chip ativo={tipo === 'retirada'} onClick={() => setTipo('retirada')}>
                  Retira na loja
                </Chip>
                <Chip ativo={tipo === 'entrega'} onClick={() => setTipo('entrega')}>
                  Entrega
                </Chip>
              </div>

              {tipo === 'entrega' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua e número *"
                    maxLength={200}
                    aria-label="Rua e número"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <input
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Bairro"
                    maxLength={100}
                    aria-label="Bairro"
                    className={inputClass}
                  />
                  <input
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder="Cidade"
                    maxLength={100}
                    aria-label="Cidade"
                    className={inputClass}
                  />
                  <input
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    placeholder="Complemento / ponto de referência"
                    maxLength={200}
                    aria-label="Complemento"
                    className={`${inputClass} sm:col-span-2`}
                  />
                </div>
              )}
            </div>

            {/* pagamento */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Forma de pagamento</p>
              <div className="flex flex-wrap gap-2">
                {PAGAMENTOS.map((forma) => (
                  <Chip
                    key={forma}
                    ativo={pagamento === forma}
                    onClick={() => setPagamento(pagamento === forma ? '' : forma)}
                  >
                    {forma}
                  </Chip>
                ))}
              </div>
            </div>

            {/* observação geral */}
            <div>
              <label htmlFor="obs-venda" className={labelClass}>
                Observação do {ehOrc ? 'orçamento' : 'pedido'}
              </label>
              <textarea
                id="obs-venda"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={
                  ehOrc
                    ? 'Ex: preço válido para pagamento à vista, frete não incluso...'
                    : 'Ex: entregar depois das 14h, cliente retira amanhã...'
                }
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </section>
      </div>

      {/* rodapé */}
      <div className="border-t border-slate-200 bg-slate-50">
        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <div>
            <p className="text-xs text-slate-500">
              Total · {itens.length} {itens.length === 1 ? 'produto' : 'produtos'}
            </p>
            <p className="text-2xl font-bold text-[#079C9C]">{reais(total)}</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onFechar}
              className="hidden border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              Cancelar
            </Button>

            {/* celular, na aba de produtos: vai revisar */}
            {aba === 'produtos' && (
              <Button
                type="button"
                onClick={() => setAba('pedido')}
                disabled={itens.length === 0}
                className="min-w-40 bg-[#079C9C] text-white hover:bg-[#079C9C]/90 md:hidden"
              >
                Revisar {ehOrc ? 'orçamento' : 'pedido'}
              </Button>
            )}

            <Button
              type="button"
              onClick={pedirSenha}
              disabled={itens.length === 0}
              className={`min-w-44 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90 ${
                aba === 'produtos' ? 'hidden md:inline-flex' : ''
              }`}
            >
              {ehOrc ? (edicao ? 'Salvar alterações' : 'Salvar orçamento') : 'Registrar venda'}
            </Button>
          </div>
        </div>
      </div>

      {/* passo final: senha do vendedor */}
      {confirmando && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <SenhaVendedor
            titulo="Digite a sua senha"
            descricao={
              ehOrc
                ? edicao
                  ? 'Para salvar as alterações no seu nome.'
                  : 'Para salvar o orçamento no seu nome.'
                : 'Para registrar a venda no seu nome.'
            }
            textoBotao={ehOrc ? 'Salvar' : 'Registrar'}
            onConfirmar={confirmar}
            onCancelar={() => setConfirmando(false)}
          />
        </div>
      )}
    </div>
  )
}

// ---------- janela ----------

export default function NovaVendaDialog({
  open,
  modo = 'venda',
  edicao,
  onClose,
  onSalvo,
}: {
  open: boolean
  modo?: ModoDocumento
  edicao?: EdicaoOrcamento
  onClose: () => void
  onSalvo?: () => void
}) {
  const sujo = useRef(false)
  const marcarSujo = useCallback((v: boolean) => {
    sujo.current = v
  }, [])
  const [chave, setChave] = useState(0)
  const ehOrc = modo === 'orcamento'

  const fechar = () => {
    if (
      sujo.current &&
      !window.confirm(
        edicao
          ? 'Descartar as alterações deste orçamento?'
          : `Descartar ${ehOrc ? 'este orçamento' : 'esta venda'}? Os produtos adicionados serão perdidos.`
      )
    )
      return
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) fechar()
      }}
    >
      <DialogContent
        // clicar fora sem querer não derruba o que está em andamento
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[3%] flex h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[1000px] md:h-[720px] md:max-h-[94dvh] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              {ehOrc ? (
                <FileText className="size-6 text-white" />
              ) : (
                <ShoppingCart className="size-6 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold text-white">
                {edicao
                  ? `Editar orçamento nº ${edicao.doc.numero}`
                  : ehOrc
                    ? 'Novo orçamento'
                    : 'Nova venda'}
              </DialogTitle>
              <DialogDescription className="text-sm text-white/80">
                {edicao
                  ? 'Altere produtos, cliente ou endereço e salve com a senha do vendedor'
                  : ehOrc
                    ? 'Monte o orçamento para o cliente e escolha por quanto tempo ele vale'
                    : 'Adicione os produtos, os dados do cliente e registre o pedido'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {open && (
          <VendaConteudo
            key={`${modo}-${chave}-${edicao?.doc.id ?? 'novo'}`}
            modo={modo}
            edicao={edicao}
            onFechar={fechar}
            onSujo={marcarSujo}
            onNova={() => setChave((k) => k + 1)}
            onSalvo={onSalvo}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}