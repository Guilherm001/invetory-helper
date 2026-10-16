'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ClipboardCheck,
  Loader2,
  Minus,
  Plus,
  Search,
  StickyNote,
  Trash2,
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
const paraNumero = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')))
const qtdTexto = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')
const precoTexto = (n: number) => n.toFixed(2).replace('.', ',')

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

const stepperClass =
  'flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#079C9C] hover:text-[#079C9C] active:scale-90'

const CONDICOES = ['À vista', '7 dias', '14 dias', '28 dias', '30/60 dias']

// "10 cimento" ou "10x cimento" -> quantidade 10
function interpretar(texto: string): { nome: string; quantidade: number } {
  const t = texto.trim()
  const m = t.match(/^(\d+)\s*x\s*(.+)$/i) || t.match(/^(\d+)\s+(.+)$/)
  if (m) {
    const q = Number(m[1])
    if (q >= 1) return { nome: m[2].trim(), quantidade: q }
  }
  return { nome: t, quantidade: 1 }
}

interface ItemForm {
  key: number
  codigo: string
  nome: string
  unidade: string | null
  qtd: string
  preco: string
  obs: string
  obsAberta: boolean
}

function subtotalDe(i: ItemForm) {
  const q = paraNumero(i.qtd)
  const p = lerPreco(i.preco)
  return Number.isFinite(q) && q > 0 && p !== null && Number.isFinite(p) && p >= 0
    ? arredonda(q * p)
    : 0
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

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="border-b border-slate-100 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </h4>
      {children}
    </section>
  )
}

// ---------- conteúdo (só existe enquanto a janela está aberta) ----------

function Conteudo({
  inicial,
  onFechar,
  onSujo,
  onSalvo,
}: {
  inicial: PedidoInicial
  onFechar: () => void
  onSujo: (sujo: boolean) => void
  onSalvo: (id: string, numero: number) => void
}) {
  const editando = !!inicial.id
  const d = inicial.dados
  const contador = useRef(0)

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [ref, setRef] = useState<string | null>(d.fornecedor_ref)
  const [nome, setNome] = useState(d.fornecedor_nome)
  const [contato, setContato] = useState(d.fornecedor_contato ?? '')
  const [prazo, setPrazo] = useState(d.prazo_dias != null ? String(d.prazo_dias) : '')
  const [condicao, setCondicao] = useState(d.condicao_pagamento ?? '')
  const [previsao, setPrevisao] = useState(d.previsao_entrega ?? '')
  const [frete, setFrete] = useState(d.frete > 0 ? precoTexto(d.frete) : '')
  const [desconto, setDesconto] = useState(d.desconto > 0 ? precoTexto(d.desconto) : '')
  const [obs, setObs] = useState(d.observacao ?? '')

  const [itens, setItens] = useState<ItemForm[]>(() =>
    inicial.itens.map((i) => ({
      key: ++contador.current,
      codigo: i.codigo,
      nome: i.nome,
      unidade: i.unidade,
      qtd: qtdTexto(i.quantidade),
      preco: i.preco > 0 ? precoTexto(i.preco) : '',
      obs: i.observacao,
      obsAberta: false,
    }))
  )

  // busca de produtos
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ProdutoLoja[]>([])
  const [buscando, setBuscando] = useState(false)
  const enterOcupado = useRef(false)

  const [ultimos, setUltimos] = useState<Map<string, UltimoPreco>>(new Map())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // fornecedores cadastrados no Comparar preços
  useEffect(() => {
    listFornecedores()
      .then(setFornecedores)
      .catch(() => {})
  }, [])

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
        if (!cancelado) setResultados(r.itens.slice(0, 6))
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
  }, [consulta])

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

  // totais
  const soma = arredonda(itens.reduce((s, i) => s + subtotalDe(i), 0))
  const freteNum = frete.trim() === '' ? 0 : (lerPreco(frete) ?? 0)
  const descontoNum = desconto.trim() === '' ? 0 : (lerPreco(desconto) ?? 0)
  const total = arredonda(soma + (Number.isFinite(freteNum) ? freteNum : 0) - (Number.isFinite(descontoNum) ? descontoNum : 0))

  // só pergunta antes de fechar se algo mudou
  const snapshot = JSON.stringify([
    ref, nome, contato, prazo, condicao, previsao, frete, desconto, obs,
    itens.map((i) => [i.codigo, i.nome, i.qtd, i.preco, i.obs]),
  ])
  const [snapshotInicial] = useState(snapshot)
  useEffect(() => {
    onSujo(snapshot !== snapshotInicial)
  }, [snapshot, snapshotInicial, onSujo])

  const escolherFornecedor = (id: string) => {
    if (!id) {
      setRef(null)
      return
    }
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

  const alterar = (key: number, dados: Partial<ItemForm>) =>
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, ...dados } : i)))

  const remover = (key: number) => setItens((prev) => prev.filter((i) => i.key !== key))

  const ajustarQtd = (i: ItemForm, delta: number) => {
    const atual = paraNumero(i.qtd)
    alterar(i.key, { qtd: qtdTexto(Math.max(1, (Number.isFinite(atual) ? atual : 0) + delta)) })
  }

  const adicionarProduto = (p: ProdutoLoja, quantidade = 1) => {
    setErro('')
    setItens((prev) => {
      const idx = prev.findIndex((x) => x.codigo !== '' && x.codigo === p.code)
      if (idx >= 0) {
        const novo = [...prev]
        const atual = paraNumero(novo[idx].qtd)
        novo[idx] = {
          ...novo[idx],
          qtd: qtdTexto((Number.isFinite(atual) ? atual : 0) + quantidade),
        }
        return novo
      }
      return [
        {
          key: ++contador.current,
          codigo: p.code,
          nome: p.name,
          unidade: p.unit,
          qtd: qtdTexto(quantidade),
          preco: '', // o preço de compra é digitado: o do catálogo é o de venda
          obs: '',
          obsAberta: false,
        },
        ...prev,
      ]
    })
  }

  const adicionarAvulso = (nomeItem: string, quantidade: number) => {
    setErro('')
    setItens((prev) => [
      {
        key: ++contador.current,
        codigo: '',
        nome: nomeItem,
        unidade: null,
        qtd: qtdTexto(quantidade),
        preco: '',
        obs: '',
        obsAberta: false,
      },
      ...prev,
    ])
  }

  // Enter: adiciona o primeiro resultado; sem resultado, entra como item avulso
  const adicionarPorEnter = async () => {
    const t = termo.trim()
    if (!t || enterOcupado.current) return
    enterOcupado.current = true
    try {
      const { nome: busca, quantidade } = interpretar(t)
      try {
        const r = await buscarProdutos({ termo: busca, pagina: 0, soComEstoque: false })
        if (r.itens[0]) {
          adicionarProduto(r.itens[0], quantidade)
          setTermo('')
          return
        }
      } catch {
        // cai para item avulso
      }
      adicionarAvulso(busca, quantidade)
      setTermo('')
    } finally {
      enterOcupado.current = false
    }
  }

  const salvar = async () => {
    setErro('')

    const nomeF = nome.trim()
    if (nomeF.length < 2) {
      setErro('Informe o fornecedor.')
      return
    }
    if (itens.length === 0) {
      setErro('Adicione pelo menos um item.')
      return
    }

    const lista: ItemEntrada[] = []
    for (const i of itens) {
      const q = paraNumero(i.qtd)
      const p = lerPreco(i.preco)
      if (i.nome.trim() === '') {
        setErro('Há um item sem nome.')
        return
      }
      if (!Number.isFinite(q) || q <= 0) {
        setErro(`Informe a quantidade de ${i.nome}.`)
        return
      }
      if (p === null || !Number.isFinite(p) || p < 0) {
        setErro(`Informe o preço de ${i.nome}.`)
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
    if (!Number.isFinite(descontoNum) || descontoNum < 0) {
      setErro('Desconto inválido.')
      return
    }
    if (total < 0) {
      setErro('O desconto não pode ser maior que o valor do pedido.')
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
      frete: freteNum,
      desconto: descontoNum,
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

  const fornecedoresOrdenados = useMemo(
    () => [...fornecedores].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [fornecedores]
  )

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <ClipboardCheck className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              {editando ? 'Editar pedido de compra' : 'Novo pedido de compra'}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              Fornecedor, itens, valores e prazo de entrega
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {d.comparacao_nome && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Veio da comparação <strong>{d.comparacao_nome}</strong>.
          </p>
        )}

        <Secao titulo="Fornecedor">
          <div className="grid gap-3 sm:grid-cols-2">
            {fornecedoresOrdenados.length > 0 && !editando && (
              <Campo id="pc-forn-select" label="Cadastrado" className="sm:col-span-2">
                <select
                  id="pc-forn-select"
                  value={ref ?? ''}
                  onChange={(e) => escolherFornecedor(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Escolher um fornecedor cadastrado...</option>
                  {fornecedoresOrdenados.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo id="pc-nome" label="Nome do fornecedor" className="sm:col-span-2">
              <input
                id="pc-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={120}
                autoComplete="off"
                autoFocus={!editando && itens.length === 0}
                className={inputClass}
              />
            </Campo>

            <Campo id="pc-contato" label="Contato">
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

            <Campo id="pc-prazo" label="Prazo (dias)">
              <input
                id="pc-prazo"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value.replace(/\D/g, '').slice(0, 3))}
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
              />
            </Campo>
          </div>
        </Secao>

        <Secao titulo="Entrega e pagamento">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id="pc-previsao" label="Previsão de entrega">
              <input
                id="pc-previsao"
                type="date"
                value={previsao}
                onChange={(e) => setPrevisao(e.target.value)}
                className={inputClass}
              />
            </Campo>

            <Campo id="pc-condicao" label="Condição de pagamento">
              <input
                id="pc-condicao"
                value={condicao}
                onChange={(e) => setCondicao(e.target.value)}
                maxLength={60}
                autoComplete="off"
                placeholder="Ex: 28 dias"
                className={inputClass}
              />
            </Campo>
          </div>

          <div className="flex flex-wrap gap-2">
            {CONDICOES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCondicao(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  condicao === c
                    ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Secao>

        <Secao titulo={`Itens (${itens.length})`}>
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    adicionarPorEnter()
                  }
                }}
                placeholder="Buscar no catálogo (código, barras ou descrição). Ex: 10 cimento"
                aria-label="Buscar produto para o pedido"
                autoComplete="off"
                enterKeyHint="done"
                className={`${inputClass} pl-9`}
              />
              {buscando && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>

            {resultados.length > 0 && (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        adicionarProduto(p, interpretar(termo).quantidade)
                        setTermo('')
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {p.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          Cód. {p.code}
                          {p.unit ? ` · ${p.unit}` : ''}
                        </span>
                      </span>
                      <Plus className="size-4 shrink-0 text-[#079C9C]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-slate-400">
              Enter adiciona o primeiro resultado. Se não achar no catálogo, entra como item
              avulso.
            </p>
          </div>

          {itens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center">
              <ClipboardCheck className="size-7 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhum item ainda.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {itens.map((i) => {
                const ultimo = ultimos.get(chaveItem(i.codigo, i.nome))
                const preco = lerPreco(i.preco)
                const variacao =
                  ultimo && ultimo.preco > 0 && preco !== null && Number.isFinite(preco)
                    ? ((preco - ultimo.preco) / ultimo.preco) * 100
                    : null

                return (
                  <li
                    key={i.key}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        value={i.nome}
                        onChange={(e) => alterar(i.key, { nome: e.target.value })}
                        aria-label="Nome do item"
                        className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 outline-none focus:bg-slate-50 focus:ring-1 focus:ring-[#079C9C]"
                      />
                      <button
                        type="button"
                        aria-label={`Remover ${i.nome}`}
                        onClick={() => remover(i.key)}
                        className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
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
                          onChange={(e) => alterar(i.key, { qtd: e.target.value })}
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
                        {i.unidade && (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            {i.unidade}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-slate-500">× R$</span>
                        <input
                          value={i.preco}
                          onChange={(e) => alterar(i.key, { preco: e.target.value })}
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

                      <span className="ml-auto text-base font-bold text-slate-900">
                        {reais(subtotalDe(i))}
                      </span>
                    </div>

                    {ultimo && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span>
                          Última compra: {reais(ultimo.preco)} em{' '}
                          {new Date(ultimo.criado_em).toLocaleDateString('pt-BR')} ({ultimo.fornecedor})
                        </span>
                        {variacao !== null && Math.abs(variacao) >= 0.5 && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                              variacao > 0
                                ? 'bg-red-50 text-red-700'
                                : 'bg-emerald-50 text-emerald-700'
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

                    {i.obsAberta || i.obs ? (
                      <input
                        value={i.obs}
                        onChange={(e) => alterar(i.key, { obs: e.target.value })}
                        placeholder="Observação deste item"
                        aria-label={`Observação de ${i.nome}`}
                        maxLength={500}
                        className={`${inputClass} mt-2`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => alterar(i.key, { obsAberta: true })}
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
        </Secao>

        <Secao titulo="Valores e observações">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id="pc-frete" label="Frete (R$)">
              <input
                id="pc-frete"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                className={inputClass}
              />
            </Campo>
            <Campo id="pc-desconto" label="Desconto (R$)">
              <input
                id="pc-desconto"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                className={inputClass}
              />
            </Campo>
          </div>

          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Observações para o fornecedor (horário de entrega, local, etc.)"
            aria-label="Observações do pedido"
            className={`${inputClass} resize-none`}
          />
        </Secao>
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
          <div>
            <p className="text-xs text-slate-500">
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
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="min-w-36 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
            >
              {salvando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : editando ? (
                'Salvar alterações'
              ) : (
                'Salvar pedido'
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
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
  const marcarSujo = (v: boolean) => {
    sujo.current = v
  }

  const fechar = () => {
    if (sujo.current && !window.confirm('Descartar as alterações deste pedido?')) return
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[760px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {open && (
          <Conteudo
            inicial={inicial}
            onFechar={fechar}
            onSujo={marcarSujo}
            onSalvo={onSalvo}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}