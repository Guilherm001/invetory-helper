'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { lerPreco } from '../utils/melhorPreco'

interface Props {
  valor: number | undefined
  destaque: boolean
  coluna: string // id do fornecedor, usado para o Enter pular para a linha de baixo
  rotulo: string // para leitores de tela: "Preço de X em Y"
  onSalvar: (valor: number | null) => Promise<void>
}

const emTexto = (n: number | undefined) =>
  n === undefined ? '' : n.toFixed(2).replace('.', ',')

export default function CelulaPreco({ valor, destaque, coluna, rotulo, onSalvar }: Props) {
  // null = não está editando: mostra o valor que vem de fora
  const [texto, setTexto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const cancelado = useRef(false)

  const exibido = texto ?? emTexto(valor)

  const confirmar = async () => {
    if (cancelado.current) {
      cancelado.current = false
      setTexto(null)
      return
    }
    if (texto === null) return

    const novo = lerPreco(texto)

    if (novo !== null && (Number.isNaN(novo) || novo < 0)) {
      setErro('Valor inválido')
      return // mantém o que foi digitado, em vermelho
    }

    if (novo === (valor ?? null)) {
      setErro('')
      setTexto(null)
      return
    }

    setSaving(true)
    setErro('')
    try {
      await onSalvar(novo)
      setTexto(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const irParaProxima = (atual: HTMLInputElement) => {
    const campos = Array.from(
      document.querySelectorAll<HTMLInputElement>(`[data-preco-col="${coluna}"]`)
    )
    const proximo = campos[campos.indexOf(atual) + 1]
    if (proximo) proximo.focus()
    else atual.blur()
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
        R$
      </span>
      <input
        data-preco-col={coluna}
        value={exibido}
        onChange={(e) => {
          setTexto(e.target.value)
          setErro('')
        }}
        onFocus={(e) => {
          setTexto((t) => t ?? emTexto(valor))
          e.target.select()
        }}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            irParaProxima(e.currentTarget)
          }
          if (e.key === 'Escape') {
            cancelado.current = true
            setErro('')
            e.currentTarget.blur()
          }
        }}
        inputMode="decimal"
        placeholder="—"
        aria-label={rotulo}
        aria-invalid={!!erro}
        title={erro || undefined}
        disabled={saving}
        className={`w-full rounded-lg border py-2 pl-8 pr-2 text-right text-sm outline-none transition placeholder:text-slate-300 focus:ring-2 disabled:opacity-60 ${
          erro
            ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400 focus:ring-red-200'
            : destaque
              ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-700 focus:border-[#079C9C] focus:ring-[#079C9C]/20'
              : 'border-slate-200 bg-white text-slate-800 focus:border-[#079C9C] focus:ring-[#079C9C]/20'
        }`}
      />
      {saving && (
        <Loader2 className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-slate-400" />
      )}
      {erro && <p className="mt-0.5 text-right text-[11px] text-red-600">{erro}</p>}
    </div>
  )
}