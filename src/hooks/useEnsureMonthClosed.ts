import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef } from "react";

/**
 * Llama a ensure_previous_month_closed() al montar para cerrar el mes anterior
 * de la sucursal del usuario (y todas si es admin). Transparente para el usuario.
 * Solo se ejecuta una vez por sesión al entrar a Finanzas.
 */
export function useEnsureMonthClosed() {
  const done = useRef(false);

  const run = useCallback(async () => {
    if (done.current) return;
    try {
      const { error } = await supabase.rpc("ensure_previous_month_closed");
      if (error) {
        console.warn("ensure_previous_month_closed:", error.message);
        return;
      }
      done.current = true;
    } catch (e) {
      console.warn("ensure_previous_month_closed:", e);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);
}
