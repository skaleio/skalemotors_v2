const ZERNIO_API_BASE = "https://zernio.com/api/v1";
const ZERNIO_FETCH_TIMEOUT_MS = 12_000;

export async function zernioFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const apiKey = Deno.env.get("ZERNIO_API_KEY");
  if (!apiKey) {
    throw new Error("ZERNIO_API_KEY no configurada en Supabase Secrets");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ZERNIO_FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${ZERNIO_API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Zernio tardó demasiado en responder. Intenta de nuevo.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json as { message?: string }).message ??
      (json as { error?: string }).error ??
      res.statusText;
    const code = (json as { code?: string }).code;
    const suffix = code ? ` (${code})` : "";
    throw new Error(
      typeof msg === "string" ? `${msg}${suffix}` : `Error en Zernio API (${res.status})`,
    );
  }
  return json as T;
}
