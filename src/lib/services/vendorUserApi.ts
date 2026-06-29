import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

const DEFAULT_TIMEOUT_MS = 30_000;

const PROXY_ALLOWED = new Set(["vendor-user-create", "vendor-user-delete"]);

function directSupabaseFunctionUrl(functionName: string): string {
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL no configurada");
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`;
}

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

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Tu sesión expiró. Cierra sesión y vuelve a entrar.");
  }
  return token;
}

async function postEdgeFunction(
  url: string,
  token: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ res: Response; text: string }> {
  const useApikey = url.includes(".supabase.co");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(useApikey ? { apikey: supabaseAnonKey ?? "", "x-client-info": "skale-motors-web" } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: useApikey ? "omit" : "same-origin",
      signal: controller.signal,
    });
    const text = await res.text();
    return { res, text };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`La operación tardó más de ${Math.round(timeoutMs / 1000)}s. Vuelve a intentar.`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `No se pudo conectar con el servidor (${msg}). Revisa tu red o vuelve a intentar en unos segundos.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function invokeVendorFunction<T extends { ok?: boolean; error?: string }>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!PROXY_ALLOWED.has(functionName)) {
    throw new Error(`Función no permitida: ${functionName}`);
  }

  const token = await getAccessToken();
  const proxiedUrl =
    typeof window !== "undefined" ? proxiedFunctionUrl(functionName) : directSupabaseFunctionUrl(functionName);
  const directUrl = directSupabaseFunctionUrl(functionName);

  let res: Response;
  let text: string;

  try {
    ({ res, text } = await postEdgeFunction(proxiedUrl, token, body, DEFAULT_TIMEOUT_MS));

    if (
      typeof window !== "undefined" &&
      proxiedUrl !== directUrl &&
      shouldFallbackFromProxy(res, text)
    ) {
      ({ res, text } = await postEdgeFunction(directUrl, token, body, DEFAULT_TIMEOUT_MS));
    }
  } catch (e) {
    if (typeof window !== "undefined" && supabaseUrl) {
      ({ res, text } = await postEdgeFunction(directUrl, token, body, DEFAULT_TIMEOUT_MS));
    } else {
      throw e;
    }
  }

  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    throw new Error(
      `Respuesta inesperada (${res.status}). ¿Existe la función «${functionName}»? ${text.slice(0, 160)}`,
    );
  }

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!data?.ok) {
    throw new Error(data?.error || "No se pudo completar la operación");
  }
  return data;
}

export async function createVendorUser(payload: {
  email: string;
  password: string;
  full_name: string;
  branch_id: string;
  sales_staff_id?: string | null;
}) {
  return invokeVendorFunction<{ ok: boolean; user_id?: string; email?: string }>(
    "vendor-user-create",
    payload,
  );
}

export async function deleteVendorUser(userId: string) {
  return invokeVendorFunction<{ ok: boolean; user_id?: string }>("vendor-user-delete", {
    user_id: userId,
  });
}
