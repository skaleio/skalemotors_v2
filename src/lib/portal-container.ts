/**
 * Contenedor estable para portales (Dialog, Select, etc.).
 * Evita el error "removeChild" en producción al usar un div dedicado
 * en lugar de document.body, y reduce conflictos con traducción del navegador.
 */
export function getPortalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.getElementById("portals") ?? document.body ?? undefined;
}
