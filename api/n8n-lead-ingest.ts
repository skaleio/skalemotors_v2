/**
 * Ingesta con Supabase service role (bypass RLS).
 * Opcional: `assigned_to` (UUID de public.users) para asignar el lead a un vendedor
 * al crearlo; así aparece en su CRM bajo las políticas por rol.
 */
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  processAppointmentIngest,
  type AppointmentIngestPayload,
} from "./lib/appointmentIngestHandler";
import { maybeCreateAppointmentAfterIngest } from "./lib/landingBookingHandler";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalAssignedToUuid(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  if (!s || !UUID_RE.test(s)) return undefined;
  return s;
}

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
  /** UUID de usuario vendedor (public.users) para asignar el lead al crear/actualizar. */
  assigned_to?: string | null;
  assigned_to_email?: string | null;
  calendar_email?: string | null;

  /** Cita en calendario (agendamiento web → n8n). Si vienen fecha/hora, se usa appointment-ingest. */
  date?: string;
  time?: string;
  scheduled_at?: string;
  title?: string;
  type?: string;
  description?: string | null;
  create_lead?: boolean;
  user_id?: string | null;
  vehicle_id?: string | null;
  company?: string;
  website?: string;
  fullName?: string;

  // --- Campos extraídos por agentes IA (ej. n8n WHATSAPP HESSEN) ---
  uso_principal?: string | null;
  pasajeros_filas?: string | null;
  transmision?: string | null;
  pie_disponible?: string | number | null;
  marca_preferida?: string | null;
  anos_minimo?: string | null;
  preferencia?: string | null;
  alerta_crediticia?: string | null;
  raw_message?: string | null;

  // --- Aliases en español (agente produce estas claves) ---
  nombre?: string;
  telefono?: string;
  presupuesto?: string | number | null;
  tipo_vehiculo?: string | null;
  payment_method?: string | null;
  cantidad_pasajeros_filas_requeridas?: string | null;
  transmision_preferida?: string | null;
  presupuesto_pie_disponible?: string | number | null;
  anos?: string | null;
  mensaje_mike?: string | null;
};

function pickString(...values: (string | number | null | undefined)[]): string | null {
  for (const v of values) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

const RAW_MESSAGE_LABELS: Record<string, string> = {
  "nombre": "nombre",
  "telefono": "telefono",
  "rut": "rut",
  "correo": "email",
  "email": "email",
  "region": "region",
  "presupuesto": "presupuesto",
  "presupuesto pie disponible": "pie_disponible",
  "pie disponible": "pie_disponible",
  "uso principal": "uso_principal",
  "cantidad de pasajeros y filas requeridas": "pasajeros_filas",
  "pasajeros y filas requeridas": "pasajeros_filas",
  "transmision preferida": "transmision",
  "transmision": "transmision",
  "marca preferida": "marca_preferida",
  "anos": "anos",
  "ano minimo": "anos",
  "preferencia": "preferencia",
  "alerta crediticia": "alerta_crediticia",
  "tipo de vehiculo": "tipo_vehiculo",
  "vehiculo": "tipo_vehiculo",
  "financiamiento": "payment_method",
};

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRawMessage(text: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text || typeof text !== "string") return out;
  const lines = text.split(/\r?\n|\\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([^:]{1,80}?)\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    const rawLabel = match[1];
    let value = match[2]
      .replace(/\{[\s\S]*$/, "")
      .replace(/[{}"]/g, "")
      .replace(/^\$/, "")
      .trim();
    if (!value) continue;
    const canonical = RAW_MESSAGE_LABELS[normalizeLabel(rawLabel)];
    if (canonical && out[canonical] === undefined) {
      out[canonical] = value;
    }
  }
  return out;
}

type KeyResolution =
  | { kind: "env"; branchId: string }
  | { kind: "db"; branchId: string; keyRowId: string };

const VALID_SOURCES = [
  "web", "referido", "walk_in", "telefono",
  "redes_sociales", "evento", "otro", "whatsapp",
] as const;

const VALID_STATUSES = [
  "nuevo", "contactado", "interesado", "cotizando",
  "agendado", "negociando", "en_espera", "vendido", "perdido", "para_cierre", "cancelado",
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

function buildNotes(body: Payload, rawMessage: string | null): string | null {
  const parts: string[] = [];
  const rawTrimmed = rawMessage?.trim() ?? "";

  if (body.vehicle_interest) {
    parts.push(`Vehículo de interés: ${body.vehicle_interest}`);
  }
  // Dedupe: si body.notes es idéntico (o muy similar) al raw_message,
  // evitamos duplicar el dump del chatbot en la columna notes.
  if (body.notes) {
    const notesTrimmed = body.notes.trim();
    const duplicatesRaw = rawTrimmed !== "" && (
      notesTrimmed === rawTrimmed || notesTrimmed.includes(rawTrimmed)
    );
    if (!duplicatesRaw) {
      parts.push(body.notes);
    }
  }
  if (body.chat_summary) {
    parts.push(`--- Resumen chat ---\n${body.chat_summary}`);
  }

  return parts.length ? parts.join("\n\n") : null;
}

function isProductionEnv(): boolean {
  const vercelEnv = (process.env.VERCEL_ENV ?? "").toLowerCase();
  if (vercelEnv) return vercelEnv === "production";
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

async function loadIdempotentResponse(
  supabase: SupabaseClient,
  branchId: string,
  idempotencyKey: string,
): Promise<{ status_code: number; response_body: unknown } | null> {
  const { data, error } = await supabase
    .from("lead_ingest_idempotency")
    .select("status_code, response_body")
    .eq("branch_id", branchId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) {
    console.error("[n8n-lead-ingest] idempotency load:", error);
    return null;
  }
  return data ?? null;
}

async function storeIdempotentResponse(
  supabase: SupabaseClient,
  branchId: string,
  idempotencyKey: string,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  const { error } = await supabase.from("lead_ingest_idempotency").upsert(
    {
      branch_id: branchId,
      idempotency_key: idempotencyKey,
      status_code: statusCode,
      response_body: responseBody,
    },
    { onConflict: "branch_id,idempotency_key" },
  );
  if (error) {
    console.error("[n8n-lead-ingest] idempotency store:", error);
  }
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
  // C5 fix: la env-key global N8N_LEAD_INGEST_API_KEY queda solo para dev/preview.
  // En producción se exige una key de lead_ingest_keys (rotables, scopeadas a branch).
  // Sin este gate, la env key permitía inyectar leads en cualquier branch.
  if (envKey && providedKey === envKey && !isProductionEnv()) {
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
    // H13: no exponer mensajes crudos de Supabase al caller.
    console.error("[n8n-lead-ingest] resolveIngestKey supabase error:", error);
    return { ok: false, status: 500, error: "Internal error resolving API key" };
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

function getAllowedOrigin(req: VercelRequest): string {
  const raw = (process.env.LEAD_INGEST_ALLOWED_ORIGINS ?? "").trim();
  if (!raw) return "*"; // backward-compatible
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = (req.headers["origin"] as string | undefined)?.trim() ?? "";
  return origin && allowed.includes(origin) ? origin : allowed[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleLeadIngest(req, res);
  } catch (err) {
    console.error("[n8n-lead-ingest] unhandled:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleLeadIngest(req: VercelRequest, res: VercelResponse) {
  // H10: CORS configurable via LEAD_INGEST_ALLOWED_ORIGINS (comma-separated).
  // Si no está seteado, sigue siendo "*" para no romper integraciones existentes.
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(req));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key, Authorization, Idempotency-Key"
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
  if (auth.ok === false) {
    return res.status(auth.status).json({ ok: false, error: auth.error });
  }

  const branchId = auth.resolution.branchId;

  const isCalendarIngest =
    (!!body.date?.trim() && !!body.time?.trim()) ||
    !!body.scheduled_at?.trim();

  if (isCalendarIngest) {
    const idempotencyKeyEarly = (req.headers["idempotency-key"] as string | undefined)?.trim();
    const cacheKey = idempotencyKeyEarly ? `appt:${idempotencyKeyEarly}` : "";
    if (cacheKey) {
      const cached = await loadIdempotentResponse(supabase, branchId, cacheKey);
      if (cached) {
        return res.status(cached.status_code).json(cached.response_body);
      }
    }
    const result = await processAppointmentIngest(
      supabase,
      branchId,
      body as AppointmentIngestPayload,
    );
    if (cacheKey && result.ok && result.status >= 200 && result.status < 300) {
      await storeIdempotentResponse(supabase, branchId, cacheKey, result.status, result.body);
    }
    return res.status(result.status).json(result.body);
  }

  const idempotencyKey = (req.headers["idempotency-key"] as string | undefined)?.trim();
  if (idempotencyKey) {
    const cached = await loadIdempotentResponse(supabase, branchId, idempotencyKey);
    if (cached) {
      return res.status(cached.status_code).json(cached.response_body);
    }
  }

  const finish = async (statusCode: number, payload: unknown) => {
    if (idempotencyKey && statusCode >= 200 && statusCode < 300) {
      await storeIdempotentResponse(supabase, branchId, idempotencyKey, statusCode, payload);
    }
    return res.status(statusCode).json(payload);
  };

  // Fallback: si el cliente mandó raw_message / mensaje_mike / notes con formato
  // "Label: valor" por línea, extraemos los campos faltantes para llenar columnas
  // cuando el n8n no emite las claves canónicas.
  const rawTextCandidate = pickString(body.raw_message, body.mensaje_mike, body.notes) || "";
  const parsed = parseRawMessage(rawTextCandidate);

  const phoneRaw = pickString(body.phone, body.telefono, parsed.telefono) || "";
  const normalizedPhone = normalizePhoneChile(phoneRaw);
  if (!normalizedPhone) {
    return res.status(400).json({ ok: false, error: "phone is required (valid Chile format)" });
  }

  const fullName = toTitleCase(pickString(body.full_name, body.nombre, parsed.nombre) || "") || "Sin nombre";

  const explicitStatus =
    body.status && includes(VALID_STATUSES, body.status) ? body.status : null;
  /** Leads sin `status` en el body entran al embudo en columna NUEVO. */
  const insertStatus = explicitStatus ?? "nuevo";

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
    console.error("[n8n-lead-ingest] branch lookup error:", branchError);
    return res.status(500).json({ ok: false, error: "Internal error resolving branch" });
  }
  if (!branch) {
    return res.status(400).json({ ok: false, error: "Invalid branch_id" });
  }

  const tenantId = branch.tenant_id ?? null;

  // Campos extraídos por el AI: se aceptan tanto las claves EN como los aliases ES.
  // Si faltan, se completan con el parse del raw_message/notes.
  const vehicleInterest = pickString(body.vehicle_interest, body.tipo_vehiculo, parsed.tipo_vehiculo);
  const usoPrincipal = pickString(body.uso_principal, parsed.uso_principal);
  const pasajerosFilas = pickString(body.pasajeros_filas, body.cantidad_pasajeros_filas_requeridas, parsed.pasajeros_filas);
  const transmision = pickString(body.transmision, body.transmision_preferida, parsed.transmision);
  const pieDisponible = pickString(body.pie_disponible, body.presupuesto_pie_disponible, parsed.pie_disponible);
  const marcaPreferida = pickString(body.marca_preferida, parsed.marca_preferida);
  const anosMinimo = pickString(body.anos_minimo, body.anos, parsed.anos);
  const preferencia = pickString(body.preferencia, parsed.preferencia);
  const alertaCrediticia = pickString(body.alerta_crediticia, parsed.alerta_crediticia);
  const rawMessage = rawTextCandidate || null;

  // vehicle_interest también se concatena en buildNotes; dejamos que siga ocurriendo
  // para compat con notas históricas, y además lo guardamos en su columna propia.
  const bodyForNotes: Payload = { ...body, vehicle_interest: vehicleInterest ?? undefined };
  const notesText = buildNotes(bodyForNotes, rawMessage);

  const budgetStr = pickString(body.budget, body.presupuesto, parsed.presupuesto);

  const paymentType = pickString(body.payment_type, body.payment_method, parsed.payment_method);
  const rut = pickString(body.rut, parsed.rut);
  const email = pickString(body.email, parsed.email);
  const region = pickString(body.region, parsed.region);

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
      console.error("[n8n-lead-ingest] lead find error:", findError);
      return res.status(500).json({ ok: false, error: "Internal error finding lead" });
    }

    if (existing?.id) {
      const updatePayload: Record<string, unknown> = {
        full_name: fullName,
        source,
        priority,
        payment_type: paymentType,
        budget: budgetStr,
        notes: notesText,
        region,
        rut,
        vehicle_interest: vehicleInterest,
        uso_principal: usoPrincipal,
        pasajeros_filas: pasajerosFilas,
        transmision,
        pie_disponible: pieDisponible,
        marca_preferida: marcaPreferida,
        anos_minimo: anosMinimo,
        preferencia,
        alerta_crediticia: alertaCrediticia,
        raw_message: rawMessage,
        updated_at: new Date().toISOString(),
      };

      if (email !== null) updatePayload.email = email;
      if (explicitStatus) updatePayload.status = explicitStatus;
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

      const ingestAssigned = optionalAssignedToUuid(body.assigned_to);
      if (ingestAssigned) updatePayload.assigned_to = ingestAssigned;

      const { data: updated, error: updError } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id, full_name, phone, status, state, branch_id, tenant_id, created_at, updated_at")
        .maybeSingle();

      if (updError) {
        console.error("[n8n-lead-ingest] lead update error:", updError);
        return res.status(500).json({ ok: false, error: "Internal error updating lead" });
      }

      if (auth.resolution.kind === "db") {
        void supabase
          .from("lead_ingest_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", auth.resolution.keyRowId);
      }

      let appointment: { id: string; scheduled_at: string } | null = null;
      if (tenantId && body.date?.trim() && body.time?.trim()) {
        appointment = await maybeCreateAppointmentAfterIngest(supabase, {
          branchId,
          leadId: existing.id as string,
          fullName,
          date: body.date,
          time: body.time,
          notes: notesText,
          source,
          tenantId,
        });
      }

      return finish(200, { ok: true, created: false, data: updated, appointment });
    }
  }

  const insertPayload: Record<string, unknown> = {
    full_name: fullName,
    phone: normalizedPhone,
    email,
    status: insertStatus,
    source,
    priority,
    branch_id: branchId,
    payment_type: paymentType,
    budget: budgetStr,
    notes: notesText,
    region,
    rut,
    tags,
    vehicle_interest: vehicleInterest,
    uso_principal: usoPrincipal,
    pasajeros_filas: pasajerosFilas,
    transmision,
    pie_disponible: pieDisponible,
    marca_preferida: marcaPreferida,
    anos_minimo: anosMinimo,
    preferencia,
    alerta_crediticia: alertaCrediticia,
    raw_message: rawMessage,
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

  const ingestAssignedInsert = optionalAssignedToUuid(body.assigned_to);
  if (ingestAssignedInsert) insertPayload.assigned_to = ingestAssignedInsert;

  const { data: created, error: insertError } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id, full_name, phone, status, state, branch_id, tenant_id, created_at, updated_at")
    .single();

  if (insertError) {
    console.error("[n8n-lead-ingest] lead insert error:", insertError);
    return res.status(500).json({ ok: false, error: "Internal error inserting lead" });
  }

  if (auth.resolution.kind === "db") {
    void supabase
      .from("lead_ingest_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", auth.resolution.keyRowId);
  }

  let appointment: { id: string; scheduled_at: string } | null = null;
  if (tenantId && body.date?.trim() && body.time?.trim()) {
    appointment = await maybeCreateAppointmentAfterIngest(supabase, {
      branchId,
      leadId: created.id as string,
      fullName,
      date: body.date,
      time: body.time,
      notes: notesText,
      source,
      tenantId,
    });
  }

  return finish(200, { ok: true, created: true, data: created, appointment });
}
