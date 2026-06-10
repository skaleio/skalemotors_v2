/**
 * Lead + cita desde landing (Vercel, service role).
 */
import {
  createLandingBookingSupabase,
  processLandingBooking,
  type LandingBookingPayload,
} from "./_lib/landingBookingHandler";
import { resolveLandingIngestKey } from "./_lib/resolveLandingIngestKey";

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  setHeader(name: string, value: string): VercelResponse;
  status(code: number): VercelResponse;
  json(body: unknown): void;
}

function getAllowedOrigin(req: VercelRequest): string {
  const raw = (process.env.LEAD_INGEST_ALLOWED_ORIGINS ?? "").trim();
  if (!raw) return "*";
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = (req.headers["origin"] as string | undefined)?.trim() ?? "";
  return origin && allowed.includes(origin) ? origin : allowed[0];
}

function parseBody(req: VercelRequest): LandingBookingPayload | null {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as LandingBookingPayload;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as LandingBookingPayload;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(req));
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, x-api-key, Authorization",
    );
    res.setHeader("Cache-Control", "no-store");

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

    const supabase = createLandingBookingSupabase();
    if (!supabase) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
    }

    const body = parseBody(req);
    if (body === null) {
      return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }

    const auth = await resolveLandingIngestKey(supabase, providedKey, body.branch_id);
    if (auth.ok === false) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }

    const result = await processLandingBooking(supabase, body);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[landing-booking] unhandled:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
