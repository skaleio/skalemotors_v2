/**
 * Lead + cita en calendario (NotHessen / sucursal landing). Service role — bypass RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { chileLocalToUtcIso } from "./chileDateTime";

export const LANDING_BRANCH_ID = "c673d388-6ae0-43b6-99b9-1d62db3692d9";
export const LANDING_USER_ID = "1bad02e7-7888-4cbc-9d79-e4d583401ed0";
const APPOINTMENT_DURATION_MIN = 60;

export type LandingBookingPayload = {
  branch_id?: string;
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

function parseScheduledAt(date: string, time: string, scheduledAtIso?: string): string | null {
  if (scheduledAtIso) {
    const d = new Date(scheduledAtIso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return chileLocalToUtcIso(date, time);
}

export type LandingBookingResult =
  | {
      ok: true;
      status: number;
      body:
        | { ok: true }
        | {
            ok: true;
            lead: { id: string; created: boolean };
            appointment: { id: string; scheduled_at: string; user_id: string };
          };
    }
  | { ok: false; status: number; body: { ok: false; error: string; lead_id?: string } };

/** Cita en calendario tras ingesta n8n si la landing envió date+time al endpoint equivocado. */
export async function maybeCreateAppointmentAfterIngest(
  supabase: SupabaseClient,
  opts: {
    branchId: string;
    leadId: string;
    fullName: string;
    date?: string;
    time?: string;
    notes?: string | null;
    source?: string;
    tenantId: string;
  },
): Promise<{ id: string; scheduled_at: string } | null> {
  if (opts.branchId !== LANDING_BRANCH_ID) return null;
  const date = opts.date?.trim() || "";
  const time = opts.time?.trim() || "";
  const scheduledAt = chileLocalToUtcIso(date, time);
  if (!scheduledAt) return null;

  const endAt = new Date(new Date(scheduledAt).getTime() + APPOINTMENT_DURATION_MIN * 60_000).toISOString();
  const landingSource = opts.source?.trim() || "meta-ads";
  const interestNotes = opts.notes?.trim() || "";
  const appointmentTitle = `Visita landing · ${opts.fullName}`;
  const appointmentDescription = interestNotes || `Solicitud desde landing (${landingSource})`;
  const leadNotes = interestNotes
    ? `Landing ${landingSource}: ${interestNotes}`
    : `Lead desde landing (${landingSource})`;

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      lead_id: opts.leadId,
      user_id: LANDING_USER_ID,
      branch_id: LANDING_BRANCH_ID,
      tenant_id: opts.tenantId,
      type: "reunion",
      status: "programada",
      scheduled_at: scheduledAt,
      end_at: endAt,
      duration_minutes: APPOINTMENT_DURATION_MIN,
      title: appointmentTitle,
      description: appointmentDescription,
      notes: leadNotes,
    })
    .select("id, scheduled_at")
    .single();

  if (error || !appointment) {
    console.error("[landing-booking] ingest-side appointment:", error);
    return null;
  }

  return {
    id: appointment.id as string,
    scheduled_at: appointment.scheduled_at as string,
  };
}

export async function processLandingBooking(
  supabase: SupabaseClient,
  body: LandingBookingPayload,
): Promise<LandingBookingResult> {
  if ((body.company && String(body.company).trim()) || (body.website && String(body.website).trim())) {
    return { ok: true, status: 200, body: { ok: true } };
  }

  const fullNameRaw = (body.full_name ?? body.fullName ?? "").trim();
  const fullName = toTitleCase(fullNameRaw) || "Sin nombre";

  const normalizedPhone = normalizePhoneChile(body.phone?.trim() || "");
  if (!normalizedPhone) {
    return { ok: false, status: 400, body: { ok: false, error: "phone is required (valid Chile format)" } };
  }

  const date = body.date?.trim() || "";
  const time = body.time?.trim() || "";
  const scheduledAt = parseScheduledAt(date, time, body.scheduled_at?.trim());
  if (!scheduledAt) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: "date and time are required (YYYY-MM-DD, HH:mm)" },
    };
  }

  const endAt = new Date(new Date(scheduledAt).getTime() + APPOINTMENT_DURATION_MIN * 60_000).toISOString();
  const landingSource = body.source?.trim() || "meta-ads";
  const interestNotes = body.notes?.trim() || "";
  const leadNotes = interestNotes
    ? `Landing ${landingSource}: ${interestNotes}`
    : `Lead desde landing (${landingSource})`;

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, tenant_id")
    .eq("id", LANDING_BRANCH_ID)
    .maybeSingle();

  if (branchError || !branch) {
    console.error("[landing-booking] branch:", branchError);
    return { ok: false, status: 500, body: { ok: false, error: "Invalid branch configuration" } };
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
    return { ok: false, status: 500, body: { ok: false, error: "Invalid calendar user configuration" } };
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
    return { ok: false, status: 500, body: { ok: false, error: "Internal error finding lead" } };
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updError) {
      console.error("[landing-booking] update lead:", updError);
      return { ok: false, status: 500, body: { ok: false, error: "Internal error updating lead" } };
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
        notes: leadNotes,
        tags: ["meta-ads", "landing"],
      })
      .select("id")
      .single();

    if (insertLeadError || !createdLead) {
      console.error("[landing-booking] insert lead:", insertLeadError);
      return {
        ok: false,
        status: 500,
        body: { ok: false, error: insertLeadError?.message ?? "Could not create lead" },
      };
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
    .select("id, scheduled_at, user_id")
    .single();

  if (apptError || !appointment) {
    console.error("[landing-booking] insert appointment:", apptError);
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: apptError?.message ?? "Could not create appointment",
        lead_id: leadId,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      lead: { id: leadId, created: leadCreated },
      appointment: {
        id: appointment.id as string,
        scheduled_at: appointment.scheduled_at as string,
        user_id: appointment.user_id as string,
      },
    },
  };
}

export function createLandingBookingSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}
