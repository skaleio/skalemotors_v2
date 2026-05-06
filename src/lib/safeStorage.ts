/**
 * Storage compatible con Supabase Auth que no rompe en Safari (macOS/iOS):
 * - Ventana privada / ITP estricto: localStorage puede lanzar o negarse.
 * - Sin storage: fallback en memoria (sesión válida hasta recargar; login sigue funcionando).
 */
export function createBrowserAuthStorage(): Storage {
  const memory = new Map<string, string>();

  const memoryAdapter: Storage = {
    get length() {
      return memory.size;
    },
    clear() {
      memory.clear();
    },
    getItem(key: string) {
      return memory.get(key) ?? null;
    },
    key(index: number) {
      return [...memory.keys()][index] ?? null;
    },
    removeItem(key: string) {
      memory.delete(key);
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
    },
  };

  if (typeof window === "undefined") {
    return memoryAdapter;
  }

  try {
    const probe = "__skale_auth_storage_probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryAdapter;
  }
}
