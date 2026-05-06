import { NextResponse } from "next/server";
import { NotesService } from "../../../features/notes/services/noteService";


export async function GET() {
    try {

        const notesService = new NotesService();
        const notes = await notesService.getAllNotes();
        return NextResponse.json(notes);
    } catch (error:unknown) {
        return NextResponse.json(
            {error: "Erro interno"},
            {status: 500}
        )
    } 
}



