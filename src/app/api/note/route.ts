import { NextResponse } from "next/server";
import { createNote, NotesService } from "../../../features/notes/services/noteService";


export async function GET() {
    try {

        const notesService = new NotesService();
        const notes = await notesService.getAllNotes();
        return NextResponse.json(notes);
    } catch (err) {
        return NextResponse.json(
            { error: "Erro interno" },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.title) {
            return NextResponse.json(
                { error: "O campo 'title' é obrigatório" },
                { status: 400 }
            )
        }
        const newNote = await createNote({
            title: body.title,
            priority: body.priority || "media",
            notes: body.notes
        });
        return NextResponse.json(newNote, { status: 201 });
    } catch (err) {
        console.error("Erro ao criar nota:", err);
        return NextResponse.json(
            { error: "Erro interno" },
            { status: 500 }
        )

    }
}


