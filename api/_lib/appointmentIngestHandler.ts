/**
 * Ingesta de citas vía POST (n8n / webhook landing → agente → Skale Motors).
 * Solo crea la cita en Calendario; no crea ni actualiza leads en CRM salvo `lead_id` explícito
 * o `create_lead: true` (opt-in, no usar en agendamiento web).
 * Misma auth que leads: x-api-key (lead_ingest_keys por sucursal).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { chileLocalToUtcIso } from "./chileDateTime";
import { resolveAssigneeForBranch } from "./resolveAssignee";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TYPES = new Set([
  "test_drive",
  "reunion",
  "entrega",
  "servicio",
  "otro",
  "meeting",
  "delivery",
  "service",
  "other",
]);

const TYPE_TO_DB: Record<string, string> = {
  test_drive: "test_drive",
  meeting: "reunion",
  reunion: "reunion",
  delivery: "entrega",
  entrega: "entrega",
  service: "servicio",
  servicio: "servicio",
  other: "otro",
  otro: "otro",
};

const VALID_STATUS = new Set(["programada", "completada", "cancelada"]);

export type AppointmentIngestPayload = {
  branch_id?: string;
  lead_id?: string;
  create_lead?: boolean;
  full_name?: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  title?: string;
  description?: string | null;
  notes?: string | null;
  type?: string;
  status?: string;
  scheduled_at?: string;
  date?: string;
  time?: string;
  end_at?: string;
  duration_minutes?: number;
  assigned_to?: string | null;
  user_id?: string | null;
  /** Alternativa a UUID: email del dueño del calendario (mismo tenant que la clave API). */
  assigned_to_email?: string | null;
  calendar_email?: string | null;
  calendar_user_email?: string | null;
  vehicle_id?: string | null;
  source?: string;
  /** Honeypot */
  company?: string;
  website?: string;
};

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

function optionalUuid(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s && UUID_RE.test(s) ? s : undefined;
}

function parseScheduledAt(body: AppointmentIngestPayload): string | null {
  const iso = body.scheduled_at != null ? String(body.scheduled_at).trim() : "";
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const date = body.date != null ? String(body.date).trim() : "";
  let time = body.time != null ? String(body.time).trim() : "";
  if (time.length >= 5) time = time.slice(0, 5);
  return chileLocalToUtcIso(date, time);
}

function toDbType(type: string | undefined): string {
  const t = (type ?? "reunion").trim().toLowerCase();
  return TYPE_TO_DB[t] ?? "reunion";
}

function buildAppointmentContactNotes(opts: {
  fullName: string;
  phone?: string;
  email?: string | null;
  source: string;
  interestNotes: string;
}): string {
  const lines = [`Cliente: ${opts.fullName}`];
  const phone = opts.phone?.trim();
  if (phone) lines.push(`Tel: ${phone}`);
  const email = opts.email?.trim();
  if (email) lines.push(`Email: ${email}`);
  lines.push(`Origen: ${opts.source}`);
  if (opts.interestNotes) lines.push(opts.interestNotes);
  return lines.join("\n");
}

export type AppointmentIngestResult =
  | {
      ok: true;
      status: number;
      body:
        | { ok: true }
        | {
            ok: true;
            lead: { id: string; created: boolean } | null;
            appointment: {
              id: string;
              scheduled_at: string;
              user_id: string;
              title: string;
            };
            calendar_user_resolved_via?: string;
          };
    }
  | { ok: false; status: number; body: { ok: false; error: string; lead_id?: string; hint?: string; received_keys?: string[] } };

export async function processAppointmentIngest(
  supabase: SupabaseClient,
  branchId: string,
  body: AppointmentIngestPayload,
): Promise<AppointmentIngestResult> {
  if ((body.company && String(body.company).trim()) || (body.website && String(body.website).trim())) {
    return { ok: true, status: 200, body: { ok: true } };
  }

  const scheduledAt = parseScheduledAt(body);
  if (!scheduledAt) {
    const received = Object.keys(body as object);
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: "scheduled_at (ISO) or date+time (YYYY-MM-DD, HH:mm Chile) are required",
        hint:
          received.length === 0
            ? "El servidor recibió body vacío. En n8n HTTP: Body JSON con expresión ={{ $json }} (con = al inicio)."
            : "Revisa date, time o scheduled_at en el JSON enviado.",
        received_keys: received.length ? received : undefined,
      },
    };
  }

  const durationMin =
    typeof body.duration_minutes === "number" && body.duration_minutes > 0
      ? body.duration_minutes
      : 60;

  let endAt: string;
  if (body.end_at?.trim()) {
    const d = new Date(body.end_at.trim());
    endAt = Number.isNaN(d.getTime())
      ? new Date(new Date(scheduledAt).getTime() + durationMin * 60_000).toISOString()
      : d.toISOString();
  } else {
    endAt = new Date(new Date(scheduledAt).getTime() + durationMin * 60_000).toISOString();
  }

  const apptTypeRaw = body.type?.trim().toLowerCase();
  if (apptTypeRaw && !VALID_TYPES.has(apptTypeRaw)) {
    return { ok: false, status: 400, body: { ok: false, error: "Invalid appointment type" } };
  }
  const apptType = toDbType(body.type);

  const status =
    body.status && VALID_STATUS.has(body.status) ? body.status : "programada";

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, tenant_id")
    .eq("id", branchId)
    .maybeSingle();

  if (branchError || !branch?.tenant_id) {
    console.error("[appointment-ingest] branch:", branchError);
    return { ok: false, status: 500, body: { ok: false, error: "Invalid branch configuration" } };
  }

  const tenantId = branch.tenant_id as string;

  const assigneeResolution = await resolveAssigneeForBranch(supabase, branchId, tenantId, body);
  if (assigneeResolution.ok === false) {
    return {
      ok: false,
      status: assigneeResolution.status,
      body: { ok: false, error: assigneeResolution.error },
    };
  }

  const assigneeId = assigneeResolution.userId;

  const fullNameRaw = (body.full_name ?? body.fullName ?? "").trim();
  const fullName = toTitleCase(fullNameRaw) || "Sin nombre";
  const landingSource = body.source?.trim() || "agendamiento-web";
  const interestNotes = body.notes?.trim() || body.description?.trim() || "";
  const defaultTitle = `Visita agendada · ${fullName}`;
  const title = body.title?.trim() || defaultTitle;

  let leadId: string | null = optionalUuid(body.lead_id) ?? null;
  let leadCreated = false;

  const createLead = body.create_lead === true;

  if (leadId) {
    const { data: leadRow, error: leadErr } = await supabase
      .from("leads")
      .select("id, branch_id, tenant_id")
      .eq("id", leadId)
      .is("deleted_at", null)
      .maybeSingle();

    if (leadErr || !leadRow) {
      return { ok: false, status: 400, body: { ok: false, error: "lead_id not found" } };
    }
    if (leadRow.branch_id !== branchId) {
      return { ok: false, status: 403, body: { ok: false, error: "lead_id does not belong to this branch" } };
    }
  } else if (createLead) {
    const normalizedPhone = normalizePhoneChile(body.phone?.trim() || "");
    if (!normalizedPhone) {
      return {
        ok: false,
        status: 400,
        body: { ok: false, error: "phone is required when create_lead is true (or send lead_id)" },
      };
    }

    const leadNotes = interestNotes
      ? `Agendamiento (${landingSource}): ${interestNotes}`
      : `Cita desde agendamiento (${landingSource})`;

    const { data: existingLead, error: findLeadError } = await supabase
      .from("leads")
      .select("id")
      .eq("branch_id", branchId)
      .eq("phone", normalizedPhone)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (findLeadError) {
      console.error("[appointment-ingest] find lead:", findLeadError);
      return { ok: false, status: 500, body: { ok: false, error: "Internal error finding lead" } };
    }

    if (existingLead?.id) {
      leadId = existingLead.id as string;
      const { error: updLeadError } = await supabase
        .from("leads")
        .update({
          full_name: fullName,
          email: body.email?.trim() ? body.email.trim() : null,
          source: "redes_sociales",
          status: "nuevo",
          priority: "media",
          notes: leadNotes,
          tags: ["agendamiento", landingSource],
          tenant_id: tenantId,
          assigned_to: assigneeId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (updLeadError) {
        console.error("[appointment-ingest] update lead:", updLeadError);
        return {
          ok: false,
          status: 500,
          body: { ok: false, error: updLeadError.message ?? "Could not update lead" },
        };
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
          branch_id: branchId,
          tenant_id: tenantId,
          assigned_to: assigneeId,
          notes: leadNotes,
          tags: ["agendamiento", landingSource],
        })
        .select("id")
        .single();

      if (insertLeadError || !createdLead) {
        console.error("[appointment-ingest] insert lead:", insertLeadError);
        return {
          ok: false,
          status: 500,
          body: { ok: false, error: insertLeadError?.message ?? "Could not create lead" },
        };
      }
      leadId = createdLead.id as string;
      leadCreated = true;
    }
  }

  const vehicleId = optionalUuid(body.vehicle_id) ?? null;

  const contactNotes = buildAppointmentContactNotes({
    fullName,
    phone: body.phone,
    email: body.email,
    source: landingSource,
    interestNotes,
  });
  const appointmentDescription =
    body.description?.trim() || (leadId ? interestNotes || null : contactNotes);
  const appointmentNotes = leadId ? interestNotes || null : contactNotes;

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      lead_id: leadId,
      user_id: assigneeId,
      branch_id: branchId,
      tenant_id: tenantId,
      vehicle_id: vehicleId,
      type: apptType,
      status,
      scheduled_at: scheduledAt,
      end_at: endAt,
      duration_minutes: durationMin,
      title,
      description: appointmentDescription,
      notes: appointmentNotes,
    })
    .select("id, scheduled_at, user_id, title")
    .single();

  if (apptError || !appointment) {
    console.error("[appointment-ingest] insert appointment:", apptError);
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: apptError?.message ?? "Could not create appointment",
        lead_id: leadId ?? undefined,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      lead: leadId ? { id: leadId, created: leadCreated } : null,
      appointment: {
        id: appointment.id as string,
        scheduled_at: appointment.scheduled_at as string,
        user_id: appointment.user_id as string,
        title: appointment.title as string,
      },
      calendar_user_resolved_via: assigneeResolution.resolvedVia,
    },
  };
}
