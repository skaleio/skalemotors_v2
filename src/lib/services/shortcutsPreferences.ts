import { supabase } from "@/lib/supabase";
import { DEFAULT_SHORTCUTS } from "@/lib/shortcuts-defaults";

export type ShortcutsMap = Record<string, string>;

/** Clave reservada dentro del JSON `shortcuts` — no es un actionId. */
export const SHORTCUTS_ENABLED_META_KEY = "__shortcuts_enabled";

export interface ShortcutPreferences {
  shortcuts: ShortcutsMap;
  enabled: boolean;
}

// Tabla user_shortcut_preferences existe en Supabase; el cliente puede no tener el tipo generado aún
const TABLE = "user_shortcut_preferences";

function unpackRaw(raw: Record<string, unknown>): ShortcutPreferences {
  const enabled =
    typeof raw[SHORTCUTS_ENABLED_META_KEY] === "boolean" ? raw[SHORTCUTS_ENABLED_META_KEY] : true;

  const shortcuts: ShortcutsMap = { ...DEFAULT_SHORTCUTS };
  for (const [key, value] of Object.entries(raw)) {
    if (key === SHORTCUTS_ENABLED_META_KEY) continue;
    if (typeof value === "string") shortcuts[key] = value;
  }

  return { shortcuts, enabled };
}

function packForDb(shortcuts: ShortcutsMap, enabled: boolean): Record<string, string | boolean> {
  return { ...shortcuts, [SHORTCUTS_ENABLED_META_KEY]: enabled };
}

export async function fetchShortcutPreferences(userId: string): Promise<ShortcutPreferences> {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select("shortcuts")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Error fetching shortcut preferences:", error);
    return { shortcuts: { ...DEFAULT_SHORTCUTS }, enabled: true };
  }

  const raw = data?.shortcuts;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return unpackRaw(raw as Record<string, unknown>);
  }
  return { shortcuts: { ...DEFAULT_SHORTCUTS }, enabled: true };
}

/** @deprecated Usar fetchShortcutPreferences */
export async function fetchShortcuts(userId: string): Promise<ShortcutsMap> {
  const prefs = await fetchShortcutPreferences(userId);
  return prefs.shortcuts;
}

export async function saveShortcutPreferences(
  userId: string,
  shortcuts: ShortcutsMap,
  enabled: boolean
): Promise<{ error: Error | null }> {
  const { error } = await (supabase as any)
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        shortcuts: packForDb(shortcuts, enabled),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("Error saving shortcut preferences:", error);
    return { error };
  }
  return { error: null };
}

export async function saveShortcuts(userId: string, shortcuts: ShortcutsMap): Promise<{ error: Error | null }> {
  const current = await fetchShortcutPreferences(userId);
  return saveShortcutPreferences(userId, shortcuts, current.enabled);
}
