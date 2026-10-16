'use client'

import { useState } from 'react'
import { AlertCircle, Lightbulb, Loader2, Star } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import {
  AREAS,
  AREA_ROTULO,
  STATUS,
  STATUS_INFO,
  TIPOS,
  TIPO_INFO,
  type AreaIdeia,
  type Ideia,
  type NovaIdeia,
  type StatusIdeia,
  type TipoIdeia,
} from '../lib/ideias'

interface Props {
  open: boolean
  ideia: Ideia | null // null = ideia nova
  textoInicial?: string // o que já foi digitado na barra rápida
  onClose: () => void
  onSalvar: (dados: NovaIdeia) => Promise<void>
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        ativo
          ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function Conteudo({ ideia, textoInicial, onClose, onSalvar }: Omit<Props, 'open'>) {
  const editando = ideia !== null

  const [texto, setTexto] = useState(ideia?.texto ?? textoInicial ?? '')
  const [detalhes, setDetalhes] = useState(ideia?.detalhes ?? '')
  const [area, setArea] = useState<AreaIdeia>(ideia?.area ?? 'geral')
  const [tipo, setTipo] = useState<TipoIdeia>(ideia?.tipo ?? 'recurso')
  const [status, setStatus] = useState<StatusIdeia>(ideia?.status ?? 'nova')
  const [destaque, setDestaque] = useState(ideia?.destaque ?? false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    if (!texto.trim()) {
      setErro('Escreva a ideia.')
      return
    }

    setSaving(true)
    setErro('')
    try {
      await onSalvar({ texto, detalhes, area, tipo, status, destaque })
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível guardar a ideia')
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Lightbulb className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              {editando ? 'Editar ideia' : 'Nova ideia'}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              {editando ? 'Ajuste o que quiser' : 'Anote com calma, dá para mexer depois'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={salvar} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5">
            <label htmlFor="ideia-texto" className="block text-sm font-semibold text-slate-700">
              A ideia
            </label>
            <textarea
              id="ideia-texto"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                setErro('')
              }}
              rows={2}
              maxLength={300}
              autoFocus
              placeholder="Ex: avisar quando um item ficar sem estoque"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ideia-detalhes" className="block text-sm font-semibold text-slate-700">
              Detalhes <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              id="ideia-detalhes"
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              rows={5}
              maxLength={3000}
              placeholder="Como você imagina que funcione, onde apareceria, exemplos, o que motivou..."
              className={`${inputClass} resize-y`}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Tipo</p>
            <div role="radiogroup" aria-label="Tipo da ideia" className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <Chip key={t} ativo={tipo === t} onClick={() => setTipo(t)}>
                  {TIPO_INFO[t].rotulo}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Parte do site</p>
            <div role="radiogroup" aria-label="Parte do site" className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <Chip key={a} ativo={area === a} onClick={() => setArea(a)}>
                  {AREA_ROTULO[a]}
                </Chip>
              ))}
            </div>
          </div>

          {editando && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Situação</p>
              <div role="radiogroup" aria-label="Situação da ideia" className="flex flex-wrap gap-2">
                {STATUS.map((s) => (
                  <Chip key={s} ativo={status === s} onClick={() => setStatus(s)}>
                    {STATUS_INFO[s].rotulo}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={destaque}
            onClick={() => setDestaque((v) => !v)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
              destaque
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Star
                className={`size-5 ${destaque ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`}
              />
              <span>
                <span className="block text-sm font-semibold text-slate-700">Importante</span>
                <span className="block text-xs text-slate-500">Fica no topo da lista</span>
              </span>
            </span>
            <span
              className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                destaque ? 'bg-amber-400' : 'bg-slate-300'
              }`}
            >
              <span
                className={`size-5 rounded-full bg-white shadow transition ${
                  destaque ? 'translate-x-5' : ''
                }`}
              />
            </span>
          </button>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50">
          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-600"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-3 px-6 py-3.5">
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
              className="min-w-36 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando...
                </>
              ) : editando ? (
                'Salvar'
              ) : (
                'Guardar ideia'
              )}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function IdeiaDialog({ open, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[560px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {open && <Conteudo key={resto.ideia?.id ?? 'nova'} {...resto} />}
      </DialogContent>
    </Dialog>
  )
}
