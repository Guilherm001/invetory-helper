'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'
import {
  excluirCliente,
  listarClientes,
  type Cliente,
  type TipoCliente,
} from '../services/clientesService'
import { formatarDocumento, formatarTelefone, pendenciasFiscais } from '../lib/documentos'
import ClienteDialog from './ClienteDialog'

interface Resultado {
  chave: string
  itens: Cliente[]
  total: number
  paginas: number
}

const FILTROS: [TipoCliente | 'todos', string][] = [
  ['todos', 'Todos'],
  ['fisica', 'Pessoa física'],
  ['juridica', 'Pessoa jurídica'],
]

export default function ClientesLista({ ehDono }: { ehDono: boolean }) {
  const [termo, setTermo] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [tipo, setTipo] = useState<TipoCliente | 'todos'>('todos')
  const [versao, setVersao] = useState(0)
  const [res, setRes] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [dialog, setDialog] = useState<{ aberto: boolean; cliente: Cliente | null }>({
    aberto: false,
    cliente: null,
  })
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')

  const chave = `${tipo}|${termoBusca}|${versao}`

  // espera a pessoa parar de digitar
  useEffect(() => {
    const timer = setTimeout(() => setTermoBusca(termo), 300)
    return () => clearTimeout(timer)
  }, [termo])

  useEffect(() => {
    let cancelado = false
    listarClientes({ termo: termoBusca, tipo, pagina: 0 })
      .then((r) => {
        if (cancelado) return
        setRes({ chave, itens: r.itens, total: r.total, paginas: 1 })
        setErro(null)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar os clientes')
      })
    return () => {
      cancelado = true
    }
  }, [chave, tipo, termoBusca])

  const carregarMais = async () => {
    if (!res || res.chave !== chave || carregandoMais) return
    setCarregandoMais(true)
    try {
      const r = await listarClientes({ termo: termoBusca, tipo, pagina: res.paginas })
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
      setErro(e instanceof Error ? e.message : 'Erro ao carregar mais clientes')
    } finally {
      setCarregandoMais(false)
    }
  }

  const excluir = async (c: Cliente) => {
    if (
      !window.confirm(
        `Excluir ${c.nome}? Os pedidos e orçamentos dele continuam existindo, só perdem o vínculo com o cadastro.`
      )
    )
      return
    setErroAcao('')
    try {
      await excluirCliente(c.id)
      setVersao((v) => v + 1)
      setAviso(`Cliente ${c.nome} excluído.`)
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível excluir')
    }
  }

  const carregando = res === null && erro === null
  const atualizando = res !== null && res.chave !== chave
  const itens = res?.itens ?? []
  const temMais = res !== null && res.itens.length < res.total

  return (
    <div className="w-full pb-16">
      <div className="mt-7 flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-2xl font-bold md:text-3xl">Clientes</h3>
          <p className="text-sm text-gray-400">
            Cadastro de pessoas físicas e jurídicas, com os dados para emissão de nota fiscal.
          </p>
        </article>

        <button
          type="button"
          onClick={() => setDialog({ aberto: true, cliente: null })}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#079C9C] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95"
        >
          <Plus className="size-5" />
          Novo cliente
        </button>
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

      <div className="space-y-3">
        <div className="relative md:max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ ou telefone"
            aria-label="Buscar cliente"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
          />
          {termo && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setTermo('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
            {FILTROS.map(([valor, rotulo]) => {
              const ativo = tipo === valor
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setTipo(valor)}
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

          <p className="flex items-center gap-2 text-sm text-slate-500">
            {atualizando && <Loader2 className="size-4 animate-spin" />}
            {res && `${res.total} ${res.total === 1 ? 'cliente' : 'clientes'}`}
          </p>
        </div>
      </div>

      {(erro || erroAcao) && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro || erroAcao}
        </p>
      )}

      {carregando ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 && !erro ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <Users className="size-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nenhum cliente encontrado</p>
          <p className="max-w-xs text-xs text-slate-400">
            Cadastre pelo botão Novo cliente. Ele fica disponível ao fazer um pedido ou orçamento.
          </p>
        </div>
      ) : (
        <ul className={`mt-4 space-y-2 ${atualizando ? 'opacity-60' : ''}`}>
          {itens.map((c) => {
            const pj = c.tipo === 'juridica'
            const pend = pendenciasFiscais(c)
            const Icone = pj ? Building2 : User
            return (
              <li
                key={c.id}
                className="flex items-stretch gap-1 rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-[#079C9C]/40 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setDialog({ aberto: true, cliente: c })}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#079C9C]/10 text-[#079C9C]">
                    <Icone className="size-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{c.nome}</span>
                    {pj && c.nome_fantasia && (
                      <span className="block truncate text-xs text-slate-500">
                        {c.nome_fantasia}
                      </span>
                    )}
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {pj ? 'CNPJ' : 'CPF'} {formatarDocumento(c.tipo, c.documento)}
                      {c.telefone ? ` · ${formatarTelefone(c.telefone)}` : ''}
                    </span>
                    {(c.municipio || c.uf) && (
                      <span className="block text-xs text-slate-400">
                        {[c.municipio, c.uf].filter(Boolean).join(' / ')}
                      </span>
                    )}
                    <span className="mt-1.5 block">
                      {pend.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          Pronto para nota
                        </span>
                      ) : (
                        <span
                          title={`Falta: ${pend.join(', ')}`}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700"
                        >
                          <AlertCircle className="size-3" />
                          Endereço incompleto
                        </span>
                      )}
                    </span>
                  </span>
                </button>

                {ehDono && (
                  <button
                    type="button"
                    title="Excluir"
                    aria-label={`Excluir ${c.nome}`}
                    onClick={() => excluir(c)}
                    className="m-2 self-start rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
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

      <ClienteDialog
        open={dialog.aberto}
        cliente={dialog.cliente}
        onClose={() => setDialog((d) => ({ ...d, aberto: false }))}
        onSalvo={(c) => {
          const novo = dialog.cliente === null
          setDialog((d) => ({ ...d, aberto: false }))
          setVersao((v) => v + 1)
          setAviso(`Cliente ${c.nome} ${novo ? 'cadastrado' : 'atualizado'}.`)
        }}
      />
    </div>
  )
}