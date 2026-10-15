'use client'

import { useEffect, useState } from 'react'
import { Building2, Loader2, Plus, Search, User, X } from 'lucide-react'
import {
  listarClientes,
  type Cliente,
  type ClienteResumo,
} from '@/features/clientes/services/clientesService'
import { formatarDocumento } from '@/features/clientes/lib/documentos'
import ClienteDialog from '@/features/clientes/components/ClienteDialog'

export default function SeletorCliente({
  vinculo,
  carregando,
  onEscolher,
  onLimpar,
}: {
  vinculo: ClienteResumo | null
  carregando: boolean
  onEscolher: (c: Cliente) => void
  onLimpar: () => void
}) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [novoAberto, setNovoAberto] = useState(false)

  const consulta = termo.trim()

  useEffect(() => {
    if (consulta.length < 2) {
      setResultados([])
      setBuscando(false)
      setErro('')
      return
    }

    let cancelado = false
    setBuscando(true)

    const timer = setTimeout(async () => {
      try {
        const r = await listarClientes({ termo: consulta, pagina: 0, tamanho: 6 })
        if (cancelado) return
        setResultados(r.itens)
        setErro('')
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao buscar clientes')
      } finally {
        if (!cancelado) setBuscando(false)
      }
    }, 250)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [consulta])

  const escolher = (c: Cliente) => {
    setTermo('')
    setResultados([])
    onEscolher(c)
  }

  if (carregando) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Carregando cliente...
      </p>
    )
  }

  // cliente já escolhido
  if (vinculo) {
    const Icone = vinculo.tipo === 'juridica' ? Building2 : User
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#079C9C]/40 bg-[#079C9C]/5 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#079C9C]/10 text-[#079C9C]">
          <Icone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{vinculo.nome}</p>
          <p className="text-xs text-slate-500">
            {vinculo.tipo === 'juridica' ? 'CNPJ' : 'CPF'}{' '}
            {formatarDocumento(vinculo.tipo, vinculo.documento)} · cliente cadastrado
          </p>
        </div>
        <button
          type="button"
          onClick={onLimpar}
          aria-label="Tirar cliente cadastrado"
          title="Tirar cliente cadastrado"
          className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar cliente cadastrado (nome, CPF/CNPJ ou telefone)"
          aria-label="Buscar cliente cadastrado"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
        />
        {buscando && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {consulta.length >= 2 && !buscando && !erro && resultados.length === 0 && (
        <p className="px-1 text-xs text-slate-500">Nenhum cliente cadastrado com esse dado.</p>
      )}

      {resultados.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {resultados.map((c) => {
            const Icone = c.tipo === 'juridica' ? Building2 : User
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => escolher(c)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <Icone className="size-4 shrink-0 text-[#079C9C]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {c.nome}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {formatarDocumento(c.tipo, c.documento)}
                      {c.municipio ? ` · ${c.municipio}/${c.uf ?? ''}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setNovoAberto(true)}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#079C9C] hover:underline"
      >
        <Plus className="size-4" />
        Cadastrar novo cliente
      </button>

      <ClienteDialog
        open={novoAberto}
        cliente={null}
        nomeInicial={/[A-Za-zÀ-ÿ]/.test(consulta) ? consulta : ''}
        onClose={() => setNovoAberto(false)}
        onSalvo={(c) => {
          setNovoAberto(false)
          escolher(c)
        }}
      />
    </div>
  )
}