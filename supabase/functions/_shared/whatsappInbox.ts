import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { AuthContext } from "./authGuard.ts";
import { assertBranchInTenant } from "./authGuard.ts";

const MANAGE_ROLES = new Set(["admin", "gerente", "jefe_sucursal"]);

export type WhatsAppInboxRow = {
  id: string;
  tenant_id: string | null;
  branch_id: string;
  provider: string;
  provider_phone_number_id: string;
  display_number: string | null;
  waba_id: string | null;
  status: string;
  is_active: boolean;
};

export type WhatsAppInboxWithCredentials = WhatsAppInboxRow & {
  access_token: string;
};

export async function assertCanManageWhatsAppBranch(
  ctx: AuthContext,
  branchId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (ctx.legacyProtected) return { ok: true };

  const role = ctx.role ?? "";
  if (!MANAGE_ROLES.has(role) && role !== "admin") {
    return { ok: false, error: "No tienes permiso para gestionar WhatsApp", status: 403 };
  }

  const { data: profile } = await ctx.supabase
    .from("users")
    .select("branch_id")
    .eq("id", ctx.user.id)
    .maybeSingle();

  const userBranchId = profile?.branch_id ?? null;

  if (role === "admin" || role === "gerente") {
    if (!ctx.tenantId) {
      return { ok: false, error: "Usuario sin tenant", status: 403 };
    }
    const inTenant = await assertBranchInTenant(ctx.supabase, branchId, ctx.tenantId);
    if (!inTenant) {
      return { ok: false, error: "La sucursal no pertenece a tu automotora", status: 403 };
    }
    return { ok: true };
  }

  if (userBranchId !== branchId) {
    return { ok: false, error: "Solo puedes conectar WhatsApp de tu sucursal", status: 403 };
  }

  return { ok: true };
}

export async function findActiveInboxForBranch(
  admin: SupabaseClient,
  branchId: string,
  provider?: "meta" | "ycloud",
): Promise<WhatsAppInboxRow | null> {
  let q = admin
    .from("whatsapp_inboxes")
    .select(
      "id, tenant_id, branch_id, provider, provider_phone_number_id, display_number, waba_id, status, is_active",
    )
    .eq("branch_id", branchId)
    .eq("is_active", true);

  if (provider) q = q.eq("provider", provider);

  const { data } = await q.maybeSingle();
  return (data as WhatsAppInboxRow | null) ?? null;
}

export async function loadTenantYCloudApiKey(
  admin: SupabaseClient,
  tenantId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("tenant_ycloud_config")
    .select("api_key")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  const key = data?.api_key as string | undefined;
  return key?.trim() ? key.trim() : null;
}

export async function loadInboxCredentials(
  admin: SupabaseClient,
  inboxId: string,
): Promise<{ access_token: string } | null> {
  const { data } = await admin
    .from("whatsapp_inbox_credentials")
    .select("access_token")
    .eq("inbox_id", inboxId)
    .maybeSingle();

  if (!data?.access_token) return null;
  return { access_token: data.access_token as string };
}

export async function loadInboxWithCredentials(
  admin: SupabaseClient,
  inboxId: string,
): Promise<WhatsAppInboxWithCredentials | null> {
  const { data: inbox } = await admin
    .from("whatsapp_inboxes")
    .select(
      "id, tenant_id, branch_id, provider, provider_phone_number_id, display_number, waba_id, status, is_active",
    )
    .eq("id", inboxId)
    .eq("is_active", true)
    .maybeSingle();

  if (!inbox) return null;

  const creds = await loadInboxCredentials(admin, inboxId);
  if (!creds) return null;

  return { ...(inbox as WhatsAppInboxRow), access_token: creds.access_token };
}

/** Evita que el mismo phone_number_id quede en dos tenants activos. */
export async function assertPhoneNumberIdAvailable(
  admin: SupabaseClient,
  phoneNumberId: string,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing } = await admin
    .from("whatsapp_inboxes")
    .select("id, tenant_id")
    .eq("provider_phone_number_id", phoneNumberId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing && existing.tenant_id && existing.tenant_id !== tenantId) {
    return {
      ok: false,
      error: "Este número de WhatsApp ya está conectado en otra automotora",
    };
  }

  return { ok: true };
}

export function legacyGlobalWhatsAppEnabled(): boolean {
  return (Deno.env.get("WHATSAPP_LEGACY_GLOBAL_FALLBACK") ?? "").toLowerCase() === "true";
}

export function getLegacyGlobalCredentials(): { accessToken: string; phoneNumberId: string } | null {
  if (!legacyGlobalWhatsAppEnabled()) return null;
  const accessToken = Deno.env.get("META_ACCESS_TOKEN") ?? "";
  const phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID") ?? "";
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}
