import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchShortcutPreferences,
  saveShortcutPreferences,
  type ShortcutsMap,
} from "@/lib/services/shortcutsPreferences";
import { DEFAULT_SHORTCUTS } from "@/lib/shortcuts-defaults";

interface ShortcutsPreferencesContextType {
  shortcuts: ShortcutsMap;
  shortcutsEnabled: boolean;
  setShortcutsEnabled: (enabled: boolean) => Promise<void>;
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
  const [shortcutsEnabled, setShortcutsEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setShortcuts({ ...DEFAULT_SHORTCUTS });
      setShortcutsEnabledState(true);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchShortcutPreferences(user.id).then(({ shortcuts: map, enabled }) => {
      if (!cancelled) {
        setShortcuts(map);
        setShortcutsEnabledState(enabled);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persist = useCallback(
    async (map: ShortcutsMap, enabled: boolean) => {
      if (!user?.id) return;
      const { error } = await saveShortcutPreferences(user.id, map, enabled);
      if (error) throw error;
    },
    [user?.id]
  );

  const setShortcutsEnabled = useCallback(
    async (enabled: boolean) => {
      setShortcutsEnabledState(enabled);
      if (!user?.id) return;
      await persist(shortcuts, enabled);
    },
    [user?.id, shortcuts, persist]
  );

  const setShortcut = useCallback(
    async (actionId: string, combo: string) => {
      if (!user?.id) return;
      const next = { ...shortcuts, [actionId]: combo };
      setShortcuts(next);
      await persist(next, shortcutsEnabled);
    },
    [user?.id, shortcuts, shortcutsEnabled, persist]
  );

  const saveShortcutsMap = useCallback(
    async (map: ShortcutsMap) => {
      if (!user?.id) return;
      await persist(map, shortcutsEnabled);
      setShortcuts(map);
    },
    [user?.id, shortcutsEnabled, persist]
  );

  const resetToDefaults = useCallback(async () => {
    if (!user?.id) return;
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    await persist({ ...DEFAULT_SHORTCUTS }, shortcutsEnabled);
  }, [user?.id, shortcutsEnabled, persist]);

  const value: ShortcutsPreferencesContextType = {
    shortcuts,
    shortcutsEnabled,
    setShortcutsEnabled,
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
