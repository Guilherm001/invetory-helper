'use client'
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

interface Note {
    id?: string;
    title: string;
    priority: string;
    notes: string;
}


export default function HoverCardDemo() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch("/api/note");
        if (!res.ok) throw new Error ("Erro ao carregar notas");
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

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Minhas Notas</h1>
      {notes.map((nota) => (
        <HoverCard key={nota.id} openDelay={10} closeDelay={100}>
          <HoverCardTrigger asChild>
            <Button variant="destructive">{nota.title}</Button>
          </HoverCardTrigger>
          <HoverCardContent className="flex w-64 flex-col gap-0.5">
            <div className="font-semibold">Prioridade: {nota.priority}</div>
            <div>{nota.notes}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              ID: {nota.id}
            </div>
          </HoverCardContent>
        </HoverCard>
      ))}
    </div>
  )
}
