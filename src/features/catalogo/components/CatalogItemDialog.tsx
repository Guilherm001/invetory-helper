'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, PackagePlus, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import {
  createGrupo,
  getCatalogItemDetalhe,
  listFornecedoresBasicos,
  listFornecedoresDoItem,
  listGrupos,
  type CatalogItem,
  type CatalogItemDetalhe,
  type FornecedorBasico,
  type FornecedorDoItem,
  type GrupoCatalogo,
  type NovoCatalogItem,
} from '../services/catalogService'
import {
  CSOSN,
  CST_NORMAL,
  MULTIPLOS_PADRAO,
  ORIGENS,
  SITUACOES_TRIB,
  exemploMultiplo,
  formatarCest,
  formatarNcm,
  soDigitos,
  textoNumero,
  type SituacaoTributaria,
} from '../lib/fiscal'
import { PASSOS_ARREDONDAMENTO, arredondarAcima, calcularPreco } from '../lib/preco'

interface Props {
  open: boolean
  item: CatalogItem | null // null = criar
  onClose: () => void
  onSave: (data: NovoCatalogItem, fornecedores: FornecedorDoItem[]) => Promise<void>
}

type Aba = 'geral' | 'preco' | 'venda' | 'fiscal' | 'fornecedores'

interface Form {
  barcode: string
  name: string
  unit: string
  stock: string
  groupId: string
  custo: string
  aliqIcms: string
  aliqIpi: string
  aliqSt: string
  margem: string
  price: string
  multiplo: string
  comissao: string
  ncm: string
  cest: string
  origem: string
  cst: string
  sit: string
}

interface VinculoForm {
  supplier_id: string
  principal: boolean
  custo: string
  codigo: string
}

type Erros = Partial<Record<keyof Form | 'fornecedores', string>>

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'geral', rotulo: 'Geral' },
  { id: 'preco', rotulo: 'Preço' },
  { id: 'venda', rotulo: 'Venda' },
  { id: 'fiscal', rotulo: 'Fiscal' },
  { id: 'fornecedores', rotulo: 'Fornecedores' },
]

// em qual aba cada campo mora (para abrir a aba certa quando há erro)
const ABA_DO_CAMPO: Record<string, Aba> = {
  name: 'geral',
  stock: 'geral',
  custo: 'preco',
  aliqIcms: 'preco',
  aliqIpi: 'preco',
  aliqSt: 'preco',
  margem: 'preco',
  price: 'preco',
  multiplo: 'venda',
  comissao: 'venda',
  ncm: 'fiscal',
  cest: 'fiscal',
  fornecedores: 'fornecedores',
}

const inputClass =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

const borda = (erro?: string) => (erro ? 'border-red-400' : 'border-slate-200')

function Campo({
  label,
  erro,
  dica,
  className = '',
  children,
}: {
  label: string
  erro?: string
  dica?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {erro ? (
        <p className="text-xs text-red-600">{erro}</p>
      ) : (
        dica && <p className="text-xs text-slate-400">{dica}</p>
      )}
    </div>
  )
}

// uma linha do passo a passo do preço: número do passo, nome, o quanto soma e o campo
function LinhaPasso({
  passo,
  rotulo,
  opcional,
  dica,
  erro,
  resultado,
  prefixo,
  sufixo,
  valor,
  onChange,
  ariaLabel,
}: {
  passo?: number
  rotulo: string
  opcional?: boolean
  dica?: string
  erro?: string
  resultado?: string
  prefixo?: string
  sufixo?: string
  valor: string
  onChange: (v: string) => void
  ariaLabel: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-2 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          passo ? 'bg-[#079C9C]/10 text-[#079C9C]' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {passo ?? '+'}
      </span>

      <div className="min-w-0 flex-1 pt-1.5">
        <p className="text-sm font-semibold text-slate-700">
          {rotulo}
          {opcional && <span className="font-normal text-slate-400"> (opcional)</span>}
        </p>
        {resultado && <p className="text-xs font-semibold text-[#079C9C]">{resultado}</p>}
        {erro ? (
          <p className="text-xs text-red-600">{erro}</p>
        ) : (
          dica && <p className="text-xs text-slate-400">{dica}</p>
        )}
      </div>

      <div className="relative w-32 shrink-0">
        {prefixo && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {prefixo}
          </span>
        )}
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          aria-label={ariaLabel}
          aria-invalid={!!erro}
          className={`${inputClass} ${borda(erro)} text-right ${prefixo ? 'pl-9' : ''} ${
            sufixo ? 'pr-8' : ''
          }`}
        />
        {sufixo && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {sufixo}
          </span>
        )}
      </div>
    </div>
  )
}

// "12,50" -> 12.5 | vazio -> null | inválido -> NaN
function paraNumero(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  return Number(t.replace(',', '.'))
}

const numTexto = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : textoNumero(n)

// valor com até 4 casas (custos muito baixos, como 0,0625)
const numTexto4 = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(Math.round(n * 10000) / 10000).replace('.', ',')

const dinheiroTexto = (n: number) => n.toFixed(2).replace('.', ',')

const percentualInvalido = (v: string) => {
  const n = paraNumero(v)
  return n !== null && (Number.isNaN(n) || n < 0 || n > 100)
}

// só números válidos entram na conta; vazio vale 0
const numeroOuZero = (v: string) => {
  const n = paraNumero(v)
  return n === null || Number.isNaN(n) ? 0 : n
}

function formInicial(item: CatalogItem | null): Form {
  return {
    barcode: item?.barcode ?? '',
    name: item?.name ?? '',
    unit: item?.unit ?? '',
    stock: numTexto(item?.stock),
    groupId: '',
    custo: '',
    aliqIcms: '',
    aliqIpi: '',
    aliqSt: '',
    margem: '',
    price: numTexto(item?.price),
    multiplo: '1',
    comissao: '',
    ncm: '',
    cest: '',
    origem: '',
    cst: '',
    sit: '',
  }
}

// o que vem do banco depois que a janela abre
function extrasDoBanco(d: CatalogItemDetalhe): Partial<Form> {
  return {
    groupId: d.group_id ?? '',
    custo: numTexto4(d.custo),
    aliqIcms: numTexto(d.aliq_icms),
    aliqIpi: numTexto(d.aliq_ipi),
    aliqSt: numTexto(d.aliq_st),
    margem: numTexto(d.margem),
    multiplo: numTexto(d.multiplo),
    comissao: numTexto(d.comissao),
    ncm: d.ncm ?? '',
    cest: d.cest ?? '',
    origem: d.origem === null ? '' : String(d.origem),
    cst: d.cst_icms ?? '',
    sit: d.situacao_trib ?? '',
  }
}

function validar(f: Form, vinculos: VinculoForm[]): Erros {
  const e: Erros = {}

  if (!f.name.trim()) e.name = 'A descrição é obrigatória.'

  const estoque = paraNumero(f.stock)
  if (estoque !== null && Number.isNaN(estoque)) e.stock = 'Informe um número.'

  const custo = paraNumero(f.custo)
  if (custo !== null && (Number.isNaN(custo) || custo < 0)) e.custo = 'Informe um valor válido.'

  if (percentualInvalido(f.aliqIcms)) e.aliqIcms = 'Informe de 0 a 100.'
  if (percentualInvalido(f.aliqIpi)) e.aliqIpi = 'Informe de 0 a 100.'
  if (percentualInvalido(f.aliqSt)) e.aliqSt = 'Informe de 0 a 100.'

  const margem = paraNumero(f.margem)
  if (margem !== null && (Number.isNaN(margem) || margem < 0 || margem > 10000))
    e.margem = 'Informe uma margem válida.'

  const preco = paraNumero(f.price)
  if (preco !== null && (Number.isNaN(preco) || preco < 0)) e.price = 'Informe um valor válido.'

  const m = paraNumero(f.multiplo)
  if (m === null || Number.isNaN(m) || m <= 0) {
    e.multiplo = 'Informe um valor maior que zero (ex.: 1, 0,5 ou 0,25).'
  } else if (Math.round(m * 1000) / 1000 !== m) {
    e.multiplo = 'Use até 3 casas decimais.'
  } else if (m > 1000) {
    e.multiplo = 'Valor grande demais.'
  }

  if (percentualInvalido(f.comissao)) e.comissao = 'Informe de 0 a 100.'
  if (f.ncm && f.ncm.length !== 8) e.ncm = 'O NCM tem 8 números.'
  if (f.cest && f.cest.length !== 7) e.cest = 'O CEST tem 7 números.'

  for (const v of vinculos) {
    const c = paraNumero(v.custo)
    if (c !== null && (Number.isNaN(c) || c < 0)) {
      e.fornecedores = 'Confira o custo informado nos fornecedores.'
      break
    }
  }

  return e
}

// ---------- conteúdo (só existe enquanto a janela está aberta) ----------

function Conteudo({ item, onClose, onSave }: Omit<Props, 'open'>) {
  const editando = item !== null

  const [aba, setAba] = useState<Aba>('geral')
  const [f, setF] = useState<Form>(() => formInicial(item))
  const [vinculos, setVinculos] = useState<VinculoForm[]>([])
  const [grupos, setGrupos] = useState<GrupoCatalogo[]>([])
  const [fornecedores, setFornecedores] = useState<FornecedorBasico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')

  const [erros, setErros] = useState<Erros>({})
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const [novoGrupo, setNovoGrupo] = useState('')
  const [criandoGrupo, setCriandoGrupo] = useState(false)
  const [erroGrupo, setErroGrupo] = useState('')
  const [fornecedorEscolhido, setFornecedorEscolhido] = useState('')
  const [passoArredondar, setPassoArredondar] = useState(0.01)

  // carrega grupos, fornecedores e (na edição) os dados completos do item
  useEffect(() => {
    let cancelado = false

    Promise.all([
      listGrupos(),
      listFornecedoresBasicos(),
      item ? getCatalogItemDetalhe(item.id) : Promise.resolve(null),
      item ? listFornecedoresDoItem(item.id) : Promise.resolve([] as FornecedorDoItem[]),
    ])
      .then(([g, forn, detalhe, doItem]) => {
        if (cancelado) return
        setGrupos(g)
        setFornecedores(forn)
        if (detalhe) setF((p) => ({ ...p, ...extrasDoBanco(detalhe) }))
        setVinculos(
          doItem.map((v) => ({
            supplier_id: v.supplier_id,
            principal: v.principal,
            custo: numTexto(v.custo),
            codigo: v.codigo_fornecedor ?? '',
          }))
        )
        setCarregando(false)
      })
      .catch((e) => {
        if (cancelado) return
        setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar os dados do item')
        setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [item])

  const set = <K extends keyof Form>(campo: K, valor: Form[K]) => {
    setF((p) => ({ ...p, [campo]: valor }))
    if (erros[campo]) setErros((p) => ({ ...p, [campo]: undefined }))
  }

  // ---------- preço calculado ----------

  const custoNum = paraNumero(f.custo)
  const temCusto = custoNum !== null && !Number.isNaN(custoNum) && custoNum > 0
  const calculo = temCusto
    ? calcularPreco({
        custo: custoNum,
        icms: numeroOuZero(f.aliqIcms),
        ipi: numeroOuZero(f.aliqIpi),
        st: numeroOuZero(f.aliqSt),
        margem: numeroOuZero(f.margem),
      })
    : null
  const precoFinal = calculo ? arredondarAcima(calculo.preco, passoArredondar) : null
  const precoAtual = paraNumero(f.price)
  const precoAplicado = precoFinal !== null && precoAtual === precoFinal

  // o que o preço que está no cadastro rende sobre o custo com impostos
  const lucroAtual =
    calculo && precoAtual !== null && !Number.isNaN(precoAtual)
      ? Math.round((precoAtual - calculo.custoComImpostos) * 10000) / 10000
      : null

  // ---------- grupo ----------

  const criarGrupo = async () => {
    const nome = novoGrupo.trim()
    if (!nome || criandoGrupo) return
    setCriandoGrupo(true)
    setErroGrupo('')
    try {
      const g = await createGrupo(nome)
      setGrupos((prev) => [...prev, g].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      set('groupId', g.id)
      setNovoGrupo('')
    } catch (e) {
      setErroGrupo(e instanceof Error ? e.message : 'Não foi possível criar o grupo')
    } finally {
      setCriandoGrupo(false)
    }
  }

  // ---------- fornecedores do item ----------

  const disponiveis = fornecedores.filter((x) => !vinculos.some((v) => v.supplier_id === x.id))
  const nomeDe = (id: string) => fornecedores.find((x) => x.id === id)?.name ?? 'Fornecedor'

  const adicionarFornecedor = () => {
    if (!fornecedorEscolhido) return
    setVinculos((prev) => [
      ...prev,
      {
        supplier_id: fornecedorEscolhido,
        principal: prev.length === 0, // o primeiro vira o principal
        custo: '',
        codigo: '',
      },
    ])
    setFornecedorEscolhido('')
    if (erros.fornecedores) setErros((p) => ({ ...p, fornecedores: undefined }))
  }

  const tornarPrincipal = (id: string) =>
    setVinculos((prev) => prev.map((v) => ({ ...v, principal: v.supplier_id === id })))

  const removerFornecedor = (id: string) =>
    setVinculos((prev) => {
      const resto = prev.filter((v) => v.supplier_id !== id)
      if (resto.length > 0 && !resto.some((v) => v.principal)) resto[0] = { ...resto[0], principal: true }
      return resto
    })

  const alterarVinculo = (id: string, dados: Partial<VinculoForm>) =>
    setVinculos((prev) => prev.map((v) => (v.supplier_id === id ? { ...v, ...dados } : v)))

  // ---------- salvar ----------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    const novos = validar(f, vinculos)
    setErros(novos)

    const camposComErro = Object.keys(novos).filter((c) => novos[c as keyof Erros])
    if (camposComErro.length > 0) {
      setErrorMessage('Corrija os campos destacados.')
      const primeiraAba = ABAS.find((a) => camposComErro.some((c) => ABA_DO_CAMPO[c] === a.id))
      if (primeiraAba) setAba(primeiraAba.id)
      return
    }

    const dados: NovoCatalogItem = {
      barcode: f.barcode.trim() || null,
      name: f.name.trim(),
      unit: f.unit.trim().toUpperCase() || null,
      price: paraNumero(f.price),
      stock: paraNumero(f.stock),
      group_id: f.groupId || null,
      custo: paraNumero(f.custo),
      margem: paraNumero(f.margem),
      multiplo: paraNumero(f.multiplo) ?? 1,
      comissao: paraNumero(f.comissao),
      ncm: f.ncm || null,
      cest: f.cest || null,
      origem: f.origem === '' ? null : Number(f.origem),
      cst_icms: f.cst || null,
      situacao_trib: (f.sit || null) as SituacaoTributaria | null,
      aliq_icms: paraNumero(f.aliqIcms),
      aliq_ipi: paraNumero(f.aliqIpi),
      aliq_st: paraNumero(f.aliqSt),
    }

    const lista: FornecedorDoItem[] = vinculos.map((v) => ({
      supplier_id: v.supplier_id,
      principal: v.principal,
      custo: paraNumero(v.custo),
      codigo_fornecedor: v.codigo.trim() || null,
    }))

    setSaving(true)
    setErrorMessage('')
    try {
      // o código não é enviado: o banco gera na criação e não muda na edição
      await onSave(dados, lista)
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  const multiploNum = paraNumero(f.multiplo)
  const exemplo = multiploNum !== null && !Number.isNaN(multiploNum) ? exemploMultiplo(multiploNum) : ''

  const abaTemErro = (id: Aba) =>
    Object.keys(erros).some((c) => erros[c as keyof Erros] && ABA_DO_CAMPO[c] === id)

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-5 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            {editando ? (
              <Pencil className="size-6 text-white" />
            ) : (
              <PackagePlus className="size-6 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              {editando ? 'Editar item' : 'Novo item'}
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {editando ? item?.name : 'Cadastre um produto no catálogo'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        {/* abas */}
        <div
          role="tablist"
          aria-label="Seções do cadastro"
          className="shrink-0 overflow-x-auto border-b border-slate-200 px-4"
        >
          <div className="flex gap-1">
            {ABAS.map(({ id, rotulo }) => {
              const ativa = aba === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAba(id)}
                  className={`relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition ${
                    ativa
                      ? 'border-[#079C9C] text-[#079C9C]'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {rotulo}
                  {id === 'fornecedores' && vinculos.length > 0 && (
                    <span className="rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
                      {vinculos.length}
                    </span>
                  )}
                  {abaTemErro(id) && <span className="size-2 rounded-full bg-red-500" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-[340px] flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {erroCarga && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {erroCarga}
            </p>
          )}

          {carregando && editando && aba !== 'geral' ? (
            <p className="flex items-center gap-2 py-6 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              Carregando dados do item...
            </p>
          ) : (
            <>
              {/* ===== GERAL ===== */}
              {aba === 'geral' && (
                <>
                  <Campo label="Descrição" erro={erros.name}>
                    <input
                      value={f.name}
                      onChange={(e) => set('name', e.target.value)}
                      className={`${inputClass} ${borda(erros.name)}`}
                      placeholder="Ex: Cimento CP-II 50kg"
                      autoFocus
                    />
                  </Campo>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo label="Código">
                      <input
                        value={editando ? item?.code ?? '' : ''}
                        readOnly
                        disabled
                        tabIndex={-1}
                        className={`${inputClass} ${borda()} cursor-not-allowed bg-slate-50 text-slate-500`}
                        placeholder="Gerado automaticamente"
                      />
                    </Campo>
                    <Campo label="Código de barras">
                      <input
                        value={f.barcode}
                        onChange={(e) => set('barcode', e.target.value)}
                        className={`${inputClass} ${borda()}`}
                        inputMode="numeric"
                        placeholder="Opcional"
                      />
                    </Campo>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Campo label="Unidade">
                      <input
                        value={f.unit}
                        onChange={(e) => set('unit', e.target.value)}
                        className={`${inputClass} ${borda()} uppercase`}
                        placeholder="UN, SC, M"
                      />
                    </Campo>
                    <Campo label="Estoque" erro={erros.stock}>
                      <input
                        value={f.stock}
                        onChange={(e) => set('stock', e.target.value)}
                        className={`${inputClass} ${borda(erros.stock)}`}
                        inputMode="decimal"
                        placeholder="0"
                      />
                    </Campo>
                  </div>

                  {editando && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Para somar ao estoque guardando o histórico, use o botão de entrada na
                      lista. Mudar o estoque aqui apenas substitui o valor. O preço de venda fica
                      na aba Preço.
                    </p>
                  )}

                  <Campo
                    label="Grupo"
                    dica="Para organizar os produtos por tipo (ex.: Cimentos, Tintas, Hidráulica)"
                  >
                    <select
                      value={f.groupId}
                      onChange={(e) => set('groupId', e.target.value)}
                      className={`${inputClass} ${borda()}`}
                    >
                      <option value="">Sem grupo</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        value={novoGrupo}
                        onChange={(e) => {
                          setNovoGrupo(e.target.value)
                          setErroGrupo('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            criarGrupo()
                          }
                        }}
                        maxLength={60}
                        placeholder="Criar um grupo novo"
                        aria-label="Nome do novo grupo"
                        className={`${inputClass} ${borda()}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={criarGrupo}
                        disabled={!novoGrupo.trim() || criandoGrupo}
                        className="shrink-0 gap-1.5 border-[#079C9C] text-[#079C9C] hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                      >
                        {criandoGrupo ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        Criar
                      </Button>
                    </div>
                    {erroGrupo && <p className="text-xs text-red-600">{erroGrupo}</p>}
                  </div>
                </>
              )}

              {/* ===== PREÇO ===== */}
              {aba === 'preco' && (
                <>
                  <p className="text-xs text-slate-400">
                    Siga os passos: informe o custo, os impostos e a margem desejada. O preço de
                    venda já aparece calculado e dá para arredondar.
                  </p>

                  <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <LinhaPasso
                      passo={1}
                      rotulo="Custo"
                      dica="Valor de compra, sem impostos"
                      erro={erros.custo}
                      prefixo="R$"
                      valor={f.custo}
                      onChange={(v) => set('custo', v)}
                      ariaLabel="Custo do produto"
                    />

                    <LinhaPasso
                      passo={2}
                      rotulo="ICMS"
                      erro={erros.aliqIcms}
                      resultado={calculo ? `+ ${formatarReais(calculo.icmsValor)}` : undefined}
                      sufixo="%"
                      valor={f.aliqIcms}
                      onChange={(v) => set('aliqIcms', v)}
                      ariaLabel="Alíquota de ICMS"
                    />

                    <LinhaPasso
                      passo={3}
                      rotulo="IPI"
                      erro={erros.aliqIpi}
                      resultado={calculo ? `+ ${formatarReais(calculo.ipiValor)}` : undefined}
                      sufixo="%"
                      valor={f.aliqIpi}
                      onChange={(v) => set('aliqIpi', v)}
                      ariaLabel="Alíquota de IPI"
                    />

                    <LinhaPasso
                      rotulo="Subst. tributária"
                      opcional
                      erro={erros.aliqSt}
                      resultado={calculo ? `+ ${formatarReais(calculo.stValor)}` : undefined}
                      sufixo="%"
                      valor={f.aliqSt}
                      onChange={(v) => set('aliqSt', v)}
                      ariaLabel="Alíquota de substituição tributária"
                    />

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      <span className="text-sm font-semibold text-slate-700">Custo com impostos</span>
                      <span className="text-base font-bold tabular-nums text-slate-900">
                        {calculo ? formatarReais(calculo.custoComImpostos) : '—'}
                      </span>
                    </div>

                    <LinhaPasso
                      passo={4}
                      rotulo="Margem desejada"
                      dica="Somada ao custo com impostos (100% = o dobro)"
                      erro={erros.margem}
                      resultado={calculo ? `+ ${formatarReais(calculo.lucro)} de lucro` : undefined}
                      sufixo="%"
                      valor={f.margem}
                      onChange={(v) => set('margem', v)}
                      ariaLabel="Margem desejada"
                    />
                  </div>

                  {/* resultado */}
                  <div className="space-y-3 rounded-xl border-2 border-[#079C9C]/30 bg-[#079C9C]/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#079C9C]">
                          5 · Preço de venda calculado
                        </p>
                        <p className="text-3xl font-bold tabular-nums text-slate-900">
                          {precoFinal !== null ? formatarReais(precoFinal) : '—'}
                        </p>
                        {calculo && precoFinal !== null && precoFinal !== calculo.preco && (
                          <p className="text-xs text-slate-500">
                            arredondado de {formatarReais(calculo.preco)}
                          </p>
                        )}
                        {!calculo && (
                          <p className="text-xs text-slate-500">Informe o custo para calcular.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-600">Arredondar para cima</p>
                      <div role="radiogroup" aria-label="Arredondamento" className="flex flex-wrap gap-2">
                        {PASSOS_ARREDONDAMENTO.map((p) => {
                          const ativo = passoArredondar === p.valor
                          return (
                            <button
                              key={p.valor}
                              type="button"
                              role="radio"
                              aria-checked={ativo}
                              onClick={() => setPassoArredondar(p.valor)}
                              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                                ativo
                                  ? 'border-[#079C9C] bg-[#079C9C] text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {p.rotulo}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <Button
                      type="button"
                      disabled={precoFinal === null || precoAplicado}
                      onClick={() => precoFinal !== null && set('price', dinheiroTexto(precoFinal))}
                      className="w-full gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
                    >
                      {precoAplicado ? (
                        <>
                          <Check className="size-4" />
                          Preço aplicado
                        </>
                      ) : precoFinal !== null ? (
                        `Usar ${formatarReais(precoFinal)} como preço de venda`
                      ) : (
                        'Usar como preço de venda'
                      )}
                    </Button>
                  </div>

                  <Campo
                    label="Preço de venda (R$)"
                    erro={erros.price}
                    dica="É este valor que aparece na venda. Dá para digitar à mão, se preferir."
                  >
                    <input
                      value={f.price}
                      onChange={(e) => set('price', e.target.value)}
                      className={`${inputClass} ${borda(erros.price)} sm:max-w-[240px]`}
                      inputMode="decimal"
                      placeholder="0,00"
                    />
                  </Campo>

                  {calculo && lucroAtual !== null && precoAtual !== null && precoAtual > 0 && (
                    <p
                      className={`rounded-lg px-3 py-2 text-sm ${
                        lucroAtual < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {lucroAtual < 0 ? (
                        <>Atenção: este preço está abaixo do custo com impostos.</>
                      ) : (
                        <>
                          Com este preço: lucro de {formatarReais(lucroAtual)}, que é{' '}
                          {textoNumero(
                            Math.round((lucroAtual / calculo.custoComImpostos) * 1000) / 10
                          )}
                          % sobre o custo e{' '}
                          {textoNumero(Math.round((lucroAtual / precoAtual) * 1000) / 10)}% sobre a
                          venda.
                        </>
                      )}
                    </p>
                  )}
                </>
              )}

              {/* ===== VENDA ===== */}
              {aba === 'venda' && (
                <>
                  <div className="space-y-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Vendido de quanto em quanto?</p>
                      <p className="text-xs text-slate-400">
                        Define o menor pedaço e o passo da quantidade na venda. Ex.: um item de
                        &ldquo;meio em meio&rdquo; pode sair como 0,5, 1 ou 1,5.
                      </p>
                    </div>

                    <div role="radiogroup" aria-label="Múltiplo de venda" className="flex flex-wrap gap-2">
                      {MULTIPLOS_PADRAO.map((m) => {
                        const ativo = multiploNum === m.valor
                        return (
                          <button
                            key={m.valor}
                            type="button"
                            role="radio"
                            aria-checked={ativo}
                            onClick={() => set('multiplo', textoNumero(m.valor))}
                            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                              ativo
                                ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {m.titulo} ({textoNumero(m.valor)})
                          </button>
                        )
                      })}
                    </div>

                    <Campo label="Ou digite outro valor" erro={erros.multiplo}>
                      <input
                        value={f.multiplo}
                        onChange={(e) => set('multiplo', e.target.value)}
                        inputMode="decimal"
                        placeholder="1"
                        className={`${inputClass} ${borda(erros.multiplo)} sm:max-w-[200px]`}
                      />
                    </Campo>

                    {exemplo && !erros.multiplo && (
                      <p className="rounded-lg bg-[#079C9C]/5 px-3 py-2 text-sm text-[#079C9C]">
                        {exemplo}
                      </p>
                    )}
                  </div>

                  <Campo
                    label="Comissão (%)"
                    erro={erros.comissao}
                    dica="Percentual do valor da venda que o vendedor ganha neste produto"
                    className="sm:max-w-[240px]"
                  >
                    <input
                      value={f.comissao}
                      onChange={(e) => set('comissao', e.target.value)}
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`${inputClass} ${borda(erros.comissao)}`}
                    />
                  </Campo>
                </>
              )}

              {/* ===== FISCAL ===== */}
              {aba === 'fiscal' && (
                <>
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Esses dados são usados na emissão de nota fiscal. Em dúvida, confirme com o
                    contador antes de preencher. As alíquotas de ICMS, IPI e substituição
                    tributária ficam na aba Preço.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo label="NCM" erro={erros.ncm} dica="8 números">
                      <input
                        value={formatarNcm(f.ncm)}
                        onChange={(e) => set('ncm', soDigitos(e.target.value).slice(0, 8))}
                        inputMode="numeric"
                        placeholder="0000.00.00"
                        autoComplete="off"
                        className={`${inputClass} ${borda(erros.ncm)}`}
                      />
                    </Campo>
                    <Campo label="CEST" erro={erros.cest} dica="7 números, quando o produto tem ST">
                      <input
                        value={formatarCest(f.cest)}
                        onChange={(e) => set('cest', soDigitos(e.target.value).slice(0, 7))}
                        inputMode="numeric"
                        placeholder="00.000.00"
                        autoComplete="off"
                        className={`${inputClass} ${borda(erros.cest)}`}
                      />
                    </Campo>
                  </div>

                  <Campo label="Origem da mercadoria">
                    <select
                      value={f.origem}
                      onChange={(e) => set('origem', e.target.value)}
                      className={`${inputClass} ${borda()}`}
                    >
                      <option value="">Não informada</option>
                      {ORIGENS.map((o) => (
                        <option key={o.valor} value={String(o.valor)}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo label="CST / CSOSN do ICMS">
                      <select
                        value={f.cst}
                        onChange={(e) => set('cst', e.target.value)}
                        className={`${inputClass} ${borda()}`}
                      >
                        <option value="">Não informado</option>
                        <optgroup label="Regime normal (CST)">
                          {CST_NORMAL.map((c) => (
                            <option key={c.valor} value={c.valor}>
                              {c.rotulo}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Simples Nacional (CSOSN)">
                          {CSOSN.map((c) => (
                            <option key={c.valor} value={c.valor}>
                              {c.rotulo}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </Campo>

                    <Campo label="Situação tributária (S. Trib.)">
                      <select
                        value={f.sit}
                        onChange={(e) => set('sit', e.target.value)}
                        className={`${inputClass} ${borda()}`}
                      >
                        <option value="">Não informada</option>
                        {SITUACOES_TRIB.map((s) => (
                          <option key={s.valor} value={s.valor}>
                            {s.rotulo}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                </>
              )}

              {/* ===== FORNECEDORES ===== */}
              {aba === 'fornecedores' && (
                <>
                  <p className="text-xs text-slate-400">
                    Escolha quem fornece este produto. O fornecedor principal é o que aparece
                    primeiro nas compras. Informe o custo e o código que o fornecedor usa, se
                    quiser.
                  </p>

                  {erros.fornecedores && <p className="text-xs text-red-600">{erros.fornecedores}</p>}

                  {vinculos.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                      Nenhum fornecedor ligado a este produto.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {vinculos.map((v) => (
                        <li
                          key={v.supplier_id}
                          className={`space-y-2 rounded-xl border p-3 shadow-sm ${
                            v.principal ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate font-semibold text-slate-900">
                              {nomeDe(v.supplier_id)}
                            </p>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => tornarPrincipal(v.supplier_id)}
                                aria-pressed={v.principal}
                                title={v.principal ? 'Fornecedor principal' : 'Tornar principal'}
                                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                                  v.principal
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                }`}
                              >
                                <Star
                                  className={`size-4 ${v.principal ? 'fill-amber-400 text-amber-500' : ''}`}
                                />
                                {v.principal ? 'Principal' : 'Tornar principal'}
                              </button>
                              <button
                                type="button"
                                aria-label={`Tirar ${nomeDe(v.supplier_id)}`}
                                onClick={() => removerFornecedor(v.supplier_id)}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              value={v.custo}
                              onChange={(e) => alterarVinculo(v.supplier_id, { custo: e.target.value })}
                              inputMode="decimal"
                              placeholder="Custo (R$)"
                              aria-label={`Custo em ${nomeDe(v.supplier_id)}`}
                              className={`${inputClass} ${borda()}`}
                            />
                            <input
                              value={v.codigo}
                              onChange={(e) => alterarVinculo(v.supplier_id, { codigo: e.target.value })}
                              maxLength={60}
                              placeholder="Código no fornecedor"
                              aria-label={`Código no fornecedor ${nomeDe(v.supplier_id)}`}
                              className={`${inputClass} ${borda()}`}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {fornecedores.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Nenhum fornecedor cadastrado ainda. Cadastre em Fornecedores para poder
                      ligar aqui.
                    </p>
                  ) : disponiveis.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        value={fornecedorEscolhido}
                        onChange={(e) => setFornecedorEscolhido(e.target.value)}
                        aria-label="Escolher fornecedor"
                        className={`${inputClass} ${borda()}`}
                      >
                        <option value="">Escolha um fornecedor</option>
                        {disponiveis.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={adicionarFornecedor}
                        disabled={!fornecedorEscolhido}
                        className="shrink-0 gap-1.5 border-[#079C9C] text-[#079C9C] hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                      >
                        <Plus className="size-4" />
                        Adicionar
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Todos os fornecedores já estão ligados.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50">
          {errorMessage && (
            <p
              role="alert"
              className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-600"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {errorMessage}
            </p>
          )}
          <div className="flex justify-end gap-3 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || (carregando && editando) || !!erroCarga}
              className="min-w-36 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : editando ? (
                'Salvar alterações'
              ) : (
                'Criar item'
              )}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function CatalogItemDialog({ open, item, onClose, onSave }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[680px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {open && <Conteudo key={item?.id ?? 'novo'} item={item} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}
