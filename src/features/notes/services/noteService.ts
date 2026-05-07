import {supabase} from "@/lib/supabase";

export interface Note {
    id?: string;
    title: string;
    priority: string;
    notes: string;
}

export class NotesService {
    async getAllNotes(): Promise<Note[]> {
        const { data, error } = await supabase
            .from("note")
            .select("*")

        if (error) {
            console.error('[NotesService] getAllNotes error:', error.message)
            throw new Error(`Failed to fetch notes: ${error.message}`);
        }
        return data;
    }
}

export async function createNote(notes: Omit<Note, "id">): Promise<Note> {
    const { data, error } = await supabase
        .from("note")
        .insert([notes])
        .select()
     if (error) throw new Error(`falha ao criar nota: ${error.message}`)
  return data[0];

}

