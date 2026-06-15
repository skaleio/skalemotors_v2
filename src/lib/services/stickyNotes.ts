import { supabase } from "../supabase";
import type { Database } from "../types/database";

export type StickyNote = Database["public"]["Tables"]["sticky_notes"]["Row"];
export type StickyNoteInsert = Database["public"]["Tables"]["sticky_notes"]["Insert"];
export type StickyNoteUpdate = Database["public"]["Tables"]["sticky_notes"]["Update"];

// El cliente no puede mutar columnas de ownership/identidad; las fija el server.
export type StickyNotePatch = Omit<StickyNoteUpdate, "id" | "user_id" | "tenant_id" | "created_at" | "updated_at">;

export type StickyNoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange";

export const stickyNotesService = {
  async getAll(): Promise<StickyNote[]> {
    const { data, error } = await supabase
      .from("sticky_notes")
      .select("*")
      .order("z_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching sticky_notes:", error);
      throw error;
    }
    return (data ?? []) as StickyNote[];
  },

  // user_id y tenant_id los completa el trigger sticky_notes_set_owner server-side.
  async create(payload: Omit<StickyNoteInsert, "user_id" | "tenant_id">): Promise<StickyNote> {
    const { data, error } = await supabase
      .from("sticky_notes")
      .insert(payload as StickyNoteInsert)
      .select("*")
      .single();

    if (error) {
      console.error("Error creating sticky note:", error);
      throw error;
    }
    if (!data) throw new Error("No data returned after creating sticky note");
    return data as StickyNote;
  },

  async update(id: string, updates: StickyNotePatch): Promise<StickyNote> {
    const { data, error } = await supabase
      .from("sticky_notes")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating sticky note:", error);
      throw error;
    }
    if (!data) throw new Error("No data returned after updating sticky note");
    return data as StickyNote;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("sticky_notes").delete().eq("id", id);
    if (error) throw error;
  },
};
