// src/components/notas/notas.tsx
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface Note {
  id?: string;
  title: string;
  priority: string;
  notes: string;
}

interface NoteCardProps {
  title: string;
  notes: Note[];
  colorClass: string;
  bgclass: string;
}

export default function NoteCard({ title, notes, colorClass, bgclass }: NoteCardProps) {
  return (
    <div className={`flex-1 border rounded-lg p-4 `}>
      <h1 className={`font-bold text-lg mb-2 ${colorClass}`}>{title}</h1>
      {notes.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma nota</p>
      ) : (
        notes.map((note) => (
          <HoverCard key={note.id} openDelay={10} closeDelay={100}  >
            <HoverCardTrigger asChild>
              <Button variant="ghost" className={`w-full mb-2 ${bgclass}`}>
                {note.title}
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="flex w-64 flex-col gap-0.5">
              <div className="font-semibold">
                Prioridade: <span className={colorClass}>{note.priority}</span>
              </div>
              <div>{note.notes}</div>
            </HoverCardContent>
          </HoverCard>
        ))
      )}
    </div>
  );
}