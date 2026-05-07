// app/algum-lugar/Note.tsx (ou page.tsx)
'use client'
import { useEffect, useState } from 'react'
import AddNotas from '@/features/notes/components/addnotas/addNotas'
import Notes from '@/features/notes/page' // ajuste o caminho se precisar

export default function Note() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchNotes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/note')
      if (!res.ok) throw new Error('Erro ao buscar notas')
      const data = await res.json()
      setNotes(data)
    } catch (err) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotes()
  }, [])

  // Função chamada quando uma nota for adicionada com sucesso
  const handleNoteAdded = () => {
    fetchNotes() // simplesmente refaz a busca
  }

  return (
    <div>
      <AddNotas onNoteAdded={handleNoteAdded} />
      <Notes notes={notes} loading={loading} error={error} />
    </div>
  )
}