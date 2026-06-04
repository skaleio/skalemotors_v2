/**
 * Ingesta de citas (calendario Skale Motors).
 * Flujo: landing webhook → n8n (agente estructura JSON) → POST aquí.
 * Auth: misma x-api-key que /api/n8n-lead-ingest (lead_ingest_keys).
 */
import { createClient } from "@supabase/supabase-js";

import {
  processAppointmentIngest,
  type AppointmentIngestPayload,
} from "./_lib/appointmentIngestHandler";
import { loadIdempotentResponse, storeIdempotentResponse } from "./_lib/ingestIdempotency";
import { getIngestAllowedOrigin, resolveIngestKey } from "./_lib/leadIngestAuth";

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

function parseBody(req: VercelRequest): AppointmentIngestPayload | null {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as AppointmentIngestPayload;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as AppointmentIngestPayload;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers["origin"] as string | undefined) ?? undefined;
  res.setHeader("Access-Control-Allow-Origin", getIngestAllowedOrigin(origin));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key, Authorization, Idempotency-Key",
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

  const body = parseBody(req);
  if (body === null) {
    return res.status(400).json({ ok: false, error: "Invalid JSON body" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const envKey = process.env.N8N_LEAD_INGEST_API_KEY?.trim() || undefined;
  const auth = await resolveIngestKey(supabase, providedKey, body.branch_id, envKey);
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, error: auth.error });
  }

  const branchId = auth.resolution.branchId;

  const idempotencyKey = (req.headers["idempotency-key"] as string | undefined)?.trim();
  if (idempotencyKey) {
    const cached = await loadIdempotentResponse(supabase, branchId, `appt:${idempotencyKey}`);
    if (cached) {
      return res.status(cached.status_code).json(cached.response_body);
    }
  }

  const result = await processAppointmentIngest(supabase, branchId, body);

  if (idempotencyKey && result.ok && result.status >= 200 && result.status < 300) {
    await storeIdempotentResponse(
      supabase,
      branchId,
      `appt:${idempotencyKey}`,
      result.status,
      result.body,
    );
  }

  return res.status(result.status).json(result.body);
}
