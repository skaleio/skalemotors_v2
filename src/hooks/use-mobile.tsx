import * as React from "react";
import { getIsMobileDevice } from "@/lib/device";

const MOBILE_BREAKPOINT = 768;

/**
 * Detecta si el layout debe comportarse como móvil.
 * Móvil = dispositivo móvil (cualquier orientación, por user agent) o viewport angosto.
 * Incluir el dispositivo evita que un celular en horizontal (ancho > 768px) sea tratado
 * como escritorio (p. ej. el sidebar pasaba a fijo y tapaba el contenido).
 */
export function useIsMobile() {
  const getMatches = () => {
    if (typeof window === "undefined") {
      return false;
    }
    if (getIsMobileDevice()) {
      return true;
    }
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
  };

  const [isMobile, setIsMobile] = React.useState<boolean>(getMatches);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMediaChange = () => {
      setIsMobile(getMatches());
    };

    // Sync inicial por si cambia entre renders
    setIsMobile(getMatches());

    if (mql.addEventListener) {
      mql.addEventListener("change", handleMediaChange);
    } else {
      mql.addListener(handleMediaChange);
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", handleMediaChange);
      } else {
        mql.removeListener(handleMediaChange);
      }
    };
  }, []);

  return isMobile;
}
