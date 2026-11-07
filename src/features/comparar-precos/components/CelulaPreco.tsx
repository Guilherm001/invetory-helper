'use client'

import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { lerPreco } from '../utils/melhorPreco'

interface Props {
  valor: number | undefined
  destaque: boolean // menor preço do item (verde)
  sozinho?: boolean // único preço do item, sem com quem comparar (amarelo claro)
  coluna: string // id do fornecedor, usado na navegação por teclado
  rotulo: string // para leitores de tela: "Preço de X em Y"
  onSalvar: (valor: number | null) => Promise<void>
}

const emTexto = (n: number | undefined) =>
  n === undefined ? '' : n.toFixed(2).replace('.', ',')

/**
 * Todos os campos de preço visíveis, na ordem da tela (linha por linha).
 * A tabela (desktop) e os cards (celular) existem juntos no HTML, por isso
 * filtramos só os que estão visíveis.
 */
export function camposDePreco(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('[data-preco-col]')).filter(
    (el) => el.offsetParent !== null
  )
}

// move o foco pela "grade" de preços. Retorna false se não há para onde ir.
function mover(atual: HTMLInputElement, dLinha: number, dColuna: number): boolean {
  const campos = camposDePreco()
  const i = campos.indexOf(atual)
  if (i < 0) return false

  const colunas = new Set(campos.map((c) => c.dataset.precoCol)).size || 1
  const linha = Math.floor(i / colunas) + dLinha
  const coluna = (i % colunas) + dColuna
  if (linha < 0 || coluna < 0 || coluna >= colunas) return false

  const proximo = campos[linha * colunas + coluna]
  if (!proximo) return false
  proximo.focus()
  return true
}

export default function CelulaPreco({
  valor,
  destaque,
  sozinho = false,
  coluna,
  rotulo,
  onSalvar,
}: Props) {
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

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        // Enter desce, Shift+Enter sobe; no fim da coluna, apenas salva
        if (!mover(el, e.shiftKey ? -1 : 1, 0) && !e.shiftKey) el.blur()
        break
      case 'ArrowDown':
        e.preventDefault()
        mover(el, 1, 0)
        break
      case 'ArrowUp':
        e.preventDefault()
        mover(el, -1, 0)
        break
      case 'ArrowRight':
        // só pula de célula quando o cursor já está no fim do texto
        if (el.selectionEnd === el.value.length) {
          e.preventDefault()
          mover(el, 0, 1)
        }
        break
      case 'ArrowLeft':
        if (el.selectionStart === 0) {
          e.preventDefault()
          mover(el, 0, -1)
        }
        break
      case 'Escape':
        cancelado.current = true
        setErro('')
        el.blur()
        break
    }
  }

  const estado = erro
    ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400 focus:ring-red-200'
    : destaque
      ? 'border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 focus:border-[#079C9C] focus:ring-[#079C9C]/20'
      : sozinho
        ? 'border-amber-200 bg-amber-50/70 text-slate-800 focus:border-[#079C9C] focus:ring-[#079C9C]/20'
        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-[#079C9C] focus:ring-[#079C9C]/20 md:border-transparent md:bg-transparent md:hover:border-slate-200 md:focus:bg-white'

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
        onKeyDown={aoTeclar}
        // readOnly (e não disabled) para o foco nunca se perder durante o salvamento
        readOnly={saving}
        aria-busy={saving}
        inputMode="decimal"
        enterKeyHint="next"
        placeholder="—"
        aria-label={rotulo}
        aria-invalid={!!erro}
        title={erro || (sozinho ? 'Único preço deste item: não há com quem comparar' : undefined)}
        className={`w-full scroll-mb-20 scroll-ml-60 scroll-mt-32 rounded-md border py-2 pl-8 pr-2 text-right text-base tabular-nums outline-none transition placeholder:text-slate-300 focus:ring-2 md:py-1.5 md:text-sm ${
          saving ? 'opacity-60' : ''
        } ${estado}`}
      />
      {saving && (
        <Loader2 className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-slate-400" />
      )}
      {erro && <p className="mt-0.5 text-right text-[11px] text-red-600">{erro}</p>}
    </div>
  )
}