import { NextResponse } from "next/server";
import { updateNote, deleteNote } from "@/features/notes/services/noteService";

export async function PUT(
    request: Request,
    { params } : {params: Promise<{ id: string }>}
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const updatedNote = await updateNote(id, body);
        return NextResponse.json(updatedNote);
    } catch (error:any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params } : {params: Promise<{ id: string }>}
) {
    try {
        const { id } = await params;
        await deleteNote(id);
        return NextResponse.json({ message: "Note deleted successfully" });
    } catch (error:any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}