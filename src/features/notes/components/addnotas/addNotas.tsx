'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

// Nosso hook customizado (você já tem um parecido)
import { useNotes } from '@/features/notes/hooks/useNotes'
interface AddNotasProps {
  onNoteAdded?: () => void
}

export default function AddNoteButton({ onNoteAdded }: AddNotasProps) {
  // Controla se o modal está aberto
  const [open, setOpen] = useState(false)
  // Campos do formulário
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('media') // valor padrão
  const [notes, setNotes] = useState('')
  // Estado de salvamento e erro
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Supondo que useNotes() tenha um método addNote
  const { addNote } = useNotes()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMessage('')

    try {
      await addNote({ title, priority, notes })
      // Sucesso! Limpa, fecha e AVISA O PAI
      setOpen(false)
      setTitle('')
      setPriority('Média')
      setNotes('')
      if (onNoteAdded) onNoteAdded()  // 👈 chama a função do pai
    } catch (error) {
      setErrorMessage('Erro ao salvar nota')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Gatilho: o botão que abre o modal */}
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-5 h-5" />
          Adicionar Nota
        </Button>
      </DialogTrigger>

      {/* Conteúdo do modal */}
      <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Nova Nota
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Campo título */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Título</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: Comprar material"
            />
          </div>

          {/* Campo prioridade (select simples para simplificar) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Prioridade</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          {/* Campo observações */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
              placeholder="Observações..."
            />
          </div>

          {/* Mensagem de erro */}
          {errorMessage && (
            <p className="text-red-500 text-sm">{errorMessage}</p>
          )}

          {/* Botões de ação */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Salvar Nota'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}