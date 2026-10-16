'use client'

import { useCallback, useEffect, useState } from 'react'
import { Banknote, Loader2 } from 'lucide-react'
import {
  definirVendedorCaixa,
  listarVendedoresCaixa,
} from '../services/caixaService'
import type { VendedorCaixa } from '../types'

export default function VendedoresCaixa() {
  const [lista, setLista] = useState<VendedorCaixa[] | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      setLista(await listarVendedoresCaixa())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
      setLista((atual) => atual ?? [])
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const alternar = async (v: VendedorCaixa) => {
    setOcupado(v.id)
    setErro('')
    try {
      await definirVendedorCaixa(v.id, !v.caixa)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section className="w-full pb-10 md:max-w-xl">
      <div className="py-4">
        <h3 className="flex items-center gap-2 text-2xl font-bold">
          <Banknote className="size-6 text-[#079C9C]" />
          Quem opera o caixa
        </h3>
        <p className="text-sm text-gray-400">
          Só a senha de quem está marcado abre, fecha e faz sangria no caixa.
        </p>
      </div>

      {erro && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
      )}

      {lista === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Carregando...
        </p>
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          Cadastre os vendedores acima para marcar quem opera o caixa.
        </p>
      ) : (
        <ul className="space-y-2">
          {lista.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <span className="min-w-0 truncate font-semibold text-slate-900">{v.nome}</span>
              <button
                type="button"
                role="switch"
                aria-checked={v.caixa}
                disabled={ocupado === v.id}
                onClick={() => alternar(v)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                  v.caixa
                    ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {ocupado === v.id && <Loader2 className="size-3.5 animate-spin" />}
                {v.caixa ? 'Opera o caixa' : 'Não opera'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}