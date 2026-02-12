import { supabase } from "@/lib/supabase";
import { DEFAULT_SHORTCUTS } from "@/lib/shortcuts-defaults";

export type ShortcutsMap = Record<string, string>;

// Tabla user_shortcut_preferences existe en Supabase; el cliente puede no tener el tipo generado aún
const TABLE = "user_shortcut_preferences";

export async function fetchShortcuts(userId: string): Promise<ShortcutsMap> {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select("shortcuts")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Error fetching shortcut preferences:", error);
    return { ...DEFAULT_SHORTCUTS };
  }

  const raw = data?.shortcuts;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...DEFAULT_SHORTCUTS, ...(raw as Record<string, string>) };
  }
  return { ...DEFAULT_SHORTCUTS };
}

export async function saveShortcuts(userId: string, shortcuts: ShortcutsMap): Promise<{ error: Error | null }> {
  const { error } = await (supabase as any)
    .from(TABLE)
    .upsert(
      { user_id: userId, shortcuts, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("Error saving shortcut preferences:", error);
    return { error };
  }
  return { error: null };
}
