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
            .from("notas")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error('[NotesService] getAllNotes error:', error.message)
            throw new Error(`Failed to fetch notes: ${error.message}`);
        }
        return data;
    }
}