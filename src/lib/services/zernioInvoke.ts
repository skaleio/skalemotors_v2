import { supabase, supabaseAnonKey, supabaseUrl } from "../supabase";

const DEFAULT_TIMEOUT_MS = 20_000;

function directSupabaseFunctionUrl(functionName: string): string {
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL no configurada");
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`;
}

/** Mismo origen (Vercel api/edge o proxy Vite). Evita CORS en producción. */
function proxiedFunctionUrl(functionName: string): string {
  return `${window.location.origin}/api/edge/${functionName}`;
}

function shouldFallbackFromProxy(res: Response, text: string): boolean {
  if (res.status === 404) return true;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) return true;
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return true;
  return false;
}

function mapInvokeError(e: unknown, timeoutMs: number): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/timeout|tiempo de espera|no hubo respuesta/i.test(msg)) {
    return new Error(
      `La conexión tardó más de ${Math.round(timeoutMs / 1000)}s. Vuelve a intentar; si persiste, revisa Supabase (ZERNIO_API_KEY y función zernio-connect-url).`,
    );
  }
  if (/failed to fetch|network|cors|load failed/i.test(msg)) {
    return new Error(
      "No se pudo contactar al servidor. Si acabas de desplegar, espera 1 minuto y recarga la página.",
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Sesión expirada. Cierra sesión y vuelve a entrar.");
  }
  return token;
}

function parseJsonBody<T>(text: string): T | null {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Invoca Edge Functions con fetch directo (evita cuelgues de functions.invoke + caché 304 en preflight).
 * El gateway de Supabase ya valida JWT cuando verify_jwt=true.
 */
async function postEdgeFunction(
  url: string,
  token: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ res: Response; text: string }> {
  const useApikey = url.includes(".supabase.co");
  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(useApikey ? { apikey: supabaseAnonKey ?? "" } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: useApikey ? "omit" : "same-origin",
    }),
    timeoutMs,
    "timeout",
  );
  const text = await res.text();
  return { res, text };
}

export async function invokeZernioFunction<T extends { ok?: boolean; error?: string }>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const token = await getAccessToken();

  const proxiedUrl =
    typeof window !== "undefined" ? proxiedFunctionUrl(functionName) : directSupabaseFunctionUrl(functionName);
  const directUrl = directSupabaseFunctionUrl(functionName);

  if (import.meta.env.DEV) {
    console.info("[zernio] POST", proxiedUrl, body);
  }

  let res: Response;
  let text: string;

  try {
    ({ res, text } = await postEdgeFunction(proxiedUrl, token, body, timeoutMs));

    if (
      typeof window !== "undefined" &&
      proxiedUrl !== directUrl &&
      shouldFallbackFromProxy(res, text)
    ) {
      if (import.meta.env.DEV) {
        console.warn("[zernio] proxy no disponible, POST directo a Supabase");
      }
      ({ res, text } = await postEdgeFunction(directUrl, token, body, timeoutMs));
    }
  } catch (e) {
    if (typeof window !== "undefined" && supabaseUrl) {
      try {
        ({ res, text } = await postEdgeFunction(directUrl, token, body, timeoutMs));
      } catch (retryErr) {
        throw mapInvokeError(retryErr, timeoutMs);
      }
    } else {
      throw mapInvokeError(e, timeoutMs);
    }
  }

  const data = parseJsonBody<T>(text);

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : null) ??
      (data && typeof data === "object" && "message" in data && typeof (data as { message?: string }).message === "string"
        ? (data as { message: string }).message
        : null) ??
      `Error ${res.status} al llamar ${functionName}`;
    throw new Error(msg);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Respuesta vacía del servidor");
  }

  if (data.ok === false) {
    throw new Error(data.error ?? "Error en el servidor");
  }

  return data;
}
