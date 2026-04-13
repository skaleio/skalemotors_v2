import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

type Payload = {
  branch_id?: string;
  full_name?: string;
  phone?: string;
  rut?: string | null;
  email?: string | null;
  source?: string;
  status?: string;
  priority?: string;
  payment_type?: string | null;
  budget?: string | number | null;
  vehicle_interest?: string | null;
  notes?: string | null;
  chat_summary?: string | null;
  region?: string | null;
  tags?: unknown;
  state?: string | null;
  state_confidence?: number | string | null;
  state_reason?: string | null;
  update_existing?: boolean;
};

type KeyResolution =
  | { kind: "env"; branchId: string }
  | { kind: "db"; branchId: string; keyRowId: string };

const VALID_SOURCES = [
  "web", "referido", "walk_in", "telefono",
  "redes_sociales", "evento", "otro", "whatsapp",
] as const;

const VALID_STATUSES = [
  "nuevo", "contactado", "interesado", "cotizando",
  "negociando", "vendido", "perdido", "para_cierre",
] as const;

const VALID_PRIORITIES = ["baja", "media", "alta"] as const;

function normalizePhoneChile(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("+56")) {
    const normalized = raw.replace(/^(\+56\s*)/g, "+56 ").trim();
    return normalized === "+56" ? "" : normalized;
  }
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.startsWith("56") && digitsOnly.length >= 10) {
    const withoutCountry = digitsOnly.slice(2);
    return withoutCountry ? `+56 ${withoutCountry}` : "";
  }
  return `+56 ${raw}`;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function includes<T extends readonly string[]>(arr: T, val: string): val is T[number] {
  return arr.includes(val as T[number]);
}

function buildNotes(body: Payload): string | null {
  const parts: string[] = [];

  if (body.vehicle_interest) {
    parts.push(`Vehículo de interés: ${body.vehicle_interest}`);
  }
  if (body.notes) {
    parts.push(body.notes);
  }
  if (body.chat_summary) {
    parts.push(`--- Resumen chat ---\n${body.chat_summary}`);
  }

  return parts.length ? parts.join("\n\n") : null;
}

async function resolveIngestKey(
  supabase: SupabaseClient,
  providedKey: string,
  bodyBranchId: string | undefined,
  envKey: string | undefined
): Promise<
  | { ok: true; resolution: KeyResolution }
  | { ok: false; status: number; error: string }
> {
  if (envKey && providedKey === envKey) {
    const bid = bodyBranchId?.trim();
    if (!bid) {
      return {
        ok: false,
        status: 400,
        error: "branch_id is required when using the global N8N_LEAD_INGEST_API_KEY",
      };
    }
    return { ok: true, resolution: { kind: "env", branchId: bid } };
  }

  const secretHash = createHash("sha256").update(providedKey, "utf8").digest("hex");

  const { data: row, error } = await supabase
    .from("lead_ingest_keys")
    .select("id, branch_id")
    .eq("secret_hash", secretHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!row) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const bodyBid = bodyBranchId?.trim();
  if (bodyBid && bodyBid !== row.branch_id) {
    return {
      ok: false,
      status: 403,
      error: "branch_id does not match this API key",
    };
  }

  return {
    ok: true,
    resolution: { kind: "db", branchId: row.branch_id, keyRowId: row.id },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key, Authorization"
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

  const body = req.body as Payload | undefined;
  if (!body || typeof body !== "object") {
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

  const phoneRaw = body.phone?.trim() || "";
  const normalizedPhone = normalizePhoneChile(phoneRaw);
  if (!normalizedPhone) {
    return res.status(400).json({ ok: false, error: "phone is required (valid Chile format)" });
  }

  const fullName = toTitleCase(body.full_name?.trim() || "") || "Sin nombre";

  const status =
    body.status && includes(VALID_STATUSES, body.status) ? body.status : "contactado";

  const source =
    body.source && includes(VALID_SOURCES, body.source) ? body.source : "whatsapp";

  const priority =
    body.priority && includes(VALID_PRIORITIES, body.priority) ? body.priority : "alta";

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, tenant_id")
    .eq("id", branchId)
    .maybeSingle();

  if (branchError) {
    return res.status(400).json({ ok: false, error: branchError.message });
  }
  if (!branch) {
    return res.status(400).json({ ok: false, error: "Invalid branch_id" });
  }

  const tenantId = branch.tenant_id ?? null;
  const notesText = buildNotes(body);

  const budgetStr =
    body.budget != null ? String(body.budget).trim() || null : null;

  const paymentType = body.payment_type?.trim() || null;
  const rut =
    body.rut != null && String(body.rut).trim() ? String(body.rut).trim() : null;
  const email =
    body.email != null && String(body.email).trim()
      ? String(body.email).trim()
      : null;
  const region = body.region?.trim() || null;

  const stateVal = body.state?.trim() || null;
  const stateConfidence =
    body.state_confidence != null ? Number(body.state_confidence) : null;
  const stateReason = body.state_reason?.trim() || null;

  let tags: unknown[] = [];
  if (body.tags != null) {
    if (Array.isArray(body.tags)) {
      tags = body.tags;
    } else {
      return res.status(400).json({ ok: false, error: "tags must be an array when provided" });
    }
  }

  const updateExisting = body.update_existing !== false;

  if (updateExisting) {
    const { data: existing, error: findError } = await supabase
      .from("leads")
      .select("id")
      .eq("branch_id", branchId)
      .eq("phone", normalizedPhone)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (findError) {
      return res.status(400).json({ ok: false, error: findError.message });
    }

    if (existing?.id) {
      const updatePayload: Record<string, unknown> = {
        full_name: fullName,
        status,
        source,
        priority,
        payment_type: paymentType,
        budget: budgetStr,
        notes: notesText,
        region,
        rut,
        updated_at: new Date().toISOString(),
      };

      if (email !== null) updatePayload.email = email;
      if (tenantId) updatePayload.tenant_id = tenantId;
      if (tags.length > 0) updatePayload.tags = tags;
      if (stateVal) {
        updatePayload.state = stateVal;
        updatePayload.state_confidence =
          stateConfidence != null && !Number.isNaN(stateConfidence)
            ? stateConfidence
            : null;
        updatePayload.state_reason = stateReason;
        updatePayload.state_updated_at = new Date().toISOString();
      }

      const { data: updated, error: updError } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id, full_name, phone, status, state, branch_id, tenant_id, created_at, updated_at")
        .maybeSingle();

      if (updError) {
        return res.status(400).json({ ok: false, error: updError.message });
      }

      if (auth.resolution.kind === "db") {
        void supabase
          .from("lead_ingest_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", auth.resolution.keyRowId);
      }

      return res.status(200).json({ ok: true, created: false, data: updated });
    }
  }

  const insertPayload: Record<string, unknown> = {
    full_name: fullName,
    phone: normalizedPhone,
    email,
    status,
    source,
    priority,
    branch_id: branchId,
    payment_type: paymentType,
    budget: budgetStr,
    notes: notesText,
    region,
    rut,
    tags,
  };

  if (tenantId) insertPayload.tenant_id = tenantId;
  if (stateVal) {
    insertPayload.state = stateVal;
    insertPayload.state_confidence =
      stateConfidence != null && !Number.isNaN(stateConfidence)
        ? stateConfidence
        : null;
    insertPayload.state_reason = stateReason;
    insertPayload.state_updated_at = new Date().toISOString();
  }

  const { data: created, error: insertError } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id, full_name, phone, status, state, branch_id, tenant_id, created_at, updated_at")
    .single();

  if (insertError) {
    return res.status(400).json({ ok: false, error: insertError.message });
  }

  if (auth.resolution.kind === "db") {
    void supabase
      .from("lead_ingest_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", auth.resolution.keyRowId);
  }

  return res.status(200).json({ ok: true, created: true, data: created });
}
