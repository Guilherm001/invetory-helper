'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, FileText, Loader2, Search, X } from 'lucide-react'
import {
  listarDocumentos,
  type Documento,
  type DocumentoResumo,
  type FiltroDocumento,
  type ItemDocumento,
} from '../services/documentosService'
import { dataCurta, dataHora, reais, statusInfo } from '../lib/formatar'
import DocumentoDetalheDialog, { type Aviso } from './DocumentoDetalheDialog'
import NovaVendaDialog from './NovaVendaDialog'

interface Resultado {
  chave: string
  itens: DocumentoResumo[]
  total: number
  paginas: number
}

const FILTROS: Record<Documento, [FiltroDocumento, string][]> = {
  pedido: [
    ['todos', 'Todos'],
    ['aberta', 'Em aberto'],
    ['entregue', 'Concluídos'],
    ['cancelada', 'Cancelados'],
  ],
  orcamento: [
    ['todos', 'Todos'],
    ['aberta', 'Em aberto'],
    ['vencido', 'Vencidos'],
    ['cancelada', 'Recusados'],
  ],
}

export default function DocumentosLista({
  documento,
  ehDono,
}: {
  documento: Documento
  ehDono: boolean
}) {
  const orc = documento === 'orcamento'

  const [termo, setTermo] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroDocumento>('todos')
  const [versao, setVersao] = useState(0)
  const [res, setRes] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [aberto, setAberto] = useState<DocumentoResumo | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [editando, setEditando] = useState<{
  doc: DocumentoResumo
  itens: ItemDocumento[]
} | null>(null)

  const chave = `${documento}|${filtro}|${termoBusca}|${versao}`

  // espera a pessoa parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo), 300)
    return () => clearTimeout(t)
  }, [termo])

  useEffect(() => {
    let cancelado = false
    listarDocumentos({ documento, filtro, termo: termoBusca, pagina: 0 })
      .then((r) => {
        if (cancelado) return
        setRes({ chave, itens: r.itens, total: r.total, paginas: 1 })
        setErro(null)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar')
      })
    return () => {
      cancelado = true
    }
  }, [chave, documento, filtro, termoBusca])

  const carregarMais = async () => {
    if (!res || res.chave !== chave || carregandoMais) return
    setCarregandoMais(true)
    try {
      const r = await listarDocumentos({
        documento,
        filtro,
        termo: termoBusca,
        pagina: res.paginas,
      })
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
      setErro(e instanceof Error ? e.message : 'Erro ao carregar mais')
    } finally {
      setCarregandoMais(false)
    }
  }

  const carregando = res === null && erro === null
  const atualizando = res !== null && res.chave !== chave
  const itens = res?.itens ?? []
  const temMais = res !== null && res.itens.length < res.total

  const Icone = orc ? FileText : ClipboardList

  return (
    <div className="w-full pb-16">
      <div className="mt-7 py-4">
        <h3 className="text-2xl font-bold md:text-3xl">{orc ? 'Orçamentos' : 'Pedidos'}</h3>
        <p className="text-sm text-gray-400">
          {orc
            ? 'Orçamentos feitos para os clientes. Toque em um para ver os detalhes ou transformar em pedido.'
            : 'Pedidos registrados na loja. Toque em um para ver os detalhes e acompanhar a entrega.'}
          {!ehDono && ' Você vê apenas os que criou.'}
        </p>
      </div>

      {aviso && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
        >
          <p>
            {aviso.texto}{' '}
            {aviso.link && (
              <Link href={aviso.link.href} className="font-semibold underline">
                {aviso.link.label}
              </Link>
            )}
          </p>
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
            placeholder="Buscar por cliente, telefone ou número"
            aria-label="Buscar"
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
          <div role="radiogroup" aria-label="Filtrar" className="flex flex-wrap gap-2">
            {FILTROS[documento].map(([valor, rotulo]) => {
              const ativo = filtro === valor
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setFiltro(valor)}
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
            {res && `${res.total} ${res.total === 1 ? 'resultado' : 'resultados'}`}
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
          <Icone className="size-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            {orc ? 'Nenhum orçamento encontrado' : 'Nenhum pedido encontrado'}
          </p>
          <p className="max-w-xs text-xs text-slate-400">
            {orc
              ? 'Crie um no Catálogo da loja, pelo botão Orçamento.'
              : 'Crie um no Catálogo da loja, pelo botão Nova venda.'}
          </p>
        </div>
      ) : (
        <ul className={`mt-4 space-y-2 ${atualizando ? 'opacity-60' : ''}`}>
          {itens.map((d) => {
            const info = statusInfo(d)
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setAberto(d)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-px hover:border-[#079C9C]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#079C9C]">Nº {d.numero}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${info.classe}`}
                        >
                          {info.texto}
                        </span>
                      </p>
                      <p className="mt-1 truncate font-semibold text-slate-900">
                        {d.cliente_nome || 'Cliente não informado'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {dataHora(d.criado_em)} · {d.tipo === 'entrega' ? 'Entrega' : 'Retirada'}
                        {d.vendedor_nome ? ` · ${d.vendedor_nome}` : ''}
                      </p>
                      {orc && d.validade && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Válido até {dataCurta(d.validade)}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-lg font-bold text-slate-900">{reais(d.total)}</p>
                  </div>
                </button>
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

      <DocumentoDetalheDialog
        doc={aberto}
        ehDono={ehDono}
        onClose={() => setAberto(null)}
        onMudou={(a) => {
          setAberto(null)
          setVersao((v) => v + 1)
          if (a) setAviso(a)
        }}
      onEditar={(doc, itens) => {
  setAberto(null)
  setEditando({ doc, itens })
}}
      />
            <NovaVendaDialog
        open={editando !== null}
        modo="orcamento"
        edicao={editando ?? undefined}
        onClose={() => setEditando(null)}
        onSalvo={() => {
          setVersao((v) => v + 1)
          setAviso({ texto: `Orçamento nº ${editando?.doc.numero} atualizado.` })
        }}
      />
    </div>
  )
}