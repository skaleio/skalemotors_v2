/**
 * Proxy Vercel → Supabase `landing-booking` (lead + cita en calendario).
 * Misma auth que n8n-lead-ingest: x-api-key con clave mintada por sucursal.
 */
interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  setHeader(name: string, value: string): VercelResponse;
  status(code: number): VercelResponse;
  json(body: unknown): void;
  send(body: string): void;
}

function getAllowedOrigin(req: VercelRequest): string {
  const raw = (process.env.LEAD_INGEST_ALLOWED_ORIGINS ?? "").trim();
  if (!raw) return "*";
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = (req.headers["origin"] as string | undefined)?.trim() ?? "";
  return origin && allowed.includes(origin) ? origin : allowed[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(req));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key, Authorization",
  );

  if (req.method === "OPTIONS") {
    return res.status(204).json({});
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const providedKey =
    (req.headers["x-api-key"] as string) ||
    (req.headers["authorization"] as string)?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!providedKey) {
    return res.status(401).json({ ok: false, error: "Missing API key" });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
  }

  const body =
    typeof req.body === "string"
      ? req.body
      : req.body !== undefined
        ? JSON.stringify(req.body)
        : "{}";

  const target = `${supabaseUrl}/functions/v1/landing-booking`;

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": providedKey,
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
