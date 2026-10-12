'use client'

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Loader2, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  criarVendedor,
  listarVendedores,
  removerVendedor,
  trocarPinVendedor,
  type Vendedor,
} from '@/features/loja/services/vendedorService'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

const soDigitos = (s: string) => s.replace(/\D/g, '').slice(0, 6)

export function VendedoresManager() {
  const [lista, setLista] = useState<Vendedor[] | null>(null)
  const [nome, setNome] = useState('')
  const [pin, setPin] = useState('')
  const [trocando, setTrocando] = useState<string | null>(null)
  const [novoPin, setNovoPin] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    try {
      setLista(await listarVendedores())
    } catch (e) {
      setMsg({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Erro ao carregar os vendedores',
      })
      setLista((atual) => atual ?? [])
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const rodar = async (fn: () => Promise<void>, textoOk: string, depois?: () => void) => {
    setOcupado(true)
    setMsg(null)
    try {
      await fn()
      setMsg({ tipo: 'ok', texto: textoOk })
      depois?.()
      await carregar()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro inesperado' })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="w-full pb-10">
      <div className="py-4">
        <h3 className="text-2xl font-bold">Vendedores</h3>
        <p className="text-sm text-gray-400 md:max-w-xl">
          Cada vendedor tem uma senha própria de 4 a 6 números, que não pode se repetir entre
  vendedores. Ela é pedida ao fechar uma venda ou orçamento e identifica quem vendeu, sem
  precisar trocar de login.
        </p>
      </div>

      {msg && (
        <p
          role={msg.tipo === 'erro' ? 'alert' : 'status'}
          className={`mb-4 rounded-lg border px-3 py-2 text-sm md:max-w-xl ${
            msg.tipo === 'erro'
              ? 'border-red-200 bg-red-50 text-red-600'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {msg.texto}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          rodar(() => criarVendedor(nome, pin), 'Vendedor cadastrado.', () => {
            setNome('')
            setPin('')
          })
        }}
        className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:max-w-xl"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <UserPlus className="size-4 text-[#079C9C]" />
          Novo vendedor
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do vendedor"
            maxLength={60}
            autoComplete="off"
            className={inputClass}
          />
          <input
            value={pin}
            onChange={(e) => setPin(soDigitos(e.target.value))}
            placeholder="Senha (4 a 6 números)"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <Button
          type="submit"
          disabled={ocupado}
          className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
        >
          {ocupado ? <Loader2 className="size-4 animate-spin" /> : null}
          Cadastrar vendedor
        </Button>
      </form>

      <div className="space-y-2 md:max-w-xl">
        {lista === null && (
          <p className="flex items-center gap-2 py-4 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Carregando...
          </p>
        )}

        {lista !== null && lista.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <Users className="size-8 text-slate-300" />
            <p className="text-sm text-slate-500">Nenhum vendedor ainda.</p>
            <p className="max-w-xs text-xs text-slate-400">
              Sem vendedor cadastrado, ninguém consegue fechar uma venda.
            </p>
          </div>
        )}

        {(lista ?? []).map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate font-semibold text-slate-900">{v.nome}</p>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  title="Trocar senha"
                  aria-label={`Trocar a senha de ${v.nome}`}
                  onClick={() => {
                    setTrocando(trocando === v.id ? null : v.id)
                    setNovoPin('')
                  }}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                >
                  <KeyRound className="size-[18px]" />
                </button>
                <button
                  type="button"
                  title="Remover"
                  aria-label={`Remover ${v.nome}`}
                  disabled={ocupado}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Remover ${v.nome}? Os pedidos que ele já fez continuam com o nome dele.`
                      )
                    )
                      return
                    rodar(() => removerVendedor(v.id), 'Vendedor removido.')
                  }}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-[18px]" />
                </button>
              </div>
            </div>

            {trocando === v.id && (
              <div className="mt-3 flex gap-2">
                <input
                  value={novoPin}
                  onChange={(e) => setNovoPin(soDigitos(e.target.value))}
                  placeholder="Nova senha"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                  className={inputClass}
                />
                <Button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    rodar(() => trocarPinVendedor(v.id, novoPin), 'Senha alterada.', () => {
                      setTrocando(null)
                      setNovoPin('')
                    })
                  }
                  className="bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
                >
                  Salvar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}