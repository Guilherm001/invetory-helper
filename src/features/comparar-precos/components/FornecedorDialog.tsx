'use client'

import { useState } from 'react'
import { Check, Loader2, Plus, Truck, Pencil } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import type { Fornecedor, NovoFornecedor } from '../types'

interface Props {
  open: boolean
  fornecedor: Fornecedor | null // null = adicionar; preenchido = editar
  disponiveis: Fornecedor[] // cadastrados que ainda não estão nesta comparação
  onClose: () => void
  onCriar: (dados: NovoFornecedor) => Promise<unknown>
  onEditar: (id: string, dados: NovoFornecedor) => Promise<unknown>
  onAdicionarExistente: (id: string) => Promise<unknown>
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

function Campo({
  label,
  dica,
  children,
}: {
  label: string
  dica?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {dica && <p className="text-xs text-slate-400">{dica}</p>}
    </div>
  )
}

// ---------- formulário (criar e editar) ----------

function Formulario({
  fornecedor,
  onCancelar,
  onSalvar,
}: {
  fornecedor: Fornecedor | null
  onCancelar: () => void
  onSalvar: (dados: NovoFornecedor) => Promise<void>
}) {
  const [name, setName] = useState(fornecedor?.name ?? '')
  const [contact, setContact] = useState(fornecedor?.contact ?? '')
  const [prazo, setPrazo] = useState(
    fornecedor?.lead_time_days != null ? String(fornecedor.lead_time_days) : ''
  )
  const [notes, setNotes] = useState(fornecedor?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setErrorMessage('Informe o nome do fornecedor.')
      return
    }

    let dias: number | null = null
    if (prazo.trim() !== '') {
      dias = Number(prazo)
      if (!Number.isInteger(dias) || dias < 0) {
        setErrorMessage('O prazo deve ser um número inteiro de dias.')
        return
      }
    }

    setSaving(true)
    setErrorMessage('')
    try {
      await onSalvar({
        name: name.trim(),
        contact: contact.trim() || null,
        lead_time_days: dias,
        notes: notes.trim() || null,
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <Campo label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Ex: Depósito Central"
            autoFocus
          />
        </Campo>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Campo label="Contato" dica="Telefone, WhatsApp ou e-mail">
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className={inputClass}
                placeholder="Opcional"
              />
            </Campo>
          </div>
          <Campo label="Prazo (dias)">
            <input
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className={inputClass}
              inputMode="numeric"
              placeholder="Ex: 3"
            />
          </Campo>
        </div>

        <Campo label="Observações" dica="Condições de pagamento, frete, mínimo de pedido...">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} min-h-[80px] resize-none`}
            placeholder="Opcional"
          />
        </Campo>

        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancelar}
          disabled={saving}
          className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="min-w-40 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : fornecedor ? (
            'Salvar alterações'
          ) : (
            'Cadastrar e adicionar'
          )}
        </Button>
      </div>
    </form>
  )
}

// ---------- lista dos já cadastrados ----------

function ListaExistentes({
  disponiveis,
  onAdicionar,
  onFechar,
  onNovo,
}: {
  disponiveis: Fornecedor[]
  onAdicionar: (id: string) => Promise<unknown>
  onFechar: () => void
  onNovo: () => void
}) {
  const [adicionando, setAdicionando] = useState<string | null>(null)
  const [adicionados, setAdicionados] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState('')

  const adicionar = async (id: string) => {
    setAdicionando(id)
    setErrorMessage('')
    try {
      await onAdicionar(id)
      setAdicionados((prev) => new Set(prev).add(id))
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao adicionar')
    } finally {
      setAdicionando(null)
    }
  }

  // quem acabou de ser adicionado continua na lista, marcado, até o modal fechar
  const lista = disponiveis

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {lista.length === 0 && adicionados.size === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Todos os fornecedores cadastrados já estão nesta comparação.
          </p>
        ) : (
          <ul className="space-y-2">
            {lista.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{f.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[
                      f.contact,
                      f.lead_time_days != null
                        ? `${f.lead_time_days} ${f.lead_time_days === 1 ? 'dia' : 'dias'}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sem contato informado'}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={adicionando !== null}
                  onClick={() => adicionar(f.id)}
                  className="shrink-0 gap-1.5 border-[#079C9C] text-[#079C9C] hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                >
                  {adicionando === f.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Adicionar
                </Button>
              </li>
            ))}
          </ul>
        )}

        {adicionados.size > 0 && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <Check className="size-4" />
            {adicionados.size}{' '}
            {adicionados.size === 1 ? 'fornecedor adicionado' : 'fornecedores adicionados'}
          </p>
        )}

        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <button
          type="button"
          onClick={onNovo}
          className="text-sm font-semibold text-[#079C9C] hover:underline"
        >
          + Cadastrar fornecedor novo
        </button>
        <Button
          type="button"
          onClick={onFechar}
          className="bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
        >
          Concluir
        </Button>
      </div>
    </div>
  )
}

// ---------- conteúdo: escolhe entre lista e formulário ----------

function Conteudo({
  fornecedor,
  disponiveis,
  onClose,
  onCriar,
  onEditar,
  onAdicionarExistente,
}: Omit<Props, 'open'>) {
  const editando = fornecedor !== null
  // abre na lista só quando há cadastrados para escolher
  const [modo, setModo] = useState<'lista' | 'novo'>(
    !editando && disponiveis.length > 0 ? 'lista' : 'novo'
  )

  const titulo = editando
    ? 'Editar fornecedor'
    : modo === 'lista'
      ? 'Adicionar fornecedor'
      : 'Novo fornecedor'

  const descricao = editando
    ? fornecedor.name
    : modo === 'lista'
      ? 'Escolha um que já está cadastrado'
      : 'Cadastre e já adicione à comparação'

  return (
    <>
      <DialogHeader className="bg-[#079C9C] px-6 py-5 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            {editando ? (
              <Pencil className="size-6 text-white" />
            ) : (
              <Truck className="size-6 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">{titulo}</DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {descricao}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {modo === 'lista' ? (
        <ListaExistentes
          disponiveis={disponiveis}
          onAdicionar={onAdicionarExistente}
          onFechar={onClose}
          onNovo={() => setModo('novo')}
        />
      ) : (
        <Formulario
          fornecedor={fornecedor}
          onCancelar={() => {
            // se veio da lista, "Cancelar" volta para ela
            if (!editando && disponiveis.length > 0) setModo('lista')
            else onClose()
          }}
          onSalvar={async (dados) => {
            if (fornecedor) await onEditar(fornecedor.id, dados)
            else await onCriar(dados)
            onClose()
          }}
        />
      )}
    </>
  )
}

export default function FornecedorDialog({ open, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[480px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <Conteudo {...resto} />
      </DialogContent>
    </Dialog>
  )
}