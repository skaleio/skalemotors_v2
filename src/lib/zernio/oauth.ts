/** Abre la URL de OAuth de Zernio en la misma pestaña (flujo estándar). */
export function redirectToZernioOAuth(authUrl: string): void {
  const url = authUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL de OAuth inválida");
  }
  window.location.replace(url);
}
