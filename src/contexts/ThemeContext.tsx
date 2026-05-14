import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

type ResolvedTheme = 'light' | 'dark';
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  // Theme efectivamente aplicado al DOM ('light' o 'dark'). Lo que ya esperaba la UI.
  theme: ResolvedTheme;
  // Preferencia del user. 'system' delega al SO.
  mode: ThemeMode;
  // Setear preferencia (acepta 'system'). API nueva.
  setMode: (mode: ThemeMode) => void;
  // Setear theme explícito (backward compat: equivale a setMode con 'light'|'dark').
  setTheme: (theme: ResolvedTheme) => void;
  // Alterna light <-> dark forzando preferencia explícita (sale de 'system').
  toggleTheme: () => void;
}

const STORAGE_KEY = 'skale-theme';
const THEME_COLOR_LIGHT = '#ffffff';
const THEME_COLOR_DARK = '#0a0a0a';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Lee la preferencia persistida. Tolera valores legacy ('light'|'dark') y default a 'system'. */
function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* localStorage bloqueado (private mode / cookies off): caer a default */
  }
  return 'system';
}

/** Resuelve mode -> theme aplicado. 'system' consulta prefers-color-scheme en vivo. */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Aplica el theme al <html>: class .dark, color-scheme nativo (scrollbars/inputs) y meta theme-color (status bar mobile/PWA). */
function applyThemeToDocument(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', theme === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // mode = preferencia del user (persistida). Init síncrono para evitar render con 'light' y flicker.
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  // theme resuelto = lo que se aplica. Re-evalúa con mode o con el SO (si mode='system').
  const [theme, setThemeResolved] = useState<ResolvedTheme>(() => resolveTheme(readStoredMode()));

  // Persistir mode + aplicar theme cuando cambia la preferencia.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* private mode / quota: ignore — el theme sigue funcionando, solo no persiste */
    }
    const resolved = resolveTheme(mode);
    setThemeResolved(resolved);
    applyThemeToDocument(resolved);
  }, [mode]);

  // Listener al SO: solo aplica mientras el user esté en 'system'.
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const resolved: ResolvedTheme = e.matches ? 'dark' : 'light';
      setThemeResolved(resolved);
      applyThemeToDocument(resolved);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  // Cross-tab sync: si en otra tab cambian el theme, esta lo refleja sin reload.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      if (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system') {
        setModeState(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const setTheme = useCallback((next: ResolvedTheme) => setModeState(next), []);
  const toggleTheme = useCallback(() => {
    setModeState(prev => {
      const current = resolveTheme(prev);
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
