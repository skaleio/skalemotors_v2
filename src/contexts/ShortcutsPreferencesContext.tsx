import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchShortcuts, saveShortcuts, type ShortcutsMap } from "@/lib/services/shortcutsPreferences";
import { DEFAULT_SHORTCUTS } from "@/lib/shortcuts-defaults";

interface ShortcutsPreferencesContextType {
  shortcuts: ShortcutsMap;
  setShortcut: (actionId: string, combo: string) => Promise<void>;
  /** Guarda el mapa completo (para el modal de personalización al hacer clic en Guardar). */
  saveShortcutsMap: (map: ShortcutsMap) => Promise<void>;
  isLoading: boolean;
  resetToDefaults: () => Promise<void>;
}

const ShortcutsPreferencesContext = createContext<ShortcutsPreferencesContextType | undefined>(undefined);

export function ShortcutsPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [shortcuts, setShortcuts] = useState<ShortcutsMap>(() => ({ ...DEFAULT_SHORTCUTS }));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setShortcuts({ ...DEFAULT_SHORTCUTS });
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchShortcuts(user.id).then((map) => {
      if (!cancelled) {
        setShortcuts(map);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const setShortcut = useCallback(
    async (actionId: string, combo: string) => {
      if (!user?.id) return;
      const next = { ...shortcuts, [actionId]: combo };
      setShortcuts(next);
      await saveShortcuts(user.id, next);
    },
    [user?.id, shortcuts]
  );

  const saveShortcutsMap = useCallback(
    async (map: ShortcutsMap) => {
      if (!user?.id) return;
      const { error } = await saveShortcuts(user.id, map);
      if (error) throw error;
      setShortcuts(map);
    },
    [user?.id]
  );

  const resetToDefaults = useCallback(async () => {
    if (!user?.id) return;
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    await saveShortcuts(user.id, DEFAULT_SHORTCUTS);
  }, [user?.id]);

  const value: ShortcutsPreferencesContextType = {
    shortcuts,
    setShortcut,
    saveShortcutsMap,
    isLoading,
    resetToDefaults,
  };

  return (
    <ShortcutsPreferencesContext.Provider value={value}>
      {children}
    </ShortcutsPreferencesContext.Provider>
  );
}

export function useShortcutsPreferences() {
  const ctx = useContext(ShortcutsPreferencesContext);
  if (ctx === undefined) {
    throw new Error("useShortcutsPreferences must be used within ShortcutsPreferencesProvider");
  }
  return ctx;
}
