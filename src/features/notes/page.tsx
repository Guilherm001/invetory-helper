

import NoteCardAlto from "./components/noteCardAlto"
import NoteCardMedio from "./components/notaCardMedio"
import NoteCardBaixo from "./components/noteCardBaixo"

export default function NotesPage() {
    return (
        <div className="flex p-4 gap-4">
            <NoteCardAlto title="Alta Prioridade" />
            <NoteCardMedio title="Média Prioridade" />
            <NoteCardBaixo title="Baixa Prioridade" />
        </div>
    )
}