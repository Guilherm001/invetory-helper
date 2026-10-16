'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Lock } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { listarVendedores, type Vendedor } from '../services/vendedorService'

export default function SenhaVendedor({
  titulo,
  descricao,
  textoBotao,
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  descricao?: string
  textoBotao: string
  // se der erro, lance uma Error: a mensagem aparece aqui
  onConfirmar: (vendedorId: string, pin: string) => Promise<void>
  onCancelar: () => void
}) {
  const [vendedores, setVendedores] = useState<Vendedor[] | null>(null)
  const [erroLista, setErroLista] = useState('')
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelado = false
    listarVendedores()
      .then((v) => {
        if (cancelado) return
        setVendedores(v)
        if (v.length === 1) setEscolhido(v[0].id)
      })
      .catch((e) => {
        if (!cancelado)
          setErroLista(e instanceof Error ? e.message : 'Erro ao carregar os vendedores')
      })
    return () => {
      cancelado = true
    }
  }, [])

  // escolheu o vendedor: o cursor já vai para a senha
  useEffect(() => {
    if (escolhido) pinRef.current?.focus()
  }, [escolhido, vendedores])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return
    if (!escolhido) {
      setErro('Escolha quem está fechando.')
      return
    }
    if (pin.length < 4) {
      setErro('Digite a senha (de 4 a 6 números).')
      return
    }

    setEnviando(true)
    setErro('')
    try {
      await onConfirmar(escolhido, pin)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível confirmar')
      setPin('')
      pinRef.current?.focus()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#079C9C]/10 text-[#079C9C]">
          <Lock className="size-5" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">{titulo}</p>
          {descricao && <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>}
        </div>
      </div>

      {erroLista ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erroLista}
        </p>
      ) : vendedores === null ? (
        <p className="flex items-center gap-2 py-3 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Carregando vendedores...
        </p>
      ) : vendedores.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Nenhum vendedor cadastrado. Peça ao dono para cadastrar em Equipe, na seção
          Vendedores.
        </p>
      ) : (
        <>
          <div role="radiogroup" aria-label="Vendedor" className="grid grid-cols-2 gap-2">
            {vendedores.map((v) => {
              const ativo = escolhido === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => {
                    setEscolhido(v.id)
                    setErro('')
                  }}
                  className={`truncate rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    ativo
                      ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {v.nome}
                </button>
              )
            })}
          </div>

          <input
            ref={pinRef}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Senha"
            aria-label="Senha do vendedor"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-xl tracking-[0.5em] shadow-sm outline-none transition placeholder:text-base placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
          />
        </>
      )}

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={enviando || !vendedores || vendedores.length === 0}
          className="min-w-36 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : null}
          {textoBotao}
        </Button>
      </div>
    </form>
  )
}