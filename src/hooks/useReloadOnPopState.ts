import { useEffect } from "react";

/**
 * Recarga la página cuando el usuario usa el botón "atrás" o "adelante" del navegador.
 * Así la vista mostrada queda actualizada con datos frescos.
 */
export function useReloadOnPopState() {
  useEffect(() => {
    const handlePopState = () => {
      window.location.reload();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
}
