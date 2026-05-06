// src/app/notes/page.tsx
'use client';

import { useEffect, useState } from "react";
import NoteCard from "./components/notas/notas";

interface Note {
  id?: string;
  title: string;
  priority: string;
  notes: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch("/api/note");
        if (!res.ok) throw new Error("Erro ao carregar notas do servidor");
        const data = await res.json();
        setNotes(data);
      } catch (err) {
        setError("Erro ao carregar notas");
      } finally {
        setLoading(false);
      }
    }
    fetchNotes();
  }, []);

  if (loading) return <div className="p-4">Carregando...</div>;
  if (error) return <div className="p-4 text-red-500">Erro: {error}</div>;

  const altaPriority = notes.filter((note) => note.priority === "alta");
  const mediaPriority = notes.filter((note) => note.priority === "media");
  const baixaPriority = notes.filter((note) => note.priority === "baixa");

  return (
    <div className="flex p-4 gap-4">
      <NoteCard
        title="Alta Prioridade"
        notes={altaPriority}
        colorClass="text-red-500"
      />
      <NoteCard
        title="Média Prioridade"
        notes={mediaPriority}
        colorClass="text-yellow-500"
      />
      <NoteCard
        title="Baixa Prioridade"
        notes={baixaPriority}
        colorClass="text-green-500"
      />
    </div>
  );
}