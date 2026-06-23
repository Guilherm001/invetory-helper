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

export async function updateNote(id: string, notes: Partial<Note>) {
    const {data, error} = await supabase
        .from("note")
        .update(notes)
        .eq("id", id)
        .select()
    
    if (error ) throw new Error(`falha ao atualizar nota: ${error.message}`)
    return data[0]
}

export async function deleteNote(id: string) {
    const { error } = await supabase
        .from("note")
        .delete()
        .eq("id", id)
    if (error) throw new Error(`falha ao excluir nota: ${error.message}`)
}
