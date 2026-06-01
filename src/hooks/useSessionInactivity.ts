import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_INACTIVITY_MS = 30 * 60 * 1000;

function readInactivityMs(): number {
  const raw = import.meta.env.VITE_SESSION_INACTIVITY_MS as string | undefined;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 60_000 ? n : DEFAULT_INACTIVITY_MS;
}

/** M4: cierre de sesión tras inactividad (concesionarias multi-usuario). */
export function useSessionInactivity() {
  const { session, signOut } = useAuth();
  const timerRef = useRef<number | null>(null);
  const inactivityMs = readInactivityMs();

  useEffect(() => {
    if (!session) return;

    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void signOut();
      }, inactivityMs);
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    for (const ev of events) {
      window.addEventListener(ev, reset, { passive: true });
    }
    reset();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      for (const ev of events) {
        window.removeEventListener(ev, reset);
      }
    };
  }, [session, signOut, inactivityMs]);
}
