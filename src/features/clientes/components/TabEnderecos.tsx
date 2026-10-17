'use client'

import { useCallback, useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Home, Loader2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Cliente } from '../services/clientesService'
import {
  alternarEnderecoAtivo,
  excluirEndereco,
  listarEnderecos,
  type EnderecoCliente,
} from '../services/fichaService'
import { formatarCep } from '../lib/documentos'
import EnderecoDialog from './EnderecoDialog'

const linhaEndereco = (e: {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  cep: string | null
}) =>
  [
    [e.logradouro, e.numero].filter(Boolean).join(', '),
    e.complemento,
    e.bairro,
    [e.municipio, e.uf].filter(Boolean).join(' / '),
    e.cep ? formatarCep(e.cep) : null,
  ]
    .filter(Boolean)
    .join(' · ')

export default function TabEnderecos({ cliente }: { cliente: Cliente }) {
  const [lista, setLista] = useState<EnderecoCliente[] | null>(null)
  const [erro, setErro] = useState('')
  const [dialog, setDialog] = useState<{ aberto: boolean; endereco: EnderecoCliente | null }>({
    aberto: false,
    endereco: null,
  })
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setLista(await listarEnderecos(cliente.id))
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar os endereços')
      setLista((atual) => atual ?? [])
    }
  }, [cliente.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  const alternar = async (e: EnderecoCliente) => {
    setOcupado(e.id)
    setErro('')
    try {
      await alternarEnderecoAtivo(e.id, !e.ativo)
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar')
    } finally {
      setOcupado(null)
    }
  }

  const excluir = async (e: EnderecoCliente) => {
    if (!window.confirm(`Excluir o endereço "${e.apelido}"?`)) return
    setOcupado(e.id)
    setErro('')
    try {
      await excluirEndereco(e.id)
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir')
    } finally {
      setOcupado(null)
    }
  }

  const principal = linhaEndereco(cliente)

  return (
    <div className="space-y-4">
      {/* o endereço original */}
      <div className="rounded-xl border border-[#079C9C]/30 bg-[#079C9C]/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#079C9C]">
          <Home className="size-4" />
          Endereço principal
        </p>
        <p className="mt-1 text-sm text-slate-800">{principal || 'Não informado'}</p>
        <p className="mt-1 text-xs text-slate-500">
          É o endereço do cadastro. Para mudar, use <strong>Editar dados</strong>.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-700">Outros endereços de entrega</h4>
        <button
          type="button"
          onClick={() => setDialog({ aberto: true, endereco: null })}
          className="flex items-center gap-1.5 rounded-lg bg-[#079C9C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95"
        >
          <Plus className="size-4" />
          Novo endereço
        </button>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
      )}

      {lista === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Carregando...
        </p>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-center">
          <MapPin className="size-8 text-slate-300" />
          <p className="text-sm text-slate-500">Nenhum endereço extra.</p>
          <p className="max-w-xs text-xs text-slate-400">
            Útil para clientes com várias casas ou obras. Não há limite de endereços.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.map((e) => (
            <li
              key={e.id}
              className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${e.ativo ? '' : 'opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {e.apelido}
                    {!e.ativo && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">{linhaEndereco(e)}</p>
                  {e.observacao && <p className="mt-1 text-xs italic text-slate-500">{e.observacao}</p>}
                </div>

                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    title="Editar"
                    aria-label={`Editar ${e.apelido}`}
                    onClick={() => setDialog({ aberto: true, endereco: e })}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                  >
                    <Pencil className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    title={e.ativo ? 'Desativar' : 'Reativar'}
                    aria-label={`${e.ativo ? 'Desativar' : 'Reativar'} ${e.apelido}`}
                    disabled={ocupado === e.id}
                    onClick={() => alternar(e)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                  >
                    {ocupado === e.id ? (
                      <Loader2 className="size-[18px] animate-spin" />
                    ) : e.ativo ? (
                      <Archive className="size-[18px]" />
                    ) : (
                      <ArchiveRestore className="size-[18px]" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Excluir"
                    aria-label={`Excluir ${e.apelido}`}
                    disabled={ocupado === e.id}
                    onClick={() => excluir(e)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EnderecoDialog
        open={dialog.aberto}
        clienteId={cliente.id}
        endereco={dialog.endereco}
        onClose={() => setDialog((d) => ({ ...d, aberto: false }))}
        onSalvo={() => {
          setDialog((d) => ({ ...d, aberto: false }))
          carregar()
        }}
      />
    </div>
  )
}