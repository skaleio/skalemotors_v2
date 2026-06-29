/** Abre la URL de OAuth de Zernio en la misma pestaña (fallback si el popup se bloquea). */
export function redirectToZernioOAuth(authUrl: string): void {
  const url = authUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL de OAuth inválida");
  }
  window.location.replace(url);
}

/**
 * Abre la URL de OAuth de Zernio en una ventana emergente centrada (flujo OAuth típico).
 * Devuelve la referencia al popup, o `null` si el navegador lo bloqueó (el caller hace fallback).
 */
export function openZernioOAuthPopup(authUrl: string): Window | null {
  const url = authUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL de OAuth inválida");
  }

  const width = 600;
  const height = 720;
  const baseLeft = window.screenLeft ?? window.screenX ?? 0;
  const baseTop = window.screenTop ?? window.screenY ?? 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const left = Math.max(0, baseLeft + (viewportWidth - width) / 2);
  const top = Math.max(0, baseTop + (viewportHeight - height) / 2);

  const features = `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`;
  const popup = window.open(url, "zernio-oauth", features);
  popup?.focus();
  return popup;
}
