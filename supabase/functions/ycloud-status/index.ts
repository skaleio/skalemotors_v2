import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/authGuard.ts";
import { findActiveInboxForBranch } from "../_shared/whatsappInbox.ts";
import { ycloudWebhookPublicUrl } from "../_shared/ycloudApi.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PROJECT_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const auth = await requireAuth(req, supabaseUrl, serviceRoleKey);
  if (!auth.ok) return auth.response;

  let branchId: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      branchId = (body.branch_id ?? "").trim() || null;
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
    }
  }

  const admin = auth.ctx.supabase;
  const { data: profile } = await admin
    .from("users")
    .select("branch_id, role, tenant_id")
    .eq("id", auth.ctx.user.id)
    .maybeSingle();

  const userBranchId = profile?.branch_id ?? null;
  const targetBranchId = branchId || userBranchId;

  if (!targetBranchId) {
    return jsonResponse(200, {
      connected: false,
      provider: "ycloud",
      inbox_id: null,
      phone_number_id: null,
      display_number: null,
      webhook_configured: false,
      webhook_url: ycloudWebhookPublicUrl(),
    });
  }

  const role = profile?.role ?? auth.ctx.role;
  if (userBranchId !== targetBranchId && role !== "admin" && role !== "gerente") {
    return jsonResponse(403, { ok: false, error: "No puedes consultar otra sucursal" });
  }

  const inbox = await findActiveInboxForBranch(admin, targetBranchId, "ycloud");
  const tenantId = inbox?.tenant_id ?? profile?.tenant_id ?? auth.ctx.tenantId;

  let webhookConfigured = false;
  if (tenantId) {
    const { data: cfg } = await admin
      .from("tenant_ycloud_config")
      .select("webhook_secret, ycloud_webhook_endpoint_id, status")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    webhookConfigured = Boolean(
      cfg?.status === "active" &&
        cfg?.webhook_secret &&
        cfg?.ycloud_webhook_endpoint_id,
    );
  }

  const connected = Boolean(inbox?.status === "active" && inbox?.is_active);

  return jsonResponse(200, {
    connected,
    provider: "ycloud",
    inbox_id: inbox?.id ?? null,
    phone_number_id: connected ? inbox?.provider_phone_number_id ?? null : null,
    display_number: inbox?.display_number ?? null,
    webhook_configured: webhookConfigured,
    webhook_url: ycloudWebhookPublicUrl(),
  });
}

Deno.serve((req) => handler(req));
