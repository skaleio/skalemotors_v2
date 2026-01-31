import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Detecta si el dispositivo es móvil usando múltiples métodos:
 * - Ancho de pantalla (breakpoint)
 * - Capacidad de touch
 * - User agent (para casos edge)
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Función para detectar móvil de forma robusta
    const detectMobile = () => {
      // 1. Verificar ancho de pantalla
      const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;

      // 2. Verificar capacidad de touch (más confiable que user agent)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // 3. Verificar user agent como fallback (para tablets en modo landscape)
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());

      // Es móvil si: pantalla pequeña Y (tiene touch O user agent móvil)
      // Esto evita falsos positivos en tablets grandes en landscape
      return isSmallScreen && (hasTouch || isMobileUA);
    };

    const updateMobile = () => {
      setIsMobile(detectMobile());
    };

    // Verificación inicial
    updateMobile();

    // Media query para cambios de tamaño
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMediaChange = () => {
      updateMobile();
    };

    // Listener para cambios de media query
    if (mql.addEventListener) {
      mql.addEventListener("change", handleMediaChange);
    } else {
      // Fallback para navegadores antiguos
      mql.addListener(handleMediaChange);
    }

    // Listener para cambios de tamaño de ventana (útil para desarrollo)
    window.addEventListener("resize", updateMobile);

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", handleMediaChange);
      } else {
        mql.removeListener(handleMediaChange);
      }
      window.removeEventListener("resize", updateMobile);
    };
  }, []);

  return !!isMobile;
}
