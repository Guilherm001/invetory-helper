'use client'

import { useState } from 'react'
import { Loader2, MessageCircle, Pencil, Plus, Truck, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import type { FornecedorCompleto, NovoFornecedorCompleto, Telefone } from '../types'
import {
  documentoValido,
  emailValido,
  formatarDocumento,
  formatarTelefone,
  limparDocumento,
  soDigitos,
  telefoneValido,
} from '../utils/formatos'

interface Props {
  open: boolean
  fornecedor: FornecedorCompleto | null // null = cadastrar
  onClose: () => void
  onSalvar: (dados: NovoFornecedorCompleto) => Promise<void>
}

const MAX_TELEFONES = 3
const MAX_EMAILS = 3

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

const telefoneVazio = (): Telefone => ({ numero: '', rotulo: '', whatsapp: false })

function Campo({
  label,
  dica,
  children,
  className = '',
}: {
  label: string
  dica?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {dica && <p className="text-xs text-slate-400">{dica}</p>}
    </div>
  )
}

// fornecedores antigos têm só um campo de contato: aproveita quando dá para identificar
function valoresIniciais(f: FornecedorCompleto | null) {
  let telefones: Telefone[] = f?.telefones ?? []
  let emails: string[] = f?.emails ?? []
  let contatoAntigo: string | null = null

  if (f && telefones.length === 0 && emails.length === 0 && f.contact?.trim()) {
    const c = f.contact.trim()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
      emails = [c]
    } else if (/^[\d\s().+-]+$/.test(c) && soDigitos(c).length >= 8 && soDigitos(c).length <= 11) {
      telefones = [{ numero: soDigitos(c), rotulo: '', whatsapp: false }]
    } else {
      contatoAntigo = c
    }
  }

  return {
    telefones: telefones.length > 0 ? telefones : [telefoneVazio()],
    emails: [...emails, ...Array<string>(Math.max(0, 2 - emails.length)).fill('')],
    contatoAntigo,
  }
}

function Conteudo({ fornecedor, onClose, onSalvar }: Omit<Props, 'open'>) {
  const editando = fornecedor !== null
  const [ini] = useState(() => valoresIniciais(fornecedor))

  const [name, setName] = useState(fornecedor?.name ?? '')
  const [razao, setRazao] = useState(fornecedor?.razao_social ?? '')
  const [documento, setDocumento] = useState(fornecedor?.documento ?? '')
  const [representante, setRepresentante] = useState(fornecedor?.representante ?? '')
  const [telefones, setTelefones] = useState<Telefone[]>(ini.telefones)
  const [emails, setEmails] = useState<string[]>(ini.emails)
  const [endereco, setEndereco] = useState(fornecedor?.endereco ?? '')
  const [prazo, setPrazo] = useState(
    fornecedor?.lead_time_days != null ? String(fornecedor.lead_time_days) : ''
  )
  const [notas, setNotas] = useState(fornecedor?.notes ?? '')
  const [ativo, setAtivo] = useState(fornecedor?.ativo ?? true)

  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const mudarTelefone = (i: number, parte: Partial<Telefone>) =>
    setTelefones((prev) => prev.map((t, n) => (n === i ? { ...t, ...parte } : t)))

  const mudarEmail = (i: number, valor: string) =>
    setEmails((prev) => prev.map((e, n) => (n === i ? valor : e)))

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (name.trim().length < 2) {
      setErro('Informe o nome do fornecedor.')
      return
    }

    if (documento && !documentoValido(documento)) {
      setErro('CNPJ ou CPF inválido. Confira os números.')
      return
    }

    const tels = telefones
      .filter((t) => t.numero)
      .map((t) => ({ numero: t.numero, rotulo: t.rotulo.trim(), whatsapp: t.whatsapp }))
    if (tels.some((t) => !telefoneValido(t.numero))) {
      setErro('Confira os telefones: informe de 8 a 11 números, com o DDD.')
      return
    }

    const mails = [...new Set(emails.map((m) => m.trim().toLowerCase()).filter(Boolean))]
    if (mails.some((m) => !emailValido(m))) {
      setErro('Confira os e-mails: algum deles não parece válido.')
      return
    }

    let dias: number | null = null
    if (prazo.trim() !== '') {
      dias = Number(prazo)
      if (!Number.isInteger(dias) || dias < 0 || dias > 365) {
        setErro('O prazo de entrega deve ser um número de dias, de 0 a 365.')
        return
      }
    }

    setSaving(true)
    try {
      await onSalvar({
        name: name.trim(),
        razao_social: razao.trim() || null,
        documento: documento || null,
        telefones: tels,
        emails: mails,
        endereco: endereco.trim() || null,
        representante: representante.trim() || null,
        lead_time_days: dias,
        notes: notas.trim() || null,
        ativo,
      })
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-5 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            {editando ? (
              <Pencil className="size-6 text-white" />
            ) : (
              <Truck className="size-6 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              {editando ? 'Editar fornecedor' : 'Novo fornecedor'}
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {editando ? fornecedor.name : 'Guarde os dados para usar nas comparações'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {ini.contatoAntigo && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Contato anterior: <strong>{ini.contatoAntigo}</strong>. Passe para os campos de
              telefone e e-mail abaixo.
            </p>
          )}

          {/* Identificação */}
          <div className="space-y-4">
            <Campo label="Nome do fornecedor *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoFocus
                placeholder="Ex: Depósito Central"
                className={inputClass}
              />
            </Campo>

            <Campo label="Razão social">
              <input
                value={razao}
                onChange={(e) => setRazao(e.target.value)}
                maxLength={160}
                placeholder="Nome registrado da empresa"
                className={inputClass}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="CNPJ ou CPF">
                <input
                  value={formatarDocumento(documento)}
                  onChange={(e) => setDocumento(limparDocumento(e.target.value))}
                  inputMode="text"
                  autoCapitalize="characters"
                  placeholder="Só os números (ou letras do CNPJ novo)"
                  className={inputClass}
                />
              </Campo>

              <Campo label="Representante">
                <input
                  value={representante}
                  onChange={(e) => setRepresentante(e.target.value)}
                  maxLength={100}
                  placeholder="Pessoa de contato"
                  className={inputClass}
                />
              </Campo>
            </div>
          </div>

          {/* Telefones */}
          <Campo label={`Telefones (até ${MAX_TELEFONES})`}>
            <div className="space-y-2">
              {telefones.map((t, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={formatarTelefone(t.numero)}
                    onChange={(e) => mudarTelefone(i, { numero: soDigitos(e.target.value).slice(0, 11) })}
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    aria-label={`Telefone ${i + 1}`}
                    className={`${inputClass} min-w-[11rem] flex-1`}
                  />
                  <input
                    value={t.rotulo}
                    onChange={(e) => mudarTelefone(i, { rotulo: e.target.value })}
                    maxLength={30}
                    placeholder="Vendas, Financeiro..."
                    aria-label={`Descrição do telefone ${i + 1}`}
                    className={`${inputClass} w-44`}
                  />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.whatsapp}
                    aria-label={`Telefone ${i + 1} tem WhatsApp`}
                    title="Tem WhatsApp"
                    onClick={() => mudarTelefone(i, { whatsapp: !t.whatsapp })}
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg border transition ${
                      t.whatsapp
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
                        : 'border-slate-200 bg-white text-slate-300 hover:text-slate-500'
                    }`}
                  >
                    <MessageCircle className="size-5" />
                  </button>
                  {telefones.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remover telefone ${i + 1}`}
                      onClick={() => setTelefones((prev) => prev.filter((_, n) => n !== i))}
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}

              {telefones.length < MAX_TELEFONES && (
                <button
                  type="button"
                  onClick={() => setTelefones((prev) => [...prev, telefoneVazio()])}
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#079C9C] hover:underline"
                >
                  <Plus className="size-4" />
                  Adicionar telefone
                </button>
              )}
            </div>
          </Campo>

          {/* E-mails */}
          <Campo label={`E-mails (até ${MAX_EMAILS})`}>
            <div className="space-y-2">
              {emails.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={m}
                    onChange={(e) => mudarEmail(i, e.target.value)}
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    placeholder={i === 0 ? 'vendas@fornecedor.com' : 'financeiro@fornecedor.com'}
                    aria-label={`E-mail ${i + 1}`}
                    className={inputClass}
                  />
                  {emails.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remover e-mail ${i + 1}`}
                      onClick={() => setEmails((prev) => prev.filter((_, n) => n !== i))}
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}

              {emails.length < MAX_EMAILS && (
                <button
                  type="button"
                  onClick={() => setEmails((prev) => [...prev, ''])}
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#079C9C] hover:underline"
                >
                  <Plus className="size-4" />
                  Adicionar e-mail
                </button>
              )}
            </div>
          </Campo>

          {/* Endereço, prazo e observações */}
          <Campo label="Endereço">
            <textarea
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Rua, número, bairro, cidade, estado"
              className={`${inputClass} resize-none`}
            />
          </Campo>

          <Campo
            label="Prazo de entrega (dias)"
            dica="Quantos dias ele costuma levar para entregar. Aparece nas comparações."
          >
            <input
              value={prazo}
              onChange={(e) => setPrazo(e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              placeholder="Ex: 3"
              className={`${inputClass} sm:w-40`}
            />
          </Campo>

          <Campo
            label="Observações"
            dica="Condições de pagamento, frete, pedido mínimo, dias de entrega..."
          >
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Opcional"
              className={`${inputClass} resize-none`}
            />
          </Campo>

          {editando && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[#079C9C]"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-700">Fornecedor ativo</span>
                <span className="block text-xs text-slate-500">
                  Desmarque para parar de usar sem perder o histórico de preços.
                </span>
              </span>
            </label>
          )}

          {erro && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              {erro}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
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
            ) : editando ? (
              'Salvar alterações'
            ) : (
              'Cadastrar fornecedor'
            )}
          </Button>
        </div>
      </form>
    </>
  )
}

export default function FornecedorFormDialog({ open, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[600px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <Conteudo {...resto} />
      </DialogContent>
    </Dialog>
  )
}