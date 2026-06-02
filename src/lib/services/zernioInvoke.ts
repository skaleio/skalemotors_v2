import { supabase, supabaseAnonKey, supabaseUrl } from "../supabase";

const DEFAULT_TIMEOUT_MS = 20_000;

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
export async function invokeZernioFunction<T extends { ok?: boolean; error?: string }>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const token = await getAccessToken();
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    }),
    timeoutMs,
    "No hubo respuesta del servidor. Revisa la pestaña Network: busca zernio-connect-url (debe ser POST, no solo 304).",
  );

  const text = await res.text();
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
