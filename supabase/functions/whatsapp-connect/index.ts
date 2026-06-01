import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/authGuard.ts";
import {
  assertCanManageWhatsAppBranch,
  assertPhoneNumberIdAvailable,
} from "../_shared/whatsappInbox.ts";
import { validateWhatsAppPhoneNumber } from "../_shared/whatsappMeta.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

type ConnectBody = {
  branch_id?: string;
  access_token?: string;
  phone_number_id?: string;
  waba_id?: string;
  display_number?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PROJECT_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const auth = await requireAuth(req, supabaseUrl, serviceRoleKey);
  if (!auth.ok) return auth.response;

  let body: ConnectBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const branchId = (body.branch_id ?? "").trim();
  const accessToken = (body.access_token ?? "").trim();
  const phoneNumberId = (body.phone_number_id ?? "").trim();
  const wabaId = (body.waba_id ?? "").trim() || null;

  if (!branchId) return jsonResponse(400, { ok: false, error: "branch_id is required" });
  if (!accessToken) return jsonResponse(400, { ok: false, error: "access_token is required" });
  if (!phoneNumberId) {
    return jsonResponse(400, { ok: false, error: "phone_number_id is required (Meta Phone Number ID)" });
  }

  const perm = await assertCanManageWhatsAppBranch(auth.ctx, branchId);
  if (!perm.ok) return jsonResponse(perm.status, { ok: false, error: perm.error });

  const admin = auth.ctx.supabase;

  const { data: branch } = await admin
    .from("branches")
    .select("id, tenant_id")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch?.tenant_id) {
    return jsonResponse(404, { ok: false, error: "Sucursal no encontrada" });
  }

  if (!auth.ctx.legacyProtected && auth.ctx.tenantId && branch.tenant_id !== auth.ctx.tenantId) {
    return jsonResponse(403, { ok: false, error: "La sucursal no pertenece a tu automotora" });
  }

  const phoneAvail = await assertPhoneNumberIdAvailable(admin, phoneNumberId, branch.tenant_id);
  if (!phoneAvail.ok) return jsonResponse(409, { ok: false, error: phoneAvail.error });

  const validation = await validateWhatsAppPhoneNumber(accessToken, phoneNumberId);
  if (!validation.ok) {
    return jsonResponse(400, { ok: false, error: validation.error ?? "Token o Phone Number ID inválidos" });
  }

  const displayNumber =
    (body.display_number ?? "").trim() ||
    validation.display_phone_number ||
    null;

  // Desactivar inbox previo de la sucursal
  await admin
    .from("whatsapp_inboxes")
    .update({ is_active: false, status: "disconnected", updated_at: new Date().toISOString() })
    .eq("branch_id", branchId)
    .eq("is_active", true);

  const { data: inbox, error: inboxErr } = await admin
    .from("whatsapp_inboxes")
    .insert({
      tenant_id: branch.tenant_id,
      branch_id: branchId,
      provider: "meta",
      provider_phone_number_id: phoneNumberId,
      display_number: displayNumber,
      waba_id: wabaId,
      status: "active",
      last_error: null,
      connected_by: auth.ctx.user.id,
      connected_at: new Date().toISOString(),
      is_active: true,
    })
    .select("id")
    .single();

  if (inboxErr || !inbox?.id) {
    return jsonResponse(500, { ok: false, error: inboxErr?.message ?? "No se pudo crear el inbox" });
  }

  const { error: credErr } = await admin.from("whatsapp_inbox_credentials").upsert(
    {
      inbox_id: inbox.id,
      access_token: accessToken,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "inbox_id" },
  );

  if (credErr) {
    await admin.from("whatsapp_inboxes").delete().eq("id", inbox.id);
    return jsonResponse(500, { ok: false, error: credErr.message });
  }

  return jsonResponse(200, {
    ok: true,
    message: "WhatsApp conectado correctamente",
    inbox_id: inbox.id,
    phone_number_id: phoneNumberId,
    display_number: displayNumber,
    verified_name: validation.verified_name ?? null,
  });
}

Deno.serve((req) => handler(req));
