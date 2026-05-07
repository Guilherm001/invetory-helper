// hooks/useNotes.ts
import { useState } from 'react'
import { Note } from '../services/noteService';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  // ... fetch, etc.

  const addNote = async (data: { title: string; priority: string; notes: string }) => {
    const res = await fetch('/api/note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Erro ao criar nota')
    }
    // Se der certo, você pode atualizar a lista local ou invalidar
    const newNote = await res.json()
    setNotes(prev => [...prev, newNote]) // ou refetch
  }

  return { notes, addNote, /* ... */ }
}