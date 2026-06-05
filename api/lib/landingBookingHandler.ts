/**
 * Cita en calendario desde landing (Miami Motors). No crea leads en CRM.
 * Service role — bypass RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { chileLocalToUtcIso } from "./chileDateTime";

/** Miami Motors — Sucursal 1 + calendario miami@motors.cl */
export const LANDING_BRANCH_ID = "caca3351-cefb-4bee-93e7-1398f9eec76d";
export const LANDING_USER_ID = "f42dab10-6dcc-4f99-b169-e679eea0638d";
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

function buildLandingContactNotes(opts: {
  fullName: string;
  phone: string;
  email?: string | null;
  source: string;
  interestNotes: string;
}): string {
  const lines = [`Cliente: ${opts.fullName}`, `Tel: ${opts.phone}`];
  const email = opts.email?.trim();
  if (email) lines.push(`Email: ${email}`);
  lines.push(`Origen: ${opts.source}`);
  if (opts.interestNotes) lines.push(opts.interestNotes);
  return lines.join("\n");
}

export type LandingBookingResult =
  | {
      ok: true;
      status: number;
      body:
        | { ok: true }
        | {
            ok: true;
            appointment: { id: string; scheduled_at: string; user_id: string };
          };
    }
  | { ok: false; status: number; body: { ok: false; error: string } };

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
  const contactNotes = buildLandingContactNotes({
    fullName,
    phone: normalizedPhone,
    email: body.email,
    source: landingSource,
    interestNotes,
  });

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

  const appointmentTitle = `Visita landing · ${fullName}`;
  const appointmentDescription = interestNotes || `Solicitud desde landing (${landingSource})`;

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      lead_id: null,
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
      notes: contactNotes,
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
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
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
