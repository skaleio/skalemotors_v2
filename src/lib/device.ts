/**
 * Detección de dispositivo móvil (celular/tablet) por user agent.
 * Sirve para reconocer cuando el usuario entra desde un celular y mostrar
 * la versión app web móvil.
 */

const MOBILE_USER_AGENT_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i;

/**
 * Indica si el dispositivo actual es móvil (teléfono o tablet) según el user agent.
 * Se evalúa en el cliente; en SSR retorna false.
 */
export function getIsMobileDevice(): boolean {
  if (typeof navigator === "undefined" || !navigator.userAgent) {
    return false;
  }
  return MOBILE_USER_AGENT_REGEX.test(navigator.userAgent);
}

/**
 * Indica si es un teléfono (excluye tablets como iPad) para UX más estricta si hace falta.
 */
export function getIsPhoneDevice(): boolean {
  if (typeof navigator === "undefined" || !navigator.userAgent) {
    return false;
  }
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) {
    return false;
  }
  return MOBILE_USER_AGENT_REGEX.test(ua);
}
