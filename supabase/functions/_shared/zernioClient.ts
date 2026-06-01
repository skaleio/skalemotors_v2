const ZERNIO_API_BASE = "https://zernio.com/api/v1";

export async function zernioFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const apiKey = Deno.env.get("ZERNIO_API_KEY");
  if (!apiKey) {
    throw new Error("ZERNIO_API_KEY no configurada en Supabase Secrets");
  }

  const res = await fetch(`${ZERNIO_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json as { message?: string }).message ??
      (json as { error?: string }).error ??
      res.statusText;
    throw new Error(typeof msg === "string" ? msg : "Error en Zernio API");
  }
  return json as T;
}
