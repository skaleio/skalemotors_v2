// landing-booking — Lead + cita desde landing Meta (Miami Motors / automotora fija).
// Auth: misma ingesta que lead-create (verify_lead_ingest_key por sucursal o legacy env).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime } from "https://esm.sh/luxon@3.5.0?target=deno";
import { getCorsHeaders, isOriginAllowed } from "../_shared/cors.ts";
import { resolveLeadAutomationAuth } from "../_shared/leadIngestAuth.ts";

const LANDING_BRANCH_ID = "c673d388-6ae0-43b6-99b9-1d62db3692d9";
const LANDING_USER_ID = "1bad02e7-7888-4cbc-9d79-e4d583401ed0";
const APPOINTMENT_DURATION_MIN = 60;

function getEnvAny(names: string[]): string | null {
  for (const name of names) {
    const v = Deno.env.get(name);
    if (v) return v;
  }
  return null;
}

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

/** Hora de la landing = reloj Chile (America/Santiago), no UTC del servidor. */
function parseScheduledAt(date: string, time: string, scheduledAtIso?: string): string | null {
  if (scheduledAtIso) {
    const d = new Date(scheduledAtIso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const timeOk = /^\d{2}:\d{2}$/.test(time);
  if (!dateOk || !timeOk) return null;
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: "America/Santiago" });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO();
}

type Payload = {
  full_name?: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  notes?: string | null;
  date?: string;
  time?: string;
  scheduled_at?: string;
  source?: string;
  company?: string;
  website?: string;
};

export default async function handler(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  if (!isOriginAllowed(req)) {
    return json(403, { ok: false, error: "Origin not allowed" });
  }

  const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
  const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const keyAuth = await resolveLeadAutomationAuth(
    req,
    LANDING_BRANCH_ID,
    supabaseUrl,
    serviceRoleKey,
    ["LEAD_INGEST_API_KEY", "BOOKING_INGEST_API_KEY"],
  );
  if (!keyAuth.ok) {
    return json(keyAuth.status, { ok: false, error: keyAuth.error });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  if ((body.company && String(body.company).trim()) || (body.website && String(body.website).trim())) {
    return json(200, { ok: true });
  }

  const fullNameRaw = (body.full_name ?? body.fullName ?? "").trim();
  const fullName = toTitleCase(fullNameRaw) || "Sin nombre";

  const normalizedPhone = normalizePhoneChile(body.phone?.trim() || "");
  if (!normalizedPhone) {
    return json(400, { ok: false, error: "phone is required (valid Chile format)" });
  }

  const date = body.date?.trim() || "";
  const time = body.time?.trim() || "";
  const scheduledAt = parseScheduledAt(date, time, body.scheduled_at?.trim());
  if (!scheduledAt) {
    return json(400, { ok: false, error: "date and time are required (YYYY-MM-DD, HH:mm)" });
  }

  const endAt = new Date(new Date(scheduledAt).getTime() + APPOINTMENT_DURATION_MIN * 60_000).toISOString();
  const landingSource = body.source?.trim() || "meta-ads";
  const interestNotes = body.notes?.trim() || "";
  const leadNotes = interestNotes
    ? `Landing ${landingSource}: ${interestNotes}`
    : `Lead desde landing (${landingSource})`;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, tenant_id")
    .eq("id", LANDING_BRANCH_ID)
    .maybeSingle();

  if (branchError || !branch) {
    console.error("[landing-booking] branch:", branchError);
    return json(500, { ok: false, error: "Invalid branch configuration" });
  }

  const tenantId = branch.tenant_id as string;

  const { data: assignee, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("id", LANDING_USER_ID)
    .eq("is_active", true)
    .maybeSingle();

  if (userError || !assignee) {
    console.error("[landing-booking] user:", userError);
    return json(500, { ok: false, error: "Invalid calendar user configuration" });
  }

  let leadId: string;
  let leadCreated = false;

  const { data: existingLead, error: findLeadError } = await supabase
    .from("leads")
    .select("id")
    .eq("branch_id", LANDING_BRANCH_ID)
    .eq("phone", normalizedPhone)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (findLeadError) {
    console.error("[landing-booking] find lead:", findLeadError);
    return json(500, { ok: false, error: "Internal error finding lead" });
  }

  if (existingLead?.id) {
    leadId = existingLead.id as string;
    const { error: updError } = await supabase
      .from("leads")
      .update({
        full_name: fullName,
        email: body.email?.trim() ? body.email.trim() : null,
        source: "redes_sociales",
        status: "nuevo",
        priority: "media",
        notes: leadNotes,
        tags: ["meta-ads", "landing"],
        tenant_id: tenantId,
        assigned_to: LANDING_USER_ID,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updError) {
      console.error("[landing-booking] update lead:", updError);
      return json(500, { ok: false, error: "Internal error updating lead" });
    }
  } else {
    const { data: createdLead, error: insertLeadError } = await supabase
      .from("leads")
      .insert({
        full_name: fullName,
        phone: normalizedPhone,
        email: body.email?.trim() ? body.email.trim() : null,
        source: "redes_sociales",
        status: "nuevo",
        priority: "media",
        branch_id: LANDING_BRANCH_ID,
        tenant_id: tenantId,
        assigned_to: LANDING_USER_ID,
        notes: leadNotes,
        tags: ["meta-ads", "landing"],
      })
      .select("id")
      .single();

    if (insertLeadError || !createdLead) {
      console.error("[landing-booking] insert lead:", insertLeadError);
      return json(500, { ok: false, error: insertLeadError?.message ?? "Could not create lead" });
    }
    leadId = createdLead.id as string;
    leadCreated = true;
  }

  const appointmentTitle = `Visita landing · ${fullName}`;
  const appointmentDescription = interestNotes || `Solicitud desde landing (${landingSource})`;

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      lead_id: leadId,
      user_id: LANDING_USER_ID,
      branch_id: LANDING_BRANCH_ID,
      tenant_id: tenantId,
      type: "reunion",
      status: "programada",
      scheduled_at: scheduledAt,
      end_at: endAt,
      duration_minutes: APPOINTMENT_DURATION_MIN,
      title: appointmentTitle,
      description: appointmentDescription,
      notes: leadNotes,
    })
    .select("id, scheduled_at, lead_id, user_id")
    .single();

  if (apptError || !appointment) {
    console.error("[landing-booking] insert appointment:", apptError);
    return json(500, {
      ok: false,
      error: apptError?.message ?? "Could not create appointment",
      lead_id: leadId,
    });
  }

  return json(200, {
    ok: true,
    lead: { id: leadId, created: leadCreated },
    appointment: {
      id: appointment.id,
      scheduled_at: appointment.scheduled_at,
      user_id: appointment.user_id,
    },
  });
}

Deno.serve((req) => handler(req));
