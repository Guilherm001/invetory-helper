// @/features/notes/page.tsx
import NoteCard from './components/notas/notas' // ajuste

interface Note {
  id?: string
  title: string
  priority: string
  notes: string
}

interface NotesProps {
  notes: Note[]
  loading: boolean
  error: string | null
}

export default function Notes({ notes, error }: NotesProps) {
  if (error) return <div>Erro: {error}</div>

  const altaPriority = notes.filter(n => n.priority === 'alta')
  const mediaPriority = notes.filter(n => n.priority === 'media')
  const baixaPriority = notes.filter(n => n.priority === 'baixa')

  return (
    <div className="flex p-4 gap-4">
      <NoteCard title="Alta Prioridade" notes={altaPriority} colorClass="text-red-500" bgclass="bg-red-100" />
      <NoteCard title="Média Prioridade" notes={mediaPriority} colorClass="text-yellow-500" bgclass="bg-yellow-100" />
      <NoteCard title="Baixa Prioridade" notes={baixaPriority} colorClass="text-green-500" bgclass="bg-green-100" />
    </div>
  )
}