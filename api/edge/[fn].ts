/**
 * Proxy same-origin hacia Supabase Edge Functions (Zernio y similares).
 * Evita CORS / preflight 304 cuando ALLOWED_ORIGINS no coincide con Vercel.
 */
interface VercelRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  setHeader(name: string, value: string): VercelResponse;
  status(code: number): VercelResponse;
  send(body: string): void;
  json(body: unknown): void;
}

const ZERNIO_FN_RE = /^zernio-[a-z0-9-]+$/;

function header(req: VercelRequest, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const rawFn = req.query.fn;
  const fn = typeof rawFn === "string" ? rawFn : Array.isArray(rawFn) ? rawFn[0] : "";
  if (!fn || !ZERNIO_FN_RE.test(fn)) {
    return res.status(404).json({ ok: false, error: "Función no encontrada" });
  }

  const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  const authorization = header(req, "authorization");

  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ ok: false, error: "Supabase no configurado en Vercel" });
  }
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ ok: false, error: "Missing auth" });
  }

  const target = `${supabaseUrl}/functions/v1/${fn}`;
  const body =
    typeof req.body === "string"
      ? req.body
      : req.body !== undefined
        ? JSON.stringify(req.body)
        : "{}";

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        apikey: anonKey,
      },
      body,
      cache: "no-store",
    });

    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.status(upstream.status).send(text);
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al contactar Supabase",
    });
  }
}
