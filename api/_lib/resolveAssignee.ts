import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalUuid(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s && UUID_RE.test(s) ? s : undefined;
}

function pickEmail(...values: unknown[]): string {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim().toLowerCase();
    if (s.includes("@")) return s;
  }
  return "";
}

export type ResolveAssigneeInput = {
  assigned_to?: string | null;
  user_id?: string | null;
  assigned_to_email?: string | null;
  calendar_email?: string | null;
  calendar_user_email?: string | null;
};

export async function resolveAssigneeForBranch(
  supabase: SupabaseClient,
  branchId: string,
  tenantId: string,
  body: ResolveAssigneeInput,
): Promise<{ ok: true; userId: string; resolvedVia: string } | { ok: false; status: number; error: string }> {
  const explicitId = optionalUuid(body.assigned_to) ?? optionalUuid(body.user_id);
  const emailHint = pickEmail(
    body.assigned_to_email,
    body.calendar_email,
    body.calendar_user_email,
  );

  if (explicitId) {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, tenant_id, branch_id, email")
      .eq("id", explicitId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[resolveAssignee] by id:", error);
      return { ok: false, status: 500, error: "Internal error resolving assigned_to" };
    }

    if (user?.id && (!user.tenant_id || user.tenant_id === tenantId)) {
      return { ok: true, userId: user.id as string, resolvedVia: "assigned_to" };
    }
    // UUID de otro tenant (ej. NotHessen con clave Miami) → seguir por email/sucursal
  }

  if (emailHint) {
    const { data: byEmail, error: emailErr } = await supabase
      .from("users")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("email", emailHint)
      .eq("is_active", true)
      .maybeSingle();

    if (emailErr) {
      console.error("[resolveAssignee] by email:", emailErr);
      return { ok: false, status: 500, error: "Internal error resolving calendar user" };
    }
    if (byEmail?.id) {
      return { ok: true, userId: byEmail.id as string, resolvedVia: "assigned_to_email" };
    }
    return {
      ok: false,
      status: 400,
      error: `No active user with email ${emailHint} in this tenant`,
    };
  }

  const envDefault = optionalUuid(process.env.APPOINTMENT_INGEST_DEFAULT_USER_ID);
  if (envDefault) {
    const { data: envUser } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("id", envDefault)
      .eq("is_active", true)
      .maybeSingle();
    if (envUser?.id && (!envUser.tenant_id || envUser.tenant_id === tenantId)) {
      return { ok: true, userId: envUser.id as string, resolvedVia: "env_default" };
    }
  }

  // Usuario de la misma sucursal que la clave API (ej. miami@motors.cl en Sucursal 1)
  const { data: branchUsers, error: branchErr } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("branch_id", branchId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(10);

  if (branchErr) {
    console.error("[resolveAssignee] branch users:", branchErr);
    return { ok: false, status: 500, error: "Internal error resolving branch calendar user" };
  }

  const adminUser = (branchUsers ?? []).find((u) => u.role === "admin");
  if (adminUser?.id) {
    return { ok: true, userId: adminUser.id as string, resolvedVia: "branch_admin" };
  }

  const miamiDefault = (branchUsers ?? []).find((u) =>
    String(u.email ?? "").toLowerCase() === "miami@motors.cl",
  );
  if (miamiDefault?.id) {
    return { ok: true, userId: miamiDefault.id as string, resolvedVia: "branch_miami_default" };
  }

  const first = branchUsers?.[0];
  if (first?.id) {
    return { ok: true, userId: first.id as string, resolvedVia: "branch_first_user" };
  }

  return {
    ok: false,
    status: 400,
    error:
      "assigned_to, assigned_to_email or calendar_email required (user must belong to the API key tenant)",
  };
}
